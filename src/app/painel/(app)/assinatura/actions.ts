"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  AsaasSubscriptionCancellationError,
  AsaasSubscriptionReactivationError,
  getAsaasSubscriptionNextDueDate,
  inactivateAsaasSubscription,
  reactivateAsaasSubscription,
  createRecurringCheckout,
} from "@/lib/asaas/client";
import { recordProductMetric } from "@/lib/analytics/server";
import type { ActionResult } from "@/lib/actions/result";
import { requireTenant } from "@/lib/auth/session";
import { brazilDateFromIso, brazilDateStartAsIso } from "@/lib/billing/access-period";
import { canRevertScheduledCancellation } from "@/lib/billing/state";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteUrl } from "@/lib/env/server";
import { logError, logInfo } from "@/lib/observability/logger";
import {
  SIGNUP_RESUME_COOKIE_NAME,
  signupResumeCookieOptions,
} from "@/lib/signup/resume";

const cancellationSchema = z.object({
  confirmation: z.string().trim().min(1).max(100),
});

type CancellationResult = {
  accessUntil?: string;
  status: "cancelado" | "agendado";
};

const REACTIVATION_LEASE_MS = 10 * 60 * 1000;

function todayInBrazil() {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
    year: "numeric",
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

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
      .select("id,status,asaas_subscription_id,asaas_subscription_state,cancel_at_period_end,access_until,reactivation_requested_at")
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

    if (subscription.reactivation_requested_at) {
      return { error: "Aguarde a conclusão da reativação em andamento.", ok: false };
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

    let remoteResult: "deleted" | "updated";
    try {
      remoteResult = await inactivateAsaasSubscription(subscription.asaas_subscription_id);
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
        logError("subscription.cancellation.rollback", rollbackError, {
          tenant_id: tenant.id,
        });
      }
      throw error;
    }

    const { error: remoteStateError } = await admin
      .from("subscriptions")
      .update({ asaas_subscription_state: remoteResult === "deleted" ? "deleted" : "inactive" })
      .eq("id", subscription.id)
      .eq("tenant_id", tenant.id);
    if (remoteStateError) {
      // A recorrência já foi inativada no Asaas. Não revertemos o estado
      // local, pois isso faria o painel prometer uma renovação inexistente.
      logError("subscription.cancellation.remote_state", remoteStateError, {
        tenant_id: tenant.id,
      });
    }

    logInfo("subscription.cancellation.requested", {
      tenant_id: tenant.id,
      result: remoteResult,
    });
    await recordProductMetric("cancellation_requested", tenant.id);

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


export async function revertSubscriptionCancellationAction(): Promise<ActionResult<{ status: "ativo" }>> {
  try {
    const { demo, tenant } = await requireTenant();
    if (demo) return { error: "A demonstração não possui assinatura real.", ok: false };

    const admin = createAdminClient();
    const { data: subscription, error } = await admin
      .from("subscriptions")
      .select("id,status,asaas_subscription_id,asaas_subscription_state,cancel_at_period_end,access_until,reactivation_requested_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !subscription) {
      return { error: "Não foi possível localizar sua assinatura.", ok: false };
    }
    if (!subscription.cancel_at_period_end || !subscription.access_until) {
      return { data: { status: "ativo" }, ok: true };
    }
    if (!canRevertScheduledCancellation({
      accessUntil: subscription.access_until,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    })) {
      return { error: "O período pago já terminou. Renove a assinatura para publicar a loja novamente.", ok: false };
    }
    if (!subscription.asaas_subscription_id || subscription.asaas_subscription_state === "deleted") {
      return { error: "Esta recorrência antiga foi encerrada definitivamente. O acesso continua até a data informada; depois, use a opção de renovação.", ok: false };
    }

    if (subscription.reactivation_requested_at) {
      const leaseAge = Date.now() - new Date(subscription.reactivation_requested_at).getTime();
      if (leaseAge < REACTIVATION_LEASE_MS) {
        return { error: "A reativação já está sendo processada. Aguarde um instante e atualize a página.", ok: false };
      }

      const { error: releaseError } = await admin
        .from("subscriptions")
        .update({ reactivation_requested_at: null })
        .eq("id", subscription.id)
        .eq("tenant_id", tenant.id)
        .eq("reactivation_requested_at", subscription.reactivation_requested_at);
      if (releaseError) throw releaseError;
    }

    const requestedAt = new Date().toISOString();
    const { data: claimed, error: claimError } = await admin
      .from("subscriptions")
      .update({ reactivation_requested_at: requestedAt })
      .eq("id", subscription.id)
      .eq("tenant_id", tenant.id)
      .eq("cancel_at_period_end", true)
      .is("reactivation_requested_at", null)
      .select("id")
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) {
      return { error: "A assinatura mudou enquanto esta ação era processada. Atualize a página.", ok: false };
    }

    try {
      await reactivateAsaasSubscription(
        subscription.asaas_subscription_id,
        brazilDateFromIso(subscription.access_until),
      );
    } catch (reactivationError) {
      await admin.from("subscriptions")
        .update({ reactivation_requested_at: null })
        .eq("id", subscription.id)
        .eq("tenant_id", tenant.id);
      throw reactivationError;
    }

    const { error: finalizeError } = await admin
      .from("subscriptions")
      .update({
        access_until: null,
        asaas_subscription_state: "active",
        cancel_at_period_end: false,
        cancellation_requested_at: null,
        reactivation_requested_at: null,
        status: "ativo",
      })
      .eq("id", subscription.id)
      .eq("tenant_id", tenant.id);
    if (finalizeError) throw finalizeError;

    const { error: tenantError } = await admin
      .from("tenants")
      .update({ canceled_at: null, status: "ativo" })
      .eq("id", tenant.id)
      .eq("owner_user_id", tenant.owner_user_id);
    if (tenantError) throw tenantError;

    revalidatePath("/painel/assinatura");
    revalidatePath(`/loja/${tenant.slug}`);
    logInfo("subscription.cancellation.reverted", { tenant_id: tenant.id, result: "active" });
    await recordProductMetric("cancellation_reverted", tenant.id);
    return { data: { status: "ativo" }, ok: true };
  } catch (error) {
    if (error instanceof AsaasSubscriptionReactivationError) {
      return { error: error.message, ok: false };
    }
    return { error: "Não foi possível desfazer o cancelamento agora. Tente novamente.", ok: false };
  }
}

export async function createReactivationCheckoutAction(): Promise<ActionResult<{ checkoutUrl: string }>> {
  try {
    const { demo, tenant, userEmail } = await requireTenant();
    if (demo) return { error: "A demonstração não possui assinatura real.", ok: false };
    if (tenant.status !== "cancelado") {
      return { error: "A renovação é usada somente depois que o período pago termina.", ok: false };
    }
    if (!userEmail) return { error: "Não foi possível confirmar o e-mail titular.", ok: false };

    const admin = createAdminClient();
    const { data: deletion } = await admin.from("account_deletion_requests")
      .select("status")
      .eq("tenant_id_original", tenant.id)
      .in("status", ["agendado", "processando"])
      .maybeSingle();
    if (deletion) {
      return { error: "Cancele primeiro a solicitação de exclusão de dados na área Privacidade.", ok: false };
    }

    const { data: pending, error: pendingError } = await admin.from("signup_intents")
      .select("external_reference,asaas_checkout_url,asaas_checkout_expires_at")
      .eq("intent_type", "reactivation")
      .eq("target_tenant_id", tenant.id)
      .eq("status", "pendente")
      .maybeSingle();
    if (pendingError) throw pendingError;
    if (
      pending?.asaas_checkout_url
      && pending.asaas_checkout_expires_at
      && new Date(pending.asaas_checkout_expires_at).getTime() > Date.now()
    ) {
      (await cookies()).set(
        SIGNUP_RESUME_COOKIE_NAME,
        pending.external_reference,
        signupResumeCookieOptions(),
      );
      return { data: { checkoutUrl: pending.asaas_checkout_url }, ok: true };
    }
    if (pending) {
      const { error: expireError } = await admin.from("signup_intents")
        .update({ status: "expirado" })
        .eq("external_reference", pending.external_reference)
        .eq("status", "pendente");
      if (expireError) throw expireError;
    }

    const { data: originalIntent, error: originalError } = await admin.from("signup_intents")
      .select("terms_accepted_at,terms_version,privacy_accepted_at,privacy_version")
      .eq("intent_type", "signup")
      .eq("provisioned_tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (originalError) throw originalError;
    if (!originalIntent) {
      return { error: "Não encontramos o aceite original desta conta. Fale com o atendimento para renovar com segurança.", ok: false };
    }

    const { data: intent, error: intentError } = await admin.from("signup_intents").insert({
      email: userEmail.toLowerCase(),
      intent_type: "reactivation",
      nome_loja: tenant.nome_loja,
      privacy_accepted_at: originalIntent.privacy_accepted_at,
      privacy_version: originalIntent.privacy_version,
      slug: tenant.slug,
      target_tenant_id: tenant.id,
      tema: tenant.tema,
      terms_accepted_at: originalIntent.terms_accepted_at,
      terms_version: originalIntent.terms_version,
      whatsapp: tenant.whatsapp,
    }).select("external_reference").single();
    if (intentError || !intent) {
      if (intentError?.code === "23505") {
        return { error: "Já existe uma renovação em andamento. Atualize a página e tente novamente.", ok: false };
      }
      throw intentError ?? new Error("Intenção de reativação não criada.");
    }

    try {
      const successUrl = `${getSiteUrl()}/cadastro/sucesso?ref=${intent.external_reference}`;
      const checkout = await createRecurringCheckout({
        externalReference: intent.external_reference,
        nextDueDate: todayInBrazil(),
        successUrl,
      });
      const checkoutExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      const { error: checkoutError } = await admin.from("signup_intents").update({
        asaas_checkout_expires_at: checkoutExpiresAt,
        asaas_checkout_id: checkout.id,
        asaas_checkout_url: checkout.link,
      }).eq("external_reference", intent.external_reference);
      if (checkoutError) throw checkoutError;

      (await cookies()).set(
        SIGNUP_RESUME_COOKIE_NAME,
        intent.external_reference,
        signupResumeCookieOptions(),
      );
      return { data: { checkoutUrl: checkout.link }, ok: true };
    } catch (checkoutError) {
      await admin.from("signup_intents")
        .update({ status: "cancelado" })
        .eq("external_reference", intent.external_reference);
      throw checkoutError;
    }
  } catch {
    return { error: "Não foi possível abrir a renovação agora. Aguarde um instante e tente novamente.", ok: false };
  }
}
