const REQUEST_TIMEOUT_MS = 3_000;
const RECONCILIATION_LIMIT = 10;
const RECONCILIATION_TIME_BUDGET_MS = 17_000;

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
  return {
    asaasApiKey,
    asaasApiUrl,
    serviceRoleKey,
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
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (status) params.set("status", status);
    const response = await asaasRequest(env, `/subscriptions/${encodeURIComponent(subscriptionId)}/payments?${params}`);
    if (!response.ok) throw new Error(`Falha ao listar cobranças (${response.status}).`);
    const payload = await response.json();
    if (!Array.isArray(payload?.data)) throw new Error("Lista de cobranças inválida.");
    all.push(...payload.data);
    if (!payload.hasMore || payload.data.length < limit) return all;
  }
  throw new Error("Limite de cobranças excedido.");
}

function isAtOrAfterCutoff(payment, cutoff, subscriptionId) {
  return typeof payment?.dueDate === "string"
    && payment.dueDate >= cutoff
    && (!payment.subscription || payment.subscription === subscriptionId);
}

async function setReconciliationState(env, row, status, remoteState) {
  const values = {
    cancellation_reconciliation_checked_at: new Date().toISOString(),
    cancellation_reconciliation_status: status,
  };
  if (remoteState) values.asaas_subscription_state = remoteState;
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
  const cutoff = row.access_until?.slice(0, 10);
  if (!subscriptionId || !/^\d{4}-\d{2}-\d{2}$/.test(cutoff ?? "")) {
    throw new Error("Cancelamento sem assinatura remota ou data de corte válida.");
  }

  ensureTimeBudget(deadline);
  const inactivation = await asaasRequest(env, `/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    body: JSON.stringify({ status: "INACTIVE" }),
    method: "PUT",
  });
  if (!inactivation.ok) throw new Error(`Falha ao inativar assinatura (${inactivation.status}).`);
  const remoteState = "inactive";

  const pending = await listSubscriptionPayments(env, subscriptionId, "PENDING", deadline);
  for (const payment of pending.filter((item) => isAtOrAfterCutoff(item, cutoff, subscriptionId))) {
    ensureTimeBudget(deadline);
    const removal = await asaasRequest(env, `/payments/${encodeURIComponent(payment.id)}`, { method: "DELETE" });
    if (!removal.ok && removal.status !== 404) throw new Error(`Falha ao remover cobrança (${removal.status}).`);
  }
  const remaining = (await listSubscriptionPayments(env, subscriptionId, undefined, deadline))
    .filter((item) => isAtOrAfterCutoff(item, cutoff, subscriptionId));
  if (remaining.length > 0) throw new Error("Cobrança posterior ao período pago ainda requer conferência.");

  await setReconciliationState(env, row, "complete", remoteState);
}

async function retryPendingReconciliations(env) {
  const startedAt = Date.now();
  const deadline = startedAt + RECONCILIATION_TIME_BUDGET_MS;
  let completed = 0;
  let attention = 0;
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
    } catch {
      attention += 1;
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

export default async function finalizeSubscriptionCancellations() {
  const env = requireEnvironment();
  const reconciliation = await retryPendingReconciliations(env);
  const finalized = await finalizeExpiredAccess(env);
  const unresolved = await inspectUnresolvedReconciliations(env);
  console.log(JSON.stringify({ finalized, reconciliation, ranAt: new Date().toISOString(), unresolved }));
}

export const config = {
  schedule: "15 * * * *",
};
