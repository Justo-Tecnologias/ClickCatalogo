"use client";

import { ArrowLeft, ArrowRight, Clock3, CreditCard, MessageCircle, Minus, Plus, ShoppingCart, Trash2, Truck, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import { Button, buttonVariants } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import {
  deliveryModeText,
  normalizePaymentMethods,
  paymentMethodLabel,
  type PaymentMethod,
  type StoreServiceInfo,
} from "@/lib/catalog/store-info";
import { formatCurrency } from "@/lib/format/currency";
import { trackProductMetric } from "@/lib/analytics/client";
import { CART_DETAIL_LIMITS, createCartMessage, type CartLine } from "@/lib/whatsapp/cart-message";
import { createWhatsAppUrl } from "@/lib/whatsapp/url";

type CartPanelProps = {
  analyticsSlug?: string;
  items: CartLine[];
  onClose: () => void;
  onDecrement: (productId: string) => void;
  onIncrement: (productId: string) => void;
  onRemove: (productId: string) => void;
  open: boolean;
  serviceInfo?: StoreServiceInfo;
  storeName: string;
  whatsapp: string;
};

// Duas etapas: "itens" (revisar quantidades) e "finalizar" (atendimento da
// loja, detalhes opcionais e envio). Cada tela fica curta mesmo com muitos itens.
type CartStep = "finalizar" | "itens";

export function CartPanel({
  analyticsSlug,
  items,
  onClose,
  onDecrement,
  onIncrement,
  onRemove,
  open,
  serviceInfo,
  storeName,
  whatsapp,
}: CartPanelProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const fieldId = useId();
  const [step, setStep] = useState<CartStep>("itens");
  // Detalhes opcionais: ficam só na memória, como o carrinho, e vão apenas
  // na mensagem do WhatsApp. Nada é salvo ou enviado ao ClickCatálogo.
  const [customerName, setCustomerName] = useState("");
  const [receiving, setReceiving] = useState<"entrega" | "retirada" | null>(null);
  const [payment, setPayment] = useState<PaymentMethod | null>(null);
  const [note, setNote] = useState("");
  const acceptedPayments = normalizePaymentMethods(serviceInfo?.formas_pagamento ?? []);
  const offersReceivingChoice = serviceInfo?.entrega_modo === "ambos";
  // Na finalização, o atendimento aparece só no que não virou escolha: com
  // mais de uma forma de pagamento ou "entrega e retirada", as próprias opções
  // já informam o cliente.
  const serviceRows = [
    acceptedPayments.length === 1
      ? { icon: CreditCard, label: "Pagamento", note: null, text: `Pagamento: ${paymentMethodLabel(acceptedPayments[0])}` }
      : null,
    serviceInfo?.entrega_modo && !offersReceivingChoice
      ? { icon: Truck, label: "Entrega", note: serviceInfo.entrega_observacao, text: deliveryModeText(serviceInfo.entrega_modo) }
      : null,
    serviceInfo?.horario_atendimento
      ? { icon: Clock3, label: "Horário de atendimento", note: null, text: serviceInfo.horario_atendimento }
      : null,
  ].filter((row) => row !== null);
  const checkout = step === "finalizar" && items.length > 0;
  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.product.preco * item.quantity, 0),
    [items],
  );
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );
  const itemCountLabel = itemCount === 1 ? "1 item" : `${itemCount} itens`;
  const orderUrl = items.length
    ? createWhatsAppUrl(whatsapp, createCartMessage(storeName, items, {
      customerName,
      note,
      payment: acceptedPayments.length > 1 ? payment : null,
      receiving: offersReceivingChoice ? receiving : null,
    }))
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

  // Ao reabrir, o carrinho começa sempre pela revisão dos itens.
  function close() {
    setStep("itens");
    onClose();
  }

  function goTo(next: CartStep) {
    flushSync(() => setStep(next));
    (next === "finalizar" ? backButtonRef : continueButtonRef).current?.focus();
  }

  return (
    <dialog
      aria-labelledby="cart-panel-title"
      className="fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-md overflow-hidden border-0 bg-transparent p-0 text-[var(--cor-texto)] shadow-2xl backdrop:bg-black/45"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
      onClose={close}
      ref={dialogRef}
    >
      <section className="flex h-full flex-col border-l border-[var(--cor-borda)] bg-[var(--cor-fundo)]">
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--cor-borda)] px-4 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            {checkout ? (
              <Button aria-label="Voltar aos itens" className="-ml-2 shrink-0" onClick={() => goTo("itens")} ref={backButtonRef} size="icon" variant="ghost">
                <ArrowLeft aria-hidden="true" />
              </Button>
            ) : null}
            <div className="min-w-0">
              <h2 className="font-bold" id="cart-panel-title">{checkout ? "Finalizar pedido" : "Seu pedido"}</h2>
              <p className="text-xs text-[var(--cor-texto-suave)]">
                {checkout
                  ? `${itemCountLabel} · ${formatCurrency(total)}`
                  : itemCount === 1 ? "1 item selecionado" : `${itemCount} itens selecionados`}
              </p>
            </div>
          </div>
          <Button aria-label="Fechar carrinho" autoFocus onClick={close} size="icon" variant="themeSecondary">
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
              <Button className="mt-5" onClick={close} variant="themeSecondary">Continuar escolhendo</Button>
            </div>
          </div>
        ) : checkout ? (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-5">
              {serviceRows.length > 0 ? (
                <section aria-labelledby={`${fieldId}-atendimento`} className="mb-6 rounded-[var(--radius-card)] border border-[var(--cor-borda)] bg-[var(--cor-superficie)] p-4">
                  <h3 className="mb-2 text-sm font-semibold" id={`${fieldId}-atendimento`}>Como a loja atende</h3>
                  <ul className="grid gap-2 text-sm">
                    {serviceRows.map(({ icon: Icon, label, note: rowNote, text }) => (
                      <li className="flex items-start gap-2" key={label}>
                        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--cor-acao)]" />
                        <span>
                          <span className="sr-only">{label}: </span>
                          {text}
                          {rowNote ? <span className="mt-0.5 block text-xs leading-5 text-[var(--cor-texto-suave)]">{rowNote}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              <section aria-labelledby={`${fieldId}-detalhes`}>
                <h3 className="text-sm font-semibold" id={`${fieldId}-detalhes`}>Detalhes do pedido <span className="font-normal text-[var(--cor-texto-suave)]">(opcional)</span></h3>
                <p className="mt-1 text-xs leading-5 text-[var(--cor-texto-suave)]">Vão junto na mensagem do WhatsApp. Nada fica salvo.</p>

                <div className="mt-4 grid gap-5">
                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium" htmlFor={`${fieldId}-nome`}>Seu nome</label>
                    <input
                      autoComplete="name"
                      className={CART_INPUT_CLASS}
                      id={`${fieldId}-nome`}
                      maxLength={CART_DETAIL_LIMITS.customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      value={customerName}
                    />
                  </div>

                  {offersReceivingChoice ? (
                    <ChoiceGroup
                      hint={serviceInfo?.entrega_observacao}
                      label="Como prefere receber?"
                      onChange={(value) => setReceiving(value as "entrega" | "retirada")}
                      options={[{ id: "entrega", label: "Entrega" }, { id: "retirada", label: "Retirada no local" }]}
                      value={receiving}
                    />
                  ) : null}

                  {acceptedPayments.length > 1 ? (
                    <ChoiceGroup
                      label="Como prefere pagar?"
                      onChange={(value) => setPayment(value as PaymentMethod)}
                      options={acceptedPayments.map((id) => ({ id, label: paymentMethodLabel(id) }))}
                      value={payment}
                    />
                  ) : null}

                  <div className="grid gap-1.5">
                    <label className="text-sm font-medium" htmlFor={`${fieldId}-obs`}>Observação</label>
                    <textarea
                      className={`${CART_INPUT_CLASS} h-auto py-2.5`}
                      id={`${fieldId}-obs`}
                      maxLength={CART_DETAIL_LIMITS.note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Ex.: para presente, sem cebola, entregar depois das 18h"
                      rows={2}
                      value={note}
                    />
                  </div>
                </div>
              </section>
            </div>

            <footer className="border-t border-[var(--cor-borda)] bg-[var(--cor-superficie)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--cor-texto-suave)]">Total do pedido</span>
                <strong className="text-xl text-[var(--cor-primaria)]">{formatCurrency(total)}</strong>
              </div>
              <p className="mb-4 text-xs leading-5 text-[var(--cor-texto-suave)]">
                O pagamento e a confirmação são combinados diretamente com a loja.
              </p>
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
                  className={buttonVariants({ className: "w-full text-sm sm:text-base", size: "lg", variant: "theme" })}
                  href={orderUrl}
                  onClick={() => {
                    if (analyticsSlug) trackProductMetric("whatsapp_order_clicked", analyticsSlug);
                  }}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <MessageCircle aria-hidden="true" />
                  Enviar pedido pelo WhatsApp
                </a>
              ) : null}
            </footer>
          </>
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

            <footer className="border-t border-[var(--cor-borda)] bg-[var(--cor-superficie)] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-4">
                <span className="text-sm text-[var(--cor-texto-suave)]">Total do pedido</span>
                <strong className="text-xl text-[var(--cor-primaria)]">{formatCurrency(total)}</strong>
              </div>
              <Button className="w-full text-sm sm:text-base" onClick={() => goTo("finalizar")} ref={continueButtonRef} size="lg" variant="theme">
                Continuar
                <ArrowRight aria-hidden="true" />
              </Button>
            </footer>
          </>
        )}
      </section>
    </dialog>
  );
}

const CART_INPUT_CLASS = "h-11 w-full rounded-[var(--radius-control)] border border-[var(--cor-borda)] bg-[var(--cor-fundo)] px-3 text-sm text-[var(--cor-texto)] outline-none placeholder:text-[var(--cor-texto-suave)] focus:border-[var(--cor-primaria)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--cor-primaria)_18%,transparent)]";

// Escolha única em "pílulas", com rádio nativo para teclado e leitor de tela.
// Tocar de novo na opção marcada não desmarca; o campo continua opcional.
function ChoiceGroup({
  hint,
  label,
  onChange,
  options,
  value,
}: {
  hint?: string | null;
  label: string;
  onChange: (value: string) => void;
  options: { id: string; label: string }[];
  value: string | null;
}) {
  const name = useId();
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {hint ? <p className="-mt-1 text-xs leading-5 text-[var(--cor-texto-suave)]">{hint}</p> : null}
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label className="cursor-pointer" key={option.id}>
            <input
              checked={value === option.id}
              className="peer sr-only"
              name={name}
              onChange={() => onChange(option.id)}
              type="radio"
              value={option.id}
            />
            <span className="flex min-h-11 items-center rounded-full border border-[var(--cor-borda)] bg-[var(--cor-fundo)] px-4 text-sm text-[var(--cor-texto)] transition-colors peer-checked:border-[var(--cor-acao)] peer-checked:bg-[var(--cor-acao)] peer-checked:text-[var(--cor-na-acao)] peer-focus-visible:ring-3 peer-focus-visible:ring-[color:var(--cor-primaria)]/30">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
