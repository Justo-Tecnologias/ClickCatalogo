export type AccountContinuationState =
  | { type: "PAID_NEEDS_PASSWORD"; slug: string }
  | { type: "ACCOUNT_READY"; slug: string }
  | { type: "CHECKOUT_PENDING"; checkoutUrl: string }
  | { type: "PAYMENT_CONFIRMING" }
  | { type: "CHECKOUT_RESTARTABLE" }
  | { type: "REACTIVATION_PENDING" }
  | { type: "CANCELED_RETAINED" }
  | { type: "TERMINAL" };

export type AccountContinuationResponse = {
  state: AccountContinuationState;
};
