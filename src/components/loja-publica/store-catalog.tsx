"use client";

import { PackageOpen, Search, SearchX, ShoppingCart } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";

import { CartPanel } from "@/components/loja-publica/cart-panel";
import { CategoryNav } from "@/components/loja-publica/category-nav";
import { ProductGrid } from "@/components/loja-publica/product-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format/currency";
import type { CatalogCategory, CatalogProduct } from "@/types/catalog";

const SEARCH_THRESHOLD = 12;
const STICKY_CATEGORY_THRESHOLD = 8;
const PRODUCTS_PER_PAGE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const MAX_CART_QUANTITY = 999;

type StoreCatalogProps = {
  analyticsSlug?: string;
  categories: CatalogCategory[];
  enableCart?: boolean;
  framed?: boolean;
  storeName: string;
  whatsapp: string;
};

type CartState = Record<string, { product: CatalogProduct; quantity: number }>;

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function StoreCatalog({ analyticsSlug, categories, enableCart = true, framed = false, storeName, whatsapp }: StoreCatalogProps) {
  const searchId = useId();
  const categoryTargetIdPrefix = `${searchId.replace(/:/g, "")}-categoria`;
  const totalProducts = useMemo(
    () => categories.reduce((total, category) => total + category.produtos.length, 0),
    [categories],
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleByCategory, setVisibleByCategory] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<CartState>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search);
      setVisibleByCategory({});
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [search]);

  const filteredCategories = useMemo(() => {
    const term = normalizeSearch(debouncedSearch);
    if (!term) return categories;

    return categories
      .map((category) => ({
        ...category,
        produtos: category.produtos.filter((product) =>
          normalizeSearch(`${product.nome} ${product.descricao ?? ""}`).includes(term),
        ),
      }))
      .filter((category) => category.produtos.length > 0);
  }, [categories, debouncedSearch]);

  const filteredProductCount = useMemo(
    () => filteredCategories.reduce((total, category) => total + category.produtos.length, 0),
    [filteredCategories],
  );
  const searching = normalizeSearch(search).length > 0;
  const showSearch = totalProducts > SEARCH_THRESHOLD;
  const stickyCategories =
    categories.length > STICKY_CATEGORY_THRESHOLD || totalProducts > SEARCH_THRESHOLD;
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartQuantities = useMemo(
    () => Object.fromEntries(cartItems.map((item) => [item.product.id, item.quantity])),
    [cartItems],
  );
  const cartItemCount = useMemo(
    () => cartItems.reduce((total, item) => total + item.quantity, 0),
    [cartItems],
  );
  const cartTotal = useMemo(
    () => cartItems.reduce((total, item) => total + item.product.preco * item.quantity, 0),
    [cartItems],
  );
  const Content = framed ? "div" : "main";

  function loadMore(categoryId: string, currentVisible: number) {
    setVisibleByCategory((current) => ({
      ...current,
      [categoryId]: currentVisible + PRODUCTS_PER_PAGE,
    }));
  }

  function addToCart(product: CatalogProduct) {
    const currentQuantity = cart[product.id]?.quantity ?? 0;
    if (currentQuantity >= MAX_CART_QUANTITY) {
      setAnnouncement(`Quantidade máxima de ${product.nome} atingida.`);
      return;
    }
    setCart((current) => {
      const existing = current[product.id];
      return {
        ...current,
        [product.id]: { product, quantity: (existing?.quantity ?? 0) + 1 },
      };
    });
    setAnnouncement(`${product.nome} adicionado ao carrinho. ${currentQuantity + 1} no total.`);
  }

  function decrementCartItem(productId: string) {
    setCart((current) => {
      const item = current[productId];
      if (!item) return current;
      if (item.quantity > 1) {
        return { ...current, [productId]: { ...item, quantity: item.quantity - 1 } };
      }
      const next = { ...current };
      delete next[productId];
      return next;
    });
  }

  function removeCartItem(productId: string) {
    const productName = cart[productId]?.product.nome;
    setCart((current) => {
      const next = { ...current };
      delete next[productId];
      return next;
    });
    if (productName) setAnnouncement(`${productName} removido do carrinho.`);
  }

  return (
    <>
      <CategoryNav categories={filteredCategories} highlightSelection={!searching} key={searching ? "searching" : "browsing"} sticky={stickyCategories} targetIdPrefix={categoryTargetIdPrefix} />

      <Content className="mx-auto w-full max-w-[var(--content-width)] px-4 py-6 @2xl/store:px-6 @2xl/store:py-8 @5xl/store:px-8">
        <div className="mb-4 flex items-end justify-between gap-4 @2xl/store:mb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--cor-primaria)]">
              Seleção da loja
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-[var(--cor-texto)] @2xl/store:text-2xl">
              Produtos em destaque
            </h2>
          </div>
          {showSearch ? (
            <span
              aria-live="polite"
              className="shrink-0 text-xs text-[var(--cor-texto-suave)]"
            >
              {debouncedSearch.trim()
                ? `${filteredProductCount} de ${totalProducts}`
                : totalProducts}{" "}
              {totalProducts === 1 ? "produto" : "produtos"}
            </span>
          ) : null}
        </div>

        {showSearch ? (
          <div className="relative mb-6">
            <label className="sr-only" htmlFor={searchId}>
              Buscar produtos
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[var(--cor-texto-suave)]"
            />
            <Input
              autoComplete="off"
              className="border-[var(--cor-borda)] bg-[var(--cor-superficie)] pl-10 text-[var(--cor-texto)] placeholder:text-[var(--cor-texto-suave)] focus:border-[var(--cor-primaria)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--cor-primaria)_18%,transparent)]"
              id={searchId}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nome ou descrição"
              type="search"
              value={search}
            />
          </div>
        ) : null}

        {categories.length === 0 ? (
          <EmptyState
            description="A loja está preparando novidades. Volte em breve para conferir."
            icon={PackageOpen}
            theme
            title="Nenhum produto publicado"
          />
        ) : filteredCategories.length === 0 ? (
          <EmptyState
            description="Tente buscar por outro nome ou termo da descrição."
            icon={SearchX}
            theme
            title="Nenhum produto encontrado"
          />
        ) : (
          <div className="space-y-14 @2xl/store:space-y-16">
            {filteredCategories.map((category) => {
              const visibleCount = visibleByCategory[category.id] ?? PRODUCTS_PER_PAGE;
              const visibleProducts = category.produtos.slice(0, visibleCount);
              const remainingProducts = category.produtos.length - visibleProducts.length;

              return (
                <section
                  aria-labelledby={`${categoryTargetIdPrefix}-titulo-${category.id}`}
                  className="scroll-mt-20"
                  id={`${categoryTargetIdPrefix}-${category.id}`}
                  key={category.id}
                >
                  <div className="mb-5 flex items-center gap-3">
                    <span aria-hidden="true" className="h-6 w-1 rounded-full bg-[var(--cor-acao)]" />
                    <h3
                      className="text-lg font-semibold tracking-tight text-[var(--cor-texto)] @2xl/store:text-xl"
                      id={`${categoryTargetIdPrefix}-titulo-${category.id}`}
                    >
                      {category.nome}
                    </h3>
                  </div>
                  <ProductGrid
                    analyticsSlug={analyticsSlug}
                    cartQuantities={enableCart ? cartQuantities : undefined}
                    onAdd={enableCart ? addToCart : undefined}
                    onDecrement={enableCart ? decrementCartItem : undefined}
                    products={visibleProducts}
                    storeName={storeName}
                    whatsapp={whatsapp}
                  />
                  {remainingProducts > 0 ? (
                    <div className="mt-5 flex justify-center">
                      <Button
                        onClick={() => loadMore(category.id, visibleCount)}
                        variant="themeSecondary"
                      >
                        Carregar mais
                      </Button>
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>
        )}
      </Content>

      {enableCart ? (
        <>
          <p aria-live="polite" className="sr-only">{announcement}</p>
          {cartItemCount > 0 ? (
            <Button
              aria-label={`Abrir carrinho com ${cartItemCount} ${cartItemCount === 1 ? "item" : "itens"}`}
              className="fixed inset-x-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 h-14 justify-between rounded-full px-5 shadow-xl sm:left-auto sm:right-6 sm:w-auto sm:min-w-56"
              onClick={() => setCartOpen(true)}
              size="lg"
              variant="theme"
            >
              <span className="flex items-center gap-2">
                <ShoppingCart aria-hidden="true" />
                Carrinho
                <span aria-live="polite" className="grid min-w-6 place-items-center rounded-full bg-[var(--cor-na-acao)] px-1.5 py-0.5 text-xs text-[var(--cor-acao)]">
                  {cartItemCount}
                </span>
              </span>
              <span>{formatCurrency(cartTotal)}</span>
            </Button>
          ) : null}
          <CartPanel
            analyticsSlug={analyticsSlug}
            items={cartItems}
            onClose={() => setCartOpen(false)}
            onDecrement={decrementCartItem}
            onIncrement={(productId) => {
              const product = cart[productId]?.product;
              if (product) addToCart(product);
            }}
            onRemove={removeCartItem}
            open={cartOpen}
            storeName={storeName}
            whatsapp={whatsapp}
          />
          {cartItemCount > 0 ? <div aria-hidden="true" className="h-20" /> : null}
        </>
      ) : null}
    </>
  );
}
