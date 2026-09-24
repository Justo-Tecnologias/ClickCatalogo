const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SETTLED_CARD_PAYMENT_STATUSES = new Set(["CONFIRMED", "RECEIVED"]);
const MAX_MONTHLY_GAP_DAYS = 35;
const MIN_MONTHLY_GAP_DAYS = 25;

/** @param {string} value */
function isValidIsoDate(value) {
  if (!DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** @param {string} date */
function nextMonthlyDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  const targetMonth = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(targetMonth.getUTCFullYear(), targetMonth.getUTCMonth(), Math.min(day, lastDay)))
    .toISOString().slice(0, 10);
}

/**
 * @typedef {{ billingType?: string | null, dueDate: string, id?: string, status: string, subscription?: string | null }} Payment
 * @param {Payment[]} payments
 * @param {string} subscriptionId
 * @param {string | null | undefined} remoteNextDueDate
 */
export function authoritativePaidThroughDate(payments, subscriptionId, remoteNextDueDate) {
  const latestSettledDueDate = payments
    .filter((payment) => payment.billingType === "CREDIT_CARD"
      && SETTLED_CARD_PAYMENT_STATUSES.has(payment.status)
      && isValidIsoDate(payment.dueDate)
      && (!payment.subscription || payment.subscription === subscriptionId))
    .map((payment) => payment.dueDate)
    .sort()
    .at(-1);

  if (!latestSettledDueDate) {
    throw new Error("Nenhuma cobrança paga foi encontrada para definir o período de acesso.");
  }

  // A recorrência do ClickCatálogo é mensal. Uma data remota que pulou um ciclo
  // não comprova que o mês intermediário foi pago.
  const latestTime = Date.parse(`${latestSettledDueDate}T00:00:00.000Z`);
  const isNextMonthlyBoundary = (date) => isValidIsoDate(date)
    && date > latestSettledDueDate
    && (Date.parse(`${date}T00:00:00.000Z`) - latestTime) / 86_400_000 >= MIN_MONTHLY_GAP_DAYS
    && (Date.parse(`${date}T00:00:00.000Z`) - latestTime) / 86_400_000 <= MAX_MONTHLY_GAP_DAYS;
  const nextGeneratedDueDate = payments
    .filter((payment) => (!payment.subscription || payment.subscription === subscriptionId)
      && isNextMonthlyBoundary(payment.dueDate))
    .map((payment) => payment.dueDate)
    .sort()
    .at(0);

  if (nextGeneratedDueDate) return nextGeneratedDueDate;
  if (remoteNextDueDate && isNextMonthlyBoundary(remoteNextDueDate)) return remoteNextDueDate;
  return nextMonthlyDate(latestSettledDueDate);
}

/** @param {string} value */
export function brazilDateStartAsIso(value) {
  if (!isValidIsoDate(value)) throw new Error("Data do período pago inválida.");
  const [year, month, day] = value.split("-").map(Number);
  const utcMidnight = Date.UTC(year, month - 1, day);
  const partsFor = (instant) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    day: "2-digit", hour: "2-digit", hourCycle: "h23", minute: "2-digit",
    month: "2-digit", second: "2-digit", timeZone: "America/Sao_Paulo", year: "numeric",
  }).formatToParts(instant).map((part) => [part.type, part.value]));
  const parts = partsFor(new Date(utcMidnight));
  const representedAsUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second));
  const result = new Date(utcMidnight - (representedAsUtc - utcMidnight));
  const actual = partsFor(result);
  if (Number(actual.year) !== year || Number(actual.month) !== month
    || Number(actual.day) !== day || Number(actual.hour) !== 0) {
    throw new Error("Não foi possível calcular o fim do período pago.");
  }
  return result.toISOString();
}
