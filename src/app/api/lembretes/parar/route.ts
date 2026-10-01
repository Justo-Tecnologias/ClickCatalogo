import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env/public";
import { logError } from "@/lib/observability/logger";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

const optOutSchema = z.object({ token: z.uuid() });

// "Não quero mais receber lembretes": o token aleatório por loja vem no
// rodapé de cada lembrete e não dá acesso a nada além desta preferência.
export async function POST(request: Request) {
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.reminderOptOut);
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = optOutSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Este link é inválido." }, { status: 400 });

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Não foi possível atualizar agora." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("tenants")
    .update({ lembretes_desativados_em: new Date().toISOString() })
    .eq("lembretes_token", parsed.data.token)
    .is("lembretes_desativados_em", null)
    .select("id");
  if (error) {
    logError("draft_reminders.opt_out", error);
    return NextResponse.json({ error: "Não foi possível atualizar agora. Tente novamente." }, { status: 503 });
  }
  // Link repetido ou já usado responde igual, sem revelar se a loja existe.
  return NextResponse.json({ stopped: true, updated: (data?.length ?? 0) > 0 });
}
