import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { createRecurringCheckout } from "@/lib/asaas/client";
import { recordProductMetric } from "@/lib/analytics/server";
import { getAsaasEnv, getSiteUrl } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/env/public";
import { logError, logInfo } from "@/lib/observability/logger";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/documents";
import { expireStaleSignupIntents } from "@/lib/signup/intents";
import { signupSchema } from "@/lib/signup/schema";
import {
  SIGNUP_RESUME_COOKIE_NAME,
  signupResumeCookieOptions,
} from "@/lib/signup/resume";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function POST(request: Request) {
  const requestId = request.headers.get("x-nf-request-id")?.slice(0, 100) ?? randomUUID();
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.checkout);
  if (rateLimitResponse) return rateLimitResponse;

  const input: unknown = await request.json().catch(() => null);
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise os dados informados." }, { status: 400 });

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY || !getAsaasEnv()) {
    return NextResponse.json({ error: "O checkout está pronto, mas as chaves do Supabase e do Asaas ainda não foram configuradas." }, { status: 503 });
  }

  const siteUrl = getSiteUrl();
  if (!siteUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Para testar o pagamento, configure NEXT_PUBLIC_SITE_URL com a URL pública HTTPS da aplicação ou de um túnel seguro." }, { status: 503 });
  }

  const admin = createAdminClient();
  try {
    await expireStaleSignupIntents(admin);
  } catch (error) {
    logError("checkout.expire_intents", error, { request_id: requestId });
    return NextResponse.json({ error: "Não foi possível verificar o endereço da loja agora. Tente novamente." }, { status: 503 });
  }

  const { data: emailHasTenant, error: emailLookupError } = await admin.rpc("email_has_tenant", {
    p_email: parsed.data.email,
  });
  if (emailLookupError) {
    logError("checkout.account_lookup", emailLookupError, { request_id: requestId });
    return NextResponse.json({ error: "Não foi possível validar o cadastro agora. Tente novamente." }, { status: 503 });
  }
  if (emailHasTenant) {
    return NextResponse.json(
      { error: "Este e-mail já possui uma loja. Entre no painel ou recupere sua senha." },
      { status: 409 },
    );
  }

  const [tenantResult, intentResult, emailIntentResult, historyResult] = await Promise.all([
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("slug", parsed.data.slug),
    admin.from("signup_intents").select("id", { count: "exact", head: true }).eq("slug", parsed.data.slug).or("status.eq.pendente,and(status.eq.pago,provisioned_tenant_id.is.null)"),
    admin.from("signup_intents").select("id", { count: "exact", head: true }).eq("email", parsed.data.email).or("status.eq.pendente,and(status.eq.pago,provisioned_tenant_id.is.null)"),
    admin.from("tenant_slug_history").select("slug", { count: "exact", head: true }).eq("slug", parsed.data.slug).gt("redirect_until", new Date().toISOString()),
  ]);
  const availabilityError = tenantResult.error ?? intentResult.error ?? emailIntentResult.error ?? historyResult.error;
  if (availabilityError) {
    logError("checkout.availability_lookup", availabilityError, { request_id: requestId });
    return NextResponse.json({ error: "Não foi possível validar o cadastro agora. Tente novamente." }, { status: 503 });
  }
  if ((tenantResult.count ?? 0) > 0 || (intentResult.count ?? 0) > 0 || (historyResult.count ?? 0) > 0) {
    return NextResponse.json({ error: "Este endereço acabou de ser reservado. Escolha outro." }, { status: 409 });
  }
  if ((emailIntentResult.count ?? 0) > 0) return NextResponse.json({ error: "Já existe um cadastro ou pagamento em andamento para este e-mail." }, { status: 409 });

  const now = new Date().toISOString();
  const { data: intent, error: intentError } = await admin.from("signup_intents").insert({
    email: parsed.data.email,
    nome_loja: parsed.data.nomeLoja,
    privacy_accepted_at: now,
    privacy_version: PRIVACY_VERSION,
    slug: parsed.data.slug,
    tema: parsed.data.tema,
    terms_accepted_at: now,
    terms_version: TERMS_VERSION,
    whatsapp: parsed.data.whatsapp,
  }).select("external_reference").single();

  if (intentError?.code === "23505") {
    return NextResponse.json({ error: "Este endereço ou e-mail acabou de ser reservado. Revise os dados e tente novamente." }, { status: 409 });
  }
  if (intentError || !intent) return NextResponse.json({ error: "Não foi possível reservar seu cadastro. Tente novamente." }, { status: 500 });

  try {
    const successUrl = `${siteUrl}/cadastro/sucesso?ref=${intent.external_reference}`;
    const checkout = await createRecurringCheckout({ externalReference: intent.external_reference, nextDueDate: todayInBrazil(), successUrl });
    const checkoutExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: checkoutUpdateError } = await admin
      .from("signup_intents")
      .update({
        asaas_checkout_expires_at: checkoutExpiresAt,
        asaas_checkout_id: checkout.id,
        asaas_checkout_url: checkout.link,
      })
      .eq("external_reference", intent.external_reference);
    if (checkoutUpdateError) throw checkoutUpdateError;
    const response = NextResponse.json({ checkoutUrl: checkout.link });
    response.cookies.set(
      SIGNUP_RESUME_COOKIE_NAME,
      intent.external_reference,
      signupResumeCookieOptions(),
    );
    logInfo("checkout.created", {
      request_id: requestId,
      result: "created",
      signup_intent_id: intent.external_reference,
    });
    await recordProductMetric("checkout_created");
    return response;
  } catch (error) {
    const { error: cancelError } = await admin.from("signup_intents").update({ status: "cancelado" }).eq("external_reference", intent.external_reference);
    if (cancelError) logError("checkout.intent_rollback", cancelError, { request_id: requestId, signup_intent_id: intent.external_reference });
    logError("checkout.create", error, {
      request_id: requestId,
      result: "failed",
      signup_intent_id: intent.external_reference,
    });
    return NextResponse.json({ error: "Não foi possível abrir o checkout agora. Aguarde um instante e tente novamente." }, { status: 502 });
  }
}
