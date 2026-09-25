import "server-only";

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env/public";
import { DEMO_CATALOG, DEMO_TENANT, isDemoAccessEnabled } from "@/lib/demo/panel-demo";
import { createPublicClient } from "@/lib/supabase/public";
import { tenantSlugSchema } from "@/lib/tenants/slug";
import type { PublicCatalog } from "@/types/catalog";

const productSchema = z.object({
  descricao: z.string().nullable(),
  id: z.uuid(),
  imagem_url: z.string().nullable(),
  link_externo: z.url().nullable().optional().default(null),
  nome: z.string(),
  ordem: z.number(),
  preco: z.coerce.number(),
  variacao_info: z.string().nullable(),
});

const publicCatalogSchema = z.object({
  banner_url: z.string().nullable(),
  categorias: z.array(z.object({ id: z.uuid(), nome: z.string(), ordem: z.number(), produtos: z.array(productSchema) })),
  descricao_curta: z.string().nullable(),
  endereco: z.string().nullable(),
  instagram: z.string().nullable(),
  logo_url: z.string().nullable(),
  nome_loja: z.string(),
  slug: z.string(),
  status: z.enum(["ativo", "inadimplente"]),
  tema: z.enum(["classico", "natural", "tech", "delivery", "elegante", "minimal"]),
  whatsapp: z.string(),
});

export type PublicStoreResult =
  | { catalog: PublicCatalog; kind: "available" }
  | { kind: "canceled" }
  | { kind: "missing" }
  | { kind: "redirect"; slug: string }
  | { kind: "unconfigured" };

type CachedPublicStoreResult = Exclude<PublicStoreResult, { kind: "redirect" }>;

const queryPublicStore = unstable_cache(async (slug: string): Promise<CachedPublicStoreResult> => {
  const parsedSlug = tenantSlugSchema.safeParse(slug);
  if (!parsedSlug.success) return { kind: "missing" };

  slug = parsedSlug.data;
  if (slug === DEMO_TENANT.slug && isDemoAccessEnabled()) {
    return { catalog: DEMO_CATALOG, kind: "available" };
  }
  if (!isSupabaseConfigured()) return { kind: "unconfigured" };

  const supabase = createPublicClient();
  const { data, error } = await supabase.rpc("get_public_catalog", { p_slug: slug });
  if (error) throw new Error("Não foi possível consultar esta loja.");

  const parsed = publicCatalogSchema.safeParse(data);
  if (parsed.success) return { catalog: parsed.data, kind: "available" };

  const { data: status, error: statusError } = await supabase.rpc("get_public_store_status", { p_slug: slug });
  if (statusError) throw new Error("Não foi possível verificar o status desta loja.");
  if (status === "cancelado") return { kind: "canceled" };

  return { kind: "missing" };
}, ["public-store"], { revalidate: 60 });

export const getPublicStore = cache(async (slug: string): Promise<PublicStoreResult> => {
  const result = await queryPublicStore(slug);
  if (result.kind !== "missing" || !isSupabaseConfigured()) return result;

  const parsedSlug = tenantSlugSchema.safeParse(slug);
  if (!parsedSlug.success) return result;

  // O destino de um endereço antigo não entra no cache de 60 segundos. Assim,
  // qualquer alias sempre resolve diretamente para o slug atual da loja.
  const supabase = createPublicClient();
  const { data: redirectSlug, error } = await supabase.rpc("resolve_public_store_slug", { p_slug: parsedSlug.data });
  if (error) throw new Error("Não foi possível verificar o endereço desta loja.");
  return redirectSlug && redirectSlug !== parsedSlug.data ? { kind: "redirect", slug: redirectSlug } : result;
});
