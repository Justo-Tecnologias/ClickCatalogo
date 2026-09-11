import "server-only";

import type { ProductMetricName } from "@/lib/analytics/events";
import { logError } from "@/lib/observability/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export async function recordProductMetric(
  eventName: ProductMetricName,
  tenantId: string | null = null,
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const { error } = await createAdminClient().rpc("increment_product_metric", {
      p_event_name: eventName,
      p_tenant_id: tenantId,
    });
    if (error) throw error;
  } catch (error) {
    // Métricas nunca podem interromper cadastro, pagamento ou pedido.
    logError("analytics.aggregate", error, {
      metric_name: eventName,
      tenant_id: tenantId,
    });
  }
}
