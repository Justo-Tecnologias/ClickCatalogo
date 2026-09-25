"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { recordProductMetric } from "@/lib/analytics/server";
import { requireTenant } from "@/lib/auth/session";
import { validateCatalogImageUpload } from "@/lib/images/validate-upload";
import { createClient } from "@/lib/supabase/server";
import { parseBrazilianCurrency } from "@/lib/format/currency";
import type { Database } from "@/types/database";

const productSchema = z.object({
  ativo: z.boolean(),
  categoryId: z.uuid("Selecione uma categoria."),
  descricao: z.string().trim().max(1000).nullable(),
  id: z.uuid().optional(),
  linkExterno: z.preprocess(
    (value) => String(value ?? "").trim() || null,
    z.string()
      .max(2048, "O link deve ter no máximo 2.048 caracteres.")
      .url("Digite um link completo e válido.")
      .refine((value) => value.startsWith("https://"), "O link deve começar com https://.")
      .nullable(),
  ),
  nome: z.string().trim().min(1, "Digite o nome do produto.").max(120),
  preco: z.number()
    .min(0.01, "O preço deve ser maior que zero.")
    .max(99_999_999)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
      "Use no máximo duas casas decimais no preço.",
    ),
  variacaoInfo: z.string().trim().max(300).nullable(),
});

type SavedProduct = Pick<
  Database["public"]["Tables"]["products"]["Row"],
  "ativo" | "category_id" | "descricao" | "id" | "imagem_url" | "link_externo" | "nome" | "preco" | "variacao_info"
>;

function parsePrice(value: FormDataEntryValue | null) {
  return parseBrazilianCurrency(String(value ?? ""));
}

function extensionFor(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function storagePathFromUrl(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/produtos/";
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
}

export async function saveProductAction(formData: FormData): Promise<ActionResult<SavedProduct>> {
  const parsed = productSchema.safeParse({
    ativo: formData.get("ativo") !== "false",
    categoryId: formData.get("categoryId"),
    descricao: String(formData.get("descricao") ?? "").trim() || null,
    id: String(formData.get("id") ?? "") || undefined,
    linkExterno: formData.get("linkExterno"),
    nome: formData.get("nome"),
    preco: parsePrice(formData.get("preco")),
    variacaoInfo: String(formData.get("variacaoInfo") ?? "").trim() || null,
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", ok: false };

  const fileEntry = formData.get("imagem");
  const file = fileEntry instanceof File && fileEntry.size > 0 ? fileEntry : null;
  const removeImage = formData.get("removeImagem") === "true";
  if (file) {
    const validationError = await validateCatalogImageUpload(file);
    if (validationError) return { error: validationError, ok: false };
  }

  let uploadedPath: string | null = null;

  try {
    const { demo, tenant } = await requireTenant();
    if (demo) return { error: "O modo de demonstração não salva alterações.", ok: false };
    const supabase = await createClient();
    const { data: category } = await supabase.from("categories").select("id").eq("id", parsed.data.categoryId).eq("tenant_id", tenant.id).maybeSingle();
    if (!category) return { error: "A categoria escolhida não pertence à sua loja.", ok: false };

    let previousImageUrl: string | null = null;
    if (parsed.data.id) {
      const { data: product } = await supabase.from("products").select("imagem_url").eq("id", parsed.data.id).eq("tenant_id", tenant.id).maybeSingle();
      if (!product) return { error: "Produto não encontrado.", ok: false };
      previousImageUrl = product.imagem_url;
    }

    let imageUrl = removeImage ? null : previousImageUrl;
    if (file) {
      uploadedPath = `${tenant.id}/${crypto.randomUUID()}.${extensionFor(file)}`;
      const { error: uploadError } = await supabase.storage.from("produtos").upload(uploadedPath, file, { cacheControl: "3600", contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      imageUrl = supabase.storage.from("produtos").getPublicUrl(uploadedPath).data.publicUrl;
    }

    const values = {
      ativo: parsed.data.ativo,
      category_id: parsed.data.categoryId,
      descricao: parsed.data.descricao,
      imagem_url: imageUrl,
      link_externo: parsed.data.linkExterno,
      nome: parsed.data.nome,
      preco: parsed.data.preco,
      tenant_id: tenant.id,
      variacao_info: parsed.data.variacaoInfo,
    };

    let savedProduct: SavedProduct;
    const returnColumns = "ativo,category_id,descricao,id,imagem_url,link_externo,nome,preco,variacao_info";

    if (parsed.data.id) {
      const { data, error } = await supabase
        .from("products")
        .update(values)
        .eq("id", parsed.data.id)
        .eq("tenant_id", tenant.id)
        .select(returnColumns)
        .single();
      if (error) throw error;
      savedProduct = data;
    } else {
      const [{ count }, { count: totalCount }] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("category_id", parsed.data.categoryId),
        supabase.from("products").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
      ]);
      const { data, error } = await supabase
        .from("products")
        .insert({ ...values, ordem: count ?? 0 })
        .select(returnColumns)
        .single();
      if (error) throw error;
      savedProduct = data;
      if (totalCount === 0) await recordProductMetric("first_product_created", tenant.id);
      if (totalCount === 4) await recordProductMetric("fifth_product_created", tenant.id);
    }

    const previousPath = storagePathFromUrl(previousImageUrl);
    if ((uploadedPath || removeImage) && previousPath) {
      const { error: cleanupError } = await supabase.storage.from("produtos").remove([previousPath]);
      if (cleanupError) console.error("Falha ao remover imagem antiga do produto:", cleanupError.message);
    }

    revalidatePath("/painel/produtos");
    revalidatePath("/painel/loja");
    revalidatePath(`/loja/${tenant.slug}`);
    return { data: savedProduct, ok: true };
  } catch (error) {
    if (uploadedPath) {
      try {
        const supabase = await createClient();
        await supabase.storage.from("produtos").remove([uploadedPath]);
      } catch { /* A limpeza será feita posteriormente se a sessão tiver expirado. */ }
    }
    return actionError(error, "Não foi possível salvar o produto.");
  }
}

export async function toggleProductAction(id: string, ativo: boolean): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Produto inválido.", ok: false };
  try {
    const { demo, tenant } = await requireTenant();
    if (demo) return { error: "O modo de demonstração não altera a publicação.", ok: false };
    const supabase = await createClient();
    const { error } = await supabase.from("products").update({ ativo }).eq("id", id).eq("tenant_id", tenant.id);
    if (error) throw error;
    revalidatePath("/painel/produtos");
    revalidatePath(`/loja/${tenant.slug}`);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Não foi possível alterar a visibilidade do produto.");
  }
}

export async function deleteProductAction(id: string): Promise<ActionResult> {
  if (!z.uuid().safeParse(id).success) return { error: "Produto inválido.", ok: false };
  try {
    const { demo, tenant } = await requireTenant();
    if (demo) return { error: "O modo de demonstração não exclui dados.", ok: false };
    const supabase = await createClient();
    const { data: product } = await supabase.from("products").select("imagem_url").eq("id", id).eq("tenant_id", tenant.id).maybeSingle();
    if (!product) return { error: "Produto não encontrado.", ok: false };
    const { error } = await supabase.from("products").delete().eq("id", id).eq("tenant_id", tenant.id);
    if (error) throw error;
    const path = storagePathFromUrl(product.imagem_url);
    if (path) {
      const { error: cleanupError } = await supabase.storage.from("produtos").remove([path]);
      if (cleanupError) console.error("Falha ao remover imagem do produto excluído:", cleanupError.message);
    }
    revalidatePath("/painel/produtos");
    revalidatePath(`/loja/${tenant.slug}`);
    return { ok: true };
  } catch (error) {
    return actionError(error, "Não foi possível excluir o produto.");
  }
}
