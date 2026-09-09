import { createClient } from "@supabase/supabase-js";

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (nodeMajor < 22) {
  console.error(
    `O auditor requer Node.js 22 ou superior (versão atual: ${process.versions.node}). `
      + "Use o mesmo Node.js 22 configurado na Netlify.",
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RATE_LIMIT_PROBE_KEY = "0".repeat(64);

if (!url || !serviceRoleKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes da auditoria.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function rows(table, columns) {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

async function listStoragePaths() {
  const paths = [];
  const pendingPrefixes = [""];

  while (pendingPrefixes.length > 0) {
    const prefix = pendingPrefixes.shift();
    let offset = 0;

    while (true) {
      const { data, error } = await supabase.storage.from("produtos").list(prefix, {
        limit: 1000,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(`storage/produtos/${prefix || "raiz"}: ${error.message}`);

      for (const object of data ?? []) {
        const objectPath = prefix ? `${prefix}/${object.name}` : object.name;
        if (object.id) paths.push(objectPath);
        else if (object.name && object.name !== ".emptyFolderPlaceholder") pendingPrefixes.push(objectPath);
      }

      if (!data || data.length < 1000) break;
      offset += data.length;
    }
  }

  return paths;
}

try {
  const [tenants, categories, products, subscriptions, intents, webhookEvents, deletionRequests, legalRecords, bucketResult, rateLimitTableResult, emailLookupResult] = await Promise.all([
    rows("tenants", "id,owner_user_id,status,canceled_at,logo_url,banner_url"),
    rows("categories", "id,tenant_id"),
    rows("products", "id,tenant_id,category_id,imagem_url"),
    rows("subscriptions", "tenant_id,status,asaas_customer_id,asaas_subscription_id"),
    rows("signup_intents", "status,provisioned_tenant_id,terms_version,privacy_version"),
    rows("asaas_webhook_events", "processed_at,processing_error,processing_started_at,attempts"),
    rows("account_deletion_requests", "tenant_id,tenant_id_original,status,scheduled_for,processing_started_at,attempts"),
    rows("legal_retention_records", "tenant_id_original,retain_until"),
    supabase.storage.getBucket("produtos"),
    supabase.from("api_rate_limits").select("key_hash", { count: "exact", head: true }),
    supabase.rpc("email_has_tenant", { p_email: "setup-check@invalid.local" }),
  ]);

  if (bucketResult.error) throw new Error(`storage/produtos: ${bucketResult.error.message}`);
  if (rateLimitTableResult.error) throw new Error(`api_rate_limits: ${rateLimitTableResult.error.message}`);
  if (emailLookupResult.error) throw new Error(`email_has_tenant: ${emailLookupResult.error.message}`);

  const [{ data: rateLimitProbe, error: rateLimitProbeError }, { error: rateLimitValidation }, { error: reorderValidation }] = await Promise.all([
    supabase.rpc("consume_api_rate_limit", {
      p_key_hash: RATE_LIMIT_PROBE_KEY,
      p_limit: 1_000_000,
      p_window_seconds: 60,
    }),
    supabase.rpc("consume_api_rate_limit", {
      p_key_hash: "invalid",
      p_limit: 1,
      p_window_seconds: 60,
    }),
    supabase.rpc("reorder_categories", {
      p_ids: [],
      p_tenant_id: "00000000-0000-0000-0000-000000000000",
    }),
  ]);
  if (rateLimitProbeError || rateLimitProbe?.[0]?.allowed !== true) {
    throw new Error(
      `consume_api_rate_limit não processou uma chamada válida: ${rateLimitProbeError?.message ?? "resultado inesperado"}`,
    );
  }
  if (rateLimitValidation?.code !== "22023") {
    throw new Error("consume_api_rate_limit não rejeitou parâmetros inválidos como esperado.");
  }
  if (reorderValidation?.code !== "42501") {
    throw new Error("reorder_categories não rejeitou uma loja não autorizada como esperado.");
  }

  const tenantIds = new Set(tenants.map((item) => item.id));
  const categoryIds = new Set(categories.map((item) => item.id));
  const storagePathFromUrl = (value) => {
    if (!value) return null;
    const marker = "/storage/v1/object/public/produtos/";
    const index = value.indexOf(marker);
    return index >= 0 ? decodeURIComponent(value.slice(index + marker.length)) : null;
  };
  const referencedStoragePaths = new Set([
    ...tenants.flatMap((tenant) => [tenant.logo_url, tenant.banner_url]),
    ...products.map((product) => product.imagem_url),
  ].map(storagePathFromUrl).filter(Boolean));
  const storagePaths = await listStoragePaths();
  const ownerCounts = tenants.reduce((counts, tenant) => {
    counts.set(tenant.owner_user_id, (counts.get(tenant.owner_user_id) ?? 0) + 1);
    return counts;
  }, new Map());

  const problems = {
    activeSubscriptionsMissingAsaasIds: subscriptions.filter((item) =>
      item.status === "ativo" && (!item.asaas_customer_id || !item.asaas_subscription_id)).length,
    duplicatedOwners: [...ownerCounts.values()].filter((count) => count > 1).length,
    canceledTenantsMissingTimestamp: tenants.filter((item) =>
      item.status === "cancelado" && !item.canceled_at).length,
    activeTenantsWithCancellationTimestamp: tenants.filter((item) =>
      item.status !== "cancelado" && item.canceled_at).length,
    deletionRequestsMissingTenant: deletionRequests.filter((item) =>
      item.tenant_id && !tenantIds.has(item.tenant_id)).length,
    expiredLegalRetentionRecords: legalRecords.filter((item) =>
      new Date(item.retain_until).getTime() <= Date.now()).length,
    orphanCategories: categories.filter((item) => !tenantIds.has(item.tenant_id)).length,
    orphanProducts: products.filter((item) =>
      !tenantIds.has(item.tenant_id) || !categoryIds.has(item.category_id)).length,
    orphanStorageObjects: storagePaths.filter((path) => !referencedStoragePaths.has(path)).length,
    paidIntentsWithoutTenant: intents.filter((item) =>
      item.status === "pago" && !item.provisioned_tenant_id).length,
    overdueDeletionRequests: deletionRequests.filter((item) =>
      ["agendado", "falhou"].includes(item.status)
      && item.attempts < 5
      && new Date(item.scheduled_for).getTime() <= Date.now()).length,
    signupIntentsMissingLegalVersion: intents.filter((item) =>
      !item.terms_version || !item.privacy_version).length,
    unprocessedWebhookEvents: webhookEvents.filter((item) =>
      !item.processed_at || item.processing_error).length,
    stuckWebhookEvents: webhookEvents.filter((item) =>
      !item.processed_at
      && !item.processing_error
      && new Date(item.processing_started_at).getTime() <= Date.now() - 5 * 60 * 1000).length,
    stuckDeletionRequests: deletionRequests.filter((item) =>
      item.status === "processando"
      && item.processing_started_at
      && new Date(item.processing_started_at).getTime() <= Date.now() - 30 * 60 * 1000).length,
  };
  const summary = {
    counts: {
      apiRateLimitEntries: rateLimitTableResult.count ?? 0,
      categories: categories.length,
      deletionRequests: deletionRequests.length,
      legalRetentionRecords: legalRecords.length,
      products: products.length,
      signupIntents: intents.length,
      subscriptions: subscriptions.length,
      tenants: tenants.length,
      webhookEvents: webhookEvents.length,
    },
    hardening: {
      distributedRateLimit: true,
      emailLookup: emailLookupResult.data === false,
      oneStorePerOwner: problems.duplicatedOwners === 0,
      reorderAuthorization: true,
    },
    problems,
    storage: {
      allowedMimeTypes: bucketResult.data.allowed_mime_types,
      fileSizeLimit: bucketResult.data.file_size_limit,
      name: bucketResult.data.name,
      public: bucketResult.data.public,
    },
  };

  const { error: probeCleanupError } = await supabase
    .from("api_rate_limits")
    .delete()
    .eq("key_hash", RATE_LIMIT_PROBE_KEY);
  if (probeCleanupError) {
    throw new Error(`Não foi possível limpar o probe técnico do rate limit: ${probeCleanupError.message}`);
  }

  console.log(JSON.stringify(summary, null, 2));
  if (Object.values(problems).some((count) => count > 0)) process.exitCode = 2;
} catch (error) {
  await supabase.from("api_rate_limits").delete().eq("key_hash", RATE_LIMIT_PROBE_KEY);
  console.error(error instanceof Error ? error.message : "Falha desconhecida na auditoria.");
  process.exitCode = 1;
}
