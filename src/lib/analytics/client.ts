import type { PublicProductMetricName } from "@/lib/analytics/events";

export function trackProductMetric(event: PublicProductMetricName, slug?: string) {
  void fetch("/api/analytics", {
    body: JSON.stringify({ event, slug }),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}
