import { Store } from "lucide-react";

import { cn } from "@/lib/utils/cn";

import { CatalogImage } from "./catalog-image";

export type StoreLogoProps = {
  className?: string;
  eager?: boolean;
  logoUrl: string | null;
  storeName: string;
};

export function StoreLogo({ className, eager = false, logoUrl, storeName }: StoreLogoProps) {
  const fallback = <Store aria-hidden="true" className="size-6" strokeWidth={1.8} />;

  return (
    <div
      className={cn(
        "relative grid aspect-square size-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[var(--cor-superficie)] bg-[var(--cor-imagem-fundo)] text-[var(--cor-primaria)] shadow-[var(--shadow-elevation)]",
        className,
      )}
    >
      {logoUrl ? (
        <CatalogImage
          alt={`Logo da ${storeName}`}
          className="object-cover"
          fallback={fallback}
          fill
          loading={eager ? "eager" : "lazy"}
          sizes="72px"
          src={logoUrl}
        />
      ) : (
        fallback
      )}
    </div>
  );
}
