import "server-only";

import { getResendEnv } from "@/lib/env/server";

type SendEmailInput = {
  html: string;
  subject: string;
  to: string;
};

export async function sendTransactionalEmail(input: SendEmailInput) {
  const env = getResendEnv();
  if (!env) throw new Error("Resend não configurado para e-mails transacionais.");

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: env.from,
      html: input.html,
      subject: input.subject,
      to: [input.to],
    }),
    headers: {
      Authorization: `Bearer ${env.apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Resend recusou o envio (${response.status}).`);
  }
}

export function signupRecoveryEmail(link: string) {
  const safeLink = link.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f7f5;font-family:Arial,sans-serif;color:#13251f">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="background:#fff;border:1px solid #d9e2dd;border-radius:16px;padding:28px">
    <p style="margin:0 0 20px;font-weight:700;color:#174f3d">ClickCatálogo</p>
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px">Acesse sua loja</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px">Recebemos uma solicitação para continuar o acesso ao ClickCatálogo. Use o botão abaixo para continuar de onde parou.</p>
    <a href="${safeLink}" style="display:inline-block;background:#174f3d;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px">Acessar minha loja</a>
    <p style="font-size:13px;line-height:1.6;color:#607069;margin:24px 0 0">Este link expira em 20 minutos e pode ser usado uma única vez. Se você não solicitou, ignore esta mensagem.</p>
  </div>
</div></body></html>`;
}
