import { CheckCheck, MessageCircle } from "lucide-react";

import { createCartMessage, type CartLine } from "@/lib/whatsapp/cart-message";

type WhatsAppOrderPreviewProps = {
  items: CartLine[];
  storeName: string;
};

// Representa a conversa que o lojista recebe. O texto vem da mesma função
// usada pelo carrinho da loja pública, então nunca diverge do pedido real.
export function WhatsAppOrderPreview({ items, storeName }: WhatsAppOrderPreviewProps) {
  const message = createCartMessage(storeName, items);

  return (
    <figure className="mx-auto w-full max-w-sm overflow-hidden rounded-[var(--radius-panel)] border border-brand-900/10 shadow-[var(--shadow-elevation)]">
      <div className="flex items-center gap-3 bg-[var(--whatsapp-header)] px-4 py-3 text-white">
        <span className="grid size-9 place-items-center rounded-full bg-white/15">
          <MessageCircle aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Cliente</p>
          <p className="text-xs text-white/75">Pedido enviado pelo catálogo</p>
        </div>
      </div>
      <div className="bg-[var(--whatsapp-chat)] px-3 py-5">
        <div className="ml-auto max-w-[92%] rounded-lg rounded-tr-none bg-[var(--whatsapp-bubble)] px-3 pt-2 pb-1 shadow-sm">
          <p className="whitespace-pre-wrap break-words text-[0.8125rem] leading-5 text-[var(--whatsapp-text)]">{message}</p>
          <p className="mt-1 flex items-center justify-end gap-1 text-[0.6875rem] text-[var(--whatsapp-meta)]">
            10:42
            <CheckCheck aria-label="Mensagem lida" className="size-3.5 text-[var(--whatsapp-check)]" />
          </p>
        </div>
      </div>
      <figcaption className="bg-white px-4 py-3 text-xs leading-5 text-[var(--app-foreground-muted)]">
        Mensagem gerada pelo carrinho da loja, com os itens, as quantidades e o total.
      </figcaption>
    </figure>
  );
}
