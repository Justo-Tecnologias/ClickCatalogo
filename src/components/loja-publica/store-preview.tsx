import { StoreCatalog } from "@/components/loja-publica/store-catalog";
import { CatalogViewTracker } from "@/components/loja-publica/catalog-view-tracker";
import { StoreFooter } from "@/components/loja-publica/store-footer";
import { StoreHeader } from "@/components/loja-publica/store-header";
import { cn } from "@/lib/utils/cn";
import type { PublicCatalog } from "@/types/catalog";
import type { TenantTheme } from "@/types/database";

export type StorePreviewProps = {
  canonicalUrl?: string;
  catalog: PublicCatalog;
  className?: string;
  /** Prévia de exemplo (/exemplo): carrinho ativo, sem métricas nem WhatsApp real. */
  demo?: { contactHref: string; signupHref: string };
  framed?: boolean;
  theme?: TenantTheme;
};

export function StorePreview({
  canonicalUrl,
  catalog,
  className,
  demo,
  framed = false,
  theme = catalog.tema,
}: StorePreviewProps) {
  const published = !framed && !demo;
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
      {published ? <CatalogViewTracker slug={catalog.slug} /> : null}
      <StoreHeader
        analyticsSlug={published ? catalog.slug : undefined}
        bannerOnly={Boolean(catalog.banner_somente)}
        bannerUrl={catalog.banner_url}
        contactHref={demo?.contactHref}
        description={catalog.descricao_curta}
        framed={framed}
        logoUrl={catalog.logo_url}
        shareUrl={published ? canonicalUrl : undefined}
        storeName={catalog.nome_loja}
        whatsapp={catalog.whatsapp}
      />
      <StoreCatalog
        categories={categoriesWithProducts}
        demoSignupHref={demo?.signupHref}
        enableCart={!framed}
        footer={(
          <StoreFooter
            address={catalog.endereco}
            analyticsSlug={published ? catalog.slug : undefined}
            contactHref={demo?.contactHref}
            instagram={catalog.instagram}
            serviceInfo={catalog}
            storeName={catalog.nome_loja}
            whatsapp={catalog.whatsapp}
          />
        )}
        framed={framed}
        analyticsSlug={published ? catalog.slug : undefined}
        serviceInfo={catalog}
        storeName={catalog.nome_loja}
        whatsapp={catalog.whatsapp}
      />
    </div>
  );
}
