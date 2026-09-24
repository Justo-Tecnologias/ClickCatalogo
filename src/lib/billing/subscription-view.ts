export type SubscriptionViewState =
  | "active"
  | "past_due"
  | "cancelling"
  | "cancelled_with_access"
  | "resuming"
  | "ending"
  | "ended";

export type SubscriptionSituation = "active" | "cancelled" | "ended";

export type SubscriptionViewInput = {
  accessUntil: string | null;
  cancelAtPeriodEnd: boolean;
  reconciliationStatus: "attention" | "complete" | "not_required" | "pending" | "processing";
  reactivationRequestedAt: string | null;
  status: "ativo" | "atrasado" | "cancelado";
};

export function subscriptionViewState(input: SubscriptionViewInput, now = Date.now()): SubscriptionViewState {
  if (input.status === "cancelado") return input.reconciliationStatus === "complete" || input.reconciliationStatus === "not_required" ? "ended" : "ending";
  if (input.cancelAtPeriodEnd) {
    if (input.reactivationRequestedAt) return "resuming";
    if (input.accessUntil && new Date(input.accessUntil).getTime() <= now) return "ending";
    if (input.reconciliationStatus !== "complete" || !input.accessUntil) return "cancelling";
    return "cancelled_with_access";
  }
  return input.status === "atrasado" ? "past_due" : "active";
}

// A interface apresenta somente situações confirmadas. Os estados técnicos
// intermediários continuam sendo usados para mensagens e ações temporárias.
export function subscriptionSituation(state: SubscriptionViewState): SubscriptionSituation {
  if (state === "ended") return "ended";
  if (state === "cancelled_with_access" || state === "resuming" || state === "ending") {
    return "cancelled";
  }
  return "active";
}
