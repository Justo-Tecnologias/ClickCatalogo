"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/result";
import { requireTenant } from "@/lib/auth/session";
import { ACTIVE_TENANT_COOKIE_NAME } from "@/lib/auth/tenant-cookie";
import { logError, logInfo } from "@/lib/observability/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const confirmationSchema = z.object({ confirmation: z.string().trim().min(1).max(100) });

// "Excluir minha loja" para quem ainda não publicou: não há contratação nem
// pagamento a preservar, então conta, loja, fotos e cadastro são apagados na
// hora (mesmo resultado da exclusão automática de 30 dias).
export async function deleteDraftStoreAction(input: unknown): Promise<ActionResult> {
  const parsed = confirmationSchema.safeParse(input);
  if (!parsed.success) return { error: "Digite o nome da loja para confirmar.", ok: false };

  try {
    const { demo, tenant } = await requireTenant();
    if (demo) return { error: "A demonstração não pode ser excluída.", ok: false };
    if (tenant.status !== "rascunho") {
      return { error: "Somente lojas ainda não publicadas podem ser excluídas por aqui.", ok: false };
    }
    if (parsed.data.confirmation !== tenant.nome_loja.trim()) {
      return { error: "O nome digitado não corresponde ao nome da sua loja.", ok: false };
    }

    const admin = createAdminClient();
    const { data: intents, error: intentError } = await admin.from("signup_intents")
      .select("id,status,asaas_checkout_expires_at")
      .eq("provisioned_tenant_id", tenant.id);
    if (intentError) throw intentError;
    // Um pagamento de publicação aberto ainda pode ser concluído no Asaas.
    const openCheckout = intents?.find((intent) => intent.status === "pendente"
      && intent.asaas_checkout_expires_at
      && new Date(intent.asaas_checkout_expires_at).getTime() > Date.now());
    if (openCheckout) {
      return { error: "Há um pagamento de publicação em aberto. Aguarde cerca de 1 hora até ele expirar e tente novamente.", ok: false };
    }

    const bucket = admin.storage.from("produtos");
    const { data: files, error: listError } = await bucket.list(tenant.id, { limit: 1000 });
    if (listError) throw listError;
    if (files?.length) {
      const { error: removeError } = await bucket.remove(files.map((file) => `${tenant.id}/${file.name}`));
      if (removeError) throw removeError;
    }

    // Só apaga se continuar em rascunho (um pagamento confirmado no meio do
    // caminho a teria colocado no ar).
    const { data: deleted, error: deleteError } = await admin.from("tenants")
      .delete()
      .eq("id", tenant.id)
      .eq("status", "rascunho")
      .select("id");
    if (deleteError) throw deleteError;
    if (!deleted?.length) return { error: "A situação da loja mudou. Atualize a página.", ok: false };

    if (intents?.length) {
      const { error: intentDeleteError } = await admin.from("signup_intents").delete().in("id", intents.map((intent) => intent.id));
      if (intentDeleteError) logError("draft.owner_deletion.intents", intentDeleteError, { tenant_id: tenant.id });
    }
    const { error: userError } = await admin.auth.admin.deleteUser(tenant.owner_user_id);
    // Usuário do Auth sem loja não acessa nada e é reaproveitado num novo cadastro.
    if (userError) logError("draft.owner_deletion.auth_user", userError, { tenant_id: tenant.id });

    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch { /* A conta já não existe; os cookies abaixo encerram a sessão local. */ }
    (await cookies()).delete(ACTIVE_TENANT_COOKIE_NAME);

    logInfo("draft.owner_deletion", { result: "deleted", tenant_id: tenant.id });
    return { ok: true };
  } catch (error) {
    logError("draft.owner_deletion", error);
    return { error: "Não foi possível excluir a loja agora. Tente novamente em instantes.", ok: false };
  }
}
