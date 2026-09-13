import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env/public";
import { logError } from "@/lib/observability/logger";
import { enforceRateLimit, PUBLIC_API_RATE_LIMITS } from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";
import { SIGNUP_RESUME_COOKIE_NAME } from "@/lib/signup/resume";
import { createAdminClient } from "@/lib/supabase/admin";

const inputSchema = z.object({ reference: z.uuid() });
const GENERIC_RESPONSE = { accepted: true };

export async function POST(request: Request) {
  const requestId = randomUUID();
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const rateLimitResponse = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.signupStatus);
  if (rateLimitResponse) return rateLimitResponse;

  const parsed = inputSchema.safeParse(await request.json().catch(() => null));
  const authorizedReference = (await cookies()).get(SIGNUP_RESUME_COOKIE_NAME)?.value;
  if (!parsed.success || authorizedReference !== parsed.data.reference) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 202 });
  }
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 202 });
  }

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("signup_intents")
      .update({ checkout_returned_at: new Date().toISOString() })
      .eq("external_reference", parsed.data.reference)
      .eq("status", "pendente")
      .not("asaas_checkout_id", "is", null)
      .is("provisioned_tenant_id", null);
    if (error) throw error;
  } catch (error) {
    logError("checkout.return_marker", error, { request_id: requestId });
  }

  return NextResponse.json(GENERIC_RESPONSE, {
    headers: { "Cache-Control": "no-store" },
    status: 202,
  });
}
