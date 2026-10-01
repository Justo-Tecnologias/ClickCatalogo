import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { createCartMessage } from "../src/lib/whatsapp/cart-message";

const read = (path: string) => readFileSync(path, "utf8");

test("como-funciona usa prints reais publicados e a mensagem gerada pelo carrinho", () => {
  const page = read("src/app/(public)/como-funciona/page.tsx");
  const preview = read("src/components/marketing/whatsapp-order-preview.tsx");

  for (const image of [...page.matchAll(/"(\/como-funciona\/[a-z-]+\.webp)"/g)].map((match) => match[1])) {
    assert.ok(existsSync(`public${image}`), `imagem ausente: ${image}`);
  }
  assert.match(preview, /createCartMessage\(storeName, items\)/);
  assert.match(page, /EXAMPLE_STORE_PATH = "\/loja\/atelie-aurora"/);
  assert.doesNotMatch(page, /\bpriority\b/);
});

test("mensagem de exemplo do WhatsApp lista itens, quantidades e total", () => {
  const product = (nome: string, preco: number) => ({ descricao: null, id: nome, imagem_url: null, nome, ordem: 0, preco, variacao_info: null });
  const message = createCartMessage("Ateliê Aurora", [
    { product: product("Kit Afeto", 84.9), quantity: 2 },
    { product: product("Vela Aurora", 42), quantity: 1 },
  ]);
  assert.match(message, /Ateliê Aurora/);
  assert.match(message, /2x Kit Afeto/);
  assert.match(message, /Total do pedido: R\$\s211,80/);
});

test("demonstração espelha a vitrine sem sobrescrever a loja real", () => {
  const demo = read("src/lib/demo/panel-demo.ts");
  assert.match(demo, /slug: "atelie-aurora-demo"/);
  assert.doesNotMatch(demo, /slug: "atelie-aurora",/);
  for (const image of [...demo.matchAll(/DEMO_IMAGE\("([a-z-]+)"\)/g)].map((match) => match[1])) {
    assert.ok(existsSync(`public/demo/atelie-aurora/${image}.webp`), `imagem de demonstração ausente: ${image}`);
  }
  for (const image of [...demo.matchAll(/demoProduct\(\d+, \d, \d, "([a-z-]+)"/g)].map((match) => match[1])) {
    assert.ok(existsSync(`public/demo/atelie-aurora/${image}.webp`), `imagem de produto ausente: ${image}`);
  }
});

test("landing e /como-funciona contam visitas no funil sem dados pessoais", () => {
  assert.match(read("src/app/(public)/page.tsx"), /<PageViewTracker event="landing_view" \/>/);
  assert.match(read("src/app/(public)/como-funciona/page.tsx"), /<PageViewTracker event="how_it_works_view" \/>/);
  const tracker = read("src/components/marketing/page-view-tracker.tsx");
  assert.match(tracker, /trackProductMetric\(event\)/);
  assert.doesNotMatch(tracker, /document\.cookie|localStorage|sessionStorage|navigator\.userAgent/);
  assert.match(read("src/lib/analytics/events.ts"), /publicProductMetricNames = \[\s*"landing_view",\s*"how_it_works_view",/);
});

test("landing e rodapé levam a /como-funciona e o auditor confere a vitrine", () => {
  const landing = read("src/app/(public)/page.tsx");
  const chrome = read("src/components/marketing/site-chrome.tsx");
  const sitemap = read("src/app/sitemap.ts");
  const audit = read("scripts/audit-production.mjs");

  assert.match(landing, /href="\/como-funciona"/);
  assert.match(landing, /href="\/loja\/atelie-aurora"/);
  assert.match(chrome, /<FooterLink href="\/como-funciona">/);
  assert.match(chrome, /cn\(buttonVariants\(\{ size: "sm", variant: "ghost" \}\), "hidden sm:inline-flex"\)/);
  assert.match(sitemap, /\/como-funciona/);
  assert.match(audit, /\["\/como-funciona", /);
  assert.match(audit, /body\.includes\("Falar no WhatsApp"\)/);
  assert.match(audit, /\|\| "atelie-aurora"/);
});
