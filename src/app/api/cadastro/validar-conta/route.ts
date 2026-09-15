import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import { expireStaleSignupIntents } from "@/lib/signup/intents";
import { createAdminClient } from "@/lib/supabase/admin";

const accountSchema = z.object({
  email: z.string().trim().pipe(z.email("Digite um e-mail válido.")).transform((value) => value.toLowerCase()),
});

export async function POST(request: Request) {
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.accountAvailability);
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = accountSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revise o e-mail informado." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Não foi possível validar a conta agora." }, { status: 503 });
  }

  const admin = createAdminClient();
  try {
    await expireStaleSignupIntents(admin);
    const [{ data: hasTenant, error: tenantError }, { count, error: intentError }] = await Promise.all([
      admin.rpc("email_has_tenant", { p_email: parsed.data.email }),
      admin.from("signup_intents")
        .select("id", { count: "exact", head: true })
        .eq("email", parsed.data.email)
        .or("status.eq.pendente,and(status.eq.pago,provisioned_tenant_id.is.null)"),
    ]);

    if (tenantError || intentError) throw tenantError ?? intentError;
    if (hasTenant) {
      return NextResponse.json(
        {
          action: "login",
          error: "Este e-mail já possui uma loja. Entre no painel ou recupere sua senha.",
        },
        { status: 409 },
      );
    }
    if ((count ?? 0) > 0) {
      return NextResponse.json(
        {
          action: "resume",
          error: "Já existe um cadastro ou pagamento em andamento para este e-mail.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ available: true });
  } catch (error) {
    console.error("Falha na validação antecipada da conta:", error instanceof Error ? error.message : "erro desconhecido");
    return NextResponse.json({ error: "Não foi possível validar a conta agora. Tente novamente." }, { status: 503 });
  }
}
