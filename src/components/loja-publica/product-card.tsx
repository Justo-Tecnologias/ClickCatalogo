import { ExternalLink, ImageIcon, MessageCircle, Minus, Plus, ShoppingCart } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui";
import { trackProductMetric } from "@/lib/analytics/client";
import { formatCurrency } from "@/lib/format/currency";
import { createWhatsAppUrl } from "@/lib/whatsapp/url";
import type { CatalogProduct } from "@/types/catalog";

import { CatalogImage } from "./catalog-image";

export type ProductCardProps = {
  analyticsSlug?: string;
  cartQuantity?: number;
  eagerImage?: boolean;
  onAdd?: (product: CatalogProduct) => void;
  onDecrement?: (productId: string) => void;
  product: CatalogProduct;
  storeName: string;
  whatsapp: string;
};

export function ProductCard({ analyticsSlug, cartQuantity = 0, eagerImage = false, onAdd, onDecrement, product, storeName, whatsapp }: ProductCardProps) {
  const orderUrl = createWhatsAppUrl(
    whatsapp,
    `Olá! Tenho interesse no produto “${product.nome}” da ${storeName}.`,
  );
  const imageFallback = (
    <div className="grid h-full w-full place-items-center bg-[color-mix(in_srgb,var(--cor-imagem-fundo)_86%,var(--cor-acao))] text-[var(--cor-primaria)]">
      <span className="grid size-14 place-items-center rounded-full border border-[color-mix(in_srgb,var(--cor-borda)_70%,var(--cor-acao))] bg-[color-mix(in_srgb,var(--cor-superficie)_82%,var(--cor-acao))]">
        <ImageIcon aria-hidden="true" className="size-7 opacity-75" strokeWidth={1.5} />
      </span>
      <span className="sr-only">Produto sem imagem</span>
    </div>
  );

  return (
    <article className="group @container/product flex w-full min-w-0 max-w-none self-stretch flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--cor-borda)] bg-[var(--cor-superficie)] shadow-[var(--shadow-elevation)]">
      <div className="relative aspect-square w-full overflow-hidden bg-[var(--cor-imagem-fundo)]">
        {product.imagem_url ? (
          <CatalogImage
            alt={product.nome}
            className="object-cover transition-transform duration-300 group-hover:scale-[1.025]"
            fallback={imageFallback}
            fill
            loading={eagerImage ? "eager" : "lazy"}
            sizes="(max-width: 767px) calc(50vw - 22px), (max-width: 1279px) calc(33vw - 24px), (max-width: 1535px) calc(25vw - 24px), 280px"
            src={product.imagem_url}
          />
        ) : (
          imageFallback
        )}
      </div>

      <div className="flex flex-1 flex-col p-3 @[14rem]/product:p-4">
        <h3 className="min-h-10 line-clamp-2 text-sm font-semibold leading-5 text-[var(--cor-texto)] @[14rem]/product:text-base @[14rem]/product:leading-6">
          {product.nome}
        </h3>
        <p className="mt-1 text-base font-bold tracking-tight text-[var(--cor-primaria)] @[14rem]/product:text-lg">
          {formatCurrency(product.preco)}
        </p>

        {product.descricao ? (
          <p className="mt-2 line-clamp-2 text-[0.8125rem] leading-[1.125rem] text-[var(--cor-texto-suave)] @[12rem]/product:leading-5">
            {product.descricao}
          </p>
        ) : null}

        {product.variacao_info ? (
          <p className="mt-2 line-clamp-1 text-[0.8125rem] leading-[1.125rem] text-[var(--cor-texto-suave)] @[12rem]/product:leading-5">
            {product.variacao_info}
          </p>
        ) : null}

        <div className="mt-auto grid gap-2 pt-4">
          {product.link_externo ? (
            <>
              <a
                aria-label={`Ver oferta de ${product.nome}`}
                className={buttonVariants({ className: "w-full", size: "sm", variant: "theme" })}
                href={product.link_externo}
                rel="nofollow sponsored noopener noreferrer"
                target="_blank"
              >
                <ExternalLink aria-hidden="true" />
                Ver oferta
              </a>
              <span className="text-center text-[0.6875rem] leading-4 text-[var(--cor-texto-suave)]">Link externo · preço sujeito a alteração</span>
            </>
          ) : onAdd && onDecrement ? (
            cartQuantity > 0 ? (
              <div className="flex h-11 items-center justify-between rounded-[var(--radius-control)] border border-[var(--cor-borda)] bg-[var(--cor-fundo)]">
                <Button
                  aria-label={`Diminuir quantidade de ${product.nome}`}
                  className="text-[var(--cor-texto)] hover:bg-[var(--cor-imagem-fundo)]"
                  onClick={() => onDecrement(product.id)}
                  size="icon"
                  variant="ghost"
                >
                  <Minus aria-hidden="true" />
                </Button>
                <span aria-label={`Quantidade no carrinho: ${cartQuantity}`} className="text-sm font-semibold text-[var(--cor-texto)]">{cartQuantity}</span>
                <Button
                  aria-label={`Aumentar quantidade de ${product.nome}`}
                  className="text-[var(--cor-texto)] hover:bg-[var(--cor-imagem-fundo)]"
                  onClick={() => onAdd(product)}
                  size="icon"
                  variant="ghost"
                >
                  <Plus aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <Button aria-label={`Adicionar ${product.nome} ao pedido`} className="w-full" onClick={() => onAdd(product)} size="sm" variant="theme">
                <ShoppingCart aria-hidden="true" />
                Adicionar
              </Button>
            )
          ) : (
            <a
              aria-label={`Pedir ${product.nome} pelo WhatsApp`}
              className={buttonVariants({ className: "w-full", size: "sm", variant: "theme" })}
              href={orderUrl}
              onClick={() => {
                if (analyticsSlug) trackProductMetric("whatsapp_order_clicked", analyticsSlug);
              }}
              rel="noopener noreferrer"
              target="_blank"
            >
              <MessageCircle aria-hidden="true" />
              Pedir
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
