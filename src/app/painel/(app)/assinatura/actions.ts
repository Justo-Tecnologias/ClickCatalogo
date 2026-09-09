"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AsaasSubscriptionCancellationError,
  cancelAsaasSubscription,
} from "@/lib/asaas/client";
import type { ActionResult } from "@/lib/actions/result";
import { requireTenant } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

const cancellationSchema = z.object({
  confirmation: z.string().trim().min(1).max(100),
});

type CancellationResult = {
  status: "cancelado";
  syncPending?: boolean;
};

export async function cancelSubscriptionAction(
  input: unknown,
): Promise<ActionResult<CancellationResult>> {
  const parsed = cancellationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Digite o nome da loja para confirmar o cancelamento.", ok: false };
  }

  try {
    const { demo, tenant } = await requireTenant();
    if (demo) {
      return { error: "A demonstração não possui uma assinatura real para cancelar.", ok: false };
    }

    if (parsed.data.confirmation !== tenant.nome_loja.trim()) {
      return { error: "O nome digitado não corresponde ao nome da sua loja.", ok: false };
    }

    const admin = createAdminClient();
    const { data: subscription, error: subscriptionError } = await admin
      .from("subscriptions")
      .select("id,status,asaas_subscription_id")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subscriptionError) {
      return { error: "Não foi possível conferir sua assinatura. Tente novamente.", ok: false };
    }

    if (!subscription) {
      return { error: "Nenhuma assinatura foi encontrada para esta loja.", ok: false };
    }

    if (subscription.status === "cancelado" || tenant.status === "cancelado") {
      return { data: { status: "cancelado" }, ok: true };
    }

    if (!subscription.asaas_subscription_id) {
      return {
        error: "Esta assinatura ainda não possui o identificador necessário do Asaas. O cancelamento não foi realizado.",
        ok: false,
      };
    }

    await cancelAsaasSubscription(subscription.asaas_subscription_id);

    const canceledAt = new Date().toISOString();

    const { error: localSubscriptionError } = await admin
      .from("subscriptions")
      .update({ status: "cancelado" })
      .eq("id", subscription.id)
      .eq("tenant_id", tenant.id);
    const { error: localTenantError } = await admin
      .from("tenants")
      .update({ canceled_at: canceledAt, status: "cancelado" })
      .eq("id", tenant.id)
      .eq("owner_user_id", tenant.owner_user_id);

    revalidatePath("/painel/assinatura");
    revalidatePath(`/loja/${tenant.slug}`);

    if (localSubscriptionError || localTenantError) {
      console.error("Cancelamento confirmado no Asaas; sincronização local pendente.");
      return { data: { status: "cancelado", syncPending: true }, ok: true };
    }

    return { data: { status: "cancelado" }, ok: true };
  } catch (error) {
    if (error instanceof AsaasSubscriptionCancellationError) {
      return { error: error.message, ok: false };
    }

    return {
      error: "Não foi possível cancelar a assinatura. Nenhuma alteração foi confirmada; tente novamente.",
      ok: false,
    };
  }
}
