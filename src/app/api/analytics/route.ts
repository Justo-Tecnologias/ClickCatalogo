import { NextResponse } from "next/server";
import { z } from "zod";

import { publicProductMetricNames } from "@/lib/analytics/events";
import { isAcquisitionMetric, parseAcquisitionOrigin } from "@/lib/analytics/origins";
import { recordAcquisitionMetric, recordProductMetric } from "@/lib/analytics/server";
import { isSupabaseConfigured } from "@/lib/env/public";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import { createAdminClient } from "@/lib/supabase/admin";
import { tenantSlugSchema } from "@/lib/tenants/slug";

const inputSchema = z.object({
  event: z.enum(publicProductMetricNames),
  origem: z.string().max(32).optional(),
  slug: tenantSlugSchema.optional(),
});

const TENANT_EVENTS = new Set(["catalog_shared", "catalog_view", "store_brand_clicked", "whatsapp_order_clicked"]);

export async function POST(request: Request) {
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.analytics);
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new NextResponse(null, { status: 204 });
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return new NextResponse(null, { status: 204 });
  }

  let tenantId: string | null = null;
  if (TENANT_EVENTS.has(parsed.data.event)) {
    if (!parsed.data.slug) return new NextResponse(null, { status: 204 });
    const { data } = await createAdminClient()
      .from("tenants")
      .select("id")
      .eq("slug", parsed.data.slug)
      // Mesma regra da loja pública: inadimplentes continuam no ar e contam.
      .in("status", ["ativo", "inadimplente"])
      .maybeSingle();
    if (!data) return new NextResponse(null, { status: 204 });
    tenantId = data.id;
  }

  await recordProductMetric(parsed.data.event, tenantId);

  // Visitas e etapas do cadastro vindas de um link com ?origem= também são
  // contadas por canal (eventos de loja ficam só no escopo da loja).
  const origin = parseAcquisitionOrigin(parsed.data.origem);
  if (!tenantId && origin && isAcquisitionMetric(parsed.data.event)) {
    await recordAcquisitionMetric(parsed.data.event, origin);
  }
  return new NextResponse(null, { status: 204 });
}
