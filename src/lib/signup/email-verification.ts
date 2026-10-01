import "server-only";

import { getResendEnv, getSiteUrl } from "@/lib/env/server";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { logError, logInfo } from "@/lib/observability/logger";
import { verificationEmail, welcomeEmail } from "@/lib/signup/draft-emails.mjs";
import { createSignupRecoveryToken } from "@/lib/signup/recovery-token";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export const EMAIL_VERIFICATION_DAYS = 7;
/** Intervalo mínimo entre dois envios de confirmação pela mesma loja. */
export const EMAIL_VERIFICATION_RESEND_MS = 2 * 60 * 1000;

/**
 * Gera um link de uso único (só o hash fica no banco) e envia a confirmação.
 * O token vai no fragmento (#) da URL, que não chega aos logs do servidor.
 */
export async function sendEmailVerification(
  admin: AdminClient,
  input: { email: string; kind: "welcome" | "resend"; storeName: string; tenantId: string },
) {
  const token = createSignupRecoveryToken();
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin.from("email_verification_tokens").insert({
    expires_at: expiresAt,
    tenant_id: input.tenantId,
    token_hash: token.hash,
  });
  if (error) throw error;

  const siteUrl = getSiteUrl();
  const verifyUrl = `${siteUrl}/cadastro/confirmar-email#token=${encodeURIComponent(token.raw)}`;
  const email = input.kind === "welcome"
    ? welcomeEmail({ siteUrl, storeName: input.storeName, verifyUrl })
    : verificationEmail({ storeName: input.storeName, verifyUrl });

  if (!getResendEnv()) {
    // Sem Resend (ambiente local), o link aparece só no terminal de desenvolvimento.
    if (process.env.NODE_ENV !== "production") console.info(`[dev] Link de confirmação: ${verifyUrl}`);
    logInfo("email_verification.skipped", { reason: "resend_not_configured", tenant_id: input.tenantId });
    return { sent: false };
  }

  try {
    await sendTransactionalEmail({ ...email, to: input.email });
    return { sent: true };
  } catch (sendError) {
    logError("email_verification.send", sendError, { tenant_id: input.tenantId });
    return { sent: false };
  }
}
