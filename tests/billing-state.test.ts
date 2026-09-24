import assert from "node:assert/strict";
import test from "node:test";

import {
  canRevertScheduledCancellation,
  overdueEventIsOlder,
  scheduledAccessIsActive,
} from "../src/lib/billing/state";
import { brazilDateFromIso, brazilDateStartAsIso, lastPaidAccessInstant } from "../src/lib/billing/access-period";
import { subscriptionSituation, subscriptionViewState } from "../src/lib/billing/subscription-view";

test("preserva acesso somente durante o período pago", () => {
  const now = Date.parse("2026-09-10T12:00:00Z");
  assert.equal(scheduledAccessIsActive({ accessUntil: "2026-09-11T03:00:00Z", cancelAtPeriodEnd: true }, now), true);
  assert.equal(scheduledAccessIsActive({ accessUntil: "2026-09-10T03:00:00Z", cancelAtPeriodEnd: true }, now), false);
  assert.equal(scheduledAccessIsActive({ accessUntil: "2026-09-11T03:00:00Z", cancelAtPeriodEnd: false }, now), false);
});

test("desfaz cancelamento apenas antes do fim do período", () => {
  const now = Date.parse("2026-09-10T12:00:00Z");
  assert.equal(canRevertScheduledCancellation({ accessUntil: "2026-10-10T03:00:00Z", cancelAtPeriodEnd: true }, now), true);
  assert.equal(canRevertScheduledCancellation({ accessUntil: null, cancelAtPeriodEnd: true }, now), false);
});

test("ignora evento de atraso anterior à renovação conhecida", () => {
  assert.equal(overdueEventIsOlder("2026-08-10", "2026-09-10"), true);
  assert.equal(overdueEventIsOlder("2026-09-10", "2026-09-10"), false);
  assert.equal(overdueEventIsOlder(null, "2026-09-10"), false);
});

test("converte o início do dia brasileiro sem deslocar a data", () => {
  const iso = brazilDateStartAsIso("2026-09-10");
  assert.equal(brazilDateFromIso(iso), "2026-09-10");
});

test("último dia de acesso é a véspera do início do próximo período", () => {
  const lastInstant = lastPaidAccessInstant("2026-11-10T03:00:00Z");
  assert.equal(brazilDateFromIso(lastInstant.toISOString()), "2026-11-09");
});

test("apresentação distingue acesso ativo, cancelamento pendente, período pago e fim do acesso", () => {
  const now = Date.parse("2026-09-10T12:00:00Z");
  const base = {
    accessUntil: "2026-10-10T03:00:00Z",
    cancelAtPeriodEnd: false,
    reconciliationStatus: "not_required" as const,
    reactivationRequestedAt: null,
    status: "ativo" as const,
  };
  assert.equal(subscriptionViewState(base, now), "active");
  assert.equal(subscriptionViewState({ ...base, status: "atrasado" }, now), "past_due");
  assert.equal(subscriptionViewState({ ...base, cancelAtPeriodEnd: true, reconciliationStatus: "processing" }, now), "cancelling");
  assert.equal(subscriptionViewState({ ...base, cancelAtPeriodEnd: true, reconciliationStatus: "complete" }, now), "cancelled_with_access");
  assert.equal(subscriptionViewState({ ...base, cancelAtPeriodEnd: true, reconciliationStatus: "complete", reactivationRequestedAt: "2026-09-10T11:00:00Z" }, now), "resuming");
  assert.equal(subscriptionViewState({ ...base, cancelAtPeriodEnd: true, reconciliationStatus: "complete" }, Date.parse("2026-10-10T03:00:00Z")), "ending");
  assert.equal(subscriptionViewState({ ...base, cancelAtPeriodEnd: true, reconciliationStatus: "complete", status: "cancelado" }, now), "ended");
});

test("interface reduz estados técnicos a três situações confirmadas", () => {
  assert.equal(subscriptionSituation("active"), "active");
  assert.equal(subscriptionSituation("past_due"), "active");
  assert.equal(subscriptionSituation("cancelling"), "active");
  assert.equal(subscriptionSituation("cancelled_with_access"), "cancelled");
  assert.equal(subscriptionSituation("resuming"), "cancelled");
  assert.equal(subscriptionSituation("ending"), "cancelled");
  assert.equal(subscriptionSituation("ended"), "ended");
});
