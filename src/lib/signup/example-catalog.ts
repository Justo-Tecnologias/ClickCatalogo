import "server-only";

import { SHOWCASE_NICHES, type ShowcaseNiche } from "@/lib/marketing/store-showcase";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Cria na loja recém-criada as categorias e os produtos de exemplo do nicho
 * escolhido na prévia (/exemplo). Os produtos ficam marcados com
 * exemplo = true: não contam para publicar e somem quando o titular os edita
 * ou apaga. As fotos são as da prévia, servidas pelo próprio site.
 */
export async function seedExampleCatalog(admin: AdminClient, tenantId: string, niche: ShowcaseNiche) {
  const template = SHOWCASE_NICHES[niche];
  const { data: categories, error: categoryError } = await admin.from("categories")
    .insert(template.categorias.map((category, ordem) => ({ nome: category.nome, ordem, tenant_id: tenantId })))
    .select("id,ordem");
  if (categoryError) throw categoryError;

  const categoryIdByOrder = new Map(categories.map((category) => [category.ordem, category.id]));
  const products = template.categorias.flatMap((category, categoryOrder) => category.produtos.map((product, ordem) => ({
    category_id: categoryIdByOrder.get(categoryOrder) as string,
    descricao: product.descricao,
    exemplo: true,
    imagem_url: product.imagem,
    nome: product.nome,
    ordem,
    preco: product.preco,
    tenant_id: tenantId,
    variacao_info: product.variacao,
  })));
  const { error: productError } = await admin.from("products").insert(products);
  if (productError) throw productError;
  return products.length;
}
