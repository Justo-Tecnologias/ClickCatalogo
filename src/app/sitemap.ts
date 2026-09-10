import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/env/public";
import { createAdminClient } from "@/lib/supabase/admin";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const staticPages: MetadataRoute.Sitemap = [
    { changeFrequency: "weekly", priority: 1, url: siteUrl },
    { changeFrequency: "monthly", priority: 0.4, url: `${siteUrl}/atendimento` },
    { changeFrequency: "monthly", priority: 0.3, url: `${siteUrl}/termos` },
    { changeFrequency: "monthly", priority: 0.3, url: `${siteUrl}/privacidade` },
  ];

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return staticPages;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("tenants")
      .select("slug,updated_at")
      .eq("status", "ativo")
      .order("updated_at", { ascending: false });
    if (error) throw error;

    return [
      ...staticPages,
      ...(data ?? []).map((tenant) => ({
        changeFrequency: "daily" as const,
        lastModified: tenant.updated_at,
        priority: 0.7,
        url: `${siteUrl}/loja/${encodeURIComponent(tenant.slug)}`,
      })),
    ];
  } catch (error) {
    console.error(
      "Não foi possível incluir as lojas no sitemap:",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return staticPages;
  }
}
