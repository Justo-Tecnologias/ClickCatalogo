import { addDays, officialAsaasInvoiceUrl, overdueMilestones } from "./overdue-policy.mjs";

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** @param {string} isoDate */
function formatDate(isoDate) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Conteúdo dos avisos de atraso (dias 1, 6 e 25). As datas vêm da mesma
 * política usada pelo banco, evitando divergência entre e-mail e realidade.
 * @param {{ invoiceUrl: string | null, noticeDay: 1 | 6 | 25, overdueSince: string, siteUrl: string, storeName: string }} input
 */
export function overdueNoticeEmail(input) {
  const { cancellationDate, lastOnlineDate, suspensionDate } = overdueMilestones(input.overdueSince);
  const plainStoreName = input.storeName.replace(/[\r\n]+/g, " ").trim();
  const storeName = escapeHtml(plainStoreName);
  const invoiceUrl = officialAsaasInvoiceUrl(input.invoiceUrl);
  const panelUrl = `${input.siteUrl.replace(/\/$/, "")}/painel/assinatura`;
  const lastPaymentDate = addDays(cancellationDate, -1);

  const content = {
    1: {
      body: `Não conseguimos confirmar o pagamento da assinatura da loja <strong>${storeName}</strong>. Sua loja continua no ar normalmente até <strong>${formatDate(lastOnlineDate)}</strong>. Para evitar a interrupção, regularize a fatura; você pode pagar com outro cartão.`,
      subject: `Pagamento não aprovado — ${plainStoreName}`,
      title: "Não conseguimos confirmar seu pagamento",
    },
    6: {
      body: `O pagamento da assinatura da loja <strong>${storeName}</strong> continua pendente. A partir de <strong>${formatDate(suspensionDate)}</strong> o catálogo ficará fora do ar para seus clientes até o pagamento ser confirmado. Seus produtos e configurações continuam guardados.`,
      subject: `Sua loja sai do ar em ${formatDate(suspensionDate)} — ${plainStoreName}`,
      title: "Sua loja vai sair do ar",
    },
    25: {
      body: `A loja <strong>${storeName}</strong> está fora do ar desde ${formatDate(suspensionDate)} por falta de pagamento. Se o pagamento não for confirmado até <strong>${formatDate(lastPaymentDate)}</strong>, a assinatura será encerrada em ${formatDate(cancellationDate)}, as faturas em aberto serão canceladas e os dados ficarão guardados por mais 30 dias para uma possível reativação.`,
      subject: `Sua assinatura será encerrada em ${formatDate(cancellationDate)} — ${plainStoreName}`,
      title: "Sua assinatura será encerrada",
    },
  }[input.noticeDay];

  if (!content) throw new Error("Aviso de atraso inválido.");

  const primaryHref = escapeHtml(invoiceUrl ?? panelUrl);
  const primaryLabel = invoiceUrl ? "Pagar fatura" : "Regularizar no painel";
  const secondary = invoiceUrl
    ? `<p style="font-size:14px;line-height:1.6;margin:16px 0 0">Prefere conferir antes? <a href="${escapeHtml(panelUrl)}" style="color:#174f3d;font-weight:700">Acesse sua assinatura no painel</a>.</p>`
    : "";

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f7f5;font-family:Arial,sans-serif;color:#13251f">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="background:#fff;border:1px solid #d9e2dd;border-radius:16px;padding:28px">
    <p style="margin:0 0 20px;font-weight:700;color:#174f3d">ClickCatálogo</p>
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px">${content.title}</h1>
    <p style="font-size:16px;line-height:1.6;margin:0 0 24px">${content.body}</p>
    <a href="${primaryHref}" style="display:inline-block;background:#174f3d;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px">${primaryLabel}</a>
    ${secondary}
    <p style="font-size:13px;line-height:1.6;color:#607069;margin:24px 0 0">Se você já pagou, desconsidere esta mensagem; a confirmação pode levar alguns minutos. O ClickCatálogo nunca pede senha ou dados do cartão por e-mail.</p>
  </div>
</div></body></html>`;

  return { html, subject: content.subject };
}
