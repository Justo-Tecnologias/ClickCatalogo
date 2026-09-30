import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { allowedExternalLinkOrNull, isAllowedExternalLink } from "../src/lib/catalog/external-links";

test("link externo aceita marketplaces conhecidos e seus subdomínios", () => {
  for (const url of [
    "https://www.mercadolivre.com.br/produto/p/MLB123?tracking_id=abc",
    "https://produto.mercadolivre.com.br/MLB-123",
    "https://meli.la/abc123",
    "https://shopee.com.br/produto-i.1.2",
    "https://s.shopee.com.br/abc",
    "https://www.amazon.com.br/dp/B000000",
    "https://amzn.to/abc",
    "https://www.magazineluiza.com.br/produto/p/123/",
    "https://pt.aliexpress.com/item/1.html",
    "https://br.shein.com/produto.html",
    "https://WWW.MERCADOLIVRE.COM.BR/produto",
  ]) {
    assert.equal(isAllowedExternalLink(url), true, url);
  }
});

test("link externo recusa domínios desconhecidos, imitações e URLs inseguras", () => {
  for (const url of [
    "https://example.com/oferta",
    "https://mercadolivre.com.br.golpe.com/produto",
    "https://falsomercadolivre.com.br/produto",
    "https://amazon.com.br@golpe.com/produto",
    "https://usuario:senha@www.amazon.com.br/dp/B0",
    "https://www.amazon.com.br:8443/dp/B0",
    "http://www.mercadolivre.com.br/produto",
    "javascript:alert(1)",
    "mercadolivre.com.br/produto",
    "",
  ]) {
    assert.equal(isAllowedExternalLink(url), false, url);
  }
});

test("loja pública descarta links gravados fora da lista", () => {
  assert.equal(allowedExternalLinkOrNull("https://example.com/oferta"), null);
  assert.equal(allowedExternalLinkOrNull(null), null);
  assert.equal(allowedExternalLinkOrNull(undefined), null);
  assert.equal(
    allowedExternalLinkOrNull("https://www.amazon.com.br/dp/B0"),
    "https://www.amazon.com.br/dp/B0",
  );

  const card = readFileSync("src/components/loja-publica/product-card.tsx", "utf8");
  const catalog = readFileSync("src/lib/catalog/public-catalog.ts", "utf8");
  const action = readFileSync("src/app/painel/(app)/produtos/actions.ts", "utf8");
  assert.match(card, /allowedExternalLinkOrNull\(product\.link_externo\)/);
  assert.match(card, /href=\{externalLink\}/);
  assert.match(catalog, /transform\(allowedExternalLinkOrNull\)/);
  assert.match(action, /refine\(\s*isAllowedExternalLink/);
});
