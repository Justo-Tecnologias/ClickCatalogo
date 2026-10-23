"use client";

import { type ReactNode, useState } from "react";

import { MiniStorePreview } from "@/components/marketing/mini-store-preview";
import { ShowcaseForm } from "@/components/marketing/showcase-form";
import { SHOWCASE_NICHES, type ShowcaseNiche } from "@/lib/marketing/store-showcase";

// Formulário da prévia com a miniatura ao lado: o celular acompanha o nome
// digitado e o nicho escolhido, antes mesmo de abrir /exemplo.
export function ShowcaseLive({ defaultNiche = "doces", footer, intro }: { defaultNiche?: ShowcaseNiche; footer?: ReactNode; intro: ReactNode }) {
  const [storeName, setStoreName] = useState("");
  const [niche, setNiche] = useState<ShowcaseNiche>(defaultNiche);

  return (
    <div className="grid items-center gap-8 md:grid-cols-[1fr_auto]">
      <div>
        {intro}
        <ShowcaseForm
          className="mt-6"
          defaultNiche={defaultNiche}
          onFieldChange={(name, value) => {
            if (name === "nome") setStoreName(value);
            if (name === "nicho" && Object.hasOwn(SHOWCASE_NICHES, value)) setNiche(value as ShowcaseNiche);
          }}
        />
        {footer}
      </div>
      <MiniStorePreview niche={niche} storeName={storeName.trim() || "Sua loja"} />
    </div>
  );
}
