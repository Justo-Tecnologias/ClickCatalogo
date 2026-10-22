import type { PublicProductMetricName } from "@/lib/analytics/events";
import { type AcquisitionOrigin, parseAcquisitionOrigin } from "@/lib/analytics/origins";

const ORIGIN_STORAGE_KEY = "clickcatalogo-origem";

// Canal do link de divulgação (?origem=bio). Fica guardado só na aba aberta
// (sessionStorage), para atribuir as etapas seguintes do cadastro. É uma
// etiqueta do canal, não um identificador da pessoa; some ao fechar a aba.
export function currentAcquisitionOrigin(): AcquisitionOrigin | null {
  if (typeof window === "undefined") return null;
  const fromUrl = parseAcquisitionOrigin(new URLSearchParams(window.location.search).get("origem"));
  try {
    if (fromUrl) {
      window.sessionStorage.setItem(ORIGIN_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    return parseAcquisitionOrigin(window.sessionStorage.getItem(ORIGIN_STORAGE_KEY));
  } catch {
    return fromUrl;
  }
}

export function trackProductMetric(event: PublicProductMetricName, slug?: string) {
  // Eventos de uma loja são contados no escopo dela, nunca por canal.
  const origem = slug ? undefined : currentAcquisitionOrigin() ?? undefined;
  void fetch("/api/analytics", {
    body: JSON.stringify({ event, origem, slug }),
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}
