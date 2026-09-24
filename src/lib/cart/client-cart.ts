import type { CatalogProduct } from "@/types/catalog";

export const MAX_CART_QUANTITY = 999;

export type ClientCartState = Record<
  string,
  { product: CatalogProduct; quantity: number }
>;

export function addProductToCart(
  cart: ClientCartState,
  product: CatalogProduct,
): ClientCartState {
  const existing = cart[product.id];
  const quantity = existing?.quantity ?? 0;
  if (quantity >= MAX_CART_QUANTITY) return cart;

  return {
    ...cart,
    [product.id]: { product, quantity: quantity + 1 },
  };
}

export function decrementProductInCart(
  cart: ClientCartState,
  productId: string,
): ClientCartState {
  const item = cart[productId];
  if (!item) return cart;
  if (item.quantity > 1) {
    return { ...cart, [productId]: { ...item, quantity: item.quantity - 1 } };
  }

  return removeProductFromCart(cart, productId);
}

export function removeProductFromCart(
  cart: ClientCartState,
  productId: string,
): ClientCartState {
  if (!cart[productId]) return cart;
  const next = { ...cart };
  delete next[productId];
  return next;
}

export function getCartItemCount(cart: ClientCartState) {
  return Object.values(cart).reduce((total, item) => total + item.quantity, 0);
}

export function getCartTotal(cart: ClientCartState) {
  return Object.values(cart).reduce(
    (total, item) => total + item.product.preco * item.quantity,
    0,
  );
}
