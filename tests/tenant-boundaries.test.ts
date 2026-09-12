import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function source(relativePath: string) {
  return readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

test("ações mutáveis do painel derivam o tenant da sessão e restringem gravações", async () => {
  for (const path of [
    "src/app/painel/(app)/categorias/actions.ts",
    "src/app/painel/(app)/produtos/actions.ts",
    "src/app/painel/(app)/loja/actions.ts",
    "src/app/painel/(app)/assinatura/actions.ts",
    "src/app/painel/(app)/privacidade/actions.ts",
  ]) {
    const contents = await source(path);
    assert.match(contents, /requireTenant\(\)/, `${path} precisa derivar o tenant da sessão`);
    assert.match(contents, /tenant\.id/, `${path} precisa restringir a operação ao tenant autenticado`);
  }
});

test("criação de senha encadeia referência paga, tenant provisionado e usuário titular", async () => {
  const contents = await source("src/app/api/cadastro/definir-senha/route.ts");
  assert.match(contents, /SIGNUP_RESUME_COOKIE_NAME/);
  assert.match(contents, /\.eq\("external_reference", parsed\.data\.reference\)/);
  assert.match(contents, /intent\.status !== "pago"/);
  assert.match(contents, /\.eq\("id", intent\.provisioned_tenant_id\)/);
  assert.match(contents, /getUserById\(tenant\.owner_user_id\)/);
});

test("recuperação consome token por RPC atômica", async () => {
  const contents = await source("src/app/api/cadastro/recuperar/confirmar/route.ts");
  assert.match(contents, /rpc\("consume_signup_recovery_token"/);
  assert.doesNotMatch(contents, /\.from\("signup_recovery_tokens"\)\.update/);
});

test("rotina horária reconcilia antes de finalizar o acesso", async () => {
  const contents = await source("netlify/functions/finalize-subscription-cancellations.mjs");
  assert.match(contents, /claim_subscription_cancellation_reconciliations/);
  assert.match(contents, /cancellation_reconciliation_status: "eq\.processing"/);
  assert.match(contents, /RECONCILIATION_TIME_BUDGET_MS/);
  assert.match(contents, /status: "INACTIVE"/);
  assert.match(contents, /status\) params\.set\("status", status\)/);
  assert.match(contents, /method: "DELETE"/);
  assert.match(contents, /await listSubscriptionPayments\(env, subscriptionId, undefined, deadline\)/);
  assert.match(contents, /if \(!inactivation\.ok\) throw new Error/);
  assert.doesNotMatch(contents, /inactivation\.status === 404 \? "deleted"/);
  assert.match(contents, /"attention"/);
  assert.ok(
    contents.indexOf("retryPendingReconciliations") < contents.indexOf("finalizeExpiredAccess(env)"),
    "a conciliação deve ocorrer antes da finalização local",
  );
});

test("listagem financeira percorre páginas completas de até cem cobranças", async () => {
  const contents = await source("src/lib/asaas/client.ts");
  assert.match(contents, /const limit = 100/);
  assert.match(contents, /offset \+= limit/);
  assert.match(contents, /parsed\.data\.hasMore/);
});

test("desfazer cancelamento e agendador compartilham trava de processamento", async () => {
  const actions = await source("src/app/painel/(app)/assinatura/actions.ts");
  const scheduled = await source("netlify/functions/finalize-subscription-cancellations.mjs");
  assert.match(actions, /cancellation_reconciliation_status === "processing"/);
  assert.match(actions, /neq\("cancellation_reconciliation_status", "processing"\)/);
  assert.match(scheduled, /rpc\/claim_subscription_cancellation_reconciliations/);
  assert.match(scheduled, /reactivation_requested_at: "is\.null"/);
});
