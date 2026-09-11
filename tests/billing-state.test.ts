import assert from "node:assert/strict";
import test from "node:test";

import {
  canRevertScheduledCancellation,
  overdueEventIsOlder,
  scheduledAccessIsActive,
} from "../src/lib/billing/state";
import { brazilDateFromIso, brazilDateStartAsIso } from "../src/lib/billing/access-period";

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
