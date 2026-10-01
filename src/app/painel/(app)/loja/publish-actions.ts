"use server";

import { createRecurringCheckout } from "@/lib/asaas/client";
import { recordProductMetric } from "@/lib/analytics/server";
import type { ActionResult } from "@/lib/actions/result";
import { requireTenant } from "@/lib/auth/session";
import { brazilToday } from "@/lib/billing/overdue-policy.mjs";
import { getSiteUrl } from "@/lib/env/server";
import { logError, logInfo } from "@/lib/observability/logger";
import { EMAIL_VERIFICATION_RESEND_MS, sendEmailVerification } from "@/lib/signup/email-verification";
import { createAdminClient } from "@/lib/supabase/admin";

const CHECKOUT_VALID_MS = 60 * 60 * 1000;
const INTENT_VALID_MS = 24 * 60 * 60 * 1000;

export type PublishBlocker = "email" | "products";

// "Publicar minha loja": abre o checkout recorrente para a loja em rascunho.
// O pagamento confirmado chega pelo webhook, que coloca a loja no ar
// (mesmo caminho do cadastro pago: o registro do cadastro vira a intenção).
export async function startPublicationCheckoutAction(): Promise<ActionResult<{ checkoutUrl: string }> & { blocker?: PublishBlocker }> {
  try {
    const { demo, tenant, userEmail } = await requireTenant();
    if (demo) return { error: "A demonstração não pode ser publicada.", ok: false };
    if (tenant.status !== "rascunho") return { error: "Esta loja já está publicada.", ok: false };
    if (!tenant.email_confirmado_em) {
      return { blocker: "email", error: "Confirme seu e-mail antes de publicar. Enviamos o link para sua caixa de entrada.", ok: false };
    }
    if (!userEmail) return { error: "Não foi possível confirmar o e-mail titular.", ok: false };

    const admin = createAdminClient();
    const { count, error: productError } = await admin.from("products")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenant.id)
      .eq("ativo", true);
    if (productError) throw productError;
    if ((count ?? 0) === 0) {
      return { blocker: "products", error: "Cadastre pelo menos 1 produto antes de publicar.", ok: false };
    }

    const { data: intent, error: intentError } = await admin.from("signup_intents")
      .select("id,external_reference,status,asaas_checkout_url,asaas_checkout_expires_at")
      .eq("intent_type", "signup")
      .eq("provisioned_tenant_id", tenant.id)
      .maybeSingle();
    if (intentError) throw intentError;
    if (!intent) return { error: "Não encontramos o registro do cadastro desta loja. Fale com o atendimento.", ok: false };
    if (intent.status === "pago") return { error: "O pagamento já foi confirmado. Atualize a página.", ok: false };

    // Reaproveita um checkout ainda válido (cliques repetidos, voltar do Asaas).
    if (
      intent.status === "pendente"
      && intent.asaas_checkout_url
      && intent.asaas_checkout_expires_at
      && new Date(intent.asaas_checkout_expires_at).getTime() > Date.now()
    ) {
      return { data: { checkoutUrl: intent.asaas_checkout_url }, ok: true };
    }

    // Os dados da loja podem ter mudado desde o cadastro; o e-mail é o da conta.
    const { error: resetError } = await admin.from("signup_intents").update({
      asaas_checkout_expires_at: null,
      asaas_checkout_id: null,
      asaas_checkout_url: null,
      checkout_returned_at: null,
      email: userEmail.toLowerCase(),
      expires_at: new Date(Date.now() + INTENT_VALID_MS).toISOString(),
      nome_loja: tenant.nome_loja,
      slug: tenant.slug,
      status: "pendente",
      tema: tenant.tema,
      whatsapp: tenant.whatsapp,
    }).eq("id", intent.id).in("status", ["rascunho", "pendente", "expirado", "cancelado"]);
    if (resetError) {
      if (resetError.code === "23505") {
        return { error: "Já existe um pagamento em andamento para este e-mail. Aguarde alguns minutos e tente novamente.", ok: false };
      }
      throw resetError;
    }

    const siteUrl = getSiteUrl();
    try {
      const checkout = await createRecurringCheckout({
        cancelUrl: `${siteUrl}/painel/loja`,
        externalReference: intent.external_reference,
        nextDueDate: brazilToday(),
        successUrl: `${siteUrl}/painel/loja?publicacao=retorno`,
      });
      const { error: checkoutError } = await admin.from("signup_intents").update({
        asaas_checkout_expires_at: new Date(Date.now() + CHECKOUT_VALID_MS).toISOString(),
        asaas_checkout_id: checkout.id,
        asaas_checkout_url: checkout.link,
      }).eq("id", intent.id);
      if (checkoutError) throw checkoutError;

      await recordProductMetric("checkout_created", tenant.id);
      logInfo("publication.checkout_created", { result: "created", tenant_id: tenant.id });
      return { data: { checkoutUrl: checkout.link }, ok: true };
    } catch (checkoutError) {
      // Volta ao rascunho para liberar o e-mail e permitir nova tentativa.
      await admin.from("signup_intents").update({ status: "rascunho" }).eq("id", intent.id).eq("status", "pendente");
      throw checkoutError;
    }
  } catch (error) {
    logError("publication.checkout", error);
    return { error: "Não foi possível abrir o pagamento agora. Aguarde um instante e tente novamente.", ok: false };
  }
}

export async function resendEmailVerificationAction(): Promise<ActionResult<{ sent: boolean }>> {
  try {
    const { demo, tenant, userEmail } = await requireTenant();
    if (demo) return { error: "A demonstração não envia e-mails.", ok: false };
    if (tenant.email_confirmado_em) return { data: { sent: false }, ok: true };
    if (!userEmail) return { error: "Não foi possível identificar o e-mail da conta.", ok: false };

    const admin = createAdminClient();
    const { data: latest, error: latestError } = await admin.from("email_verification_tokens")
      .select("created_at")
      .eq("tenant_id", tenant.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;
    if (latest && Date.now() - new Date(latest.created_at).getTime() < EMAIL_VERIFICATION_RESEND_MS) {
      return { error: "Acabamos de enviar um link. Aguarde 2 minutos e confira também a caixa de spam.", ok: false };
    }

    const result = await sendEmailVerification(admin, { email: userEmail, kind: "resend", storeName: tenant.nome_loja, tenantId: tenant.id });
    if (!result.sent && process.env.NODE_ENV === "production") {
      return { error: "Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.", ok: false };
    }
    return { data: { sent: result.sent }, ok: true };
  } catch (error) {
    logError("email_verification.resend", error);
    return { error: "Não foi possível enviar o e-mail agora. Tente novamente em alguns minutos.", ok: false };
  }
}
