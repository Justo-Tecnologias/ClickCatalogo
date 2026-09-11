import { createHash, randomBytes } from "node:crypto";

export function createSignupRecoveryToken() {
  const raw = randomBytes(32).toString("base64url");
  return { hash: hashSignupRecoveryToken(raw), raw };
}

export function hashSignupRecoveryToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}
