import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { ACTIVE_TENANT_COOKIE_MAX_AGE, ACTIVE_TENANT_COOKIE_NAME } from "@/lib/auth/tenant-cookie";
import { isSupabaseConfigured } from "@/lib/env/public";
import { expireStaleSignupIntents } from "@/lib/signup/intents";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { SIGNUP_RESUME_COOKIE_NAME } from "@/lib/signup/resume";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.signupStatus);
  if (rateLimitResponse) return rateLimitResponse;

  const ref = request.nextUrl.searchParams.get("ref") ?? "";
  if (!z.uuid().safeParse(ref).success) return NextResponse.json({ error: "Referência inválida." }, { status: 400 });
  if (request.cookies.get(SIGNUP_RESUME_COOKIE_NAME)?.value !== ref) {
    return NextResponse.json(
      { error: "Recupere o cadastro pelo e-mail para consultar este acompanhamento." },
      { status: 403 },
    );
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ configured: false, status: "pendente" }, { status: 503 });
  const admin = createAdminClient();
  try {
    await expireStaleSignupIntents(admin);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Falha ao liberar cadastros expirados.");
    return NextResponse.json({ error: "Não foi possível consultar o cadastro agora." }, { status: 503 });
  }

  const { data, error } = await admin
    .from("signup_intents")
    .select("status,slug,provisioned_tenant_id,asaas_checkout_url,asaas_checkout_expires_at")
    .eq("external_reference", ref)
    .maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Cadastro não encontrado." }, { status: 404 });

  const ready = data.status === "pago" && Boolean(data.provisioned_tenant_id);
  let accessConfigured = false;

  if (ready && data.provisioned_tenant_id) {
    const { data: tenant } = await admin.from("tenants").select("owner_user_id").eq("id", data.provisioned_tenant_id).maybeSingle();
    if (tenant) {
      const { data: owner } = await admin.auth.admin.getUserById(tenant.owner_user_id);
      accessConfigured = Boolean(owner.user?.app_metadata?.catalogoja_password_configured_at);
    }
  }

  const checkoutAvailable = data.status === "pendente"
    && Boolean(data.asaas_checkout_url)
    && Boolean(data.asaas_checkout_expires_at)
    && new Date(data.asaas_checkout_expires_at!).getTime() > Date.now();
  const response = NextResponse.json({
    accessConfigured,
    checkoutUrl: checkoutAvailable ? data.asaas_checkout_url : null,
    ready,
    slug: data.status === "pago" ? data.slug : null,
    status: data.status,
  });

  if (ready && data.provisioned_tenant_id) {
    response.cookies.set(ACTIVE_TENANT_COOKIE_NAME, data.provisioned_tenant_id, {
      httpOnly: true,
      maxAge: ACTIVE_TENANT_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }

  return response;
}
