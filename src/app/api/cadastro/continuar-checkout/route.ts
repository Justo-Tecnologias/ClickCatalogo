import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { createRecurringCheckout } from "@/lib/asaas/client";
import { getAsaasEnv, getSiteUrl } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/env/public";
import { logError, logInfo } from "@/lib/observability/logger";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import {
  publicContinuationState,
  resolveAccountContinuationState,
} from "@/lib/signup/account-continuation";
import { SIGNUP_RESUME_COOKIE_NAME } from "@/lib/signup/resume";
import { createAdminClient } from "@/lib/supabase/admin";

const inputSchema = z.object({ reference: z.uuid() });

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

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Solicitação inválida." }, { status: 400 });

  const authorizedReference = (await cookies()).get(SIGNUP_RESUME_COOKIE_NAME)?.value;
  if (authorizedReference !== parsed.data.reference) {
    return NextResponse.json({ error: "Solicite um novo link para continuar." }, { status: 403 });
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY || !getAsaasEnv()) {
    return NextResponse.json({ error: "Continuação temporariamente indisponível." }, { status: 503 });
  }

  const siteUrl = getSiteUrl();
  if (!siteUrl.startsWith("https://")) {
    return NextResponse.json({ error: "Continuação temporariamente indisponível." }, { status: 503 });
  }

  const admin = createAdminClient();
  let claimedAt: string | null = null;

  try {
    const current = await resolveAccountContinuationState(admin, parsed.data.reference);
    if (current.type === "CHECKOUT_PENDING") {
      return NextResponse.json({ checkoutUrl: current.checkoutUrl });
    }
    if (current.type !== "CHECKOUT_RESTARTABLE") {
      return NextResponse.json(
        { next: "/painel/acessar-loja/continuar", state: publicContinuationState(current) },
        { status: 202 },
      );
    }

    const { data: claims, error: claimError } = await admin.rpc("claim_signup_checkout_restart", {
      p_external_reference: parsed.data.reference,
      p_lease_seconds: 120,
    });
    if (claimError) throw claimError;

    const claim = claims?.[0];
    if (claim?.outcome === "existing") {
      const refreshed = await resolveAccountContinuationState(admin, parsed.data.reference);
      if (refreshed.type === "CHECKOUT_PENDING") {
        return NextResponse.json({ checkoutUrl: refreshed.checkoutUrl });
      }
      return NextResponse.json(
        { next: "/painel/acessar-loja/continuar", state: publicContinuationState(refreshed) },
        { status: 202 },
      );
    }
    if (claim?.outcome !== "claimed" || !claim.claimed_at) {
      const refreshed = await resolveAccountContinuationState(admin, parsed.data.reference);
      return NextResponse.json(
        { next: "/painel/acessar-loja/continuar", state: publicContinuationState(refreshed) },
        { status: 202 },
      );
    }
    claimedAt = claim.claimed_at;

    const successUrl = `${siteUrl}/cadastro/sucesso?ref=${parsed.data.reference}`;
    const checkout = await createRecurringCheckout({
      externalReference: parsed.data.reference,
      nextDueDate: todayInBrazil(),
      successUrl,
    });
    const checkoutExpiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { data: saved, error: saveError } = await admin
      .from("signup_intents")
      .update({
        asaas_checkout_expires_at: checkoutExpiresAt,
        asaas_checkout_id: checkout.id,
        asaas_checkout_url: checkout.link,
        checkout_creation_started_at: null,
        checkout_returned_at: null,
        status: "pendente",
      })
      .eq("external_reference", parsed.data.reference)
      .eq("checkout_creation_started_at", claimedAt)
      .is("provisioned_tenant_id", null)
      .neq("status", "pago")
      .select("id")
      .maybeSingle();
    if (saveError) throw saveError;
    if (!saved) {
      logError("checkout.restart_save", new Error("Estado mudou após criação remota."), {
        request_id: requestId,
        result: "state_changed",
      });
      const refreshed = await resolveAccountContinuationState(admin, parsed.data.reference);
      return NextResponse.json(
        { next: "/painel/acessar-loja/continuar", state: publicContinuationState(refreshed) },
        { status: 202 },
      );
    }

    logInfo("checkout.restarted", { request_id: requestId, result: "created" });
    return NextResponse.json({ checkoutUrl: checkout.link });
  } catch (error) {
    if (claimedAt) {
      const { error: releaseError } = await admin
        .from("signup_intents")
        .update({ checkout_creation_started_at: null, status: "cancelado" })
        .eq("external_reference", parsed.data.reference)
        .eq("checkout_creation_started_at", claimedAt)
        .is("provisioned_tenant_id", null)
        .neq("status", "pago");
      if (releaseError) logError("checkout.restart_release", releaseError, { request_id: requestId });
    }
    logError("checkout.restart", error, { request_id: requestId, result: "failed" });
    return NextResponse.json(
      { error: "Não foi possível abrir uma nova página de pagamento agora. Tente novamente em alguns minutos." },
      { status: 502 },
    );
  }
}
