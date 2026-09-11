import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { recordProductMetric } from "@/lib/analytics/server";
import { getAsaasCheckoutPlan } from "@/lib/billing/server-plan";
import { overdueEventIsOlder, scheduledAccessIsActive } from "@/lib/billing/state";
import { requireAsaasWebhookToken } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/env/public";
import { logError, logInfo } from "@/lib/observability/logger";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { secretsMatch } from "@/lib/security/secret";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

export const dynamic = "force-dynamic";

const eventSchema = z.object({
  checkout: z.record(z.string(), z.unknown()).optional(),
  event: z.string().min(1).max(100),
  id: z.string().min(1).max(200),
  payment: z.record(z.string(), z.unknown()).optional(),
  subscription: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

type WebhookEvent = z.infer<typeof eventSchema>;
type SignupIntent = Database["public"]["Tables"]["signup_intents"]["Row"];

function textValue(record: Record<string, unknown> | undefined, ...keys: string[]) {
  for (const key of keys) if (typeof record?.[key] === "string") return record[key] as string;
  return null;
}

function numberValue(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  const parsed = typeof value === "number" ? value : typeof value === "string" && value ? Number(value) : null;
  return parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function recordValue(record: Record<string, unknown> | undefined, key: string) {
  const value = record?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function customerIdFrom(event: WebhookEvent) {
  return textValue(event.payment, "customer")
    ?? textValue(event.checkout, "customer")
    ?? textValue(event.subscription, "customer");
}

function subscriptionIdFrom(event: WebhookEvent) {
  return textValue(event.payment, "subscription")
    ?? textValue(event.subscription, "id")
    ?? textValue(event.checkout, "subscription")
    ?? textValue(recordValue(event.checkout, "subscription"), "id");
}

function nextDueDateFrom(event: WebhookEvent) {
  return textValue(event.subscription, "nextDueDate")
    ?? textValue(recordValue(event.checkout, "subscription"), "nextDueDate")
    ?? textValue(event.payment, "nextDueDate")
    ?? textValue(event.payment, "dueDate");
}

function validToken(received: string | null) {
  let expected: string;
  try { expected = requireAsaasWebhookToken(); } catch { return false; }
  return secretsMatch(received, expected);
}

async function findAuthUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
) {
  const normalizedEmail = email.toLowerCase();
  const perPage = 1000;

  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const userId = data.users.find((user) => user.email?.toLowerCase() === normalizedEmail)?.id;
    if (userId) return userId;
    if (data.users.length < perPage) return null;
  }
}

export async function POST(request: Request) {
  const requestId = request.headers.get("x-nf-request-id")?.slice(0, 100) ?? randomUUID();
  if (!validToken(request.headers.get("asaas-access-token"))) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.webhook);
  if (rateLimitResponse) return rateLimitResponse;

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Webhook temporariamente indisponível." }, { status: 503 });
  }

  const raw: unknown = await request.json().catch(() => null);
  const parsed = eventSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "Evento inválido." }, { status: 400 });

  const event = parsed.data;
  const admin = createAdminClient();
  const { data: claim, error: claimError } = await admin.rpc("claim_asaas_webhook_event", {
    p_event_id: event.id,
    p_event_type: event.event,
    p_payload: event as unknown as Json,
    p_stale_seconds: 300,
  });
  if (claimError) return NextResponse.json({ error: "Falha ao registrar evento." }, { status: 500 });
  if (claim === "repeated") {
    logInfo("asaas.webhook", { event_id: event.id, request_id: requestId, result: "repeated" });
    return NextResponse.json({ received: true, repeated: true });
  }
  if (claim === "processing") {
    return NextResponse.json(
      { error: "Evento ainda em processamento; tente novamente." },
      { status: 409 },
    );
  }
  if (claim !== "claimed") return NextResponse.json({ error: "Estado de evento inválido." }, { status: 500 });

  try {
    await processEvent(event);
    const { error: processedUpdateError } = await admin.from("asaas_webhook_events").update({ processed_at: new Date().toISOString(), processing_error: null }).eq("event_id", event.id);
    if (processedUpdateError) throw processedUpdateError;
    logInfo("asaas.webhook", {
      event_id: event.id,
      event_type: event.event,
      request_id: requestId,
      result: "processed",
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : "Erro desconhecido";
    await admin.from("asaas_webhook_events").update({ processing_error: message }).eq("event_id", event.id);
    logError("asaas.webhook", error, {
      event_id: event.id,
      event_type: event.event,
      request_id: requestId,
      result: "failed",
    });
    return NextResponse.json({ error: "Evento não processado." }, { status: 500 });
  }
}

async function processEvent(event: WebhookEvent) {
  if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "CHECKOUT_PAID"].includes(event.event)) {
    const intent = await findIntent(event);
    if (intent?.intent_type === "reactivation") await provisionReactivation(intent, event);
    else if (intent) await provisionTenant(intent, event);
    else if (!await activateExistingSubscription(event)) throw new Error("Intenção de cadastro ou assinatura não encontrada para o pagamento.");
    return;
  }
  if (event.event === "PAYMENT_OVERDUE") { await updateSubscriptionStatus(event, "atrasado", "inadimplente"); return; }
  if (event.event === "SUBSCRIPTION_UPDATED") { await completePendingReactivation(event); return; }
  if (event.event === "SUBSCRIPTION_INACTIVATED") { await recordRemoteSubscriptionState(event, "inactive"); return; }
  if (event.event === "SUBSCRIPTION_DELETED") {
    if (!await recordRemoteSubscriptionState(event, "deleted")) return;
    await updateSubscriptionStatus(event, "cancelado", "cancelado");
    return;
  }
  if (["CHECKOUT_CANCELED", "CHECKOUT_EXPIRED"].includes(event.event)) {
    const intent = await findIntent(event);
    if (intent && !intent.provisioned_tenant_id) {
      const admin = createAdminClient();
      const { error } = await admin.from("signup_intents").update({ status: event.event === "CHECKOUT_EXPIRED" ? "expirado" : "cancelado" }).eq("id", intent.id);
      if (error) throw error;
    }
  }
}

async function findIntent(event: WebhookEvent): Promise<SignupIntent | null> {
  const admin = createAdminClient();
  const checkoutSubscription = recordValue(event.checkout, "subscription");
  const externalReference = textValue(event.payment, "externalReference") ?? textValue(event.checkout, "externalReference") ?? textValue(event.subscription, "externalReference") ?? textValue(checkoutSubscription, "externalReference");
  if (externalReference && z.uuid().safeParse(externalReference).success) {
    const { data, error } = await admin.from("signup_intents").select("*").eq("external_reference", externalReference).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  const checkoutId = textValue(event.payment, "checkoutSession")
    ?? textValue(event.checkout, "id", "checkoutId");
  if (checkoutId) {
    const { data, error } = await admin.from("signup_intents").select("*").eq("asaas_checkout_id", checkoutId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  const subscriptionId = subscriptionIdFrom(event);
  if (subscriptionId) {
    const { data, error } = await admin.from("signup_intents").select("*").eq("asaas_subscription_id", subscriptionId).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  const customerId = customerIdFrom(event);
  if (customerId) {
    const { data, error } = await admin.from("signup_intents").select("*").eq("asaas_customer_id", customerId).in("status", ["pendente", "pago"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    if (data) return data;
  }
  return null;
}

type ExistingSubscription = {
  access_until: string | null;
  cancel_at_period_end: boolean;
  id: string;
  matchedBy: "customer" | "subscription";
  next_due_date?: string | null;
  status: "ativo" | "atrasado" | "cancelado";
  tenant_id: string;
};

function scheduledCancellationStillHasAccess(subscription: ExistingSubscription) {
  return scheduledAccessIsActive({
    accessUntil: subscription.access_until,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
}

async function cancellationIsTerminal(
  admin: ReturnType<typeof createAdminClient>,
  tenantId: string,
  subscriptionStatus: ExistingSubscription["status"] | null,
) {
  if (subscriptionStatus === "cancelado") return true;

  const { data, error } = await admin
    .from("tenants")
    .select("status")
    .eq("id", tenantId)
    .single();
  if (error) throw error;

  return data.status === "cancelado";
}

async function findExistingSubscription(event: WebhookEvent): Promise<ExistingSubscription | null> {
  const admin = createAdminClient();
  const subscriptionId = subscriptionIdFrom(event);

  if (subscriptionId) {
    const { data, error } = await admin.from("subscriptions").select("id,status,tenant_id,cancel_at_period_end,access_until,next_due_date").eq("asaas_subscription_id", subscriptionId).maybeSingle();
    if (error) throw error;
    if (data) return { ...data, matchedBy: "subscription" };
  }

  const customerId = customerIdFrom(event);
  if (!customerId) return null;

  const { data, error } = await admin.from("subscriptions").select("id,status,tenant_id,cancel_at_period_end,access_until,next_due_date").eq("asaas_customer_id", customerId).order("created_at", { ascending: false }).limit(2);
  if (error) throw error;
  if (!data?.length) return null;

  const tenantIds = new Set(data.map((subscription) => subscription.tenant_id));
  if (tenantIds.size > 1) throw new Error("Cliente Asaas está associado a mais de um tenant.");
  return { ...data[0], matchedBy: "customer" };
}

async function activateExistingSubscription(event: WebhookEvent) {
  const existing = await findExistingSubscription(event);
  if (!existing) return false;

  const admin = createAdminClient();
  if (await cancellationIsTerminal(admin, existing.tenant_id, existing.status)) {
    return true;
  }

  const values: Database["public"]["Tables"]["subscriptions"]["Update"] = {
    asaas_subscription_state: "active",
    status: "ativo",
  };
  const customerId = customerIdFrom(event);
  const subscriptionId = subscriptionIdFrom(event);
  const nextDueDate = nextDueDateFrom(event);
  const portalUrl = textValue(event.payment, "invoiceUrl");
  const value = numberValue(event.payment, "value") ?? numberValue(event.subscription, "value");

  if (customerId) values.asaas_customer_id = customerId;
  if (subscriptionId) values.asaas_subscription_id = subscriptionId;
  if (nextDueDate) values.next_due_date = nextDueDate;
  if (portalUrl) values.portal_url = portalUrl;
  if (value) values.valor = value;

  const { error: subscriptionError } = await admin.from("subscriptions").update(values).eq("id", existing.id);
  if (subscriptionError) throw subscriptionError;
  const { error: tenantError } = await admin.from("tenants").update({ status: "ativo" }).eq("id", existing.tenant_id);
  if (tenantError) throw tenantError;
  return true;
}

async function provisionTenant(intent: SignupIntent, event: WebhookEvent) {
  const admin = createAdminClient();
  const customerId = customerIdFrom(event) ?? intent.asaas_customer_id;
  const subscriptionId = subscriptionIdFrom(event) ?? intent.asaas_subscription_id;
  const nextDueDate = nextDueDateFrom(event);
  const portalUrl = textValue(event.payment, "invoiceUrl");
  const value = numberValue(event.payment, "value") ?? numberValue(event.subscription, "value") ?? getAsaasCheckoutPlan().value;

  let tenantId = intent.provisioned_tenant_id;
  let existingSubscription = await findExistingSubscription(event);
  if (existingSubscription?.matchedBy === "customer" && existingSubscription.tenant_id !== tenantId) {
    const { data: matchedTenant, error } = await admin.from("tenants").select("slug").eq("id", existingSubscription.tenant_id).single();
    if (error) throw error;
    if (matchedTenant.slug !== intent.slug) existingSubscription = null;
  }
  if (tenantId && existingSubscription && existingSubscription.tenant_id !== tenantId) throw new Error("Identificadores Asaas pertencem a outro tenant.");
  tenantId ??= existingSubscription?.tenant_id ?? null;

  let ownerUserId: string | null = null;
  let currentTenantStatus: "ativo" | "inadimplente" | "cancelado" | null = null;
  if (tenantId) {
    const { data: tenant, error } = await admin.from("tenants").select("owner_user_id,status").eq("id", tenantId).single();
    if (error) throw error;
    ownerUserId = tenant?.owner_user_id ?? null;
    currentTenantStatus = tenant?.status ?? null;
  }

  if (!ownerUserId) {
    const created = await admin.auth.admin.createUser({
      email: intent.email,
      email_confirm: true,
      user_metadata: {
        nome_loja: intent.nome_loja,
        signup_reference: intent.external_reference,
      },
    });
    ownerUserId = created.data.user?.id ?? null;
    if (created.error || !ownerUserId) {
      ownerUserId = await findAuthUserIdByEmail(admin, intent.email);
    }
    if (!ownerUserId) throw new Error("Usuário não pôde ser criado no Supabase Auth.");
  }

  if (!tenantId) {
    const { data: existingTenant, error: existingTenantError } = await admin.from("tenants").select("id,owner_user_id").eq("slug", intent.slug).maybeSingle();
    if (existingTenantError) throw existingTenantError;
    if (existingTenant && existingTenant.owner_user_id !== ownerUserId) throw new Error("Slug já pertence a outro usuário.");
    if (existingTenant) tenantId = existingTenant.id;
    else {
      const { data: tenant, error } = await admin.from("tenants").insert({ nome_loja: intent.nome_loja, owner_user_id: ownerUserId, slug: intent.slug, status: "ativo", tema: intent.tema, whatsapp: intent.whatsapp }).select("id").single();
      if (error || !tenant) throw error ?? new Error("Tenant não foi criado.");
      tenantId = tenant.id;
    }
  }

  let currentSubscription = existingSubscription;
  if (!currentSubscription) {
    const { data, error } = await admin.from("subscriptions").select("id,status,tenant_id,cancel_at_period_end,access_until,next_due_date").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    currentSubscription = data ? { ...data, matchedBy: "customer" } : null;
  }

  if (
    intent.provisioned_tenant_id
    && (currentTenantStatus === "cancelado" || currentSubscription?.status === "cancelado")
  ) {
    return;
  }

  const { error: tenantError } = await admin.from("tenants").update({ status: "ativo" }).eq("id", tenantId);
  if (tenantError) throw tenantError;

  const subscriptionValues: Database["public"]["Tables"]["subscriptions"]["Update"] = {
    asaas_subscription_state: "active",
    status: "ativo",
    valor: value,
  };
  if (customerId) subscriptionValues.asaas_customer_id = customerId;
  if (subscriptionId) subscriptionValues.asaas_subscription_id = subscriptionId;
  if (nextDueDate) subscriptionValues.next_due_date = nextDueDate;
  if (portalUrl) subscriptionValues.portal_url = portalUrl;
  if (currentSubscription) {
    const { error } = await admin.from("subscriptions").update(subscriptionValues).eq("id", currentSubscription.id);
    if (error) throw error;
  } else {
    const { error } = await admin.from("subscriptions").insert({ ...subscriptionValues, tenant_id: tenantId });
    if (error) throw error;
  }

  const intentValues: Database["public"]["Tables"]["signup_intents"]["Update"] = { provisioned_tenant_id: tenantId, status: "pago" };
  if (customerId) intentValues.asaas_customer_id = customerId;
  if (subscriptionId) intentValues.asaas_subscription_id = subscriptionId;
  const { error: intentError } = await admin.from("signup_intents").update(intentValues).eq("id", intent.id);
  if (intentError) throw intentError;
  if (intent.status !== "pago") await recordProductMetric("payment_confirmed", tenantId);
}

async function updateSubscriptionStatus(event: WebhookEvent, subscriptionStatus: "atrasado" | "cancelado", tenantStatus: "inadimplente" | "cancelado") {
  const admin = createAdminClient();
  const subscriptionId = subscriptionIdFrom(event);
  const customerId = customerIdFrom(event);
  let tenantId: string | null = null;
  if (subscriptionId) {
    const { data: subscription, error } = await admin.from("subscriptions").select("id,status,tenant_id,cancel_at_period_end,access_until,next_due_date").eq("asaas_subscription_id", subscriptionId).maybeSingle();
    if (error) throw error;
    if (subscription) {
      tenantId = subscription.tenant_id;
      if (scheduledCancellationStillHasAccess({ ...subscription, matchedBy: "subscription" })) return;
      const eventDueDate = nextDueDateFrom(event);
      if (subscriptionStatus === "atrasado" && overdueEventIsOlder(eventDueDate, subscription.next_due_date)) return;
      if (
        subscriptionStatus === "atrasado"
        && await cancellationIsTerminal(admin, tenantId, subscription.status)
      ) return;
      const { error: updateError } = await admin.from("subscriptions").update({ status: subscriptionStatus }).eq("id", subscription.id);
      if (updateError) throw updateError;
    }
  }
  if (!tenantId && customerId) {
    const existing = await findExistingSubscription(event);
    if (existing) {
      tenantId = existing.tenant_id;
      if (scheduledCancellationStillHasAccess(existing)) return;
      if (
        subscriptionStatus === "atrasado"
        && await cancellationIsTerminal(admin, tenantId, existing.status)
      ) return;
      const { error } = await admin.from("subscriptions").update({ status: subscriptionStatus }).eq("id", existing.id);
      if (error) throw error;
    }
  }
  if (!tenantId) tenantId = (await findIntent(event))?.provisioned_tenant_id ?? null;
  if (!tenantId) throw new Error("Assinatura não encontrada para atualizar o status.");
  if (!subscriptionId && !customerId) {
    const { error } = await admin.from("subscriptions").update({ status: subscriptionStatus }).eq("tenant_id", tenantId);
    if (error) throw error;
  }
  const tenantValues: Database["public"]["Tables"]["tenants"]["Update"] = {
    status: tenantStatus,
  };
  if (tenantStatus === "cancelado") tenantValues.canceled_at = new Date().toISOString();
  const { error: tenantError } = await admin.from("tenants").update(tenantValues).eq("id", tenantId);
  if (tenantError) throw tenantError;
}

async function recordRemoteSubscriptionState(
  event: WebhookEvent,
  state: "deleted" | "inactive",
) {
  const existing = await findExistingSubscription(event);
  if (!existing) return false;

  const admin = createAdminClient();
  const { error } = await admin.from("subscriptions")
    .update({ asaas_subscription_state: state })
    .eq("id", existing.id);
  if (error) throw error;

  // A inativação solicitada pelo ClickCatálogo apenas impede novas cobranças.
  // O estado local e o catálogo continuam ativos até access_until.
  if (state === "inactive" && !existing.cancel_at_period_end) {
    logInfo("asaas.subscription.remote_state", {
      operation: "unexpected_inactivation",
      result: state,
      tenant_id: existing.tenant_id,
    });
  }
  return true;
}

async function completePendingReactivation(event: WebhookEvent) {
  const remoteStatus = textValue(event.subscription, "status");
  if (remoteStatus !== "ACTIVE") return;
  const existing = await findExistingSubscription(event);
  if (!existing) return;

  const admin = createAdminClient();
  const { data: subscription, error } = await admin.from("subscriptions")
    .select("reactivation_requested_at")
    .eq("id", existing.id)
    .single();
  if (error) throw error;
  if (!subscription.reactivation_requested_at) return;

  const { error: subscriptionError } = await admin.from("subscriptions").update({
    access_until: null,
    asaas_subscription_state: "active",
    cancel_at_period_end: false,
    cancellation_requested_at: null,
    reactivation_requested_at: null,
    status: "ativo",
  }).eq("id", existing.id);
  if (subscriptionError) throw subscriptionError;
  const { error: tenantError } = await admin.from("tenants")
    .update({ canceled_at: null, status: "ativo" })
    .eq("id", existing.tenant_id);
  if (tenantError) throw tenantError;
}

async function provisionReactivation(intent: SignupIntent, event: WebhookEvent) {
  if (!intent.target_tenant_id) throw new Error("Reativação sem tenant de destino.");
  const admin = createAdminClient();
  const { data: tenant, error: tenantError } = await admin.from("tenants")
    .select("id,owner_user_id")
    .eq("id", intent.target_tenant_id)
    .single();
  if (tenantError || !tenant) throw tenantError ?? new Error("Tenant da reativação não encontrado.");

  const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(tenant.owner_user_id);
  if (ownerError || owner.user?.email?.toLowerCase() !== intent.email.toLowerCase()) {
    throw new Error("A intenção de reativação não pertence ao titular do tenant.");
  }

  const customerId = customerIdFrom(event) ?? intent.asaas_customer_id;
  const subscriptionId = subscriptionIdFrom(event) ?? intent.asaas_subscription_id;
  if (!subscriptionId) throw new Error("Pagamento de reativação sem assinatura Asaas.");
  const nextDueDate = nextDueDateFrom(event);
  const portalUrl = textValue(event.payment, "invoiceUrl");
  const value = numberValue(event.payment, "value")
    ?? numberValue(event.subscription, "value")
    ?? getAsaasCheckoutPlan().value;

  const { data: subscription, error: subscriptionLookupError } = await admin.from("subscriptions")
    .select("id")
    .eq("tenant_id", tenant.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (subscriptionLookupError || !subscription) {
    throw subscriptionLookupError ?? new Error("Assinatura local da reativação não encontrada.");
  }

  const values: Database["public"]["Tables"]["subscriptions"]["Update"] = {
    access_until: null,
    asaas_subscription_id: subscriptionId,
    asaas_subscription_state: "active",
    cancel_at_period_end: false,
    cancellation_requested_at: null,
    reactivation_requested_at: null,
    status: "ativo",
    valor: value,
  };
  if (customerId) values.asaas_customer_id = customerId;
  if (nextDueDate) values.next_due_date = nextDueDate;
  if (portalUrl) values.portal_url = portalUrl;

  const { error: subscriptionError } = await admin.from("subscriptions")
    .update(values)
    .eq("id", subscription.id)
    .eq("tenant_id", tenant.id);
  if (subscriptionError) throw subscriptionError;
  const { error: activateTenantError } = await admin.from("tenants")
    .update({ canceled_at: null, status: "ativo" })
    .eq("id", tenant.id);
  if (activateTenantError) throw activateTenantError;
  const { error: intentError } = await admin.from("signup_intents")
    .update({
      asaas_customer_id: customerId,
      asaas_subscription_id: subscriptionId,
      provisioned_tenant_id: tenant.id,
      status: "pago",
    })
    .eq("id", intent.id)
    .eq("target_tenant_id", tenant.id);
  if (intentError) throw intentError;
  if (intent.status !== "pago") {
    await recordProductMetric("payment_confirmed", tenant.id);
    await recordProductMetric("subscription_reactivated", tenant.id);
  }
}
