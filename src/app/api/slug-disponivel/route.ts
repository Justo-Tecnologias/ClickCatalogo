import { NextResponse, type NextRequest } from "next/server";

import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { expireStaleSignupIntents } from "@/lib/signup/intents";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { tenantSlugSchema } from "@/lib/tenants/slug";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.slugAvailability);
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = tenantSlugSchema.safeParse(request.nextUrl.searchParams.get("slug") ?? "");
  if (!parsed.success) return NextResponse.json({ available: false, message: parsed.error.issues[0]?.message ?? "Endereço inválido." });

  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ available: null, configured: false, message: "Disponibilidade será confirmada após configurar o Supabase." });
  }

  const admin = createAdminClient();
  const panelRequest = request.nextUrl.searchParams.get("context") === "panel";
  let requestingTenantId: string | null = null;

  if (panelRequest) {
    const supabase = await createClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      return NextResponse.json(
        { available: null, configured: true, message: "Não foi possível confirmar sua sessão agora. Tente novamente." },
        { status: 503 },
      );
    }
    if (user) {
      const { data: ownTenant, error: ownTenantError } = await admin
        .from("tenants")
        .select("id")
        .eq("owner_user_id", user.id)
        .maybeSingle();
      if (ownTenantError) {
        console.error("Falha ao identificar a loja durante a verificação do endereço:", ownTenantError.message);
        return NextResponse.json(
          { available: null, configured: true, message: "Não foi possível confirmar o endereço agora. Tente novamente." },
          { status: 503 },
        );
      }
      requestingTenantId = ownTenant?.id ?? null;
    }
  }

  try {
    await expireStaleSignupIntents(admin);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Falha ao liberar cadastros expirados.");
    return NextResponse.json(
      { available: null, configured: true, message: "Não foi possível confirmar o endereço agora. Tente novamente." },
      { status: 503 },
    );
  }

  const [tenantResult, intentResult, historyResult] = await Promise.all([
    admin.from("tenants").select("id", { count: "exact", head: true }).eq("slug", parsed.data),
    admin.from("signup_intents").select("id", { count: "exact", head: true }).eq("slug", parsed.data).or("status.eq.pendente,and(status.eq.pago,provisioned_tenant_id.is.null)"),
    admin.from("tenant_slug_history").select("tenant_id").eq("slug", parsed.data).gt("redirect_until", new Date().toISOString()).maybeSingle(),
  ]);
  const queryError = tenantResult.error ?? intentResult.error ?? historyResult.error;
  if (queryError) {
    console.error("Falha ao consultar disponibilidade do endereço:", queryError.message);
    return NextResponse.json(
      { available: null, configured: true, message: "Não foi possível confirmar o endereço agora. Tente novamente." },
      { status: 503 },
    );
  }
  const { count: tenantCount } = tenantResult;
  const { count: intentCount } = intentResult;
  const historyOwnerId = historyResult.data?.tenant_id ?? null;
  const reclaimingOwnSlug = Boolean(
    panelRequest && requestingTenantId && historyOwnerId === requestingTenantId,
  );
  const historyBlocked = Boolean(historyOwnerId) && !reclaimingOwnSlug;
  const available = (tenantCount ?? 0) === 0 && (intentCount ?? 0) === 0 && !historyBlocked;
  return NextResponse.json({
    available,
    configured: true,
    message: available
      ? reclaimingOwnSlug
        ? "Este endereço antigo pertence à sua loja e pode ser reutilizado."
        : "Endereço disponível!"
      : "Este endereço já está em uso.",
  });
}
