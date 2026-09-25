import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  addProductToCart,
  decrementProductInCart,
  getCartItemCount,
  getCartTotal,
  removeProductFromCart,
} from "../src/lib/cart/client-cart";
import {
  createMapSearchUrl,
  shouldShowCatalogSearch,
  shouldShowCategoryNavigation,
  shouldUseStickyCategories,
} from "../src/lib/catalog/storefront";
import { THEMES } from "../src/lib/design-system/themes";
import { getInstagramProfileUrl } from "../src/lib/instagram/username";
import { createWhatsAppUrl } from "../src/lib/whatsapp/url";
import type { CatalogProduct } from "../src/types/catalog";

const product: CatalogProduct = {
  descricao: "Produto de teste",
  id: "produto-1",
  imagem_url: null,
  nome: "Produto",
  ordem: 0,
  preco: 12.5,
  variacao_info: null,
};

test("catálogo pequeno esconde controles que não ajudam", () => {
  assert.equal(shouldShowCategoryNavigation(0), false);
  assert.equal(shouldShowCategoryNavigation(1), false);
  assert.equal(shouldShowCategoryNavigation(2), true);
  assert.equal(shouldShowCatalogSearch(12), false);
  assert.equal(shouldShowCatalogSearch(13), true);
  assert.equal(shouldUseStickyCategories(8, 12), false);
  assert.equal(shouldUseStickyCategories(9, 12), true);
  assert.equal(shouldUseStickyCategories(1, 13), true);
});

test("carrinho aparece com itens, atualiza quantidade e volta a ficar vazio", () => {
  const empty = {};
  const one = addProductToCart(empty, product);
  const two = addProductToCart(one, product);

  assert.equal(getCartItemCount(empty), 0);
  assert.equal(getCartItemCount(one), 1);
  assert.equal(getCartItemCount(two), 2);
  assert.equal(getCartTotal(two), 25);
  assert.equal(getCartItemCount(decrementProductInCart(two, product.id)), 1);
  assert.equal(getCartItemCount(removeProductFromCart(two, product.id)), 0);
});

test("links públicos são construídos internamente com protocolos seguros", () => {
  const whatsappUrl = new URL(createWhatsAppUrl("+55 (11) 99999-9999", "Olá"));
  assert.equal(whatsappUrl.origin, "https://wa.me");
  assert.equal(whatsappUrl.pathname, "/5511999999999");
  assert.equal(whatsappUrl.searchParams.get("text"), "Olá");

  assert.equal(
    getInstagramProfileUrl("javascript:alert(1)"),
    "https://instagram.com/javascriptalert1",
  );

  const mapUrl = new URL(createMapSearchUrl("Rua A, 10 — São Paulo") ?? "");
  assert.equal(mapUrl.origin, "https://www.google.com");
  assert.equal(mapUrl.searchParams.get("query"), "Rua A, 10 — São Paulo");
});

test("experiência pública preserva seis temas, indisponibilidade e canonical no compartilhamento", () => {
  assert.equal(THEMES.length, 6);

  const page = readFileSync("src/app/loja/[slug]/page.tsx", "utf8");
  const preview = readFileSync("src/components/loja-publica/store-preview.tsx", "utf8");
  const header = readFileSync("src/components/loja-publica/store-header.tsx", "utf8");
  const catalog = readFileSync("src/components/loja-publica/store-catalog.tsx", "utf8");
  const card = readFileSync("src/components/loja-publica/product-card.tsx", "utf8");
  const grid = readFileSync("src/components/loja-publica/product-grid.tsx", "utf8");
  const footer = readFileSync("src/components/loja-publica/store-footer.tsx", "utf8");

  assert.match(page, /store\.kind === "canceled"/);
  assert.match(page, /canonicalUrl=\{canonicalUrl\}/);
  assert.match(preview, /shareUrl=\{!framed \? canonicalUrl : undefined\}/);
  assert.match(preview, /footer=\{\(/);
  assert.match(catalog, /\{footer\}[\s\S]*?cartItemCount > 0[\s\S]*?env\(safe-area-inset-bottom\)/);
  assert.match(card, /Adicionar/);
  assert.match(card, /onAdd && onDecrement/);
  assert.match(card, /product\.link_externo/);
  assert.match(card, /nofollow sponsored noopener noreferrer/);
  assert.match(card, />\s*Ver oferta\s*</);
  assert.match(header, /line-clamp-3/);
  assert.doesNotMatch(header, /<Store\b/);
  assert.doesNotMatch(catalog, />\s*Produtos\s*</);
  assert.match(catalog, /<h2[\s\S]*?\{category\.nome\}[\s\S]*?<\/h2>/);
  assert.match(card, /product\.variacao_info[\s\S]*?line-clamp-1/);
  assert.match(grid, /grid-cols-2/);
  assert.match(grid, /@2xl\/product-grid:grid-cols-3/);
  assert.match(grid, /@5xl\/product-grid:grid-cols-4/);
  assert.doesNotMatch(grid, /grid-cols-5/);
  assert.match(footer, /rel="noopener noreferrer ugc"/);
  assert.match(footer, /Criado com/);
  assert.match(footer, />\s*ClickCatálogo\s*</);
});

test("painel limita a prévia desktop e mantém acesso à visualização completa", () => {
  const settings = readFileSync("src/components/painel/store-settings-form.tsx", "utf8");

  assert.match(settings, /aria-label="Prévia rolável da loja"/);
  assert.match(settings, /max-h-\[calc\(100dvh-7rem\)\]/);
  assert.match(settings, /overflow-y-auto/);
  assert.match(settings, /Expandir prévia/);
  assert.doesNotMatch(settings, /backdrop:bg-black\/50 xl:hidden/);
});
