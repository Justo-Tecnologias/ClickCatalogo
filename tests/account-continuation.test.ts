import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  decideAccountContinuationState,
  type ContinuationSnapshot,
} from "../src/lib/signup/continuation-state";

const now = Date.parse("2026-09-12T18:00:00.000Z");
const base: ContinuationSnapshot = {
  checkoutCreationStartedAt: null,
  checkoutExpiresAt: null,
  checkoutReturnedAt: null,
  checkoutUrl: null,
  hasIntent: true,
  hasTenant: false,
  intentStatus: "pendente",
  ownerHasPassword: false,
  reconciliationStatus: null,
  reactivationRequestedAt: null,
  slug: null,
  tenantStatus: null,
};

test("roteador cobre contratação, conta pronta, cancelamento e expurgo", () => {
  assert.equal(decideAccountContinuationState({ ...base, hasIntent: false }, now).type, "TERMINAL");
  assert.equal(decideAccountContinuationState({
    ...base,
    hasTenant: true,
    intentStatus: "pago",
    slug: "loja-segura",
    tenantStatus: "ativo",
  }, now).type, "PAID_NEEDS_PASSWORD");
  assert.equal(decideAccountContinuationState({
    ...base,
    hasTenant: true,
    intentStatus: "pago",
    ownerHasPassword: true,
    slug: "loja-segura",
    tenantStatus: "ativo",
  }, now).type, "ACCOUNT_READY");
  assert.equal(decideAccountContinuationState({
    ...base,
    hasTenant: true,
    intentStatus: "pago",
    ownerHasPassword: true,
    slug: "loja-segura",
    tenantStatus: "cancelado",
  }, now).type, "CANCELED_RETAINED");
  assert.equal(decideAccountContinuationState({
    ...base,
    hasTenant: true,
    intentStatus: "pago",
    ownerHasPassword: true,
    reconciliationStatus: "pending",
    slug: "loja-segura",
    tenantStatus: "cancelado",
  }, now).type, "REACTIVATION_PENDING");
});

test("checkout válido é reutilizado e checkout expirado pode ser reiniciado", () => {
  const pending = decideAccountContinuationState({
    ...base,
    checkoutExpiresAt: "2026-09-12T18:30:00.000Z",
    checkoutUrl: "https://asaas.com/checkoutSession/show/seguro",
  }, now);
  assert.deepEqual(pending, {
    checkoutUrl: "https://asaas.com/checkoutSession/show/seguro",
    type: "CHECKOUT_PENDING",
  });
  assert.equal(decideAccountContinuationState({
    ...base,
    checkoutExpiresAt: "2026-09-12T17:30:00.000Z",
    checkoutUrl: "https://asaas.com/checkoutSession/show/expirado",
  }, now).type, "CHECKOUT_RESTARTABLE");
  assert.equal(decideAccountContinuationState({
    ...base,
    checkoutExpiresAt: "2026-09-12T18:30:00.000Z",
    checkoutUrl: "https://site-malicioso.example/checkout",
  }, now).type, "CHECKOUT_RESTARTABLE");
});

test("retorno visual recente aguarda webhook e nunca confirma pagamento", () => {
  assert.equal(decideAccountContinuationState({
    ...base,
    checkoutExpiresAt: "2026-09-12T18:30:00.000Z",
    checkoutReturnedAt: "2026-09-12T17:55:00.000Z",
    checkoutUrl: "https://asaas.com/checkoutSession/show/ainda-ativo",
  }, now).type, "PAYMENT_CONFIRMING");
  assert.equal(decideAccountContinuationState({
    ...base,
    checkoutReturnedAt: "2026-09-12T16:00:00.000Z",
  }, now).type, "CHECKOUT_RESTARTABLE");
});

test("ações sensíveis revalidam estado e primeira senha não substitui senha existente", async () => {
  const [restartRoute, passwordRoute, returnRoute] = await Promise.all([
    readFile(new URL("../src/app/api/cadastro/continuar-checkout/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/cadastro/definir-senha/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/cadastro/checkout-retornado/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(restartRoute, /resolveAccountContinuationState/);
  assert.match(restartRoute, /claim_signup_checkout_restart/);
  assert.match(restartRoute, /eq\("checkout_creation_started_at", claimedAt\)/);
  assert.match(passwordRoute, /catalogoja_password_configured_at/);
  assert.match(passwordRoute, /owner\.user\.email\?\.trim\(\)\.toLowerCase\(\)/);
  assert.doesNotMatch(returnRoute, /status:\s*"pago"/);
});

test("solicitação pública não enumera e token segue no fragmento", async () => {
  const source = await readFile(new URL("../src/app/api/cadastro/recuperar/route.ts", import.meta.url), "utf8");
  assert.match(source, /GENERIC_RESPONSE/);
  assert.match(source, /\/painel\/acessar-loja\/confirmar#token=/);
  assert.match(source, /\.is\("consumed_at", null\)/);
  assert.doesNotMatch(source, /e-mail não encontrado/i);
});
