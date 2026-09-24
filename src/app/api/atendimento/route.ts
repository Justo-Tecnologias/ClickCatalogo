import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { getPanelContext } from "@/lib/auth/session";
import { sendTransactionalEmail } from "@/lib/email/resend";
import { getResendEnv } from "@/lib/env/server";
import { getLegalIdentity } from "@/lib/legal/identity";
import { logError, logInfo } from "@/lib/observability/logger";
import {
  enforceRateLimit,
  enforceRateLimitForIdentifier,
  PUBLIC_API_RATE_LIMITS,
} from "@/lib/security/rate-limit";
import { enforceSameOrigin } from "@/lib/security/same-origin";

const supportRequestSchema = z.object({
  email: z.string().trim().pipe(z.email()).transform((value) => value.toLowerCase()),
  message: z.string().trim().min(10, "Explique sua dúvida em pelo menos 10 caracteres.").max(3000),
  name: z.string().trim().min(2, "Informe seu nome.").max(100),
  pageUrl: z.string().trim().max(500).optional(),
  topic: z.enum(["geral", "cobranca", "dados", "sugestao", "problema"]),
  userAgent: z.string().trim().max(500).optional(),
  website: z.string().max(200).optional(),
});

const topicLabels = {
  cobranca: "Cobrança e assinatura",
  dados: "Privacidade e dados",
  geral: "Dúvida geral",
  problema: "Problema no sistema",
  sugestao: "Sugestão de melhoria",
} as const;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function supportRequestEmail(input: z.infer<typeof supportRequestSchema>, account: { email: string | null; storeName: string | null }) {
  const accountDetails = account.storeName
    ? `<p style="margin:0 0 8px"><strong>Loja autenticada:</strong> ${escapeHtml(account.storeName)}</p>`
    : "";
  const accountEmail = account.email
    ? `<p style="margin:0 0 8px"><strong>E-mail da conta:</strong> ${escapeHtml(account.email)}</p>`
    : "";
  const pageDetails = input.pageUrl
    ? `<p style="margin:0 0 8px"><strong>Página de origem:</strong> ${escapeHtml(input.pageUrl)}</p>`
    : "";
  const deviceDetails = input.userAgent
    ? `<p style="margin:0 0 8px"><strong>Navegador/dispositivo:</strong> ${escapeHtml(input.userAgent)}</p>`
    : "";

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f7f5;font-family:Arial,sans-serif;color:#13251f">
<div style="max-width:640px;margin:0 auto;padding:32px 20px">
  <div style="background:#fff;border:1px solid #d9e2dd;border-radius:16px;padding:28px">
    <p style="margin:0 0 20px;font-weight:700;color:#174f3d">ClickCatálogo</p>
    <h1 style="font-size:22px;line-height:1.3;margin:0 0 20px">Nova solicitação de atendimento</h1>
    <p style="margin:0 0 8px"><strong>Assunto:</strong> ${topicLabels[input.topic]}</p>
    <p style="margin:0 0 8px"><strong>Nome:</strong> ${escapeHtml(input.name)}</p>
    <p style="margin:0 0 8px"><strong>E-mail para resposta:</strong> ${escapeHtml(input.email)}</p>
    ${accountDetails}${accountEmail}${pageDetails}${deviceDetails}
    <div style="margin-top:20px;padding:16px;background:#f4f7f5;border-radius:10px;white-space:pre-wrap;line-height:1.6">${escapeHtml(input.message)}</div>
  </div>
</div></body></html>`;
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  const originResponse = enforceSameOrigin(request);
  if (originResponse) return originResponse;

  const ipLimit = await enforceRateLimit(request, PUBLIC_API_RATE_LIMITS.supportIp);
  if (ipLimit) return ipLimit;

  const parsed = supportRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Revise os dados da mensagem." },
      { status: 400 },
    );
  }
  if (parsed.data.website) return NextResponse.json({ message: "Mensagem recebida." }, { status: 202 });

  const emailLimit = await enforceRateLimitForIdentifier(parsed.data.email, PUBLIC_API_RATE_LIMITS.supportEmail);
  if (emailLimit) return emailLimit;

  const { supportEmail } = getLegalIdentity();
  if (!supportEmail || !getResendEnv()) {
    return NextResponse.json(
      { error: "O atendimento está temporariamente indisponível. Tente novamente mais tarde." },
      { status: 503 },
    );
  }

  try {
    const context = await getPanelContext();
    const account = context.authenticated && !context.demo
      ? { email: context.userEmail, storeName: context.tenant?.nome_loja ?? null }
      : { email: null, storeName: null };

    await sendTransactionalEmail({
      html: supportRequestEmail(parsed.data, account),
      idempotencyKey: `support-${requestId}`,
      replyTo: parsed.data.email,
      subject: `[Atendimento] ${topicLabels[parsed.data.topic]} — ${parsed.data.name.replace(/[\r\n]+/g, " ")}`,
      to: supportEmail,
    });
    logInfo("support.request", { authenticated: context.authenticated && !context.demo, request_id: requestId, topic: parsed.data.topic });
    return NextResponse.json(
      { message: "Mensagem enviada. Responderemos pelo e-mail informado." },
      { headers: { "Cache-Control": "no-store" }, status: 201 },
    );
  } catch (error) {
    logError("support.request", error, { request_id: requestId, topic: parsed.data.topic });
    return NextResponse.json(
      { error: "Não foi possível enviar sua mensagem agora. Aguarde um instante e tente novamente." },
      { status: 503 },
    );
  }
}
