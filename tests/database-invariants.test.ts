import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaPath = new URL("../supabase/schema.sql", import.meta.url);
const slugGrantMigrationPath = new URL(
  "../supabase/migrations/202609300023_restrict_tenant_slug_update.sql",
  import.meta.url,
);

function tenantUpdateColumns(sql: string) {
  const grants = [...sql.matchAll(/grant update \(([^)]*)\) on table public\.tenants to authenticated/g)];
  return grants.map((grant) => grant[1].split(",").map((column) => column.trim()));
}

test("lista de métricas do banco é igual à do código", async () => {
  const { productMetricNames } = await import("../src/lib/analytics/events");
  const schema = await readFile(schemaPath, "utf8");
  const migration = await readFile(
    new URL("../supabase/migrations/202610020029_free_draft_signup.sql", import.meta.url),
    "utf8",
  );
  const expected = [...productMetricNames].sort();

  for (const sql of [schema, migration]) {
    const constraint = sql.match(/product_metrics_daily_event_check check \(\s*event_name in \(([^)]*)\)/);
    const fn = sql.match(/if p_event_name not in \(([^)]*)\)/);
    assert.ok(constraint && fn);
    for (const list of [constraint[1], fn[1]]) {
      assert.deepEqual([...list.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort(), expected);
    }
  }
});

test("funções SQL mantêm delimitadores $$ íntegros", async () => {
  const schema = await readFile(schemaPath, "utf8");
  assert.doesNotMatch(schema, /^as \$\r?$/m);
  assert.equal((schema.match(/\$\$/g) ?? []).length % 2, 0);
});

test("slug do tenant só muda pela RPC change_tenant_slug", async () => {
  const schema = (await readFile(schemaPath, "utf8")).toLowerCase();
  const migration = (await readFile(slugGrantMigrationPath, "utf8")).toLowerCase();

  for (const sql of [schema, migration]) {
    const grants = tenantUpdateColumns(sql);
    assert.equal(grants.length, 1);
    assert.ok(!grants[0].includes("slug"));
    assert.ok(grants[0].includes("nome_loja"));
  }
  assert.doesNotMatch(schema, /grant update on table public\.tenants/);
  assert.match(migration, /revoke update on table public\.tenants from authenticated/);
  assert.match(schema, /update public\.tenants set slug = v_new_slug where id = v_tenant\.id/);
});

test("schema preserva isolamento, unicidade e idempotência financeira", async () => {
  const sql = (await readFile(schemaPath, "utf8")).toLowerCase();

  assert.match(sql, /create unique index tenants_owner_user_id_unique_idx/);
  assert.match(sql, /create unique index subscriptions_one_current_per_tenant_idx/);
  assert.match(sql, /event_id text primary key/);
  assert.match(sql, /cancellation_reconciliation_status in \('not_required', 'pending', 'processing', 'complete', 'attention'\)/);
  assert.match(sql, /claim_subscription_cancellation_reconciliations/);
  assert.match(sql, /for update skip locked/);
  assert.match(sql, /alter table public\.tenants enable row level security/);
  assert.match(sql, /alter table public\.categories enable row level security/);
  assert.match(sql, /alter table public\.products enable row level security/);
  assert.match(sql, /alter table public\.subscriptions enable row level security/);
  assert.match(sql, /tenants\.id::text = \(storage\.foldername\(name\)\)\[1\]/);
  assert.match(sql, /set search_path = ''/);
  assert.match(sql, /checkout_creation_started_at timestamptz/);
  assert.match(sql, /checkout_returned_at timestamptz/);
  assert.match(sql, /create or replace function public\.claim_signup_checkout_restart/);
  assert.match(sql, /where intent\.external_reference = p_external_reference\s+for update/);
  assert.match(sql, /create table public\.tenant_slug_history/);
  assert.match(sql, /create or replace function public\.change_tenant_slug/);
  assert.match(sql, /create or replace function public\.resolve_public_store_slug/);
  assert.match(sql, /redirect_until > clock_timestamp\(\)/);
  assert.match(sql, /v_active_aliases >= 3/);
  assert.match(sql, /create or replace function public\.get_own_tenant_redirect_slugs/);
});

test("recuperação é atômica e não persiste token bruto", async () => {
  const sql = (await readFile(schemaPath, "utf8")).toLowerCase();

  assert.match(sql, /token_hash text not null unique/);
  assert.doesNotMatch(sql, /raw_token/);
  assert.match(sql, /recovery\.consumed_at is null/);
  assert.match(sql, /recovery\.expires_at > clock_timestamp\(\)/);
  assert.match(sql, /grant execute on function public\.consume_signup_recovery_token\(text\)\s+to service_role/);
});

test("finaliza acesso vencido mesmo se a rotina externa atrasar", async () => {
  const sql = (await readFile(schemaPath, "utf8")).toLowerCase();

  assert.match(sql, /subscription\.access_until <= now\(\)/);
  assert.match(sql, /cancellation_reconciliation_status = 'complete'\s+and access_until <= coalesce/);
  assert.match(sql, /cancellation_reconciliation_status = 'complete'\s+and access_until <= coalesce\(p_now, clock_timestamp\(\)\)\s+and reactivation_requested_at is null/);
  assert.match(sql, /intent\.target_tenant_id = request\.tenant_id_original/);
  assert.match(sql, /intent\.intent_type = 'reactivation'/);
});

test("todas as funções security definer fixam search_path e claim tem grant mínimo", async () => {
  const sql = (await readFile(schemaPath, "utf8")).toLowerCase();
  const functions = sql.match(/create or replace function[\s\S]*?\$\$;/g) ?? [];
  const privileged = functions.filter((definition) => definition.includes("security definer"));
  assert.ok(privileged.length > 0);
  for (const definition of privileged) {
    assert.match(definition, /set search_path = ''/);
  }
  assert.match(
    sql,
    /revoke all on function public\.claim_subscription_cancellation_reconciliations\(integer\)\s+from public, anon, authenticated/,
  );
  assert.match(
    sql,
    /grant execute on function public\.claim_subscription_cancellation_reconciliations\(integer\)\s+to service_role/,
  );
  assert.match(
    sql,
    /revoke all on function public\.claim_signup_checkout_restart\(uuid, integer\)\s+from public, anon, authenticated/,
  );
  assert.match(
    sql,
    /grant execute on function public\.claim_signup_checkout_restart\(uuid, integer\)\s+to service_role/,
  );
});
