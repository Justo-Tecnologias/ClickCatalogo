import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { NICHE_PAGES } from "../src/lib/marketing/niche-pages";
import { SHOWCASE_NICHE_IDS } from "../src/lib/marketing/store-showcase";

const read = (path: string) => readFileSync(path, "utf8");

test("cada nicho da prévia tem página com conteúdo próprio", () => {
  assert.deepEqual(Object.keys(NICHE_PAGES).sort(), [...SHOWCASE_NICHE_IDS].sort());
  const titles = new Set<string>();
  const descriptions = new Set<string>();
  for (const id of SHOWCASE_NICHE_IDS) {
    const page = NICHE_PAGES[id];
    titles.add(page.title);
    descriptions.add(page.description);
    // Título e descrição dentro do que o Google mostra sem cortar muito.
    assert.ok(page.title.length <= 60, `${id}: título longo`);
    assert.ok(page.description.length >= 80 && page.description.length <= 170, `${id}: descrição ${page.description.length}`);
    assert.equal(page.pains.length, 3);
    assert.equal(page.solutions.length, 3);
    assert.ok(page.faq.length >= 4);
    // Sem promessas que o produto não cumpre.
    const text = JSON.stringify(page);
    assert.doesNotMatch(text, /pagamento online|cartão pelo site|frete automático|estoque automático/i);
  }
  assert.equal(titles.size, SHOWCASE_NICHE_IDS.length);
  assert.equal(descriptions.size, SHOWCASE_NICHE_IDS.length);
});

test("páginas são estáticas, só para os nichos da lista, e entram no sitemap e no rodapé", () => {
  const page = read("src/app/(public)/para/[nicho]/page.tsx");
  assert.match(page, /export const dynamicParams = false;/);
  assert.match(page, /return SHOWCASE_NICHE_IDS\.map\(\(nicho\) => \(\{ nicho \}\)\);/);
  assert.match(page, /alternates: \{ canonical: `\/para\/\$\{niche\}` \}/);
  assert.match(page, /"@type": "FAQPage"/);
  assert.match(page, /\.replace\(\/<\/g, "\\\\u003c"\)/);
  assert.match(page, /<ShowcaseLive\s+defaultNiche=\{niche\}/);
  assert.match(page, /<PageViewTracker event="landing_view" \/>/);
  assert.match(read("src/app/sitemap.ts"), /url: `\$\{siteUrl\}\/para\/\$\{nicho\}`/);
  assert.match(read("src/components/marketing/site-chrome.tsx"), /href=\{`\/para\/\$\{nicho\}`\}/);
});
