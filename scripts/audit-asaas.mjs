const nodeMajor = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);
if (nodeMajor < 22) {
  console.error(`A auditoria exige Node.js 22 ou superior (versão atual: ${process.versions.node}).`);
  process.exit(1);
}

const REQUIRED_EVENTS = [
  "CHECKOUT_CANCELED",
  "CHECKOUT_EXPIRED",
  "CHECKOUT_PAID",
  "PAYMENT_CONFIRMED",
  "PAYMENT_DELETED",
  "PAYMENT_OVERDUE",
  "PAYMENT_RECEIVED",
  "SUBSCRIPTION_DELETED",
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_UPDATED",
];

const apiKey = process.env.ASAAS_API_KEY?.trim();
const webhookToken = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
const siteUrlValue = process.env.NEXT_PUBLIC_SITE_URL?.trim();

if (!apiKey || !siteUrlValue) {
  console.error("Configure ASAAS_API_KEY e NEXT_PUBLIC_SITE_URL antes da auditoria.");
  process.exit(1);
}

let environment;
let apiUrl;
if (apiKey.startsWith("$aact_prod_")) {
  environment = "production";
  apiUrl = "https://api.asaas.com/v3";
} else if (apiKey.startsWith("$aact_hmlg_")) {
  environment = "sandbox";
  apiUrl = "https://api-sandbox.asaas.com/v3";
} else {
  console.error("O prefixo da ASAAS_API_KEY não identifica Sandbox nem Produção.");
  process.exit(1);
}

let expectedWebhookUrl;
try {
  const siteUrl = new URL(siteUrlValue);
  if (siteUrl.protocol !== "https:") throw new Error();
  expectedWebhookUrl = new URL("/api/webhooks/asaas", siteUrl).toString();
} catch {
  console.error("NEXT_PUBLIC_SITE_URL deve ser uma URL HTTPS válida.");
  process.exit(1);
}

const failures = [];
if (!webhookToken || webhookToken.length < 32 || webhookToken.length > 255) {
  failures.push("ASAAS_WEBHOOK_TOKEN ausente ou fora do tamanho permitido.");
} else if (webhookToken === apiKey) {
  failures.push("ASAAS_WEBHOOK_TOKEN não pode ser igual à API Key.");
}

try {
  const response = await fetch(`${apiUrl}/webhooks?offset=0&limit=100`, {
    headers: {
      "User-Agent": "ClickCatalogoAsaasAudit/0.1",
      access_token: apiKey,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`Asaas respondeu HTTP ${response.status} ao listar webhooks.`);
  }

  const payload = await response.json();
  const webhooks = Array.isArray(payload?.data) ? payload.data : [];
  const matchingWebhooks = webhooks.filter((webhook) => webhook?.url === expectedWebhookUrl);

  if (matchingWebhooks.length === 0) {
    failures.push(`Nenhum webhook aponta para ${expectedWebhookUrl}.`);
  }
  if (matchingWebhooks.length > 1) {
    failures.push("Existe mais de um webhook para a mesma URL; remova configurações redundantes.");
  }

  const checks = matchingWebhooks.map((webhook) => {
    const events = Array.isArray(webhook.events) ? webhook.events : [];
    const missingEvents = REQUIRED_EVENTS.filter((event) => !events.includes(event));

    if (webhook.enabled !== true) failures.push("O webhook correspondente não está ativo.");
    if (webhook.interrupted === true) failures.push("A fila do webhook correspondente está interrompida.");
    if (webhook.sendType !== "SEQUENTIALLY") {
      failures.push("O webhook deve usar envio sequencial para preservar a ordem financeira.");
    }
    if (missingEvents.length > 0) {
      failures.push(`Eventos ausentes no webhook: ${missingEvents.join(", ")}.`);
    }

    return {
      enabled: webhook.enabled === true,
      eventsConfigured: events.length,
      interrupted: webhook.interrupted === true,
      missingEvents,
      name: typeof webhook.name === "string" ? webhook.name : null,
      sendType: typeof webhook.sendType === "string" ? webhook.sendType : null,
      url: webhook.url,
    };
  });

  console.log(JSON.stringify({
    configuredWebhooks: webhooks.map((webhook) => ({
      enabled: webhook?.enabled === true,
      interrupted: webhook?.interrupted === true,
      name: typeof webhook?.name === "string" ? webhook.name : null,
      url: typeof webhook?.url === "string" ? webhook.url : null,
    })),
    environment,
    expectedWebhookUrl,
    failures,
    matchingWebhooks: checks,
    totalWebhooks: webhooks.length,
    webhookTokenConfigured: Boolean(webhookToken && webhookToken.length >= 32),
  }, null, 2));

  if (failures.length > 0) process.exitCode = 2;
} catch (error) {
  console.error(error instanceof Error ? error.message : "Falha desconhecida ao auditar o Asaas.");
  process.exitCode = 1;
}
