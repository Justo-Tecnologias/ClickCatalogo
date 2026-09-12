import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const schemaPath = new URL("../supabase/schema.sql", import.meta.url);

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
  assert.match(sql, /reactivation_requested_at is null\s+or reactivation_requested_at < coalesce/);
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
});
