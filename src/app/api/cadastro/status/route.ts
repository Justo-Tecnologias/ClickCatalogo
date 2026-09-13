import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ACTIVE_TENANT_COOKIE_MAX_AGE, ACTIVE_TENANT_COOKIE_NAME } from "@/lib/auth/tenant-cookie";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import {
  publicContinuationState,
  resolveAccountContinuationState,
} from "@/lib/signup/account-continuation";
import { expireStaleSignupIntents } from "@/lib/signup/intents";
import { SIGNUP_RESUME_COOKIE_NAME } from "@/lib/signup/resume";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.signupStatus);
  if (rateLimitResponse) return rateLimitResponse;

  const ref = request.nextUrl.searchParams.get("ref") ?? "";
  if (!z.uuid().safeParse(ref).success) {
    return NextResponse.json({ error: "Referência inválida." }, { status: 400 });
  }
  if (request.cookies.get(SIGNUP_RESUME_COOKIE_NAME)?.value !== ref) {
    return NextResponse.json({ error: "Solicite um novo link para consultar este acesso." }, { status: 403 });
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ configured: false, status: "pendente" }, { status: 503 });
  }

  const admin = createAdminClient();
  try {
    await expireStaleSignupIntents(admin);
    const [{ data: intent, error: intentError }, continuation] = await Promise.all([
      admin
        .from("signup_intents")
        .select("status")
        .eq("external_reference", ref)
        .maybeSingle(),
      resolveAccountContinuationState(admin, ref),
    ]);
    if (intentError) throw intentError;
    if (!intent) return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });

    const publicState = publicContinuationState(continuation);
    const ready = continuation.type === "PAID_NEEDS_PASSWORD"
      || continuation.type === "ACCOUNT_READY";
    const response = NextResponse.json({
      accessConfigured: continuation.type === "ACCOUNT_READY",
      checkoutUrl: continuation.type === "CHECKOUT_PENDING" ? continuation.checkoutUrl : null,
      ready,
      slug: "slug" in publicState ? publicState.slug : null,
      state: publicState,
      status: intent.status,
    }, { headers: { "Cache-Control": "no-store" } });

    if (continuation.tenantId) {
      response.cookies.set(ACTIVE_TENANT_COOKIE_NAME, continuation.tenantId, {
        httpOnly: true,
        maxAge: ACTIVE_TENANT_COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Falha ao consultar acesso da loja.");
    return NextResponse.json({ error: "Não foi possível consultar o acesso agora." }, { status: 503 });
  }
}
