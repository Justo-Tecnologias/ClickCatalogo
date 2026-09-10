"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  AsaasSubscriptionCancellationError,
  cancelAsaasSubscription,
  getAsaasSubscriptionNextDueDate,
} from "@/lib/asaas/client";
import type { ActionResult } from "@/lib/actions/result";
import { requireTenant } from "@/lib/auth/session";
import { brazilDateStartAsIso } from "@/lib/billing/access-period";
import { createAdminClient } from "@/lib/supabase/admin";

const cancellationSchema = z.object({
  confirmation: z.string().trim().min(1).max(100),
});

type CancellationResult = {
  accessUntil?: string;
  status: "cancelado" | "agendado";
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
      .select("id,status,asaas_subscription_id,cancel_at_period_end,access_until")
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

    if (subscription.cancel_at_period_end && subscription.access_until) {
      return {
        data: { accessUntil: subscription.access_until, status: "agendado" },
        ok: true,
      };
    }

    if (!subscription.asaas_subscription_id) {
      return {
        error: "Esta assinatura ainda não possui o identificador necessário do Asaas. O cancelamento não foi realizado.",
        ok: false,
      };
    }

    const nextDueDate = await getAsaasSubscriptionNextDueDate(subscription.asaas_subscription_id);
    const accessUntil = brazilDateStartAsIso(nextDueDate);
    if (new Date(accessUntil).getTime() <= Date.now()) {
      return {
        error: "O Asaas não informou uma renovação futura. A assinatura não foi cancelada; fale com o atendimento.",
        ok: false,
      };
    }

    const cancellationRequestedAt = new Date().toISOString();
    const { error: scheduleError } = await admin
      .from("subscriptions")
      .update({
        access_until: accessUntil,
        cancel_at_period_end: true,
        cancellation_requested_at: cancellationRequestedAt,
        next_due_date: nextDueDate,
      })
      .eq("id", subscription.id)
      .eq("tenant_id", tenant.id);

    if (scheduleError) {
      return {
        error: "Não foi possível registrar o fim do período pago. A assinatura não foi cancelada.",
        ok: false,
      };
    }

    try {
      await cancelAsaasSubscription(subscription.asaas_subscription_id);
    } catch (error) {
      const { error: rollbackError } = await admin
        .from("subscriptions")
        .update({
          access_until: null,
          cancel_at_period_end: false,
          cancellation_requested_at: null,
        })
        .eq("id", subscription.id)
        .eq("tenant_id", tenant.id);
      if (rollbackError) {
        console.error("Falha crítica ao reverter o agendamento local após recusa do Asaas:", rollbackError.message);
      }
      throw error;
    }

    revalidatePath("/painel/assinatura");
    revalidatePath(`/loja/${tenant.slug}`);

    return { data: { accessUntil, status: "agendado" }, ok: true };
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
