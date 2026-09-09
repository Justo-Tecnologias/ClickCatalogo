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
  | { kind: "unconfigured" };

const queryPublicStore = unstable_cache(async (slug: string): Promise<PublicStoreResult> => {
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
  return status === "cancelado" ? { kind: "canceled" } : { kind: "missing" };
}, ["public-store"], { revalidate: 60 });

export const getPublicStore = cache(queryPublicStore);
