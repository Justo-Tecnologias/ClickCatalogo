import { ArrowLeft, ShoppingBag } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({ children, description, title }: { children: ReactNode; description: string; title: string }) {
  return (
    <main className="min-h-screen bg-[var(--app-background)]">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link className="flex min-h-11 shrink-0 items-center gap-2 font-bold" href="/">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-900 text-white">
              <ShoppingBag aria-hidden="true" className="size-4" />
            </span>
            ClickCatálogo
          </Link>
          <Link
            className="flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--app-foreground-muted)] transition-colors hover:text-brand-700"
            href="/"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Voltar ao início
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
        <div className="rounded-2xl border bg-white p-6 shadow-[var(--shadow-elevation)] sm:p-10">
          <div className="border-b border-brand-100 pb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">
              Documento legal
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--app-foreground-muted)]">
              {description}
            </p>
            <p className="mt-3 text-xs font-medium text-brand-700">
              Última atualização: 30 de agosto de 2026
            </p>
          </div>

          <div className="mt-8 grid gap-0 text-sm leading-7 [&_section]:border-b [&_section]:border-[var(--app-border)] [&_section]:py-7 [&_section:first-child]:pt-0 [&_section:last-child]:border-0 [&_section:last-child]:pb-0 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-[var(--app-foreground)] [&_li]:text-[var(--app-foreground-muted)] [&_p]:text-[var(--app-foreground-muted)] [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1">
            {children}
          </div>
        </div>
      </article>
    </main>
  );
}
