import "server-only";

import type { ProductMetricName } from "@/lib/analytics/events";
import type { AcquisitionMetricName, AcquisitionOrigin } from "@/lib/analytics/origins";
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

// Contagem extra por canal (?origem=), em tabela própria: o funil geral de
// product_metrics_daily continua contando cada ocorrência uma única vez.
export async function recordAcquisitionMetric(
  eventName: AcquisitionMetricName,
  origin: AcquisitionOrigin,
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;

  try {
    const { error } = await createAdminClient().rpc("increment_acquisition_metric", {
      p_event_name: eventName,
      p_origem: origin,
    });
    if (error) throw error;
  } catch (error) {
    logError("analytics.acquisition", error, {
      metric_name: eventName,
      origin,
    });
  }
}
