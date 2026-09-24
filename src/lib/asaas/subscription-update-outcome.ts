export function classifySubscriptionUpdateResponse(status: number) {
  if (status >= 200 && status < 300) return "updated" as const;
  if (status === 404) return "deleted" as const;
  if (status >= 500) return "unknown" as const;
  return "rejected" as const;
}
