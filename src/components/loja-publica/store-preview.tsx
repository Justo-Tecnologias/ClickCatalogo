import { StoreCatalog } from "@/components/loja-publica/store-catalog";
import { CatalogViewTracker } from "@/components/loja-publica/catalog-view-tracker";
import { StoreFooter } from "@/components/loja-publica/store-footer";
import { StoreHeader } from "@/components/loja-publica/store-header";
import { cn } from "@/lib/utils/cn";
import type { PublicCatalog } from "@/types/catalog";
import type { TenantTheme } from "@/types/database";

export type StorePreviewProps = {
  catalog: PublicCatalog;
  className?: string;
  framed?: boolean;
  theme?: TenantTheme;
};

export function StorePreview({
  catalog,
  className,
  framed = false,
  theme = catalog.tema,
}: StorePreviewProps) {
  const categoriesWithProducts = catalog.categorias.filter(
    (category) => category.produtos.length > 0,
  );

  return (
    <div
      className={cn(
        "@container/store min-h-screen overflow-clip bg-[var(--cor-fundo)] text-[var(--cor-texto)]",
        framed &&
          "min-h-full rounded-[var(--radius-panel)] border border-[var(--cor-borda)] shadow-[var(--shadow-elevation)]",
        className,
      )}
      data-tema={theme}
    >
      {!framed ? <CatalogViewTracker slug={catalog.slug} /> : null}
      <StoreHeader
        bannerUrl={catalog.banner_url}
        description={catalog.descricao_curta}
        framed={framed}
        logoUrl={catalog.logo_url}
        storeName={catalog.nome_loja}
        whatsapp={catalog.whatsapp}
      />
      <StoreCatalog
        categories={categoriesWithProducts}
        enableCart={!framed}
        framed={framed}
        analyticsSlug={!framed ? catalog.slug : undefined}
        storeName={catalog.nome_loja}
        whatsapp={catalog.whatsapp}
      />

      <StoreFooter
        address={catalog.endereco}
        instagram={catalog.instagram}
        storeName={catalog.nome_loja}
      />
    </div>
  );
}
