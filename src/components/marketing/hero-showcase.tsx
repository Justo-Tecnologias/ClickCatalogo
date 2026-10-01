import { CheckCheck, MessageCircle } from "lucide-react";

import { PhoneFrame } from "@/components/marketing/device-frames";
import { EXAMPLE_STORE_NAME, exampleOrder } from "@/lib/marketing/example-order";
import { createCartMessage } from "@/lib/whatsapp/cart-message";

// Hero da landing: a loja real no celular e o pedido que chega no WhatsApp.
// O texto do balão vem da mesma função usada pelo carrinho da loja pública.
export function HeroShowcase() {
  const message = createCartMessage(EXAMPLE_STORE_NAME, exampleOrder());

  return (
    <div className="relative mx-auto w-full max-w-md pb-6 sm:pb-0">
      <div aria-hidden="true" className="absolute -inset-8 rounded-full bg-brand-200/70 blur-3xl" />
      <PhoneFrame
        alt={`Loja ${EXAMPLE_STORE_NAME} aberta no celular, com produtos e botão de pedido`}
        className="relative max-w-[15rem] sm:mr-auto sm:ml-6 lg:max-w-[16.5rem]"
        eager
        sizes="(max-width: 639px) 240px, 264px"
        src="/como-funciona/loja-celular.webp"
      />
      <figure className="relative -mt-24 ml-auto w-[min(100%,17.5rem)] rounded-[var(--radius-card)] bg-[var(--whatsapp-chat)] p-2.5 shadow-[0_24px_60px_rgb(19_50_41_/_24%)] sm:absolute sm:right-0 sm:bottom-10 sm:mt-0">
        <figcaption className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold text-[var(--whatsapp-header)]">
          <span className="grid size-6 place-items-center rounded-full bg-[var(--whatsapp-header)] text-white">
            <MessageCircle aria-hidden="true" className="size-3.5" />
          </span>
          Novo pedido no seu WhatsApp
        </figcaption>
        <div className="rounded-lg rounded-tr-none bg-[var(--whatsapp-bubble)] px-3 pt-2 pb-1 shadow-sm">
          <p className="whitespace-pre-wrap break-words text-[0.72rem] leading-[1.05rem] text-[var(--whatsapp-text)]">{message}</p>
          <p className="mt-1 flex items-center justify-end gap-1 text-[0.65rem] text-[var(--whatsapp-meta)]">
            10:42
            <CheckCheck aria-label="Mensagem lida" className="size-3 text-[var(--whatsapp-check)]" />
          </p>
        </div>
      </figure>
    </div>
  );
}
