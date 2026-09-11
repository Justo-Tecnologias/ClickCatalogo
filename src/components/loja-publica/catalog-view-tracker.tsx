"use client";

import { useEffect } from "react";

import { trackProductMetric } from "@/lib/analytics/client";

export function CatalogViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackProductMetric("catalog_view", slug);
  }, [slug]);

  return null;
}
