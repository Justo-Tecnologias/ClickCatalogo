import { paymentMethodLabel, type PaymentMethod } from "@/lib/catalog/store-info";
import { formatCurrency } from "@/lib/format/currency";
import type { CatalogProduct } from "@/types/catalog";

export type CartLine = {
  product: CatalogProduct;
  quantity: number;
};

/** Detalhes opcionais que o cliente preenche no carrinho; vão só na mensagem. */
export type CartOrderDetails = {
  customerName?: string;
  note?: string;
  payment?: PaymentMethod | null;
  receiving?: "entrega" | "retirada" | null;
};

export const CART_DETAIL_LIMITS = {
  customerName: 60,
  note: 200,
} as const;

// Uma linha só por campo: evita que o texto livre quebre a estrutura da mensagem.
function oneLine(value: string | undefined, max: number) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function createCartMessage(storeName: string, items: CartLine[], details: CartOrderDetails = {}) {
  const lines = items.map(({ product, quantity }) => {
    const subtotal = product.preco * quantity;
    return `• ${quantity}x ${product.nome} — ${formatCurrency(product.preco)} cada — ${formatCurrency(subtotal)}`;
  });
  const total = items.reduce(
    (sum, { product, quantity }) => sum + product.preco * quantity,
    0,
  );

  const name = oneLine(details.customerName, CART_DETAIL_LIMITS.customerName);
  const note = oneLine(details.note, CART_DETAIL_LIMITS.note);
  const extra = [
    name ? `Nome: ${name}` : null,
    details.receiving ? `Recebimento: ${details.receiving === "entrega" ? "Entrega" : "Retirada no local"}` : null,
    details.payment ? `Pagamento: ${paymentMethodLabel(details.payment)}` : null,
    note ? `Observação: ${note}` : null,
  ].filter((line): line is string => Boolean(line));

  return [
    `Olá! Gostaria de fazer este pedido na ${storeName}:`,
    "",
    ...lines,
    "",
    `Total do pedido: ${formatCurrency(total)}`,
    ...(extra.length > 0 ? ["", ...extra] : []),
  ].join("\n");
}
