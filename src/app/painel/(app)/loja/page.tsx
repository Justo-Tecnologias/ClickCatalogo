import type { Metadata } from "next";

import { StoreSettingsForm } from "@/components/painel/store-settings-form";
import { StoreOnboardingChecklist, StoreShareActions, StoreTopActions } from "@/components/painel/store-launch-tools";
import { StoreSlugForm } from "@/components/painel/store-slug-form";
import { PageHeader } from "@/components/ui/page-header";
import { requireTenant } from "@/lib/auth/session";
import { DEMO_CATALOG } from "@/lib/demo/panel-demo";
import { createClient } from "@/lib/supabase/server";
import type { PublicCatalog } from "@/types/catalog";
import { getSiteUrl } from "@/lib/env/server";

export const metadata: Metadata = { title: "Minha loja" };
export const dynamic = "force-dynamic";

export default async function StorePage() {
  const { demo, tenant } = await requireTenant();
  if (demo) {
    const siteUrl = getSiteUrl();
    const storeUrl = `${siteUrl}/loja/${encodeURIComponent(DEMO_CATALOG.slug)}`;
    return (
      <div className="grid min-w-0 gap-5 pb-28 xl:gap-6 xl:pb-0 [&>*]:min-w-0">
        <PageHeader actions={<StoreTopActions storeHref={`/loja/${DEMO_CATALOG.slug}`} storeName={DEMO_CATALOG.nome_loja} storeUrl={storeUrl} />} description="Personalize o que seus clientes veem." eyebrow="Configuração" title="Minha loja" />
        <div className="order-3 xl:order-5"><StoreSettingsForm catalog={DEMO_CATALOG} /></div>
        <div className="order-4 xl:order-3"><StoreShareActions storeName={DEMO_CATALOG.nome_loja} storeUrl={storeUrl}><StoreSlugForm currentSlug={DEMO_CATALOG.slug} demo embedded hasActiveRedirects={false} siteUrl={siteUrl} /></StoreShareActions></div>
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data: categories }, { data: products }, { data: redirectSlugs }] = await Promise.all([
    supabase.from("categories").select("id,nome,ordem").eq("tenant_id", tenant.id).order("ordem").order("created_at"),
    supabase.from("products").select("id,nome,preco,descricao,imagem_url,variacao_info,ordem,category_id").eq("tenant_id", tenant.id).eq("ativo", true).order("ordem").order("created_at"),
    supabase.rpc("get_own_tenant_redirect_slugs"),
  ]);

  const catalog: PublicCatalog = {
    banner_url: tenant.banner_url,
    categorias: (categories ?? []).map((category) => ({ ...category, produtos: (products ?? []).filter((product) => product.category_id === category.id).map((product) => ({ descricao: product.descricao, id: product.id, imagem_url: product.imagem_url, nome: product.nome, ordem: product.ordem, preco: Number(product.preco), variacao_info: product.variacao_info })) })),
    descricao_curta: tenant.descricao_curta,
    endereco: tenant.endereco,
    instagram: tenant.instagram,
    logo_url: tenant.logo_url,
    nome_loja: tenant.nome_loja,
    slug: tenant.slug,
    status: tenant.status === "inadimplente" ? "inadimplente" : "ativo",
    tema: tenant.tema,
    whatsapp: tenant.whatsapp,
  };

  const activeProducts = catalog.categorias.reduce((total, category) => total + category.produtos.length, 0);
  const siteUrl = getSiteUrl();
  const storeUrl = `${siteUrl}/loja/${encodeURIComponent(catalog.slug)}`;
  return (
    <div className="grid min-w-0 gap-5 pb-28 xl:gap-6 xl:pb-0 [&>*]:min-w-0">
      <PageHeader actions={<StoreTopActions storeHref={`/loja/${catalog.slug}`} storeName={catalog.nome_loja} storeUrl={storeUrl} />} description="Personalize o que seus clientes veem." eyebrow="Configuração" title="Minha loja" />
      <div className="order-2"><StoreOnboardingChecklist bannerReady={Boolean(catalog.banner_url)} categoryCount={catalog.categorias.length} logoReady={Boolean(catalog.logo_url)} productCount={activeProducts} storeName={catalog.nome_loja} storeUrl={storeUrl} whatsappReady={Boolean(catalog.whatsapp)} /></div>
      <div className="order-3 xl:order-5"><StoreSettingsForm catalog={catalog} /></div>
      <div className="order-4 xl:order-3"><StoreShareActions storeName={catalog.nome_loja} storeUrl={storeUrl}><StoreSlugForm currentSlug={catalog.slug} embedded hasActiveRedirects={Boolean(redirectSlugs?.length)} siteUrl={siteUrl} /></StoreShareActions></div>
    </div>
  );
}
