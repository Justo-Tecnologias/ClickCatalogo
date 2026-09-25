import type { Metadata } from "next";

import { ProductManager } from "@/components/painel/product-manager";
import { PageHeader } from "@/components/ui/page-header";
import { requireTenant } from "@/lib/auth/session";
import { DEMO_CATEGORIES, DEMO_PRODUCTS } from "@/lib/demo/panel-demo";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Produtos" };
export const dynamic = "force-dynamic";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const { demo, tenant } = await requireTenant();
  const { categoria } = await searchParams;
  if (demo) {
    return <div className="grid min-w-0 gap-7"><PageHeader description="Cadastre seus itens, atualize preços e escolha o que aparece na loja." eyebrow="Seu catálogo" title="Produtos" /><ProductManager categories={DEMO_CATEGORIES.map(({ id, nome }) => ({ id, nome }))} initialCategoryFilter={categoria} initialProducts={DEMO_PRODUCTS.map((product) => ({ ativo: product.ativo, category_id: product.category_id, descricao: product.descricao, id: product.id, imagem_url: product.imagem_url, link_externo: null, nome: product.nome, preco: Number(product.preco), variacao_info: product.variacao_info }))} /></div>;
  }
  const supabase = await createClient();
  const [{ data: categories, error: categoryError }, { data: products, error: productError }] = await Promise.all([
    supabase.from("categories").select("id,nome").eq("tenant_id", tenant.id).order("ordem").order("created_at"),
    supabase.from("products").select("id,nome,preco,descricao,imagem_url,link_externo,variacao_info,ativo,category_id").eq("tenant_id", tenant.id).order("ordem").order("created_at", { ascending: false }),
  ]);
  if (categoryError || productError) throw new Error("Não foi possível carregar os produtos.");

  return (
    <div className="grid min-w-0 gap-7">
      <PageHeader description="Cadastre seus itens, atualize preços e escolha o que aparece na loja." eyebrow="Seu catálogo" title="Produtos" />
      <ProductManager categories={categories ?? []} initialCategoryFilter={categoria} initialProducts={(products ?? []).map((product) => ({ ...product, preco: Number(product.preco) }))} />
    </div>
  );
}
