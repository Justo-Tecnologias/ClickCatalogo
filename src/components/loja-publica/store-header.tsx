import { MessageCircle } from "lucide-react";

import { buttonVariants } from "@/components/ui";
import { createWhatsAppUrl } from "@/lib/whatsapp/url";

import { CatalogImage } from "./catalog-image";
import { StoreLogo } from "./store-logo";
import { StoreShareButton } from "./store-share-button";

export type StoreHeaderProps = {
  analyticsSlug?: string;
  bannerUrl: string | null;
  description: string | null;
  framed?: boolean;
  logoUrl: string | null;
  shareUrl?: string;
  storeName: string;
  whatsapp: string;
};

export function StoreHeader({
  analyticsSlug,
  bannerUrl,
  description,
  framed = false,
  logoUrl,
  shareUrl,
  storeName,
  whatsapp,
}: StoreHeaderProps) {
  const whatsappUrl = createWhatsAppUrl(
    whatsapp,
    `Olá! Vim pelo catálogo da ${storeName} e gostaria de fazer um pedido.`,
  );
  const Heading = framed ? "h2" : "h1";
  const bannerFallback = (
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[var(--cor-imagem-fundo)]"
    />
  );

  return (
    <header className="@container overflow-hidden bg-[var(--cor-fundo)]">
      <div className="relative h-36 w-full overflow-hidden bg-[var(--cor-imagem-fundo)] @2xl:aspect-[21/9] @2xl:h-auto @2xl:min-h-40 @2xl:max-h-72">
        {bannerUrl ? (
          <div className="absolute left-1/2 top-1/2 aspect-[21/9] w-full -translate-x-1/2 -translate-y-1/2">
            <CatalogImage
              alt={`Banner da ${storeName}`}
              className="object-cover object-center"
              fallback={bannerFallback}
              fill
              loading={framed ? "lazy" : "eager"}
              sizes={framed ? "(max-width: 1279px) 100vw, 40vw" : "100vw"}
              src={bannerUrl}
            />
          </div>
        ) : (
          bannerFallback
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(to_top,rgb(0_0_0_/_0.72),rgb(0_0_0_/_0.22)_58%,transparent)]"
        />
      </div>

      <div className="relative z-10 mx-auto -mt-24 flex w-full max-w-[var(--content-width)] flex-col gap-4 px-4 pb-7 @xl:flex-row @xl:items-end @xl:justify-between @2xl:-mt-20 @2xl:px-6 @5xl:px-8">
        <div className="flex w-full min-w-0 items-start gap-4 @xl:flex-1">
          <StoreLogo eager={!framed} logoUrl={logoUrl} storeName={storeName} />
          <div className="min-w-0 flex-1 pt-1">
            <Heading className="break-words text-[1.375rem] font-bold leading-7 tracking-tight text-white [text-shadow:0_1px_3px_rgb(0_0_0_/_0.5)] @2xl:text-3xl">
              {storeName}
            </Heading>
            {description ? (
              <p className="mt-1 line-clamp-3 max-w-2xl text-sm leading-5 text-white/90 [text-shadow:0_1px_3px_rgb(0_0_0_/_0.5)] @xl:line-clamp-1">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex w-full items-center gap-2 @xl:w-auto">
          <a
            className={buttonVariants({ className: "min-w-0 flex-1 px-3 @xl:flex-none @xl:px-4", size: "md", variant: "theme" })}
            href={whatsappUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <MessageCircle aria-hidden="true" />
            Falar no WhatsApp
          </a>
          {shareUrl ? (
            <StoreShareButton
              analyticsSlug={analyticsSlug}
              description={description}
              storeName={storeName}
              url={shareUrl}
            />
          ) : null}
        </div>
      </div>
    </header>
  );
}
