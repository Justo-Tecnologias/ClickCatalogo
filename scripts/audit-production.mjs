const siteUrlValue = process.env.NEXT_PUBLIC_SITE_URL?.trim();
const storeSlug = process.argv[2]?.trim();
const failures = [];
const results = [];

function fail(check, detail) {
  failures.push({ check, detail });
}

function assert(check, condition, detail) {
  if (!condition) fail(check, detail);
}

async function request(path, redirect = "follow") {
  const url = new URL(path, siteUrlValue);
  const response = await fetch(url, {
    headers: { "User-Agent": "ClickCatalogoProductionAudit/0.1" },
    redirect,
    signal: AbortSignal.timeout(15_000),
  });

  return { body: await response.text(), response, url };
}

if (!siteUrlValue) {
  console.error("Configure NEXT_PUBLIC_SITE_URL antes de executar a auditoria publicada.");
  process.exit(1);
}

let siteUrl;
try {
  siteUrl = new URL(siteUrlValue);
} catch {
  console.error("NEXT_PUBLIC_SITE_URL não contém uma URL válida.");
  process.exit(1);
}

if (siteUrl.protocol !== "https:" || ["localhost", "127.0.0.1"].includes(siteUrl.hostname)) {
  console.error("A auditoria publicada exige uma URL HTTPS que não seja localhost.");
  process.exit(1);
}

const publicPages = [
  ["/", "Sua loja no WhatsApp em minutos"],
  ["/cadastro", "Vamos criar sua loja"],
  ["/painel", "Seu catálogo, num clique"],
  ["/auth/confirmar-recuperacao", "Confirme a recuperação"],
  ["/termos", "Termos de uso"],
  ["/privacidade", "Política de privacidade"],
  ["/robots.txt", "Sitemap:"],
  ["/sitemap.xml", "<urlset"],
];

for (const [path, expectedText] of publicPages) {
  try {
    const { body, response } = await request(path);
    const ok = response.status === 200 && body.includes(expectedText);
    assert(path, ok, `HTTP ${response.status}; conteúdo esperado não confirmado.`);
    results.push({ check: path, status: response.status });
  } catch (error) {
    fail(path, error instanceof Error ? error.message : "Falha desconhecida.");
  }
}

try {
  const { body, response } = await request("/");
  const requiredHeaders = {
    "content-security-policy": "object-src 'none'",
    "cross-origin-opener-policy": "same-origin-allow-popups",
    "cross-origin-resource-policy": "same-origin",
    "origin-agent-cluster": "?1",
    "permissions-policy": "camera=()",
    "referrer-policy": "strict-origin-when-cross-origin",
    "strict-transport-security": "max-age=",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
  };

  for (const [header, expectedValue] of Object.entries(requiredHeaders)) {
    const value = response.headers.get(header) ?? "";
    assert(`header:${header}`, value.includes(expectedValue), `Valor recebido: ${value || "ausente"}`);
  }
  assert("header:x-powered-by", !response.headers.has("x-powered-by"), "O framework ainda está exposto no cabeçalho X-Powered-By.");
  assert("marca", body.includes("ClickCatálogo"), "A marca não apareceu no HTML inicial.");
} catch (error) {
  fail("headers", error instanceof Error ? error.message : "Falha desconhecida.");
}

for (const path of ["/termos", "/privacidade"]) {
  try {
    const { body, response } = await request(path);
    assert(
      `identidade-legal:${path}`,
      response.status === 200 && body.includes('data-legal-identity="complete"'),
      "A identificação pública do fornecedor está incompleta. Configure as quatro variáveis LEGAL_* e publique novamente.",
    );
  } catch (error) {
    fail(`identidade-legal:${path}`, error instanceof Error ? error.message : "Falha desconhecida.");
  }
}

try {
  const { response } = await request("/painel/loja", "manual");
  const location = response.headers.get("location") ?? "";
  assert(
    "painel-protegido",
    [302, 303, 307, 308].includes(response.status) && new URL(location, siteUrl).pathname === "/painel",
    `HTTP ${response.status}; Location: ${location || "ausente"}`,
  );
} catch (error) {
  fail("painel-protegido", error instanceof Error ? error.message : "Falha desconhecida.");
}

try {
  const missingSlug = `auditoria-loja-inexistente-${Date.now()}`;
  const { body, response } = await request(`/loja/${missingSlug}`);
  const noIndex = /<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(body)
    || /<meta[^>]+content=["'][^"']*noindex[^"']*["'][^>]+name=["']robots["']/i.test(body);
  assert(
    "loja-inexistente",
    [200, 404].includes(response.status)
      && body.includes("Esta loja não foi encontrada")
      && noIndex,
    `HTTP ${response.status}; tela ou noindex não confirmado.`,
  );
  results.push({ check: "loja-inexistente", status: response.status, streamingNoIndex: noIndex });
} catch (error) {
  fail("loja-inexistente", error instanceof Error ? error.message : "Falha desconhecida.");
}

if (storeSlug) {
  try {
    const { body, response } = await request(`/loja/${encodeURIComponent(storeSlug)}`);
    assert(
      "loja-real",
      response.status === 200 && body.includes("Produtos em destaque"),
      `HTTP ${response.status}; catálogo não confirmado.`,
    );
    results.push({ check: "loja-real", slug: storeSlug, status: response.status });
  } catch (error) {
    fail("loja-real", error instanceof Error ? error.message : "Falha desconhecida.");
  }
}

console.log(JSON.stringify({ failures, results, site: siteUrl.origin }, null, 2));
if (failures.length > 0) process.exitCode = 1;
