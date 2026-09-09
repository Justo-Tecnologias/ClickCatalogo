import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";

const passwordSetupSchema = z.object({
  email: z.string().trim().pipe(z.email("Digite o mesmo e-mail usado no cadastro.")).transform((value) => value.toLowerCase()),
  password: z.string().min(8, "Crie uma senha com pelo menos 8 caracteres.").max(128, "A senha deve ter no máximo 128 caracteres."),
  reference: z.uuid("Referência do cadastro inválida."),
});

export async function POST(request: Request) {
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.passwordSetup);
  if (rateLimitResponse) return rateLimitResponse;

  const input: unknown = await request.json().catch(() => null);
  const parsed = passwordSetupSchema.safeParse(input);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revise os dados informados." },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "O acesso ainda não foi configurado no servidor." }, { status: 503 });
  }

  const admin = createAdminClient();
  const { data: intent, error: intentError } = await admin
    .from("signup_intents")
    .select("email,status,provisioned_tenant_id")
    .eq("external_reference", parsed.data.reference)
    .maybeSingle();

  if (intentError || !intent) {
    return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });
  }

  if (intent.status !== "pago" || !intent.provisioned_tenant_id) {
    return NextResponse.json({ error: "Aguarde a confirmação do pagamento antes de criar a senha." }, { status: 409 });
  }

  if (intent.email.toLowerCase() !== parsed.data.email) {
    return NextResponse.json({ error: "O e-mail não corresponde ao usado no cadastro." }, { status: 403 });
  }

  const { data: tenant, error: tenantError } = await admin
    .from("tenants")
    .select("owner_user_id")
    .eq("id", intent.provisioned_tenant_id)
    .maybeSingle();

  if (tenantError || !tenant) {
    return NextResponse.json({ error: "A loja ainda não terminou de ser preparada." }, { status: 409 });
  }

  const { data: owner, error: ownerError } = await admin.auth.admin.getUserById(tenant.owner_user_id);
  if (ownerError || !owner.user) {
    return NextResponse.json({ error: "O acesso da loja ainda não foi criado." }, { status: 409 });
  }

  if (owner.user.app_metadata?.catalogoja_password_configured_at) {
    return NextResponse.json(
      { configured: true, error: "A senha desta loja já foi configurada. Entre pelo painel." },
      { status: 409 },
    );
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(owner.user.id, {
    email_confirm: true,
    password: parsed.data.password,
    app_metadata: {
      ...(owner.user.app_metadata ?? {}),
      catalogoja_password_configured_at: new Date().toISOString(),
    },
  });

  if (updateError) {
    return NextResponse.json({ error: "Não foi possível criar a senha agora. Tente novamente." }, { status: 500 });
  }

  return NextResponse.json({ configured: true });
}
