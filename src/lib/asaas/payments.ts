export type AsaasSubscriptionPayment = {
  billingType?: string | null;
  dueDate: string;
  id: string;
  status: string;
  subscription?: string | null;
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SETTLED_CARD_PAYMENT_STATUSES = new Set(["CONFIRMED", "RECEIVED"]);

function isValidIsoDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function belongsToSubscription(payment: AsaasSubscriptionPayment, subscriptionId: string) {
  return !payment.subscription || payment.subscription === subscriptionId;
}

export function authoritativePaidThroughDate(
  payments: AsaasSubscriptionPayment[],
  subscriptionId: string,
  remoteNextDueDate?: string | null,
) {
  const latestSettledDueDate = payments
    .filter((payment) => (
      payment.billingType === "CREDIT_CARD"
      && SETTLED_CARD_PAYMENT_STATUSES.has(payment.status)
      && isValidIsoDate(payment.dueDate)
      && belongsToSubscription(payment, subscriptionId)
    ))
    .map((payment) => payment.dueDate)
    .sort()
    .at(-1);

  if (!latestSettledDueDate) {
    throw new Error("Nenhuma cobrança paga foi encontrada para definir o período de acesso.");
  }

  const nextGeneratedDueDate = payments
    .filter((payment) => (
      isValidIsoDate(payment.dueDate)
      && payment.dueDate > latestSettledDueDate
      && belongsToSubscription(payment, subscriptionId)
    ))
    .map((payment) => payment.dueDate)
    .sort()
    .at(0);

  if (nextGeneratedDueDate) return nextGeneratedDueDate;
  if (remoteNextDueDate && isValidIsoDate(remoteNextDueDate) && remoteNextDueDate > latestSettledDueDate) {
    return remoteNextDueDate;
  }

  throw new Error("O Asaas não informou a próxima fronteira do período pago.");
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
