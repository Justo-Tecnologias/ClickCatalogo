import "server-only";

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env/public";
import { createAdminClient } from "@/lib/supabase/admin";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

type RateLimitPolicy = {
  failureMode?: "closed" | "local";
  limit: number;
  scope: string;
  windowMs: number;
};

type GlobalRateLimitStore = typeof globalThis & {
  __clickCatalogoRateLimitStore?: Map<string, RateLimitEntry>;
};

const MAX_STORED_CLIENTS = 10_000;
const globalStore = globalThis as GlobalRateLimitStore;
const store = globalStore.__clickCatalogoRateLimitStore ??= new Map<string, RateLimitEntry>();

export const PUBLIC_API_RATE_LIMITS = {
  accountAvailability: { limit: 12, scope: "account-availability", windowMs: 10 * 60 * 1000 },
  analytics: { limit: 60, scope: "product-analytics", windowMs: 60 * 1000 },
  checkout: { failureMode: "closed", limit: 5, scope: "checkout", windowMs: 10 * 60 * 1000 },
  passwordSetup: { failureMode: "closed", limit: 10, scope: "password-setup", windowMs: 15 * 60 * 1000 },
  signupRecoveryConsume: { failureMode: "closed", limit: 10, scope: "signup-recovery-consume", windowMs: 15 * 60 * 1000 },
  signupRecoveryEmail: { failureMode: "closed", limit: 3, scope: "signup-recovery-email", windowMs: 30 * 60 * 1000 },
  signupRecoveryIp: { failureMode: "closed", limit: 5, scope: "signup-recovery-ip", windowMs: 15 * 60 * 1000 },
  slugAvailability: { limit: 60, scope: "slug-availability", windowMs: 60 * 1000 },
  supportEmail: { failureMode: "closed", limit: 5, scope: "support-email", windowMs: 15 * 60 * 1000 },
  supportIp: { failureMode: "closed", limit: 10, scope: "support-ip", windowMs: 15 * 60 * 1000 },
  signupStatus: { limit: 120, scope: "signup-status", windowMs: 10 * 60 * 1000 },
  webhook: { limit: 180, scope: "asaas-webhook", windowMs: 60 * 1000 },
} satisfies Record<string, RateLimitPolicy>;

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return request.headers.get("x-nf-client-connection-ip")?.trim()
    || forwarded
    || request.headers.get("x-real-ip")?.trim()
    || request.headers.get("cf-connecting-ip")?.trim()
    || "unknown";
}

function removeExpiredEntries(now: number) {
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

function reserveStoreSpace(now: number) {
  if (store.size < MAX_STORED_CLIENTS) return;
  removeExpiredEntries(now);

  if (store.size >= MAX_STORED_CLIENTS) {
    const oldestKey = store.keys().next().value;
    if (typeof oldestKey === "string") store.delete(oldestKey);
  }
}

function memoryRateLimit(identifier: string, policy: RateLimitPolicy) {
  const now = Date.now();
  const key = `${policy.scope}:${identifier}`;
  const current = store.get(key);

  if (!current || current.resetAt <= now) {
    reserveStoreSpace(now);
    store.set(key, { count: 1, resetAt: now + policy.windowMs });
    return null;
  }

  current.count += 1;

  if (current.count <= policy.limit) return null;

  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  return NextResponse.json(
    { error: "Muitas solicitações em pouco tempo. Aguarde um instante e tente novamente." },
    {
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(policy.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(current.resetAt / 1000)),
      },
      status: 429,
    },
  );
}

let distributedFallbackReported = false;

function rateLimitResponse(policy: RateLimitPolicy, retryAfter: number, resetAt: number) {
  return NextResponse.json(
    { error: "Muitas solicitações em pouco tempo. Aguarde um instante e tente novamente." },
    {
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfter),
        "X-RateLimit-Limit": String(policy.limit),
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
      },
      status: 429,
    },
  );
}

function unavailableRateLimitResponse() {
  return NextResponse.json(
    { error: "Serviço temporariamente indisponível. Aguarde um instante e tente novamente." },
    {
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "30",
      },
      status: 503,
    },
  );
}

async function enforceIdentifierRateLimit(identifier: string, policy: RateLimitPolicy) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isSupabaseConfigured() && secret) {
    try {
      const keyHash = createHmac("sha256", secret)
        .update(`${policy.scope}:${identifier}`)
        .digest("hex");
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("consume_api_rate_limit", {
        p_key_hash: keyHash,
        p_limit: policy.limit,
        p_window_seconds: Math.ceil(policy.windowMs / 1000),
      });
      if (error) throw error;

      const result = data?.[0];
      if (result && !result.allowed) {
        return rateLimitResponse(policy, result.retry_after, new Date(result.reset_at).getTime());
      }
      if (result) return null;
    } catch (error) {
      if (!distributedFallbackReported) {
        distributedFallbackReported = true;
        console.error(
          "Rate limit distribuído indisponível; usando fallback local:",
          error instanceof Error
            ? error.message
            : error && typeof error === "object" && "message" in error
              ? String(error.message)
              : "erro desconhecido",
        );
      }
    }
  }

  if (policy.failureMode === "closed") return unavailableRateLimitResponse();
  return memoryRateLimit(identifier, policy);
}

export async function enforceRateLimit(request: Request, policy: RateLimitPolicy) {
  return enforceIdentifierRateLimit(clientIp(request), policy);
}

export async function enforceRateLimitForIdentifier(
  identifier: string,
  policy: RateLimitPolicy,
) {
  return enforceIdentifierRateLimit(identifier.trim().toLowerCase(), policy);
}
