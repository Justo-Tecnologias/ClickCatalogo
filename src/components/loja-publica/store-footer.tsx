import { MapPin, MessageCircle } from "lucide-react";
import Link from "next/link";

import { InstagramIcon } from "@/components/icons/instagram-icon";
import { createMapSearchUrl } from "@/lib/catalog/storefront";
import { getInstagramProfileUrl, normalizeInstagramUsername } from "@/lib/instagram/username";
import { createWhatsAppUrl } from "@/lib/whatsapp/url";

export type StoreFooterProps = {
  address: string | null;
  instagram: string | null;
  storeName: string;
  whatsapp: string;
};

export function StoreFooter({ address, instagram, storeName, whatsapp }: StoreFooterProps) {
  const instagramUsername = instagram ? normalizeInstagramUsername(instagram) : null;
  const instagramUrl = instagram ? getInstagramProfileUrl(instagram) : null;
  const mapUrl = createMapSearchUrl(address);
  const whatsappUrl = createWhatsAppUrl(
    whatsapp,
    `Olá! Vim pelo catálogo da ${storeName} e gostaria de mais informações.`,
  );

  return (
    <footer className="mt-12 bg-[color-mix(in_srgb,var(--cor-superficie)_58%,var(--cor-fundo))]">
      <div className="mx-auto w-full max-w-[var(--content-width)] px-4 py-8 text-sm text-[var(--cor-texto-suave)] @2xl/store:px-6 @5xl/store:px-8">
        <div className="flex flex-col gap-4 @2xl/store:flex-row @2xl/store:items-start @2xl/store:justify-between">
          <div>
            <p className="font-semibold text-[var(--cor-texto)]">{storeName}</p>
            {address && mapUrl ? (
              <a
                className="mt-2 flex min-h-11 items-center gap-2 rounded-sm outline-none underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-[color:var(--cor-primaria)]/30"
                href={mapUrl}
                rel="noopener noreferrer ugc"
                target="_blank"
              >
                <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {address}
              </a>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
            {instagramUsername && instagramUrl ? (
              <a
                className="inline-flex min-h-11 items-center gap-2 font-medium text-[var(--cor-texto)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color:var(--cor-primaria)]/30"
                href={instagramUrl}
                rel="noopener noreferrer ugc"
                target="_blank"
              >
                <InstagramIcon className="size-4" />
                @{instagramUsername}
              </a>
            ) : null}
            <a
              className="inline-flex min-h-11 items-center gap-2 font-medium text-[var(--cor-texto)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color:var(--cor-primaria)]/30"
              href={whatsappUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <MessageCircle aria-hidden="true" className="size-4" />
              WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-5 flex min-h-11 items-center gap-1 pt-5 text-xs text-[var(--cor-texto-suave)] [border-top:1px_solid_color-mix(in_srgb,var(--cor-borda)_55%,transparent)]">
          <span>Criado com</span>
          <Link
            className="rounded-sm font-semibold text-[var(--cor-texto)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[color:var(--cor-primaria)]/30"
            href="/"
          >
            ClickCatálogo
          </Link>
        </div>
      </div>
    </footer>
  );
}
