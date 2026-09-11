export type RecurringCheckoutContractInput = {
  cancelUrl: string;
  description: string;
  externalReference: string;
  name: string;
  nextDueDate: string;
  successUrl: string;
  value: number;
};

export function recurringCheckoutPayload(input: RecurringCheckoutContractInput) {
  return {
    billingTypes: ["CREDIT_CARD"],
    callback: {
      cancelUrl: input.cancelUrl,
      expiredUrl: input.cancelUrl,
      successUrl: input.successUrl,
    },
    chargeTypes: ["RECURRENT"],
    externalReference: input.externalReference,
    items: [{
      description: input.description,
      name: input.name,
      quantity: 1,
      value: input.value,
    }],
    minutesToExpire: 60,
    subscription: { cycle: "MONTHLY", nextDueDate: input.nextDueDate },
  } as const;
}

export function subscriptionStatusPayload(
  status: "ACTIVE" | "INACTIVE",
  nextDueDate?: string,
) {
  return nextDueDate ? { nextDueDate, status } : { status };
}
