import Image from "next/image";

import { cn } from "@/lib/utils/cn";

// Molduras de navegador e celular para prints reais do produto.
// sizes padrão pensado para colunas de conteúdo; ajuste por uso quando necessário.
export function BrowserFrame({ alt, eager = false, src, url }: { alt: string; eager?: boolean; src: string; url: string }) {
  return (
    <figure className="overflow-hidden rounded-[var(--radius-card)] border border-brand-900/10 bg-white shadow-[0_24px_60px_rgb(19_50_41_/_14%)]">
      <div aria-hidden="true" className="flex items-center gap-3 border-b border-brand-900/10 bg-[var(--app-surface-muted)] px-3 py-2">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-brand-900/15" />
          <span className="size-2.5 rounded-full bg-brand-900/15" />
          <span className="size-2.5 rounded-full bg-brand-900/15" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-white px-3 py-1 text-xs text-[var(--app-foreground-muted)]">{url}</span>
      </div>
      <Image
        alt={alt}
        className="h-auto w-full"
        fetchPriority={eager ? "high" : undefined}
        height={900}
        loading={eager ? "eager" : "lazy"}
        sizes="(max-width: 1023px) 100vw, 720px"
        src={src}
        width={1440}
      />
    </figure>
  );
}

export function PhoneFrame({ alt, className, eager = false, sizes = "240px", src }: { alt: string; className?: string; eager?: boolean; sizes?: string; src: string }) {
  return (
    <figure className={cn("mx-auto w-full max-w-[15rem] rounded-[2rem] border-[6px] border-brand-900 bg-brand-900 shadow-[0_24px_60px_rgb(19_50_41_/_22%)]", className)}>
      <Image
        alt={alt}
        className="h-auto w-full rounded-[1.6rem]"
        fetchPriority={eager ? "high" : undefined}
        height={1688}
        loading={eager ? "eager" : "lazy"}
        sizes={sizes}
        src={src}
        width={780}
      />
    </figure>
  );
}
