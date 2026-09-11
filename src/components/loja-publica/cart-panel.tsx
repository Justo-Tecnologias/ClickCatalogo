"use client";

import { MessageCircle, Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatCurrency } from "@/lib/format/currency";
import { trackProductMetric } from "@/lib/analytics/client";
import { createCartMessage, type CartLine } from "@/lib/whatsapp/cart-message";
import { createWhatsAppUrl } from "@/lib/whatsapp/url";

type CartPanelProps = {
  analyticsSlug?: string;
  items: CartLine[];
  onClose: () => void;
  onDecrement: (productId: string) => void;
  onIncrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  open: boolean;
  storeName: string;
  whatsapp: string;
};

export function CartPanel({
  analyticsSlug,
  items,
  onClose,
  onDecrement,
  onIncrement,
  onRemove,
  open,
  storeName,
  whatsapp,
}: CartPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.preco * item.quantity, 0),
    [items],
  );
  const orderUrl = items.length
    ? createWhatsAppUrl(whatsapp, createCartMessage(storeName, items))
    : null;
  const messageTooLong = (orderUrl?.length ?? 0) > 7_000;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <dialog
      aria-labelledby="cart-panel-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md overflow-hidden border-0 bg-transparent p-0 text-[var(--cor-texto)] shadow-2xl backdrop:bg-black/45"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onClose={onClose}
      ref={dialogRef}
    >
      <section className="flex h-full flex-col border-l border-[var(--cor-borda)] bg-[var(--cor-fundo)]">
        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-[var(--cor-borda)] px-4 sm:px-5">
          <div>
            <h2 className="font-bold" id="cart-panel-title">Seu carrinho</h2>
            <p className="text-xs text-[var(--cor-texto-suave)]">
              {items.length === 1 ? "1 produto selecionado" : `${items.length} produtos selecionados`}
            </p>
          </div>
          <Button aria-label="Fechar carrinho" autoFocus onClick={onClose} size="icon" variant="themeSecondary">
            <X aria-hidden="true" />
          </Button>
        </header>

        {items.length === 0 ? (
          <div className="grid flex-1 place-items-center px-6 py-12 text-center">
            <div>
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-[color-mix(in_srgb,var(--cor-imagem-fundo)_82%,var(--cor-acao))] text-[var(--cor-primaria)]">
                <ShoppingCart aria-hidden="true" className="size-6" />
              </span>
              <h3 className="mt-4 font-semibold">Seu carrinho está vazio</h3>
              <p className="mt-1 text-sm leading-6 text-[var(--cor-texto-suave)]">
                Adicione produtos para montar um pedido completo.
              </p>
              <Button className="mt-5" onClick={onClose} variant="themeSecondary">Continuar escolhendo</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
              <ul className="grid gap-3">
                {items.map(({ product, quantity }) => (
                  <li className="rounded-[var(--radius-card)] border border-[var(--cor-borda)] bg-[var(--cor-superficie)] p-4" key={product.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold leading-5">{product.nome}</p>
                        <p className="mt-1 text-sm text-[var(--cor-texto-suave)]">
                          {formatCurrency(product.preco)} cada
                        </p>
                      </div>
                      <Button
                        aria-label={`Remover ${product.nome}`}
                        className="text-[var(--cor-texto-suave)] hover:bg-[var(--cor-imagem-fundo)] hover:text-[var(--cor-texto)]"
                        onClick={() => onRemove(product.id)}
                        size="icon"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-4">
                      <div className="inline-flex items-center rounded-[var(--radius-control)] border border-[var(--cor-borda)] bg-[var(--cor-fundo)]">
                        <Button
                          aria-label={`Diminuir quantidade de ${product.nome}`}
                          className="text-[var(--cor-texto)] hover:bg-[var(--cor-imagem-fundo)]"
                          onClick={() => onDecrement(product.id)}
                          size="icon"
                          variant="ghost"
                        >
                          <Minus aria-hidden="true" />
                        </Button>
                        <span aria-label={`Quantidade: ${quantity}`} className="min-w-10 text-center text-sm font-semibold">{quantity}</span>
                        <Button
                          aria-label={`Aumentar quantidade de ${product.nome}`}
                          className="text-[var(--cor-texto)] hover:bg-[var(--cor-imagem-fundo)]"
                          onClick={() => onIncrement(product.id)}
                          size="icon"
                          variant="ghost"
                        >
                          <Plus aria-hidden="true" />
                        </Button>
                      </div>
                      <p className="font-bold text-[var(--cor-primaria)]">
                        {formatCurrency(product.preco * quantity)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <footer className="border-t border-[var(--cor-borda)] bg-[var(--cor-superficie)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--cor-texto-suave)]">Total do pedido</span>
                <strong className="text-xl text-[var(--cor-primaria)]">{formatCurrency(total)}</strong>
              </div>
              {messageTooLong ? (
                <Alert
                  className="mb-4"
                  description="Remova alguns produtos e envie mais de um pedido para garantir que o WhatsApp abra corretamente."
                  title="Este pedido ficou muito grande"
                  variant="warning"
                />
              ) : null}
              {orderUrl && !messageTooLong ? (
                <a
                  className={buttonVariants({ className: "w-full", size: "lg", variant: "theme" })}
                  href={orderUrl}
                  onClick={() => {
                    if (analyticsSlug) trackProductMetric("whatsapp_order_clicked", analyticsSlug);
                  }}
                  rel="noreferrer"
                  target="_blank"
                >
                  <MessageCircle aria-hidden="true" />
                  Finalizar pedido no WhatsApp
                </a>
              ) : null}
            </footer>
          </>
        )}
      </section>
    </dialog>
  );
}
