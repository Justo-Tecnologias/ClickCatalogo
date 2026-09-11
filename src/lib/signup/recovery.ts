import "server-only";

import { createHmac } from "node:crypto";

import { requireSupabaseServiceRoleKey } from "@/lib/env/server";

export { createSignupRecoveryToken, hashSignupRecoveryToken } from "@/lib/signup/recovery-token";

export const SIGNUP_RECOVERY_TOKEN_MINUTES = 20;

export function hashPrivateIdentifier(value: string) {
  return createHmac("sha256", requireSupabaseServiceRoleKey())
    .update(value.trim().toLowerCase())
    .digest("hex");
}

export function requestIp(request: Request) {
  return request.headers.get("x-nf-client-connection-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown";
}
