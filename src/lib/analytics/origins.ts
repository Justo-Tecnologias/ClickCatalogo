import type { ProductMetricName } from "@/lib/analytics/events";

// Canais dos links de divulgação (?origem=). Lista fechada: valores fora dela
// são ignorados, para o relatório não receber etiquetas inventadas.
// Links prontos para cada canal: docs/LINKS-DIVULGACAO.md.
export const acquisitionOrigins = {
  bio: "Link da bio do Instagram",
  post: "Legenda ou comentário de post",
  story: "Stories",
  facebook: "Facebook",
  whatsapp: "WhatsApp (status ou conversas)",
  dm: "Mensagem direta (abordagem)",
  grupo: "Grupos e comunidades",
  loja: "Rodapé de uma loja ClickCatálogo",
  email: "E-mail",
  indicacao: "Indicação",
} as const;

export type AcquisitionOrigin = keyof typeof acquisitionOrigins;

export const acquisitionOriginNames = Object.keys(acquisitionOrigins) as AcquisitionOrigin[];

// Etapas de aquisição também contadas por canal. A lista do banco
// (acquisition_metrics_daily) precisa ser igual; um teste confere isso.
export const acquisitionMetricNames = [
  "landing_view",
  "how_it_works_view",
  "signup_started",
  "signup_step_completed",
  "draft_created",
] as const satisfies readonly ProductMetricName[];

export type AcquisitionMetricName = (typeof acquisitionMetricNames)[number];

export function parseAcquisitionOrigin(value: unknown): AcquisitionOrigin | null {
  if (typeof value !== "string") return null;
  const origin = value.trim().toLowerCase();
  return Object.hasOwn(acquisitionOrigins, origin) ? origin as AcquisitionOrigin : null;
}

export function isAcquisitionMetric(event: string): event is AcquisitionMetricName {
  return (acquisitionMetricNames as readonly string[]).includes(event);
}
