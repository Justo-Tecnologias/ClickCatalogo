import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { overdueNoticeEmail } from "../src/lib/billing/overdue-emails.mjs";
import {
  addDays,
  brazilToday,
  dueOverdueNotice,
  officialAsaasInvoiceUrl,
  overdueDay,
  overdueMilestones,
  overduePhase,
  overdueSituation,
} from "../src/lib/billing/overdue-policy.mjs";

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("dias de atraso seguem o calendário de São Paulo", () => {
  assert.equal(brazilToday(new Date("2026-10-01T02:30:00Z")), "2026-09-30");
  assert.equal(brazilToday(new Date("2026-10-01T03:30:00Z")), "2026-10-01");
  assert.equal(overdueDay("2026-09-30", "2026-09-30"), 0);
  assert.equal(overdueDay("2026-09-30", "2026-10-01"), 1);
  assert.equal(overdueDay("2026-01-31", "2026-03-02"), 30);
  assert.equal(addDays("2026-02-27", 2), "2026-03-01");
  assert.throws(() => overdueDay("2026-02-30", "2026-03-01"));
});

test("loja fica no ar até o 7º dia, sai no 8º e encerra no 30º", () => {
  assert.equal(overduePhase(0), "online");
  assert.equal(overduePhase(7), "online");
  assert.equal(overduePhase(8), "suspended");
  assert.equal(overduePhase(29), "suspended");
  assert.equal(overduePhase(30), "cancellation_due");
  assert.deepEqual(overdueMilestones("2026-10-10"), {
    cancellationDate: "2026-11-09",
    lastOnlineDate: "2026-10-17",
    suspensionDate: "2026-10-18",
  });
});

test("avisos saem nos dias 1, 6 e 25, uma vez, sem repetir atrasados", () => {
  assert.equal(dueOverdueNotice(0, 0), null);
  assert.equal(dueOverdueNotice(1, 0), 1);
  assert.equal(dueOverdueNotice(3, 1), null);
  assert.equal(dueOverdueNotice(6, 1), 6);
  assert.equal(dueOverdueNotice(10, 0), 6);
  assert.equal(dueOverdueNotice(25, 6), 25);
  assert.equal(dueOverdueNotice(28, 25), null);
  assert.equal(dueOverdueNotice(30, 6), null);
});

test("somente faturas hospedadas pelo Asaas viram link de pagamento", () => {
  assert.equal(officialAsaasInvoiceUrl("https://www.asaas.com/i/abc123"), "https://www.asaas.com/i/abc123");
  assert.equal(officialAsaasInvoiceUrl("https://sandbox.asaas.com/i/abc"), "https://sandbox.asaas.com/i/abc");
  assert.equal(officialAsaasInvoiceUrl("http://www.asaas.com/i/abc"), null);
  assert.equal(officialAsaasInvoiceUrl("https://asaas.com.golpe.com/i/abc"), null);
  assert.equal(officialAsaasInvoiceUrl("https://www.asaas.com@golpe.com/i/abc"), null);
  assert.equal(officialAsaasInvoiceUrl(null), null);
});

test("situação do painel ignora assinaturas em dia e cancelamento agendado", () => {
  const base = { cancelAtPeriodEnd: false, overdueInvoiceUrl: "https://www.asaas.com/i/x", overdueSince: "2026-10-01", status: "atrasado" };
  assert.equal(overdueSituation({ ...base, status: "ativo" }, "2026-10-05"), null);
  assert.equal(overdueSituation({ ...base, cancelAtPeriodEnd: true }, "2026-10-05"), null);
  assert.equal(overdueSituation({ ...base, overdueSince: null }, "2026-10-05"), null);
  assert.equal(overdueSituation(base, "2026-10-05")?.phase, "online");
  assert.equal(overdueSituation(base, "2026-10-09")?.phase, "suspended");
  assert.equal(overdueSituation({ ...base, overdueInvoiceUrl: "https://golpe.com" }, "2026-10-02")?.invoiceUrl, null);
});

test("e-mails de atraso usam datas da política e escapam o nome da loja", () => {
  const first = overdueNoticeEmail({ invoiceUrl: "https://www.asaas.com/i/abc", noticeDay: 1, overdueSince: "2026-10-10", siteUrl: "https://clickcatalogo.com", storeName: "Loja <b>X</b>" });
  assert.match(first.subject, /^Pagamento não aprovado/);
  assert.match(first.html, /17\/10\/2026/);
  assert.match(first.html, /href="https:\/\/www\.asaas\.com\/i\/abc"/);
  assert.match(first.html, /Loja &lt;b&gt;X&lt;\/b&gt;/);
  assert.doesNotMatch(first.html, /<b>X<\/b>/);

  const sixth = overdueNoticeEmail({ invoiceUrl: null, noticeDay: 6, overdueSince: "2026-10-10", siteUrl: "https://clickcatalogo.com/", storeName: "Loja\nNova" });
  assert.equal(sixth.subject, "Sua loja sai do ar em 18/10/2026 — Loja Nova");
  assert.match(sixth.html, /href="https:\/\/clickcatalogo\.com\/painel\/assinatura"[^>]*>Regularizar no painel/);

  const last = overdueNoticeEmail({ invoiceUrl: "https://www.asaas.com/i/abc", noticeDay: 25, overdueSince: "2026-10-10", siteUrl: "https://clickcatalogo.com", storeName: "Loja" });
  assert.match(last.subject, /encerrada em 09\/11\/2026/);
  assert.match(last.html, /até <strong>08\/11\/2026<\/strong>/);
});

test("banco aplica a mesma regra e protege as RPCs de atraso", async () => {
  const schema = (await source("supabase/schema.sql")).toLowerCase();
  const migration = (await source("supabase/migrations/202609300025_overdue_suspension_policy.sql")).toLowerCase();

  for (const sql of [schema, migration]) {
    assert.match(sql, /subscription\.overdue_since\s+<= \(clock_timestamp\(\) at time zone 'america\/sao_paulo'\)::date - 8/);
    assert.match(sql, /then 'suspenso'/);
    assert.match(sql, /subscription\.overdue_since <= v_today - 30/);
    assert.match(sql, /overdue_last_notice_day in \(0, 1, 6, 25\)/);
    assert.match(sql, /grant execute on function public\.claim_overdue_notices\(integer\) to service_role/);
    assert.match(sql, /grant execute on function public\.finalize_overdue_cancellation\(uuid, timestamptz, text\) to service_role/);
    assert.match(sql, /and subscription\.overdue_cancellation_checked_at = p_checked_at/);
    assert.doesNotMatch(sql, /coalesce\(claimed\.overdue_invoice_url, claimed\.portal_url\)/);
  }
  assert.match(migration, /set overdue_since = \(clock_timestamp\(\) at time zone 'america\/sao_paulo'\)::date\s+where subscription\.status = 'atrasado'/);
});

test("webhook registra e limpa o atraso; rotina encerra somente após limpar cobranças", async () => {
  const webhook = await source("src/app/api/webhooks/asaas/route.ts");
  const cron = await source("netlify/functions/finalize-subscription-cancellations.mjs");
  const catalog = await source("src/lib/catalog/public-catalog.ts");

  assert.match(webhook, /if \(subscriptionStatus === "atrasado"\) await markSubscriptionOverdue/);
  assert.match(webhook, /\.is\("overdue_since", null\)/);
  // Atraso que começa numa assinatura em dia sempre inicia um ciclo novo.
  assert.match(webhook, /startsNewCycle \? \{ \.\.\.OVERDUE_RESET, overdue_since: overdueSince \}/);
  assert.match(webhook, /markSubscriptionOverdue\(admin, event, "id", subscription\.id, subscription\.status !== "atrasado"\)/);
  assert.match(webhook, /markSubscriptionOverdue\(admin, event, "id", existing\.id, existing\.status !== "atrasado"\)/);
  // Os quatro caminhos de pagamento/reativação confirmados zeram o atraso.
  assert.equal((webhook.match(/^ {4}\.\.\.OVERDUE_RESET,\r?$/gm) ?? []).length, 4);
  assert.match(catalog, /status === "cancelado" \|\| status === "suspenso"/);

  assert.match(cron, /rpc\/claim_overdue_cancellations/);
  assert.match(cron, /OPEN_PAYMENT_STATUSES = new Set\(\["PENDING", "OVERDUE"\]\)/);
  assert.match(cron, /paidDuringOverdue[\s\S]*?method: "DELETE"[\s\S]*?remaining\.length > 0[\s\S]*?rpc\/finalize_overdue_cancellation/);
  assert.match(cron, /"Idempotency-Key": idempotencyKey/);
  assert.match(cron, /overdue-\$\{row\.subscription_id\}-\$\{row\.overdue_since\}-\$\{row\.notice_day\}/);
});
