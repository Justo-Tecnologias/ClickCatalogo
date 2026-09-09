import { createClient } from "@supabase/supabase-js";

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (nodeMajor < 22) {
  console.error(`A rotina requer Node.js 22 ou superior (versão atual: ${process.versions.node}).`);
  process.exit(1);
}

const EXECUTION_CONFIRMATION = "PURGAR-DADOS-CANCELADOS";
const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.split("=");
    return [key, value.join("=") || true];
  }),
);
const execute = args.has("--execute");
const confirmation = args.get("--confirm");
const requestedLimit = Number(args.get("--limit") ?? 10);
const limit = Number.isInteger(requestedLimit) && requestedLimit >= 1 && requestedLimit <= 50
  ? requestedLimit
  : 10;

if (execute && confirmation !== EXECUTION_CONFIRMATION) {
  console.error(
    `Execução recusada. Use --execute --confirm=${EXECUTION_CONFIRMATION} somente depois de revisar a simulação.`,
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de executar a rotina.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const now = new Date();
const isoBeforeDays = (days) => new Date(now.getTime() - days * 86_400_000).toISOString();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function countRows(table, configure) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  query = configure(query);
  const { count, error } = await query;
  if (error) throw new Error(`${table}: ${error.message}`);
  return count ?? 0;
}

async function loadDryRunSummary() {
  const [tenantsResult, requestsResult, staleRateLimits, staleIntents, staleWebhooks, expiredLegalRecords] = await Promise.all([
    supabase.from("tenants").select("id,canceled_at").eq("status", "cancelado").not("canceled_at", "is", null),
    supabase.from("account_deletion_requests").select("tenant_id_original,status,scheduled_for,attempts"),
    countRows("api_rate_limits", (query) => query.lt("reset_at", isoBeforeDays(1))),
    countRows("signup_intents", (query) => query
      .is("provisioned_tenant_id", null)
      .in("status", ["expirado", "cancelado"])
      .lt("updated_at", isoBeforeDays(90))),
    countRows("asaas_webhook_events", (query) => query
      .not("processed_at", "is", null)
      .is("processing_error", null)
      .lt("processed_at", isoBeforeDays(180))),
    countRows("legal_retention_records", (query) => query.lte("retain_until", now.toISOString())),
  ]);

  if (tenantsResult.error) throw new Error(`tenants: ${tenantsResult.error.message}`);
  if (requestsResult.error) throw new Error(`account_deletion_requests: ${requestsResult.error.message}`);

  const requests = requestsResult.data ?? [];
  const requestedTenantIds = new Set(requests.map((request) => request.tenant_id_original));
  const canceledRetentionCutoff = now.getTime() - 30 * 86_400_000;
  const automaticDeletionCandidates = (tenantsResult.data ?? []).filter((tenant) =>
    tenant.canceled_at
      && new Date(tenant.canceled_at).getTime() <= canceledRetentionCutoff
      && !requestedTenantIds.has(tenant.id));
  const dueDeletionRequests = requests.filter((request) =>
    ["agendado", "falhou"].includes(request.status)
      && request.attempts < 5
      && new Date(request.scheduled_for).getTime() <= now.getTime());

  return {
    accountDeletion: {
      automaticCandidatesToSchedule: automaticDeletionCandidates.length,
      dueRequests: dueDeletionRequests.length,
      exhaustedRetries: requests.filter((request) => request.status === "falhou" && request.attempts >= 5).length,
    },
    mode: execute ? "execute" : "dry-run",
    operationalRetention: {
      apiRateLimits: staleRateLimits,
      processedWebhookPayloads: staleWebhooks,
      signupIntents: staleIntents,
    },
    expiredLegalRecords,
    processingLimit: limit,
    timestamp: now.toISOString(),
  };
}

async function listTenantStoragePaths(tenantId) {
  if (!UUID_PATTERN.test(tenantId)) throw new Error("Identificador de tenant inválido para o Storage.");
  const files = [];
  const pendingPrefixes = [tenantId];

  while (pendingPrefixes.length > 0) {
    const prefix = pendingPrefixes.shift();
    let offset = 0;
    while (true) {
      const { data, error } = await supabase.storage.from("produtos").list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`Storage ${prefix}: ${error.message}`);

      for (const object of data ?? []) {
        const objectPath = `${prefix}/${object.name}`;
        if (!objectPath.startsWith(`${tenantId}/`)) throw new Error("Caminho de Storage fora do tenant.");
        if (object.id) files.push(objectPath);
        else if (object.name && object.name !== ".emptyFolderPlaceholder") pendingPrefixes.push(objectPath);
      }

      if (!data || data.length < 1000) break;
      offset += data.length;
    }
  }

  return files;
}

async function removeTenantStorage(tenantId) {
  const files = await listTenantStoragePaths(tenantId);
  for (let index = 0; index < files.length; index += 100) {
    const batch = files.slice(index, index + 100);
    const { error } = await supabase.storage.from("produtos").remove(batch);
    if (error) throw new Error(`Remoção do Storage: ${error.message}`);
  }
  return files.length;
}

async function markRequestFailed(request, error) {
  const message = (error instanceof Error ? error.message : "Falha desconhecida").slice(0, 500);
  const retryAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
  const { error: updateError } = await supabase
    .from("account_deletion_requests")
    .update({
      last_error: message,
      processing_started_at: null,
      scheduled_for: retryAt,
      status: "falhou",
    })
    .eq("id", request.id);
  if (updateError) console.error(`Não foi possível registrar a falha da solicitação ${request.id}: ${updateError.message}`);
}

async function processDeletionRequest(request) {
  const tenantId = request.tenant_id_original;
  if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(request.owner_user_id)) {
    throw new Error("Solicitação contém identificadores inválidos.");
  }

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select("id,status,canceled_at,owner_user_id")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError) throw tenantError;

  let storageObjects = 0;
  if (tenant) {
    if (tenant.owner_user_id !== request.owner_user_id) throw new Error("A solicitação não pertence ao titular do tenant.");
    if (tenant.status !== "cancelado" || !tenant.canceled_at) throw new Error("Tenant não está cancelado.");

    const { data: subscriptions, error: subscriptionError } = await supabase
      .from("subscriptions")
      .select("status")
      .eq("tenant_id", tenantId);
    if (subscriptionError) throw subscriptionError;
    if ((subscriptions ?? []).some((subscription) => subscription.status !== "cancelado")) {
      throw new Error("Ainda existe uma assinatura local não cancelada.");
    }

    const { error: archiveError } = await supabase.rpc("archive_tenant_legal_record", {
      p_tenant_id: tenantId,
    });
    if (archiveError) throw new Error(`Arquivamento legal: ${archiveError.message}`);

    storageObjects = await removeTenantStorage(tenantId);

    const { error: intentError } = await supabase
      .from("signup_intents")
      .delete()
      .eq("provisioned_tenant_id", tenantId);
    if (intentError) throw new Error(`Intenção de cadastro: ${intentError.message}`);

    const { error: deleteTenantError } = await supabase
      .from("tenants")
      .delete()
      .eq("id", tenantId)
      .eq("owner_user_id", request.owner_user_id);
    if (deleteTenantError) throw new Error(`Tenant: ${deleteTenantError.message}`);
  } else {
    const { count, error: archiveCheckError } = await supabase
      .from("legal_retention_records")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id_original", tenantId);
    if (archiveCheckError) throw archiveCheckError;
    if (!count) throw new Error("Tenant ausente sem evidência legal arquivada; intervenção manual necessária.");
  }

  const { error: authError } = await supabase.auth.admin.deleteUser(request.owner_user_id);
  if (authError && !/not found/i.test(authError.message)) throw new Error(`Supabase Auth: ${authError.message}`);

  const completedAt = new Date().toISOString();
  const { error: completionError } = await supabase
    .from("account_deletion_requests")
    .update({
      completed_at: completedAt,
      last_error: null,
      processing_started_at: null,
      status: "concluido",
      tenant_id: null,
    })
    .eq("id", request.id);
  if (completionError) throw new Error(`Conclusão da solicitação: ${completionError.message}`);

  return { storageObjects };
}

try {
  const summary = await loadDryRunSummary();
  console.log(JSON.stringify(summary, null, 2));

  if (!execute) {
    console.log(`Simulação concluída. Nenhum dado foi alterado. Para executar, revise os números e use --execute --confirm=${EXECUTION_CONFIRMATION}.`);
    process.exit(0);
  }

  const { data: expiredIntents, error: expiryError } = await supabase.rpc("expire_stale_signup_intents");
  if (expiryError) throw new Error(`Expiração de intenções: ${expiryError.message}`);

  const { data: operationalPurge, error: operationalError } = await supabase.rpc(
    "purge_expired_operational_records",
    { p_now: new Date().toISOString() },
  );
  if (operationalError) throw new Error(`Expurgo operacional: ${operationalError.message}`);

  const { data: scheduled, error: scheduleError } = await supabase.rpc("schedule_retention_deletions", {
    p_now: new Date().toISOString(),
  });
  if (scheduleError) throw new Error(`Agendamento automático: ${scheduleError.message}`);

  const { data: requests, error: claimError } = await supabase.rpc("claim_account_deletion_requests", {
    p_limit: limit,
  });
  if (claimError) throw new Error(`Reserva da fila: ${claimError.message}`);

  const results = {
    completed: 0,
    completedRequestIds: [],
    failed: 0,
    failedRequestIds: [],
    storageObjectsRemoved: 0,
  };
  for (const request of requests ?? []) {
    try {
      const result = await processDeletionRequest(request);
      results.completed += 1;
      results.completedRequestIds.push(request.id);
      results.storageObjectsRemoved += result.storageObjects;
    } catch (error) {
      results.failed += 1;
      results.failedRequestIds.push(request.id);
      await markRequestFailed(request, error);
      console.error(`Solicitação ${request.id} falhou: ${error instanceof Error ? error.message : "erro desconhecido"}`);
    }
  }

  console.log(JSON.stringify({
    execution: {
      expiredPendingSignupIntents: expiredIntents ?? 0,
      operationalPurge,
      requestsScheduled: scheduled ?? 0,
      ...results,
    },
  }, null, 2));
  if (results.failed > 0) process.exitCode = 2;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falha desconhecida na rotina de retenção.");
  process.exitCode = 1;
}
