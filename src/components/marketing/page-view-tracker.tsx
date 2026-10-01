"use client";

import { useEffect } from "react";

import { trackProductMetric } from "@/lib/analytics/client";

// Conta uma visita nas páginas de aquisição como contador diário agregado:
// sem cookies, identificadores ou dados pessoais.
export function PageViewTracker({ event }: { event: "how_it_works_view" | "landing_view" }) {
  useEffect(() => {
    trackProductMetric(event);
  }, [event]);

  return null;
}
