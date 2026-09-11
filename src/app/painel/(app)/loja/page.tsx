import type { Metadata } from "next";

import { StoreSettingsForm } from "@/components/painel/store-settings-form";
import { StoreLaunchTools } from "@/components/painel/store-launch-tools";
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
    return <div className="grid gap-7"><PageHeader description="Personalize a identidade e as informações que seus clientes veem." eyebrow="Configuração" title="Minha loja" /><StoreSettingsForm catalog={DEMO_CATALOG} /></div>;
  }
  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("id,nome,ordem").eq("tenant_id", tenant.id).order("ordem").order("created_at"),
    supabase.from("products").select("id,nome,preco,descricao,imagem_url,variacao_info,ordem,category_id").eq("tenant_id", tenant.id).eq("ativo", true).order("ordem").order("created_at"),
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
  return <div className="grid gap-7"><PageHeader description="Personalize a identidade e as informações que seus clientes veem." eyebrow="Configuração" title="Minha loja" /><StoreLaunchTools bannerReady={Boolean(catalog.banner_url)} categoryCount={catalog.categorias.length} logoReady={Boolean(catalog.logo_url)} productCount={activeProducts} storeName={catalog.nome_loja} storeUrl={`${getSiteUrl()}/loja/${encodeURIComponent(catalog.slug)}`} whatsappReady={Boolean(catalog.whatsapp)} /><StoreSettingsForm catalog={catalog} /></div>;
}
