import { Clock3, CreditCard, Truck } from "lucide-react";
import type { ReactNode } from "react";

import {
  deliveryModeText,
  hasStoreServiceInfo,
  paymentMethodLabel,
  normalizePaymentMethods,
  type StoreServiceInfo,
} from "@/lib/catalog/store-info";

function Chip({ children, icon: Icon, label }: { children: ReactNode; icon: typeof Clock3; label: string }) {
  return (
    <li className="flex min-h-9 items-center gap-2 rounded-full border border-[var(--cor-borda)] bg-[var(--cor-superficie)] px-3 py-1.5 text-sm text-[var(--cor-texto)]">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-[var(--cor-acao)]" />
      <span className="sr-only">{label}: </span>
      {children}
    </li>
  );
}

// Selos de atendimento abaixo do cabeçalho: respondem antes do pedido como a
// loja recebe, entrega e quando atende.
export function StoreServiceInfoBar({ info }: { info: StoreServiceInfo }) {
  if (!hasStoreServiceInfo(info)) return null;

  const payments = normalizePaymentMethods(info.formas_pagamento).map(paymentMethodLabel);
  const delivery = deliveryModeText(info.entrega_modo);

  return (
    <section aria-label="Atendimento da loja" className="mx-auto w-full max-w-[var(--content-width)] px-4 pb-2 @2xl/store:px-6 @5xl/store:px-8">
      <ul className="flex flex-wrap gap-2">
        {payments.length > 0 ? <Chip icon={CreditCard} label="Formas de pagamento">{payments.join(" · ")}</Chip> : null}
        {delivery ? <Chip icon={Truck} label="Entrega">{delivery}</Chip> : null}
        {info.horario_atendimento ? <Chip icon={Clock3} label="Horário de atendimento">{info.horario_atendimento}</Chip> : null}
      </ul>
      {delivery && info.entrega_observacao ? (
        <p className="mt-2 text-sm leading-5 text-[var(--cor-texto-suave)]">{info.entrega_observacao}</p>
      ) : null}
    </section>
  );
}
