"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionError, type ActionResult } from "@/lib/actions/result";
import { requireTenant } from "@/lib/auth/session";
import { normalizeInstagramUsername } from "@/lib/instagram/username";
import { validateCatalogImageUpload } from "@/lib/images/validate-upload";
import { createClient } from "@/lib/supabase/server";
import type { TenantTheme } from "@/types/database";

const themes = ["classico", "natural", "tech", "delivery", "elegante", "minimal"] as const;

const storeSchema = z.object({
  descricaoCurta: z.string().trim().max(180).nullable(),
  endereco: z.string().trim().max(240).nullable(),
  instagram: z.string().regex(/^[a-zA-Z0-9._]{1,30}$/, "Informe um usuário válido do Instagram.").nullable(),
  nomeLoja: z.string().trim().min(2, "Digite o nome da loja.").max(100),
  tema: z.enum(themes),
  whatsapp: z.string().regex(/^55\d{10,11}$/, "Informe o código do país 55, o DDD e o número."),
});

function storagePathFromUrl(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/produtos/";
  const index = url.indexOf(marker);
  return index >= 0 ? decodeURIComponent(url.slice(index + marker.length)) : null;
}

function extensionFor(file: File) {
  return file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
}

export async function updateStoreAction(formData: FormData): Promise<ActionResult<{ bannerUrl: string | null; logoUrl: string | null }>> {
  const parsed = storeSchema.safeParse({
    descricaoCurta: String(formData.get("descricaoCurta") ?? "").trim() || null,
    endereco: String(formData.get("endereco") ?? "").trim() || null,
    instagram: normalizeInstagramUsername(String(formData.get("instagram") ?? "")) || null,
    nomeLoja: formData.get("nomeLoja"),
    tema: formData.get("tema") as TenantTheme,
    whatsapp: String(formData.get("whatsapp") ?? "").replace(/\D/g, ""),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos.", ok: false };

  const entries = { banner: formData.get("banner"), logo: formData.get("logo") };
  const removeBanner = formData.get("remove-banner") === "true";
  const removeLogo = formData.get("remove-logo") === "true";
  const files = Object.fromEntries(Object.entries(entries).map(([key, entry]) => [key, entry instanceof File && entry.size > 0 ? entry : null])) as { banner: File | null; logo: File | null };
  for (const file of Object.values(files)) {
    if (!file) continue;
    const validationError = await validateCatalogImageUpload(file);
    if (validationError) return { error: validationError, ok: false };
  }

  const uploaded: string[] = [];
  try {
    const { demo, tenant } = await requireTenant();
    if (demo) return { error: "O modo de demonstração não publica alterações.", ok: false };
    const supabase = await createClient();
    let bannerUrl = removeBanner ? null : tenant.banner_url;
    let logoUrl = removeLogo ? null : tenant.logo_url;

    for (const [kind, file] of Object.entries(files) as ["banner" | "logo", File | null][]) {
      if (!file) continue;
      const path = `${tenant.id}/${kind}-${crypto.randomUUID()}.${extensionFor(file)}`;
      const { error } = await supabase.storage.from("produtos").upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
      if (error) throw error;
      uploaded.push(path);
      const url = supabase.storage.from("produtos").getPublicUrl(path).data.publicUrl;
      if (kind === "banner") bannerUrl = url;
      else logoUrl = url;
    }

    const { error } = await supabase.from("tenants").update({
      banner_url: bannerUrl,
      descricao_curta: parsed.data.descricaoCurta,
      endereco: parsed.data.endereco,
      instagram: parsed.data.instagram,
      logo_url: logoUrl,
      nome_loja: parsed.data.nomeLoja,
      tema: parsed.data.tema,
      whatsapp: parsed.data.whatsapp,
    }).eq("id", tenant.id).eq("owner_user_id", tenant.owner_user_id);
    if (error) throw error;

    const oldPaths = [files.logo || removeLogo ? storagePathFromUrl(tenant.logo_url) : null, files.banner || removeBanner ? storagePathFromUrl(tenant.banner_url) : null].filter((path): path is string => Boolean(path));
    if (oldPaths.length) {
      const { error: cleanupError } = await supabase.storage.from("produtos").remove(oldPaths);
      if (cleanupError) console.error("Falha ao remover imagens antigas da loja:", cleanupError.message);
    }

    revalidatePath("/painel/loja");
    revalidatePath(`/loja/${tenant.slug}`);
    return { data: { bannerUrl, logoUrl }, ok: true };
  } catch (error) {
    if (uploaded.length) {
      try { const supabase = await createClient(); await supabase.storage.from("produtos").remove(uploaded); } catch { /* Mantém o erro original. */ }
    }
    return actionError(error, "Não foi possível salvar os dados da loja.");
  }
}
