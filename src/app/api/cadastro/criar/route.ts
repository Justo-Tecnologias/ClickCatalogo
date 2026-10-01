import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { recordProductMetric } from "@/lib/analytics/server";
import { ACTIVE_TENANT_COOKIE_MAX_AGE, ACTIVE_TENANT_COOKIE_NAME } from "@/lib/auth/tenant-cookie";
import { DEMO_COOKIE_NAME } from "@/lib/demo/panel-demo";
import { isSupabaseConfigured } from "@/lib/env/public";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/legal/documents";
import { logError, logInfo } from "@/lib/observability/logger";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import { sendEmailVerification } from "@/lib/signup/email-verification";
import { expireStaleSignupIntents } from "@/lib/signup/intents";
import { draftSignupSchema } from "@/lib/signup/schema";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type AdminClient = ReturnType<typeof createAdminClient>;

// Cadastro gratuito ("monte grátis, pague para publicar"): cria a conta com
// senha, a loja em rascunho e o registro de aceites, abre a sessão e envia o
// e-mail de boas-vindas com a confirmação. Nada é cobrado aqui.
export async function POST(request: Request) {
  const requestId = request.headers.get("x-nf-request-id")?.slice(0, 100) ?? randomUUID();
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.draftSignup);
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = draftSignupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Revise os dados informados." }, { status: 400 });

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "O cadastro ainda não foi configurado no servidor." }, { status: 503 });
  }

  const admin = createAdminClient();
  const input = parsed.data;

  try {
    await expireStaleSignupIntents(admin);
    const availability = await checkAvailability(admin, input.email, input.slug);
    if (availability) return availability;
  } catch (error) {
    logError("draft_signup.availability", error, { request_id: requestId });
    return NextResponse.json({ error: "Não foi possível validar o cadastro agora. Tente novamente." }, { status: 503 });
  }

  const now = new Date().toISOString();
  const owner = await createOwner(admin, input.email, input.password, input.nomeLoja, now);
  if ("error" in owner) {
    if (owner.status >= 500) logError("draft_signup.owner", owner.cause, { request_id: requestId });
    return NextResponse.json({ action: owner.status === 409 ? "login" : undefined, error: owner.error }, { status: owner.status });
  }

  const { data: tenant, error: tenantError } = await admin.from("tenants").insert({
    draft_last_seen_at: now,
    nome_loja: input.nomeLoja,
    owner_user_id: owner.userId,
    slug: input.slug,
    status: "rascunho",
    tema: input.tema,
    whatsapp: input.whatsapp,
  }).select("id").single();

  if (tenantError || !tenant) {
    if (owner.created) await admin.auth.admin.deleteUser(owner.userId).catch(() => undefined);
    if (tenantError?.code === "23505") {
      return NextResponse.json({ error: "Este endereço acabou de ser reservado. Escolha outro." }, { status: 409 });
    }
    logError("draft_signup.tenant", tenantError ?? new Error("Loja não criada."), { request_id: requestId });
    return NextResponse.json({ error: "Não foi possível criar sua loja agora. Tente novamente." }, { status: 500 });
  }

  // Aceites ficam no mesmo registro usado pelo fluxo pago (arquivo legal,
  // reativação). Ao publicar, este registro recebe o checkout.
  const { error: intentError } = await admin.from("signup_intents").insert({
    email: input.email,
    nome_loja: input.nomeLoja,
    privacy_accepted_at: now,
    privacy_version: PRIVACY_VERSION,
    provisioned_tenant_id: tenant.id,
    slug: input.slug,
    status: "rascunho",
    tema: input.tema,
    terms_accepted_at: now,
    terms_version: TERMS_VERSION,
    whatsapp: input.whatsapp,
  });
  if (intentError) {
    await admin.from("tenants").delete().eq("id", tenant.id);
    if (owner.created) await admin.auth.admin.deleteUser(owner.userId).catch(() => undefined);
    logError("draft_signup.intent", intentError, { request_id: requestId });
    return NextResponse.json({ error: "Não foi possível criar sua loja agora. Tente novamente." }, { status: 500 });
  }

  // A conta já existe: falhas daqui em diante não desfazem o cadastro.
  try {
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
    if (signInError) throw signInError;
  } catch (signInError) {
    logError("draft_signup.sign_in", signInError, { request_id: requestId, tenant_id: tenant.id });
    return NextResponse.json({ next: "/painel" });
  }

  await sendEmailVerification(admin, { email: input.email, kind: "welcome", storeName: input.nomeLoja, tenantId: tenant.id })
    .catch((sendError) => logError("draft_signup.welcome_email", sendError, { request_id: requestId, tenant_id: tenant.id }));
  await recordProductMetric("draft_created", tenant.id);
  logInfo("draft_signup.created", { request_id: requestId, result: "created", tenant_id: tenant.id });

  const response = NextResponse.json({ next: "/painel/loja?bem-vindo=1" });
  response.cookies.set(ACTIVE_TENANT_COOKIE_NAME, tenant.id, {
    httpOnly: true,
    maxAge: ACTIVE_TENANT_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  response.cookies.delete(DEMO_COOKIE_NAME);
  return response;
}

async function checkAvailability(admin: AdminClient, email: string, slug: string) {
  const [emailResult, tenantResult, intentResult, emailIntentResult, historyResult] = await Promise.all([
    admin.rpc("email_has_tenant", { p_email: email }),
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("slug", slug),
    admin.from("signup_intents").select("id", { count: "exact", head: true }).eq("slug", slug).or("status.eq.pendente,and(status.eq.pago,provisioned_tenant_id.is.null)"),
    admin.from("signup_intents").select("id", { count: "exact", head: true }).eq("email", email).or("status.eq.pendente,and(status.eq.pago,provisioned_tenant_id.is.null)"),
    admin.from("tenant_slug_history").select("slug", { count: "exact", head: true }).eq("slug", slug).gt("redirect_until", new Date().toISOString()),
  ]);
  const lookupError = emailResult.error ?? tenantResult.error ?? intentResult.error ?? emailIntentResult.error ?? historyResult.error;
  if (lookupError) throw lookupError;

  if (emailResult.data) {
    return NextResponse.json({ action: "login", error: "Este e-mail já possui uma loja. Entre no painel ou recupere sua senha." }, { status: 409 });
  }
  if ((tenantResult.count ?? 0) > 0 || (intentResult.count ?? 0) > 0 || (historyResult.count ?? 0) > 0) {
    return NextResponse.json({ error: "Este endereço acabou de ser reservado. Escolha outro." }, { status: 409 });
  }
  if ((emailIntentResult.count ?? 0) > 0) {
    return NextResponse.json({ action: "resume", error: "Já existe um cadastro ou pagamento em andamento para este e-mail." }, { status: 409 });
  }
  return null;
}

type OwnerResult =
  | { created: boolean; userId: string }
  | { cause?: unknown; error: string; status: number };

async function createOwner(admin: AdminClient, email: string, password: string, storeName: string, now: string): Promise<OwnerResult> {
  // O e-mail fica marcado como confirmado no Auth para permitir o login com
  // senha imediato; a confirmação real (exigida para publicar) é
  // tenants.email_confirmado_em, feita pelo link do e-mail de boas-vindas.
  const appMetadata = { catalogoja_password_configured_at: now };
  const created = await admin.auth.admin.createUser({
    app_metadata: appMetadata,
    email,
    email_confirm: true,
    password,
    user_metadata: { nome_loja: storeName },
  });
  if (created.data.user && !created.error) return { created: true, userId: created.data.user.id };

  // Usuário do Auth sem loja (ex.: rascunho excluído ou cadastro interrompido):
  // reaproveita a conta com a nova senha. Com loja, o caminho é o login.
  const { data: existingId, error: lookupError } = await admin.rpc("find_auth_user_id_by_email", { p_email: email });
  if (lookupError || !existingId) return { cause: created.error ?? lookupError, error: "Não foi possível criar seu acesso agora. Tente novamente.", status: 500 };

  const { count, error: tenantError } = await admin.from("tenants").select("id", { count: "exact", head: true }).eq("owner_user_id", existingId);
  if (tenantError) return { cause: tenantError, error: "Não foi possível criar seu acesso agora. Tente novamente.", status: 500 };
  if ((count ?? 0) > 0) return { error: "Este e-mail já possui uma loja. Entre no painel ou recupere sua senha.", status: 409 };

  const { error: updateError } = await admin.auth.admin.updateUserById(existingId, {
    app_metadata: appMetadata,
    email_confirm: true,
    password,
  });
  if (updateError) return { cause: updateError, error: "Não foi possível criar seu acesso agora. Tente novamente.", status: 500 };
  return { created: false, userId: existingId };
}
