"use client";

import { PackageOpen, Search, SearchX, ShoppingCart, X } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { CartPanel } from "@/components/loja-publica/cart-panel";
import { CategoryNav } from "@/components/loja-publica/category-nav";
import { ProductGrid } from "@/components/loja-publica/product-grid";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  addProductToCart,
  decrementProductInCart,
  getCartItemCount,
  getCartTotal,
  MAX_CART_QUANTITY,
  removeProductFromCart,
  type ClientCartState,
} from "@/lib/cart/client-cart";
import {
  PRODUCTS_PER_PAGE,
  shouldShowCatalogSearch,
  shouldShowCategoryNavigation,
  shouldUseStickyCategories,
} from "@/lib/catalog/storefront";
import { formatCurrency } from "@/lib/format/currency";
import type { CatalogCategory, CatalogProduct } from "@/types/catalog";

const SEARCH_DEBOUNCE_MS = 300;

type StoreCatalogProps = {
  analyticsSlug?: string;
  categories: CatalogCategory[];
  enableCart?: boolean;
  footer?: ReactNode;
  framed?: boolean;
  storeName: string;
  whatsapp: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function StoreCatalog({ analyticsSlug, categories, enableCart = true, footer, framed = false, storeName, whatsapp }: StoreCatalogProps) {
  const searchId = useId();
  const categoryTargetIdPrefix = `${searchId.replace(/:/g, "")}-categoria`;
  const totalProducts = useMemo(
    () => categories.reduce((total, category) => total + category.produtos.length, 0),
    [categories],
  );
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [visibleByCategory, setVisibleByCategory] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<ClientCartState>({});
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
  const showSearch = shouldShowCatalogSearch(totalProducts);
  const showCategoryNavigation = shouldShowCategoryNavigation(filteredCategories.length);
  const stickyCategories = shouldUseStickyCategories(categories.length, totalProducts);
  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const cartQuantities = useMemo(
    () => Object.fromEntries(cartItems.map((item) => [item.product.id, item.quantity])),
    [cartItems],
  );
  const cartItemCount = useMemo(() => getCartItemCount(cart), [cart]);
  const cartTotal = useMemo(() => getCartTotal(cart), [cart]);
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
    setCart((current) => addProductToCart(current, product));
    setAnnouncement(`${product.nome} adicionado ao carrinho. ${currentQuantity + 1} no total.`);
  }

  function decrementCartItem(productId: string) {
    setCart((current) => decrementProductInCart(current, productId));
  }

  function removeCartItem(productId: string) {
    const productName = cart[productId]?.product.nome;
    setCart((current) => removeProductFromCart(current, productId));
    if (productName) setAnnouncement(`${productName} removido do carrinho.`);
  }

  return (
    <>
      {showCategoryNavigation ? (
        <CategoryNav categories={filteredCategories} highlightSelection={!searching} key={searching ? "searching" : "browsing"} sticky={stickyCategories} targetIdPrefix={categoryTargetIdPrefix} />
      ) : null}

      <Content className="mx-auto w-full max-w-[var(--content-width)] px-4 py-7 @2xl/store:px-6 @2xl/store:py-8 @5xl/store:px-8">
        <h2 className="sr-only">Catálogo</h2>
        {showSearch ? (
          <div className="relative mb-7">
            <label className="sr-only" htmlFor={searchId}>
              Buscar produtos
            </label>
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-[var(--cor-texto-suave)]"
            />
            <Input
              autoComplete="off"
              className="border-[var(--cor-borda)] bg-[var(--cor-superficie)] pl-10 pr-12 text-[var(--cor-texto)] placeholder:text-[var(--cor-texto-suave)] focus:border-[var(--cor-primaria)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--cor-primaria)_18%,transparent)]"
              id={searchId}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar produtos"
              type="search"
              value={search}
            />
            {search ? (
              <button
                aria-label="Limpar busca"
                className="absolute right-0 top-0 grid size-11 place-items-center rounded-[var(--radius-control)] text-[var(--cor-texto-suave)] outline-none hover:text-[var(--cor-texto)] focus-visible:ring-3 focus-visible:ring-[color:var(--cor-primaria)]/30"
                onClick={() => {
                  setSearch("");
                  setDebouncedSearch("");
                }}
                type="button"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            ) : null}
            {searching ? (
              <p aria-live="polite" className="mt-2 text-xs text-[var(--cor-texto-suave)]">
                {filteredProductCount} de {totalProducts} produtos
              </p>
            ) : null}
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
            title="Nenhum produto encontrado."
          />
        ) : (
          <div className="space-y-10 @2xl/store:space-y-12">
            {filteredCategories.map((category, categoryIndex) => {
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
                  <div className="mb-4 flex items-center gap-3">
                    <span aria-hidden="true" className="h-5 w-1 rounded-full bg-[var(--cor-acao)]" />
                    <h2
                      className="text-lg font-semibold tracking-tight text-[var(--cor-texto)] @2xl/store:text-xl"
                      id={`${categoryTargetIdPrefix}-titulo-${category.id}`}
                    >
                      {category.nome}
                    </h2>
                  </div>
                  <ProductGrid
                    analyticsSlug={analyticsSlug}
                    cartQuantities={enableCart ? cartQuantities : undefined}
                    onAdd={enableCart ? addToCart : undefined}
                    onDecrement={enableCart ? decrementCartItem : undefined}
                    prioritizeFirstImage={!framed && categoryIndex === 0}
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

      {footer}

      {enableCart ? (
        <>
          <p aria-live="polite" className="sr-only">{announcement}</p>
          {cartItemCount > 0 ? (
            <Button
              aria-label={`Abrir carrinho com ${cartItemCount} ${cartItemCount === 1 ? "item" : "itens"}`}
              className="fixed inset-x-4 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-40 h-16 justify-between rounded-[var(--radius-card)] px-4 shadow-[0_12px_36px_rgb(0_0_0_/_24%)] sm:left-auto sm:right-6 sm:h-14 sm:w-auto sm:min-w-72 sm:rounded-full sm:px-5"
              onClick={() => setCartOpen(true)}
              size="lg"
              variant="theme"
            >
              <span className="flex min-w-0 items-center gap-2">
                <ShoppingCart aria-hidden="true" />
                <span className="truncate">
                  {cartItemCount} {cartItemCount === 1 ? "item" : "itens"} • {formatCurrency(cartTotal)}
                </span>
              </span>
              <span className="shrink-0 text-sm">Ver pedido</span>
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
          {cartItemCount > 0 ? <div aria-hidden="true" className="h-[calc(6rem+env(safe-area-inset-bottom))]" /> : null}
        </>
      ) : null}
    </>
  );
}
