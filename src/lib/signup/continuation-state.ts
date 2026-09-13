import type { AccountContinuationState } from "@/lib/signup/continuation-types";

export type ContinuationSnapshot = {
  checkoutCreationStartedAt: string | null;
  checkoutExpiresAt: string | null;
  checkoutReturnedAt: string | null;
  checkoutUrl: string | null;
  hasIntent: boolean;
  hasTenant: boolean;
  intentStatus: "cancelado" | "expirado" | "pago" | "pendente" | null;
  ownerHasPassword: boolean;
  reconciliationStatus: string | null;
  reactivationRequestedAt: string | null;
  slug: string | null;
  tenantStatus: string | null;
};

const CHECKOUT_CREATION_LEASE_MS = 2 * 60 * 1000;
const CHECKOUT_RETURN_CONFIRMATION_MS = 30 * 60 * 1000;

function officialCheckoutUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const officialHost = url.hostname === "asaas.com" || url.hostname.endsWith(".asaas.com");
    return url.protocol === "https:" && officialHost ? url.toString() : null;
  } catch {
    return null;
  }
}

function isRecent(value: string | null, durationMs: number, nowMs: number) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && nowMs - timestamp >= 0 && nowMs - timestamp < durationMs;
}

export function decideAccountContinuationState(
  snapshot: ContinuationSnapshot,
  nowMs = Date.now(),
): AccountContinuationState {
  if (!snapshot.hasIntent) return { type: "TERMINAL" };

  if (snapshot.intentStatus !== "pago") {
    const checkoutUrl = officialCheckoutUrl(snapshot.checkoutUrl);
    const checkoutExpiresAt = snapshot.checkoutExpiresAt
      ? new Date(snapshot.checkoutExpiresAt).getTime()
      : Number.NaN;

    if (isRecent(snapshot.checkoutReturnedAt, CHECKOUT_RETURN_CONFIRMATION_MS, nowMs)) {
      return { type: "PAYMENT_CONFIRMING" };
    }

    if (
      snapshot.intentStatus === "pendente"
      && checkoutUrl
      && Number.isFinite(checkoutExpiresAt)
      && checkoutExpiresAt > nowMs
    ) {
      return { checkoutUrl, type: "CHECKOUT_PENDING" };
    }

    if (isRecent(snapshot.checkoutCreationStartedAt, CHECKOUT_CREATION_LEASE_MS, nowMs)) {
      return { type: "PAYMENT_CONFIRMING" };
    }

    return { type: "CHECKOUT_RESTARTABLE" };
  }

  if (!snapshot.hasTenant || !snapshot.slug) return { type: "TERMINAL" };
  if (!snapshot.ownerHasPassword) {
    return { slug: snapshot.slug, type: "PAID_NEEDS_PASSWORD" };
  }

  if (snapshot.tenantStatus === "cancelado") {
    if (
      snapshot.reactivationRequestedAt
      || ["attention", "pending", "processing"].includes(snapshot.reconciliationStatus ?? "")
    ) {
      return { type: "REACTIVATION_PENDING" };
    }
    return { type: "CANCELED_RETAINED" };
  }

  return { slug: snapshot.slug, type: "ACCOUNT_READY" };
}
