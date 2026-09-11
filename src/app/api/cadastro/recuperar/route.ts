import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { sendTransactionalEmail, signupRecoveryEmail } from "@/lib/email/resend";
import { getResendEnv, getSiteUrl } from "@/lib/env/server";
import { isSupabaseConfigured } from "@/lib/env/public";
import { logError, logInfo } from "@/lib/observability/logger";
import {
  enforceRateLimit,
  enforceRateLimitForIdentifier,
  PUBLIC_API_RATE_LIMITS,
} from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import {
  createSignupRecoveryToken,
  hashPrivateIdentifier,
  requestIp,
  SIGNUP_RECOVERY_TOKEN_MINUTES,
} from "@/lib/signup/recovery";
import { createAdminClient } from "@/lib/supabase/admin";

const inputSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((value) => value.toLowerCase()),
});

const GENERIC_RESPONSE = {
  message: "Se encontrarmos um cadastro relacionado a este e-mail, enviaremos instruções.",
};

export async function POST(request: Request) {
  const requestId = randomUUID();
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const ipLimit = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.signupRecoveryIp);
  if (ipLimit) return ipLimit;

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(GENERIC_RESPONSE, { status: 202 });

  const emailLimit = await enforceRateLimitForIdentifier(
    parsed.data.email,
    PUBLIC_API_RATE_LIMITS.signupRecoveryEmail,
  );
  if (emailLimit) return emailLimit;

  if (
    !isSupabaseConfigured()
    || !process.env.SUPABASE_SERVICE_ROLE_KEY
    || !getResendEnv()
  ) {
    logError("signup_recovery.request", new Error("Infraestrutura de recuperação não configurada."), { request_id: requestId });
    return NextResponse.json(GENERIC_RESPONSE, { status: 202 });
  }

  const admin = createAdminClient();

  try {
    const { data: intent, error: intentError } = await admin
      .from("signup_intents")
      .select("id")
      .eq("email", parsed.data.email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (intentError) throw intentError;

    if (!intent) {
      logInfo("signup_recovery.request", { request_id: requestId, result: "not_found" });
      return NextResponse.json(GENERIC_RESPONSE, { status: 202 });
    }

    const now = new Date();
    const { hash, raw } = createSignupRecoveryToken();
    const expiresAt = new Date(now.getTime() + SIGNUP_RECOVERY_TOKEN_MINUTES * 60_000).toISOString();

    const { error: invalidateError } = await admin
      .from("signup_recovery_tokens")
      .update({ consumed_at: now.toISOString() })
      .eq("signup_intent_id", intent.id)
      .is("consumed_at", null);
    if (invalidateError) throw invalidateError;

    const { data: recovery, error: tokenError } = await admin
      .from("signup_recovery_tokens")
      .insert({
        email_hash: hashPrivateIdentifier(parsed.data.email),
        expires_at: expiresAt,
        requested_ip_hash: hashPrivateIdentifier(requestIp(request)),
        signup_intent_id: intent.id,
        token_hash: hash,
      })
      .select("id")
      .single();
    if (tokenError || !recovery) throw tokenError ?? new Error("Token não criado.");

    const link = `${getSiteUrl()}/cadastro/recuperar/confirmar#token=${encodeURIComponent(raw)}`;
    try {
      await sendTransactionalEmail({
        html: signupRecoveryEmail(link),
        subject: "Continue seu cadastro no ClickCatálogo",
        to: parsed.data.email,
      });
    } catch (error) {
      await admin.from("signup_recovery_tokens")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", recovery.id);
      throw error;
    }

    logInfo("signup_recovery.request", {
      request_id: requestId,
      result: "sent",
      signup_intent_id: intent.id,
    });
  } catch (error) {
    logError("signup_recovery.request", error, { request_id: requestId });
  }

  return NextResponse.json(GENERIC_RESPONSE, {
    headers: { "Cache-Control": "no-store" },
    status: 202,
  });
}
