import "server-only";

import { addDays, brazilToday } from "@/lib/billing/overdue-policy.mjs";
import { logError } from "@/lib/observability/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export const STORE_STAT_EVENTS = ["catalog_view", "whatsapp_order_clicked", "catalog_shared"] as const;
export type StoreStatEvent = (typeof STORE_STAT_EVENTS)[number];

export type StoreStat = { current: number; event: StoreStatEvent; previous: number };

const WINDOW_DAYS = 7;

/**
 * Soma os contadores diários da loja: últimos 7 dias (incluindo hoje, no
 * calendário de São Paulo) e os 7 dias anteriores. A tabela não tem acesso pelo
 * usuário (RLS), então a leitura usa a service role filtrada pelo tenant da
 * sessão — nunca por um id vindo do navegador.
 */
export async function getStoreWeeklyStats(tenantId: string): Promise<StoreStat[] | null> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;

  const today = brazilToday();
  const currentStart = addDays(today, -(WINDOW_DAYS - 1));
  const previousStart = addDays(today, -(WINDOW_DAYS * 2 - 1));

  try {
    const { data, error } = await createAdminClient()
      .from("product_metrics_daily")
      .select("metric_date,event_name,event_count")
      .eq("scope_key", tenantId)
      .in("event_name", [...STORE_STAT_EVENTS])
      .gte("metric_date", previousStart)
      .lte("metric_date", today);
    if (error) throw error;

    return STORE_STAT_EVENTS.map((event) => {
      const rows = (data ?? []).filter((row) => row.event_name === event);
      const sum = (from: string, to: string) => rows
        .filter((row) => row.metric_date >= from && row.metric_date <= to)
        .reduce((total, row) => total + Number(row.event_count), 0);
      return {
        current: sum(currentStart, today),
        event,
        previous: sum(previousStart, addDays(currentStart, -1)),
      };
    });
  } catch (error) {
    // Métricas são complementares: falha na leitura não pode quebrar o painel.
    logError("analytics.store_weekly_stats", error, { tenant_id: tenantId });
    return null;
  }
}
