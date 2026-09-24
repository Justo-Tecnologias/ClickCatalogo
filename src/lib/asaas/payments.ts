import { authoritativePaidThroughDate } from "./paid-period.mjs";

export { authoritativePaidThroughDate };

export type AsaasSubscriptionPayment = {
  billingType?: string | null;
  dueDate: string;
  id: string;
  status: string;
  subscription?: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function belongsToSubscription(payment: AsaasSubscriptionPayment, subscriptionId: string) {
  return !payment.subscription || payment.subscription === subscriptionId;
}

export function selectSubscriptionPaymentsAtOrAfter(
  payments: AsaasSubscriptionPayment[],
  subscriptionId: string,
  cutoffDate: string,
) {
  if (!isValidIsoDate(cutoffDate)) {
    throw new Error("Data de corte inválida para conciliação.");
  }

  return payments.filter((payment) => (
    isValidIsoDate(payment.dueDate)
    && payment.dueDate >= cutoffDate
    && belongsToSubscription(payment, subscriptionId)
  ));
}

export function selectFuturePendingSubscriptionPayments(
  payments: AsaasSubscriptionPayment[],
  subscriptionId: string,
  accessUntilDate: string,
) {
  if (!isValidIsoDate(accessUntilDate)) {
    throw new Error("Data de corte inválida para conciliação.");
  }

  return payments.filter((payment) => (
    payment.status === "PENDING"
    && isValidIsoDate(payment.dueDate)
    && payment.dueDate >= accessUntilDate
    && belongsToSubscription(payment, subscriptionId)
  ));
}
