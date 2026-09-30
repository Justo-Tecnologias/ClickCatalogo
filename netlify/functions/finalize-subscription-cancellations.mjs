import { authoritativePaidThroughDate, brazilDateStartAsIso } from "../../src/lib/asaas/paid-period.mjs";
import { overdueNoticeEmail } from "../../src/lib/billing/overdue-emails.mjs";

const REQUEST_TIMEOUT_MS = 3_000;
const RECONCILIATION_LIMIT = 10;
// A função agendada tem teto de 30 s na Netlify. Cada etapa recebe uma fatia
// e o que não couber fica para a próxima execução horária.
// Cada aviso precisa de até dois pedidos (Resend e registro), por isso a fatia
// de avisos deve ser maior que 2 × REQUEST_TIMEOUT_MS.
// Soma das fatias (24 s) + finalização e inspeção (até 2 × 3 s) = 30 s.
const RECONCILIATION_TIME_BUDGET_MS = 10_000;
const OVERDUE_CANCELLATION_TIME_BUDGET_MS = 6_000;
const OVERDUE_NOTICE_TIME_BUDGET_MS = 8_000;
const OVERDUE_CANCELLATION_LIMIT = 5;
const OVERDUE_NOTICE_LIMIT = 20;
const OPEN_PAYMENT_STATUSES = new Set(["PENDING", "OVERDUE"]);
const SETTLED_PAYMENT_STATUSES = new Set(["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"]);

function requireEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const asaasApiKey = process.env.ASAAS_API_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase não configurado para finalizar cancelamentos.");
  if (!asaasApiKey) throw new Error("Asaas não configurado para reconciliar cancelamentos.");
  const configuredAsaasUrl = process.env.ASAAS_API_URL?.trim().replace(/\/$/, "");
  const asaasApiUrl = asaasApiKey.startsWith("$aact_prod_")
    ? "https://api.asaas.com/v3"
    : asaasApiKey.startsWith("$aact_hmlg_")
      ? "https://api-sandbox.asaas.com/v3"
      : configuredAsaasUrl;
  if (!["https://api.asaas.com/v3", "https://api-sandbox.asaas.com/v3"].includes(asaasApiUrl)) {
    throw new Error("Ambiente Asaas não pôde ser identificado com segurança.");
  }
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();
  return {
    asaasApiKey,
    asaasApiUrl,
    // Avisos por e-mail são opcionais: sem Resend, a rotina segue e registra.
    resend: resendApiKey && resendFrom ? { apiKey: resendApiKey, from: resendFrom } : null,
    serviceRoleKey,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "https://clickcatalogo.com",
    supabaseUrl,
  };
}

async function supabaseRequest(env, path, init = {}) {
  return fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function asaasRequest(env, path, init = {}) {
  return fetch(`${env.asaasApiUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "ClickCatalogo/0.1.0 (scheduled-reconciliation)",
      access_token: env.asaasApiKey,
      ...init.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function ensureTimeBudget(deadline) {
  if (Date.now() + REQUEST_TIMEOUT_MS >= deadline) {
    throw new Error("Orçamento de execução reservado para a próxima tentativa.");
  }
}

async function listSubscriptionPayments(env, subscriptionId, status, deadline) {
  const all = [];
  const limit = 100;
  for (let offset = 0; offset < 2_000; offset += limit) {
    ensureTimeBudget(deadline);
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset), subscription: subscriptionId });
    if (status) params.set("status", status);
    const response = await asaasRequest(env, `/payments?${params}`);
    if (!response.ok) throw new Error(`Falha ao listar cobranças (${response.status}).`);
    const payload = await response.json();
    if (!Array.isArray(payload?.data)) throw new Error("Lista de cobranças inválida.");
    if (payload.data.some((payment) => payment?.subscription && payment.subscription !== subscriptionId)) {
      throw new Error("Cobrança sem vínculo confirmado com a assinatura.");
    }
    all.push(...payload.data);
    if (!payload.hasMore || payload.data.length < limit) return all;
  }
  throw new Error("Limite de cobranças excedido.");
}

async function isDeletedSubscription(env, subscriptionId, deadline) {
  const limit = 100;
  for (let offset = 0; offset < 2_000; offset += limit) {
    ensureTimeBudget(deadline);
    const params = new URLSearchParams({ deletedOnly: "true", limit: String(limit), offset: String(offset) });
    const response = await asaasRequest(env, `/subscriptions?${params}`);
    if (!response.ok) return false;
    const payload = await response.json();
    if (!Array.isArray(payload?.data)) return false;
    if (payload.data.some((subscription) => subscription?.id === subscriptionId)) return true;
    if (!payload.hasMore || payload.data.length < limit) return false;
  }
  return false;
}

function isAtOrAfterCutoff(payment, cutoff, subscriptionId) {
  return typeof payment?.dueDate === "string"
    && payment.dueDate >= cutoff
    && (!payment.subscription || payment.subscription === subscriptionId);
}

async function setReconciliationState(env, row, status, remoteState, paidThroughDate) {
  const values = {
    cancellation_reconciliation_checked_at: new Date().toISOString(),
    cancellation_reconciliation_status: status,
  };
  if (remoteState) values.asaas_subscription_state = remoteState;
  if (paidThroughDate) {
    values.access_until = brazilDateStartAsIso(paidThroughDate);
    values.next_due_date = paidThroughDate;
  }
  const filters = new URLSearchParams({
    cancel_at_period_end: "eq.true",
    cancellation_reconciliation_checked_at: `eq.${row.cancellation_reconciliation_checked_at}`,
    cancellation_reconciliation_status: "eq.processing",
    id: `eq.${row.id}`,
    reactivation_requested_at: "is.null",
  });
  const response = await supabaseRequest(env, `subscriptions?${filters}`, {
    body: JSON.stringify(values),
    headers: { Prefer: "return=representation" },
    method: "PATCH",
  });
  if (!response.ok) throw new Error(`Falha ao salvar conciliação (${response.status}).`);
  const updated = await response.json();
  if (!Array.isArray(updated) || updated.length !== 1) {
    throw new Error("A conciliação perdeu a reserva exclusiva.");
  }
}

async function reconcileOne(env, row, deadline) {
  const subscriptionId = row.asaas_subscription_id;
  if (!subscriptionId || !row.access_until) {
    throw new Error("Cancelamento sem assinatura remota ou período de acesso.");
  }

  ensureTimeBudget(deadline);
  const inactivation = await asaasRequest(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    body: JSON.stringify({ status: "INACTIVE" }),
    method: "PUT",
  });
  const deleted = inactivation.status === 404
    || (!inactivation.ok && await isDeletedSubscription(env, subscriptionId, deadline));
  if (!inactivation.ok && !deleted) {
    throw new Error(`Falha ao inativar assinatura (${inactivation.status}).`);
  }
  const remoteState = deleted ? "deleted" : "inactive";

  const payments = await listSubscriptionPayments(env, subscriptionId, undefined, deadline);
  const cutoff = authoritativePaidThroughDate(payments, subscriptionId);

  const pending = payments.filter((item) => item.status === "PENDING");
  for (const payment of pending.filter((item) => isAtOrAfterCutoff(item, cutoff, subscriptionId))) {
    ensureTimeBudget(deadline);
    const removal = await asaasRequest(env, `/payments/${encodeURIComponent(payment.id)}`, { method: "DELETE" });
    if (!removal.ok && removal.status !== 404) throw new Error(`Falha ao remover cobrança (${removal.status}).`);
  }
  const remaining = (await listSubscriptionPayments(env, subscriptionId, undefined, deadline))
    .filter((item) => isAtOrAfterCutoff(item, cutoff, subscriptionId));
  if (remaining.length > 0) throw new Error("Cobrança posterior ao período pago ainda requer conferência.");

  await setReconciliationState(env, row, "complete", remoteState, cutoff);
}

async function retryPendingReconciliations(env) {
  const startedAt = Date.now();
  const deadline = startedAt + RECONCILIATION_TIME_BUDGET_MS;
  let completed = 0;
  let attention = 0;
  const failureReasons = {};
  let inspected = 0;
  let timeBudgetReached = false;
  while (inspected < RECONCILIATION_LIMIT) {
    if (Date.now() + REQUEST_TIMEOUT_MS >= deadline) {
      timeBudgetReached = true;
      break;
    }
    const claim = await supabaseRequest(env, "rpc/claim_subscription_cancellation_reconciliations", {
      body: JSON.stringify({ p_limit: 1 }),
      method: "POST",
    });
    if (!claim.ok) throw new Error(`Falha ao reservar conciliação (${claim.status}).`);
    const rows = await claim.json();
    if (!Array.isArray(rows)) throw new Error("Reserva de conciliação inválida.");
    const row = rows[0];
    if (!row) break;
    inspected += 1;
    try {
      await reconcileOne(env, row, deadline);
      completed += 1;
    } catch (error) {
      attention += 1;
      const reason = error instanceof Error ? error.message : "Falha desconhecida.";
      failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
      console.error(JSON.stringify({ event: "subscription.cancellation.reconciliation_failed", reason }));
      try {
        await setReconciliationState(env, row, "attention");
      } catch {
        // Uma falha de persistência mantém o item para a próxima execução.
      }
    }
  }
  return {
    attention,
    completed,
    duration_ms: Date.now() - startedAt,
    failure_reasons: failureReasons,
    inspected,
    time_budget_reached: timeBudgetReached,
  };
}

async function finalizeExpiredAccess(env) {
  const response = await supabaseRequest(env, "rpc/finalize_due_subscription_cancellations", {
    body: JSON.stringify({ p_now: new Date().toISOString() }),
    method: "POST",
  });
  if (!response.ok) throw new Error(`Falha ao finalizar cancelamentos (${response.status}).`);
  return response.json();
}

async function inspectUnresolvedReconciliations(env) {
  const query = new URLSearchParams({
    cancellation_reconciliation_status: "in.(pending,processing,attention)",
    limit: "1",
    order: "cancellation_requested_at.asc.nullslast",
    select: "cancellation_requested_at",
  });
  const response = await supabaseRequest(env, `subscriptions?${query}`, {
    headers: { Prefer: "count=exact" },
  });
  if (!response.ok) return { oldest_age_minutes: null, unresolved_count: null };
  const rows = await response.json();
  const total = Number(response.headers.get("content-range")?.split("/").at(-1));
  const oldest = rows?.[0]?.cancellation_requested_at;
  return {
    oldest_age_minutes: oldest
      ? Math.max(0, Math.round((Date.now() - new Date(oldest).getTime()) / 60_000))
      : null,
    unresolved_count: Number.isFinite(total) ? total : null,
  };
}

async function setOverdueCancellationAttention(env, row) {
  const filters = new URLSearchParams({
    id: `eq.${row.id}`,
    overdue_cancellation_checked_at: `eq.${row.overdue_cancellation_checked_at}`,
    overdue_cancellation_status: "eq.processing",
    status: "eq.atrasado",
  });
  const response = await supabaseRequest(env, `subscriptions?${filters}`, {
    body: JSON.stringify({
      overdue_cancellation_checked_at: new Date().toISOString(),
      overdue_cancellation_status: "attention",
    }),
    method: "PATCH",
  });
  if (!response.ok) throw new Error(`Falha ao registrar atenção (${response.status}).`);
}

// 30º dia de atraso: interrompe a recorrência, remove cobranças abertas (a
// fatura não pode ser paga depois do encerramento) e só então encerra a loja.
async function cancelOverdueSubscription(env, row, deadline) {
  const subscriptionId = row.asaas_subscription_id;
  let remoteState = "inactive";

  if (subscriptionId) {
    ensureTimeBudget(deadline);
    const inactivation = await asaasRequest(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      body: JSON.stringify({ status: "INACTIVE" }),
      method: "PUT",
    });
    const deleted = inactivation.status === 404
      || (!inactivation.ok && await isDeletedSubscription(env, subscriptionId, deadline));
    if (!inactivation.ok && !deleted) {
      throw new Error(`Falha ao inativar assinatura em atraso (${inactivation.status}).`);
    }
    remoteState = deleted ? "deleted" : "inactive";

    const payments = await listSubscriptionPayments(env, subscriptionId, undefined, deadline);
    const paidDuringOverdue = payments.some((payment) => SETTLED_PAYMENT_STATUSES.has(payment.status)
      && typeof payment.dueDate === "string"
      && payment.dueDate >= row.overdue_since);
    if (paidDuringOverdue) {
      throw new Error("Pagamento identificado durante o encerramento; aguardando confirmação do webhook.");
    }

    for (const payment of payments.filter((item) => OPEN_PAYMENT_STATUSES.has(item.status))) {
      ensureTimeBudget(deadline);
      const removal = await asaasRequest(env, `/payments/${encodeURIComponent(payment.id)}`, { method: "DELETE" });
      if (!removal.ok && removal.status !== 404) throw new Error(`Falha ao remover cobrança em atraso (${removal.status}).`);
    }

    const remaining = (await listSubscriptionPayments(env, subscriptionId, undefined, deadline))
      .filter((item) => OPEN_PAYMENT_STATUSES.has(item.status));
    if (remaining.length > 0) throw new Error("Cobrança em aberto ainda requer conferência.");
  }

  const response = await supabaseRequest(env, "rpc/finalize_overdue_cancellation", {
    body: JSON.stringify({
      p_checked_at: row.overdue_cancellation_checked_at,
      p_remote_state: remoteState,
      p_subscription_id: row.id,
    }),
    method: "POST",
  });
  if (!response.ok) throw new Error(`Falha ao encerrar assinatura em atraso (${response.status}).`);
  const finalized = await response.json();
  if (finalized !== true) {
    // Um pagamento confirmado pelo webhook reativou a loja depois da
    // inativação no Asaas. A recorrência precisa ser revista manualmente.
    console.error(JSON.stringify({
      event: "overdue.cancellation.superseded",
      subscription_id: row.id,
      tenant_id: row.tenant_id,
    }));
    return "superseded";
  }
  return "canceled";
}

async function processOverdueCancellations(env) {
  const startedAt = Date.now();
  const deadline = startedAt + OVERDUE_CANCELLATION_TIME_BUDGET_MS;
  const result = { attention: 0, canceled: 0, failure_reasons: {}, inspected: 0, superseded: 0 };

  while (result.inspected < OVERDUE_CANCELLATION_LIMIT && Date.now() + REQUEST_TIMEOUT_MS < deadline) {
    const claim = await supabaseRequest(env, "rpc/claim_overdue_cancellations", {
      body: JSON.stringify({ p_limit: 1 }),
      method: "POST",
    });
    if (!claim.ok) throw new Error(`Falha ao reservar encerramento por atraso (${claim.status}).`);
    const rows = await claim.json();
    if (!Array.isArray(rows)) throw new Error("Reserva de encerramento inválida.");
    const row = rows[0];
    if (!row) break;
    result.inspected += 1;
    try {
      const outcome = await cancelOverdueSubscription(env, row, deadline);
      result[outcome] += 1;
    } catch (error) {
      result.attention += 1;
      const reason = error instanceof Error ? error.message : "Falha desconhecida.";
      result.failure_reasons[reason] = (result.failure_reasons[reason] ?? 0) + 1;
      console.error(JSON.stringify({ event: "overdue.cancellation.failed", reason, tenant_id: row.tenant_id }));
      try {
        await setOverdueCancellationAttention(env, row);
      } catch {
        // O lease de processamento expira e o item volta na próxima execução.
      }
    }
  }

  return { ...result, duration_ms: Date.now() - startedAt };
}

async function sendResendEmail(env, { html, idempotencyKey, subject, to }) {
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({ from: env.resend.from, html, subject, to: [to] }),
    headers: {
      Authorization: `Bearer ${env.resend.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Resend recusou o envio (${response.status}).`);
}

async function updateOverdueNotice(env, row, values) {
  const filters = new URLSearchParams({
    id: `eq.${row.subscription_id}`,
    overdue_since: `eq.${row.overdue_since}`,
    status: "eq.atrasado",
  });
  const response = await supabaseRequest(env, `subscriptions?${filters}`, {
    body: JSON.stringify(values),
    method: "PATCH",
  });
  if (!response.ok) throw new Error(`Falha ao registrar aviso (${response.status}).`);
}

async function sendOverdueNotices(env) {
  if (!env.resend) {
    console.error(JSON.stringify({ event: "overdue.notice.skipped", reason: "resend_not_configured" }));
    return { skipped: "resend_not_configured" };
  }

  const startedAt = Date.now();
  const deadline = startedAt + OVERDUE_NOTICE_TIME_BUDGET_MS;
  const claim = await supabaseRequest(env, "rpc/claim_overdue_notices", {
    body: JSON.stringify({ p_limit: OVERDUE_NOTICE_LIMIT }),
    method: "POST",
  });
  if (!claim.ok) throw new Error(`Falha ao reservar avisos de atraso (${claim.status}).`);
  const rows = await claim.json();
  if (!Array.isArray(rows)) throw new Error("Reserva de avisos inválida.");

  const result = { failed: 0, released: 0, sent: 0 };
  for (const row of rows) {
    if (Date.now() + REQUEST_TIMEOUT_MS * 2 >= deadline) {
      // Sem tempo para enviar: libera o lease para a próxima execução.
      await updateOverdueNotice(env, row, { overdue_notice_claimed_at: null }).catch(() => undefined);
      result.released += 1;
      continue;
    }
    try {
      const email = overdueNoticeEmail({
        invoiceUrl: row.invoice_url,
        noticeDay: row.notice_day,
        overdueSince: row.overdue_since,
        siteUrl: env.siteUrl,
        storeName: row.nome_loja,
      });
      await sendResendEmail(env, {
        ...email,
        idempotencyKey: `overdue-${row.subscription_id}-${row.overdue_since}-${row.notice_day}`,
        to: row.owner_email,
      });
      await updateOverdueNotice(env, row, {
        overdue_last_notice_day: row.notice_day,
        overdue_notice_claimed_at: null,
      });
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      console.error(JSON.stringify({
        event: "overdue.notice.failed",
        notice_day: row.notice_day,
        reason: error instanceof Error ? error.message : "Falha desconhecida.",
        tenant_id: row.tenant_id,
      }));
      await updateOverdueNotice(env, row, { overdue_notice_claimed_at: null }).catch(() => undefined);
    }
  }

  return { ...result, duration_ms: Date.now() - startedAt };
}

export default async function finalizeSubscriptionCancellations() {
  const env = requireEnvironment();
  const reconciliation = await retryPendingReconciliations(env);
  const overdueCancellations = await processOverdueCancellations(env);
  const finalized = await finalizeExpiredAccess(env);
  const overdueNotices = await sendOverdueNotices(env);
  const unresolved = await inspectUnresolvedReconciliations(env);
  console.log(JSON.stringify({
    finalized,
    overdueCancellations,
    overdueNotices,
    ranAt: new Date().toISOString(),
    reconciliation,
    unresolved,
  }));
}

export const config = {
  schedule: "15 * * * *",
};
