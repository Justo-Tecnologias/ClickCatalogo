export const ACCOUNT_DELETION_REQUEST_DELAY_DAYS = 15;
export const CANCELED_ACCOUNT_RETENTION_DAYS = 30;
export const OPERATIONAL_SIGNUP_RETENTION_DAYS = 90;
export const WEBHOOK_PAYLOAD_RETENTION_DAYS = 180;
export const LEGAL_EVIDENCE_RETENTION_YEARS = 5;

export function addUtcDays(value: Date | string, days: number) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

export function defaultDeletionDate(canceledAt: string) {
  return addUtcDays(canceledAt, CANCELED_ACCOUNT_RETENTION_DAYS);
}

export function requestedDeletionDate(now = new Date()) {
  return addUtcDays(now, ACCOUNT_DELETION_REQUEST_DELAY_DAYS);
}
