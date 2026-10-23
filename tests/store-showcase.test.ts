import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import {
  buildShowcaseCatalog,
  parseShowcaseParams,
  SHOWCASE_NICHE_IDS,
  SHOWCASE_NICHES,
  showcaseHref,
  showcaseSignupHref,
} from "../src/lib/marketing/store-showcase";

const read = (path: string) => readFileSync(path, "utf8");

test("prévia lê nome, nicho e tema da URL com valores seguros", () => {
  assert.equal(parseShowcaseParams({}), null);
  assert.equal(parseShowcaseParams({ nome: " a " }), null);
  assert.deepEqual(parseShowcaseParams({ nicho: "moda", nome: "  Loja   da\u0000 Bia ", tema: "tech" }), { nicho: "moda", nome: "Loja da Bia", tema: "tech" });
  // Nicho ou tema desconhecidos caem no padrão, nunca em valor da URL.
  assert.deepEqual(parseShowcaseParams({ nicho: "constructor", nome: "Doces da Ana", tema: "rosa" }), { nicho: "doces", nome: "Doces da Ana", tema: SHOWCASE_NICHES.doces.tema });
  assert.equal(parseShowcaseParams({ nome: "x".repeat(200) })?.nome.length, 60);
  assert.equal(parseShowcaseParams({ nome: ["Primeiro", "Segundo"] })?.nome, "Primeiro");
});

test("links da prévia e do cadastro levam nome e tema codificados", () => {
  const params = { nicho: "doces" as const, nome: "Doces & Cia", tema: "delivery" as const };
  assert.equal(showcaseHref(params), "/exemplo?nome=Doces+%26+Cia&nicho=doces&tema=delivery");
  assert.equal(showcaseSignupHref(params), "/cadastro?nome=Doces+%26+Cia&tema=delivery&nicho=doces");
});

test("cada nicho tem fotos existentes, preços e ids únicos", () => {
  const ids = new Set<string>();
  for (const nicho of SHOWCASE_NICHE_IDS) {
    const catalog = buildShowcaseCatalog({ nicho, nome: "Loja Teste", tema: SHOWCASE_NICHES[nicho].tema });
    assert.equal(catalog.nome_loja, "Loja Teste");
    assert.ok(catalog.banner_url && existsSync(`public${catalog.banner_url}`), `${nicho}: banner`);
    const products = catalog.categorias.flatMap((category) => category.produtos);
    assert.equal(products.length, 6);
    for (const product of products) {
      assert.ok(product.imagem_url && existsSync(`public${product.imagem_url}`), `${nicho}: ${product.nome}`);
      assert.ok(product.preco > 0);
      ids.add(`${nicho}:${product.id}`);
    }
    assert.equal(new Set(products.map((product) => product.id)).size, 6);
    for (const category of catalog.categorias) assert.match(category.id, /^[0-9a-f-]{36}$/);
  }
  assert.equal(ids.size, SHOWCASE_NICHE_IDS.length * 6);
  // Toda foto baixada está documentada com a origem.
  const credits = read("docs/FOTOS-NICHOS.md");
  for (const nicho of SHOWCASE_NICHE_IDS.filter((id) => id !== "artesanato")) {
    const catalog = buildShowcaseCatalog({ nicho, nome: "Loja Teste", tema: "minimal" });
    for (const url of [catalog.banner_url, ...catalog.categorias.flatMap((c) => c.produtos.map((p) => p.imagem_url))]) {
      assert.ok(credits.includes(`public${url}`), `${url} sem origem em docs/FOTOS-NICHOS.md`);
    }
  }
});

test("prévia não mede, não compartilha e não abre WhatsApp real", () => {
  const preview = read("src/components/loja-publica/store-preview.tsx");
  assert.match(preview, /const published = !framed && !demo;/);
  assert.match(preview, /\{published \? <CatalogViewTracker/);
  assert.doesNotMatch(preview, /analyticsSlug=\{!framed/);
  assert.match(read("src/components/loja-publica/cart-panel.tsx"), /\{orderUrl && !demoSignupHref && !messageTooLong \? \(/);
  assert.match(read("src/components/loja-publica/store-header.tsx"), /href=\{contactHref \?\? whatsappUrl\}/);
  assert.match(read("src/components/loja-publica/store-footer.tsx"), /href=\{contactHref \?\? whatsappUrl\}/);
  const page = read("src/app/(public)/exemplo/page.tsx");
  assert.match(page, /<PageViewTracker event="store_preview_view" \/>/);
  assert.match(page, /robots: \{ follow: false, index: false \}/);
  assert.match(page, /demo=\{\{ contactHref: "#sobre-a-previa", signupHref \}\}/);
});

test("cadastro abre preenchido vindo da prévia e a landing leva até ela", () => {
  assert.match(read("src/app/cadastro/page.tsx"), /<SignupForm prefill=\{prefill\} \/>/);
  assert.match(read("src/components/cadastro/signup-form.tsx"), /slug: slugify\(prefill\.nomeLoja\)/);
  const landing = read("src/app/(public)/page.tsx");
  assert.match(landing, /href="#sua-loja"/);
  assert.match(landing, /<ShowcaseLive\b/);
  assert.match(read("src/components/marketing/showcase-form.tsx"), /action="\/exemplo"\s+className=\{cn\("grid gap-5", className\)\}\s+method="get"/);
  // A miniatura da landing é só desenho: sem carrinho nem a loja completa.
  const mini = read("src/components/marketing/mini-store-preview.tsx");
  assert.doesNotMatch(mini, /<StorePreview|<StoreCatalog|<CartPanel/);
  assert.match(mini, /data-tema=\{template\.tema\}/);
  assert.match(read("src/components/marketing/showcase-live.tsx"), /<MiniStorePreview niche=\{niche\} storeName=\{storeName\.trim\(\) \|\| "Sua loja"\} \/>/);
});
