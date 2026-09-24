import assert from "node:assert/strict";
import test from "node:test";

import {
  authoritativePaidThroughDate,
  selectFuturePendingSubscriptionPayments,
  selectSubscriptionPaymentsAtOrAfter,
} from "../src/lib/asaas/payments";

test("período pago usa a última cobrança liquidada, não o nextDueDate remoto", () => {
  const payments = [
    { billingType: "CREDIT_CARD", dueDate: "2026-09-10", id: "paid", status: "CONFIRMED", subscription: "sub_current" },
    { dueDate: "2026-10-10", id: "renewal", status: "PENDING", subscription: "sub_current" },
  ];

  assert.equal(authoritativePaidThroughDate(payments, "sub_current", "2026-11-10"), "2026-10-10");
  assert.deepEqual(
    selectFuturePendingSubscriptionPayments(payments, "sub_current", "2026-10-10")
      .map((payment) => payment.id),
    ["renewal"],
  );
});

test("período pago considera cartão liquidado mais recente e a fronteira remota", () => {
  assert.equal(authoritativePaidThroughDate([
    { billingType: "CREDIT_CARD", dueDate: "2026-08-10", id: "old", status: "RECEIVED", subscription: "sub_current" },
    { billingType: "CREDIT_CARD", dueDate: "2026-09-10", id: "latest", status: "CONFIRMED", subscription: "sub_current" },
    { billingType: "CREDIT_CARD", dueDate: "2026-12-10", id: "other", status: "CONFIRMED", subscription: "sub_other" },
  ], "sub_current", "2026-10-10"), "2026-10-10");
});

test("fim do mês usa a próxima fronteira autoritativa do Asaas", () => {
  assert.equal(authoritativePaidThroughDate([
    { billingType: "CREDIT_CARD", dueDate: "2027-01-31", id: "paid", status: "CONFIRMED" },
    { billingType: "CREDIT_CARD", dueDate: "2027-02-28", id: "generated", status: "PENDING" },
  ], "sub_current", "2027-03-31"), "2027-02-28");
  assert.equal(authoritativePaidThroughDate([
    { billingType: "CREDIT_CARD", dueDate: "2028-01-31", id: "paid", status: "RECEIVED" },
  ], "sub_current", "2028-02-29"), "2028-02-29");
});

test("cancelamento seguro exige ao menos uma cobrança liquidada", () => {
  assert.throws(
    () => authoritativePaidThroughDate([
      { billingType: "CREDIT_CARD", dueDate: "2026-10-10", id: "pending", status: "PENDING" },
    ], "sub_current", "2026-11-10"),
    /Nenhuma cobrança paga/,
  );
});

test("recebimento manual e negativação não comprovam mensalidade de cartão", () => {
  assert.throws(() => authoritativePaidThroughDate([
    { billingType: "RECEIVED_IN_CASH", dueDate: "2026-09-10", id: "cash", status: "RECEIVED" },
    { billingType: "BOLETO", dueDate: "2026-09-10", id: "dunning", status: "DUNNING_RECEIVED" },
  ], "sub_current", "2026-10-10"), /Nenhuma cobrança paga/);
});

test("assinatura excluída usa um ciclo mensal a partir da última cobrança paga", () => {
  assert.equal(authoritativePaidThroughDate([
    { billingType: "CREDIT_CARD", dueDate: "2026-09-10", id: "paid", status: "CONFIRMED" },
  ], "sub_current", "2026-09-10"), "2026-10-10");
});

test("próxima data remota que pula um mês não concede acesso sem pagamento", () => {
  const paid = { billingType: "CREDIT_CARD", dueDate: "2026-09-10", id: "paid", status: "CONFIRMED", subscription: "sub_current" };
  assert.equal(authoritativePaidThroughDate([paid], "sub_current", "2026-11-10"), "2026-10-10");
  assert.equal(authoritativePaidThroughDate([
    paid,
    { dueDate: "2026-11-10", id: "future", status: "PENDING", subscription: "sub_current" },
  ], "sub_current", "2026-11-10"), "2026-10-10");
});

test("conciliação remove somente cobranças pendentes do período futuro da assinatura correta", () => {
  const selected = selectFuturePendingSubscriptionPayments([
    { dueDate: "2026-09-30", id: "before", status: "PENDING", subscription: "sub_current" },
    { dueDate: "2026-10-01", id: "cutoff", status: "PENDING", subscription: "sub_current" },
    { dueDate: "2026-11-01", id: "future", status: "PENDING", subscription: "sub_current" },
    { dueDate: "2026-11-01", id: "overdue", status: "OVERDUE", subscription: "sub_current" },
    { dueDate: "2026-11-01", id: "confirmed", status: "CONFIRMED", subscription: "sub_current" },
    { dueDate: "2026-11-01", id: "received", status: "RECEIVED", subscription: "sub_current" },
    { dueDate: "2026-11-01", id: "other", status: "PENDING", subscription: "sub_other" },
    { dueDate: "invalid", id: "invalid-date", status: "PENDING", subscription: "sub_current" },
  ], "sub_current", "2026-10-01");

  assert.deepEqual(selected.map((payment) => payment.id), ["cutoff", "future"]);
});

test("conciliação rejeita uma data de corte inválida", () => {
  assert.throws(
    () => selectFuturePendingSubscriptionPayments([], "sub_current", "01/10/2026"),
    /Data de corte inválida/,
  );
  assert.throws(
    () => selectFuturePendingSubscriptionPayments([], "sub_current", "2026-99-99"),
    /Data de corte inválida/,
  );
});

test("pós-condição encontra qualquer cobrança remanescente após o corte", () => {
  const remaining = selectSubscriptionPaymentsAtOrAfter([
    { dueDate: "2026-10-01", id: "race", status: "CONFIRMED", subscription: "sub_current" },
    { dueDate: "2026-11-01", id: "overdue", status: "OVERDUE", subscription: "sub_current" },
    { dueDate: "2026-11-01", id: "other", status: "PENDING", subscription: "sub_other" },
  ], "sub_current", "2026-10-01");

  assert.deepEqual(remaining.map((payment) => payment.id), ["race", "overdue"]);
});
