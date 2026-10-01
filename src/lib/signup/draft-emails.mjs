/** Prazo de exclusão do rascunho sem acesso ao painel (docs/PLANO-MONTA-GRATIS.md). */
export const DRAFT_RETENTION_DAYS = 30;
/** Dias após o cadastro em que os lembretes são enviados. */
export const DRAFT_REMINDER_DAYS = [1, 3, 7];

/** @param {string} value */
function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** @param {string} value */
function plain(value) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

/** @param {string} siteUrl */
function base(siteUrl) {
  return siteUrl.replace(/\/$/, "");
}

/**
 * @param {{ body: string, button: { href: string, label: string }, footer: string, title: string }} input
 */
function layout(input) {
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f4f7f5;font-family:Arial,sans-serif;color:#13251f">
<div style="max-width:560px;margin:0 auto;padding:32px 20px">
  <div style="background:#fff;border:1px solid #d9e2dd;border-radius:16px;padding:28px">
    <p style="margin:0 0 20px;font-weight:700;color:#174f3d">ClickCatálogo</p>
    <h1 style="font-size:24px;line-height:1.25;margin:0 0 12px">${input.title}</h1>
    ${input.body}
    <a href="${escapeHtml(input.button.href)}" style="display:inline-block;background:#174f3d;color:#fff;text-decoration:none;font-weight:700;padding:14px 20px;border-radius:10px">${input.button.label}</a>
    <p style="font-size:13px;line-height:1.6;color:#607069;margin:24px 0 0">${input.footer}</p>
  </div>
</div></body></html>`;
}

/** @param {string} text */
function paragraph(text) {
  return `<p style="font-size:16px;line-height:1.6;margin:0 0 20px">${text}</p>`;
}

/**
 * E-mail de boas-vindas do cadastro gratuito. O botão confirma o e-mail,
 * condição para publicar a loja.
 * @param {{ siteUrl: string, storeName: string, verifyUrl: string }} input
 */
export function welcomeEmail(input) {
  const storeName = escapeHtml(plain(input.storeName));
  return {
    html: layout({
      body: [
        paragraph(`Sua loja <strong>${storeName}</strong> foi criada em modo rascunho. Monte o catálogo com calma: só você vê a loja até decidir publicar.`),
        paragraph("Confirme seu e-mail agora para poder publicar quando quiser:"),
      ].join(""),
      button: { href: input.verifyUrl, label: "Confirmar meu e-mail" },
      footer: `O link vale por 7 dias. Para continuar montando a loja, entre em ${escapeHtml(base(input.siteUrl))}/painel. Se você não criou esta loja, ignore esta mensagem.`,
      title: "Sua loja foi criada!",
    }),
    subject: `Confirme seu e-mail — ${plain(input.storeName)}`,
  };
}

/**
 * Reenvio da confirmação pedido pelo painel.
 * @param {{ storeName: string, verifyUrl: string }} input
 */
export function verificationEmail(input) {
  const storeName = escapeHtml(plain(input.storeName));
  return {
    html: layout({
      body: paragraph(`Use o botão abaixo para confirmar o e-mail da loja <strong>${storeName}</strong>. Depois disso, você pode publicar a loja pelo painel.`),
      button: { href: input.verifyUrl, label: "Confirmar meu e-mail" },
      footer: "O link vale por 7 dias e pode ser usado uma única vez. Se você não pediu, ignore esta mensagem.",
      title: "Confirme seu e-mail",
    }),
    subject: `Confirme seu e-mail — ${plain(input.storeName)}`,
  };
}

/**
 * Lembretes dos dias 1, 3 e 7 para quem criou a loja e não publicou. O texto
 * acompanha o progresso: sem produtos, pede o primeiro; com produtos, convida a publicar.
 * @param {{ day: 1 | 3 | 7, optOutUrl: string, productCount: number, siteUrl: string, storeName: string }} input
 */
export function draftReminderEmail(input) {
  const storeName = escapeHtml(plain(input.storeName));
  const plainName = plain(input.storeName);
  const panelUrl = `${base(input.siteUrl)}/painel/${input.productCount > 0 ? "loja" : "produtos"}`;
  const ready = input.productCount > 0;
  const productsText = input.productCount === 1 ? "1 produto" : `${input.productCount} produtos`;

  const content = !ready
    ? {
      1: {
        body: `Sua loja <strong>${storeName}</strong> já tem endereço e tema. Falta o mais importante: os produtos. Cadastre o primeiro com foto, preço e descrição — leva poucos minutos.`,
        subject: `Adicione o primeiro produto — ${plainName}`,
        title: "Falta pouco para sua loja ganhar vida",
      },
      3: {
        body: `A loja <strong>${storeName}</strong> continua esperando os primeiros produtos. Dica: comece pelos 3 itens que mais vendem; você pode completar o catálogo depois.`,
        subject: `Comece pelos 3 produtos que mais vendem — ${plainName}`,
        title: "Que tal começar pelos campeões de venda?",
      },
      7: {
        body: `Sua loja <strong>${storeName}</strong> ainda está sem produtos. Guardamos o rascunho por ${DRAFT_RETENTION_DAYS} dias desde o último acesso ao painel; depois disso ele é excluído.`,
        subject: `Seu rascunho continua guardado — ${plainName}`,
        title: "Seu rascunho está esperando por você",
      },
    }[input.day]
    : {
      1: {
        body: `A loja <strong>${storeName}</strong> já tem ${productsText}. Quando estiver pronta, publique para receber pedidos pelo WhatsApp.`,
        subject: `Sua loja está quase pronta — ${plainName}`,
        title: "Sua loja está tomando forma",
      },
      3: {
        body: `Com ${productsText}, a loja <strong>${storeName}</strong> já pode receber pedidos. Publique e compartilhe o link no WhatsApp e no Instagram.`,
        subject: `Pronta para receber pedidos — ${plainName}`,
        title: "Sua loja pode ir ao ar hoje",
      },
      7: {
        body: `A loja <strong>${storeName}</strong> tem ${productsText} esperando clientes. Guardamos o rascunho por ${DRAFT_RETENTION_DAYS} dias desde o último acesso ao painel; publique para não perder o trabalho.`,
        subject: `Publique sua loja — ${plainName}`,
        title: "Seus produtos estão prontos para vender",
      },
    }[input.day];

  return {
    html: layout({
      body: paragraph(content.body),
      button: { href: panelUrl, label: ready ? "Publicar minha loja" : "Adicionar produtos" },
      footer: `Você recebe estes lembretes porque criou uma loja no ClickCatálogo. <a href="${escapeHtml(input.optOutUrl)}" style="color:#607069">Não quero mais receber lembretes</a>.`,
      title: content.title,
    }),
    subject: content.subject,
  };
}
