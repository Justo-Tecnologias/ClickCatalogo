"use client";

import Link from "next/link";

import { trackProductMetric } from "@/lib/analytics/client";

// Crédito discreto do rodapé da loja. O texto não muda (a loja é do lojista);
// o clique só é contado, por loja, para medir o interesse de quem visita.
export function BrandCredit({ analyticsSlug }: { analyticsSlug?: string }) {
  return (
    <Link
      className="rounded-sm font-semibold text-[var(--cor-texto)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color:var(--cor-primaria)]/30"
      href="/"
      onClick={() => {
        if (analyticsSlug) trackProductMetric("store_brand_clicked", analyticsSlug);
      }}
    >
      ClickCatálogo
    </Link>
  );
}
