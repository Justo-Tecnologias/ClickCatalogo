import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env/public";
import { logError, logInfo } from "@/lib/observability/logger";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import { hashSignupRecoveryToken } from "@/lib/signup/recovery";
import {
  SIGNUP_RESUME_COOKIE_NAME,
  signupResumeCookieOptions,
} from "@/lib/signup/resume";
import { createAdminClient } from "@/lib/supabase/admin";

const inputSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{40,60}$/),
});

export async function POST(request: Request) {
  const requestId = randomUUID();
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const rateLimitResponse = await enforceRateLimit(
    request,
    PUBLIC_API_RATE_LIMITS.signupRecoveryConsume,
  );
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Este link é inválido ou já expirou." }, { status: 400 });
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Não foi possível validar o link agora." }, { status: 503 });
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("consume_signup_recovery_token", {
      p_token_hash: hashSignupRecoveryToken(parsed.data.token),
    });
    if (error) throw error;

    const recovered = data?.[0];
    if (!recovered) {
      return NextResponse.json({ error: "Este link é inválido, expirou ou já foi utilizado." }, { status: 400 });
    }

    const response = NextResponse.json({ next: "/painel/acessar-loja/continuar" });
    response.cookies.set(
      SIGNUP_RESUME_COOKIE_NAME,
      recovered.external_reference,
      signupResumeCookieOptions(),
    );
    logInfo("signup_recovery.consume", { request_id: requestId, result: "accepted" });
    return response;
  } catch (error) {
    logError("signup_recovery.consume", error, { request_id: requestId });
    return NextResponse.json({ error: "Não foi possível validar o link agora." }, { status: 503 });
  }
}
