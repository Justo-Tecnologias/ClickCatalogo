import { createClient } from "@supabase/supabase-js";

// Aviso único aos lojistas atuais sobre a nova regra de atraso dos Termos
// (versão 2026-09-30). Simula por padrão; o envio real exige confirmação.
// A Idempotency-Key do Resend impede duplicidade em reexecuções no mesmo dia.

const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (nodeMajor < 22) {
  console.error(`A rotina requer Node.js 22 ou superior (versão atual: ${process.versions.node}).`);
  process.exit(1);
}

const TERMS_VERSION = "2026-09-30";
const EXECUTION_CONFIRMATION = "AVISAR-LOJISTAS-TERMOS";
const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...value] = argument.split("=");
    return [key, value.join("=") || true];
  }),
);
const execute = args.has("--execute");

if (execute && args.get("--confirm") !== EXECUTION_CONFIRMATION) {
  console.error(
    `Envio recusado. Use --execute --confirm=${EXECUTION_CONFIRMATION} somente depois de revisar a simulação.`,
  );
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const resendApiKey = process.env.RESEND_API_KEY?.trim();
const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();
const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://clickcatalogo.com").replace(/\/$/, "");
if (!url || !serviceRoleKey) {
  console.error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY antes de executar a rotina.");
  process.exit(1);
}
if (execute && (!resendApiKey || !resendFrom)) {
  console.error("Configure RESEND_API_KEY e RESEND_FROM_EMAIL antes do envio real.");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain ?? "?"}`;
}

function termsEmail(storeName) {
  const name = escapeHtml(storeName.replace(/[\r\n]+/g, " ").trim());
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f7f5;font-family:Arial,sans-serif;color:#13251f">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="background:#fff;border:1px solid #d9e2dd;border-radius:16px;padding:28px">
    <p style="margin:0 0 20px;font-weight:700;color:#174f3d">ClickCatálogo</p>
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px">Atualizamos os Termos de uso</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 16px">Olá! Para deixar tudo mais claro para a loja <strong>${name}</strong>, os Termos agora explicam o que acontece se o pagamento de uma renovação não for confirmado:</p>
    <ul style="font-size:15px;line-height:1.7;margin:0 0 16px;padding-left:20px">
      <li>avisamos você por e-mail e no painel;</li>
      <li>a loja continua no ar por até 7 dias após o vencimento;</li>
      <li>a partir do 8º dia, o catálogo fica fora do ar até o pagamento ser confirmado;</li>
      <li>com 30 dias de atraso, a assinatura é encerrada e os dados ficam guardados por mais 30 dias para reativação.</li>
    </ul>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px">Se a sua assinatura está em dia, nada muda para você.</p>
    <a href="${escapeHtml(`${siteUrl}/termos`)}" style="display:inline-block;background:#174f3d;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px">Ler os Termos atualizados</a>
    <p style="font-size:13px;line-height:1.6;color:#607069;margin:24px 0 0">Este é um aviso único sobre a atualização dos Termos. Em caso de dúvida, responda pelo atendimento em ${escapeHtml(`${siteUrl}/atendimento`)}.</p>
  </div>
</div></body></html>`;
}

const { data: tenants, error } = await supabase
  .from("tenants")
  .select("id,nome_loja,owner_user_id,status")
  .in("status", ["ativo", "inadimplente"])
  .order("created_at");
if (error) {
  console.error("Não foi possível listar as lojas:", error.message);
  process.exit(1);
}

const summary = { failed: 0, mode: execute ? "execucao" : "simulacao", recipients: 0, sent: 0, skipped: 0 };

for (const tenant of tenants ?? []) {
  const { data: owner, error: ownerError } = await supabase.auth.admin.getUserById(tenant.owner_user_id);
  const email = owner?.user?.email;
  if (ownerError || !email) {
    summary.skipped += 1;
    continue;
  }
  summary.recipients += 1;

  if (!execute) {
    console.log(`[simulação] ${tenant.status} · ${maskEmail(email)}`);
    continue;
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: resendFrom,
      html: termsEmail(tenant.nome_loja),
      subject: "Atualizamos os Termos de uso do ClickCatálogo",
      to: [email],
    }),
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `terms-${TERMS_VERSION}-${tenant.id}`,
    },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });
  if (response.ok) {
    summary.sent += 1;
  } else {
    summary.failed += 1;
    console.error(`Falha no envio para ${maskEmail(email)} (${response.status}).`);
  }
}

console.log(JSON.stringify(summary, null, 2));
if (summary.failed > 0) process.exitCode = 1;
