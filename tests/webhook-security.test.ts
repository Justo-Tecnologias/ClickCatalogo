import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { secretsMatch } from "../src/lib/security/secret";

test("token correto do webhook é aceito", () => {
  const token = "9f4a93a8733f97ef6fc9248193241f91";
  assert.equal(secretsMatch(token, token), true);
});

test("webhook registra duração sem expor payloads", async () => {
  const source = await readFile(new URL("../src/app/api/webhooks/asaas/route.ts", import.meta.url), "utf8");
  assert.match(source, /duration_ms: Math\.round\(performance\.now\(\) - startedAt\)/);
  // Restringe a busca à própria chamada de log (até o fim do comando).
  assert.doesNotMatch(source, /log(?:Info|Error)\([^;]*?payload:/);
});

test("auditoria exige eventos de recuperação financeira", async () => {
  const source = await readFile(new URL("../scripts/audit-asaas.mjs", import.meta.url), "utf8");
  assert.match(source, /"PAYMENT_DELETED"/);
  assert.match(source, /"SUBSCRIPTION_UPDATED"/);
});

test("eventos antigos não desfazem cancelamento agendado nem reativação concluída", async () => {
  const source = await readFile(new URL("../src/app/api/webhooks/asaas/route.ts", import.meta.url), "utf8");
  assert.match(source, /scheduledCancellationStillHasAccess\(existing\)\) return true/);
  assert.match(source, /intent\.provisioned_tenant_id[\s\S]*scheduledCancellationStillHasAccess\(currentSubscription\)/);
  assert.match(source, /state === "inactive" && !existing\.cancel_at_period_end/);
});

test("webhook localiza usuário por e-mail antes de recorrer à paginação completa", async () => {
  const source = await readFile(new URL("../src/app/api/webhooks/asaas/route.ts", import.meta.url), "utf8");
  const schema = (await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8")).toLowerCase();

  assert.match(source, /rpc\("find_auth_user_id_by_email"[\s\S]*?if \(!lookupError\) return[\s\S]*?listUsers/);
  assert.match(schema, /create or replace function public\.find_auth_user_id_by_email\(p_email text\)/);
  assert.match(
    schema,
    /revoke all on function public\.find_auth_user_id_by_email\(text\) from public, anon, authenticated;\s+grant execute on function public\.find_auth_user_id_by_email\(text\) to service_role;/,
  );
});

test("token ausente, alterado ou com tamanho diferente é rejeitado", () => {
  const expected = "9f4a93a8733f97ef6fc9248193241f91";

  assert.equal(secretsMatch(null, expected), false);
  assert.equal(secretsMatch(`${expected}x`, expected), false);
  assert.equal(secretsMatch("8f4a93a8733f97ef6fc9248193241f91", expected), false);
});
