import { NextResponse } from "next/server";
import { z } from "zod";

import { recordProductMetric } from "@/lib/analytics/server";
import { isSupabaseConfigured } from "@/lib/env/public";
import { logError } from "@/lib/observability/logger";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import { hashSignupRecoveryToken } from "@/lib/signup/recovery-token";
import { createAdminClient } from "@/lib/supabase/admin";

const tokenSchema = z.object({ token: z.string().min(20).max(200) });

// Confirma o e-mail do titular pelo link de uso único (exigido para publicar).
// Não depende de sessão: o link pode ser aberto em outro aparelho.
export async function POST(request: Request) {
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.emailVerification);
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = tokenSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Este link é inválido ou está incompleto." }, { status: 400 });

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "A confirmação ainda não foi configurada no servidor." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: tenantId, error } = await admin.rpc("consume_email_verification_token", {
    p_token_hash: hashSignupRecoveryToken(parsed.data.token),
  });
  if (error) {
    logError("email_verification.consume", error);
    return NextResponse.json({ error: "Não foi possível confirmar agora. Tente novamente." }, { status: 503 });
  }
  if (!tenantId) {
    return NextResponse.json({ error: "Este link expirou ou já foi usado." }, { status: 410 });
  }

  await recordProductMetric("email_verified", tenantId);
  return NextResponse.json({ confirmed: true });
}
