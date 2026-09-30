// Política de pagamento em atraso, compartilhada pelo painel, pelo webhook e
// pela Scheduled Function da Netlify. As mesmas regras estão refletidas no
// banco (get_public_catalog e RPCs de atraso); mantenha os números alinhados.
//
// `overdue_since` guarda a data de vencimento da cobrança não paga. O dia N do
// atraso é a diferença, em dias do calendário de São Paulo, entre hoje e essa
// data. A loja fica no ar do dia 0 ao 7, sai do ar a partir do dia 8 e a
// assinatura é encerrada no dia 30. Avisos por e-mail nos dias 1, 6 e 25.

export const OVERDUE_LAST_ONLINE_DAY = 7;
export const OVERDUE_SUSPENSION_DAY = 8;
export const OVERDUE_CANCELLATION_DAY = 30;
export const OVERDUE_NOTICE_DAYS = /** @type {const} */ ([1, 6, 25]);

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/** @param {string} value */
function assertIsoDate(value) {
  if (!DATE_PATTERN.test(value)) throw new Error("Data de atraso inválida.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error("Data de atraso inválida.");
  }
  return date;
}

/** Data atual no calendário de São Paulo (YYYY-MM-DD). */
export function brazilToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

/**
 * @param {string} date
 * @param {number} days
 */
export function addDays(date, days) {
  return new Date(assertIsoDate(date).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Dia do atraso (0 no vencimento, 1 no primeiro dia depois dele).
 * @param {string} overdueSince
 * @param {string} today
 */
export function overdueDay(overdueSince, today) {
  return Math.round((assertIsoDate(today).getTime() - assertIsoDate(overdueSince).getTime()) / DAY_MS);
}

/**
 * @param {number} day
 * @returns {"online" | "suspended" | "cancellation_due"}
 */
export function overduePhase(day) {
  if (day >= OVERDUE_CANCELLATION_DAY) return "cancellation_due";
  if (day >= OVERDUE_SUSPENSION_DAY) return "suspended";
  return "online";
}

/**
 * Aviso que deve ser enviado agora, ou null. Se uma execução atrasar, envia
 * apenas o aviso mais recente aplicável e não repete os anteriores.
 * @param {number} day
 * @param {number} lastNoticeDay
 */
export function dueOverdueNotice(day, lastNoticeDay) {
  if (day >= OVERDUE_CANCELLATION_DAY) return null;
  const applicable = OVERDUE_NOTICE_DAYS.filter((noticeDay) => noticeDay <= day).at(-1);
  return applicable && applicable > lastNoticeDay ? applicable : null;
}

/**
 * Datas relevantes para comunicar o atraso ao titular.
 * @param {string} overdueSince
 */
export function overdueMilestones(overdueSince) {
  return {
    cancellationDate: addDays(overdueSince, OVERDUE_CANCELLATION_DAY),
    lastOnlineDate: addDays(overdueSince, OVERDUE_LAST_ONLINE_DAY),
    suspensionDate: addDays(overdueSince, OVERDUE_SUSPENSION_DAY),
  };
}

/**
 * Resumo do atraso para a interface do titular, ou null quando não há atraso
 * ativo (inclui cancelamento agendado, que segue a própria regra).
 * @param {{ cancelAtPeriodEnd: boolean, overdueInvoiceUrl: string | null, overdueSince: string | null, status: string }} subscription
 * @param {string} today
 */
export function overdueSituation(subscription, today) {
  if (subscription.status !== "atrasado" || subscription.cancelAtPeriodEnd || !subscription.overdueSince) {
    return null;
  }
  const day = overdueDay(subscription.overdueSince, today);
  return {
    ...overdueMilestones(subscription.overdueSince),
    day,
    invoiceUrl: officialAsaasInvoiceUrl(subscription.overdueInvoiceUrl),
    phase: overduePhase(day),
  };
}

/**
 * Aceita somente faturas hospedadas pelo Asaas, evitando que um valor
 * inesperado vire link de pagamento em e-mails ou no painel.
 * @param {string | null | undefined} value
 */
export function officialAsaasInvoiceUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    const official = hostname === "asaas.com" || hostname.endsWith(".asaas.com");
    return url.protocol === "https:" && official && !url.username && !url.password && !url.port
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
