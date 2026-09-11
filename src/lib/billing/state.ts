export type ScheduledAccess = {
  accessUntil: string | null;
  cancelAtPeriodEnd: boolean;
};

export function scheduledAccessIsActive(input: ScheduledAccess, now = Date.now()) {
  return input.cancelAtPeriodEnd
    && Boolean(input.accessUntil)
    && new Date(input.accessUntil!).getTime() > now;
}

export function canRevertScheduledCancellation(input: ScheduledAccess, now = Date.now()) {
  return scheduledAccessIsActive(input, now);
}

export function overdueEventIsOlder(eventDueDate: string | null, currentNextDueDate: string | null) {
  return Boolean(eventDueDate && currentNextDueDate && eventDueDate < currentNextDueDate);
}
