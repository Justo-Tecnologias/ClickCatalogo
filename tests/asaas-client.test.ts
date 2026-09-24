import assert from "node:assert/strict";
import test from "node:test";

import {
  recurringCheckoutPayload,
  subscriptionStatusPayload,
} from "../src/lib/asaas/contracts";
import { classifySubscriptionUpdateResponse } from "../src/lib/asaas/subscription-update-outcome";

test("checkout recorrente usa apenas cartão e o contrato mensal esperado", () => {
  const body = recurringCheckoutPayload({
    cancelUrl: "https://clickcatalogo.com/cadastro?ref=teste",
    description: "Catálogo digital com pedidos pelo WhatsApp",
    externalReference: "11111111-1111-4111-8111-111111111111",
    name: "Assinatura ClickCatálogo",
    nextDueDate: "2026-09-10",
    successUrl: "https://clickcatalogo.com/cadastro/sucesso?ref=teste",
    value: 27,
  });

  assert.deepEqual(body.billingTypes, ["CREDIT_CARD"]);
  assert.deepEqual(body.chargeTypes, ["RECURRENT"]);
  assert.equal(body.subscription.cycle, "MONTHLY");
  assert.equal(body.items[0].value, 27);
});

test("cancelamento novo gera inativação reversível", () => {
  assert.deepEqual(subscriptionStatusPayload("INACTIVE"), { status: "INACTIVE" });
});

test("desfazer cancelamento reativa na data final já paga", () => {
  assert.deepEqual(subscriptionStatusPayload("ACTIVE", "2026-10-10"), {
    nextDueDate: "2026-10-10",
    status: "ACTIVE",
  });
});

test("resposta inconclusiva do Asaas não é tratada como rejeição segura para repetição", () => {
  assert.equal(classifySubscriptionUpdateResponse(200), "updated");
  assert.equal(classifySubscriptionUpdateResponse(400), "rejected");
  assert.equal(classifySubscriptionUpdateResponse(404), "deleted");
  assert.equal(classifySubscriptionUpdateResponse(500), "unknown");
  assert.equal(classifySubscriptionUpdateResponse(503), "unknown");
});
