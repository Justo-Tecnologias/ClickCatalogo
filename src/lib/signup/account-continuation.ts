import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import type { AccountContinuationState } from "@/lib/signup/continuation-types";
import { decideAccountContinuationState } from "@/lib/signup/continuation-state";

type AdminClient = ReturnType<typeof createAdminClient>;

export type InternalContinuationState = AccountContinuationState & {
  intentId?: string;
  intentType?: "reactivation" | "signup";
  tenantId?: string;
};

export async function resolveAccountContinuationState(
  admin: AdminClient,
  externalReference: string,
): Promise<InternalContinuationState> {
  const { data: intent, error: intentError } = await admin
    .from("signup_intents")
    .select("id,email,status,intent_type,provisioned_tenant_id,target_tenant_id,slug,asaas_checkout_url,asaas_checkout_expires_at,checkout_creation_started_at,checkout_returned_at")
    .eq("external_reference", externalReference)
    .maybeSingle();
  if (intentError) throw intentError;
  if (!intent) return { type: "TERMINAL" };

  const identity = { intentId: intent.id, intentType: intent.intent_type };

  if (intent.status !== "pago") return {
    ...identity,
    ...decideAccountContinuationState({
      checkoutCreationStartedAt: intent.checkout_creation_started_at,
      checkoutExpiresAt: intent.asaas_checkout_expires_at,
      checkoutReturnedAt: intent.checkout_returned_at,
      checkoutUrl: intent.asaas_checkout_url,
      hasIntent: true,
      hasTenant: false,
      intentStatus: intent.status,
      ownerHasPassword: false,
      reconciliationStatus: null,
      reactivationRequestedAt: null,
      slug: null,
      tenantStatus: null,
    }),
  };

  const tenantId = intent.provisioned_tenant_id ?? intent.target_tenant_id;
  if (!tenantId) return { ...identity, type: "PAYMENT_CONFIRMING" };

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("id,owner_user_id,slug,status")
    .eq("id", tenantId)
    .maybeSingle();
  if (tenantError) throw tenantError;
  if (!tenant) return { ...identity, type: "TERMINAL" };

  const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(tenant.owner_user_id);
  if (ownerError) throw ownerError;
  if (!owner.user || owner.user.email?.trim().toLowerCase() !== intent.email.trim().toLowerCase()) {
    return { ...identity, type: "TERMINAL" };
  }
  let reconciliationStatus: string | null = null;
  let reactivationRequestedAt: string | null = null;
  if (tenant.status === "cancelado") {
    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .select("cancellation_reconciliation_status,reactivation_requested_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (subscriptionError) throw subscriptionError;
    reconciliationStatus = subscription?.cancellation_reconciliation_status ?? null;
    reactivationRequestedAt = subscription?.reactivation_requested_at ?? null;
  }

  return {
    ...identity,
    ...decideAccountContinuationState({
      checkoutCreationStartedAt: intent.checkout_creation_started_at,
      checkoutExpiresAt: intent.asaas_checkout_expires_at,
      checkoutReturnedAt: intent.checkout_returned_at,
      checkoutUrl: intent.asaas_checkout_url,
      hasIntent: true,
      hasTenant: true,
      intentStatus: intent.status,
      ownerHasPassword: Boolean(owner.user?.app_metadata?.catalogoja_password_configured_at),
      reconciliationStatus,
      reactivationRequestedAt,
      slug: tenant.slug,
      tenantStatus: tenant.status,
    }),
    tenantId: tenant.id,
  };
}

export function publicContinuationState(state: InternalContinuationState): AccountContinuationState {
  switch (state.type) {
    case "PAID_NEEDS_PASSWORD":
    case "ACCOUNT_READY":
      return { slug: state.slug, type: state.type };
    case "CHECKOUT_PENDING":
      return { checkoutUrl: state.checkoutUrl, type: state.type };
    default:
      return { type: state.type };
  }
}
