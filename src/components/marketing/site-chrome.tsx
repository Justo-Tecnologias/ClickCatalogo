import { ArrowRight, ShoppingBag } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { PendingLink } from "@/components/ui/pending-link";
import { getLegalIdentity } from "@/lib/legal/identity";
import type { Announcement } from "@/lib/marketing/announcements";
import { cn } from "@/lib/utils/cn";

// Cabeçalho e rodapé das páginas institucionais (landing e /como-funciona).

export function BrandLink({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      className={`flex min-h-11 items-center gap-2 font-bold tracking-tight ${inverse ? "text-white" : "text-brand-900"}`}
      href="/"
    >
      <span className={`grid size-8 place-items-center rounded-lg ${inverse ? "bg-white/10" : "bg-brand-900 text-white"}`}>
        <ShoppingBag aria-hidden="true" className="size-4" />
      </span>
      ClickCatálogo
    </Link>
  );
}

export function AnnouncementBar({ announcement }: { announcement: Announcement | null }) {
  if (!announcement) return null;

  return (
    <Link
      className="group relative z-20 flex min-h-10 items-center justify-center gap-2 bg-brand-900 px-4 py-2 text-center text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/70"
      href={announcement.href}
    >
      <span className="shrink-0 rounded-full bg-[var(--brand-accent)] px-2 py-0.5 text-xs font-bold text-brand-900">Novo</span>
      <span className="min-w-0 truncate text-white/90 group-hover:text-white sm:whitespace-normal">{announcement.text}</span>
      <ArrowRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

export function SiteHeader() {
  return (
    <nav className="relative z-10 border-b border-brand-900/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <BrandLink />
        <div className="flex items-center gap-2">
          {/* cn resolve o conflito entre o inline-flex do botão e o hidden no celular. */}
          <Link className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "hidden sm:inline-flex")} href="/como-funciona">
            Como funciona
          </Link>
          <PendingLink className={buttonVariants({ size: "sm", variant: "ghost" })} href="/painel" pendingLabel="Abrindo...">
            Entrar
          </PendingLink>
          <PendingLink className={buttonVariants({ size: "sm" })} href="/cadastro" pendingLabel="Abrindo...">
            Criar loja grátis
          </PendingLink>
        </div>
      </div>
    </nav>
  );
}

function FooterLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      href={href}
    >
      {children}
    </Link>
  );
}

export function SiteFooter({ origin = "inicio" }: { origin?: string }) {
  const legalIdentity = getLegalIdentity();

  return (
    <footer
      className="border-t border-white/10 bg-brand-900 px-4 text-white sm:px-6 lg:px-8"
      id="rodape"
    >
      <div className="mx-auto grid max-w-7xl gap-8 py-10 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="max-w-md">
          <BrandLink inverse />
          <p className="mt-4 text-sm leading-6 text-white/75">
            Catálogo digital simples para organizar produtos e receber pedidos direto no WhatsApp.
          </p>
        </div>
        <nav aria-label="Links institucionais" className="flex flex-col items-start gap-1 sm:items-end">
          <FooterLink href="/como-funciona">Como funciona</FooterLink>
          <FooterLink href="/termos">Termos de uso</FooterLink>
          <FooterLink href="/privacidade">Política de privacidade</FooterLink>
          {legalIdentity.supportEmail ? (
            <>
              <FooterLink href="/atendimento">Atendimento</FooterLink>
              <FooterLink href={`/atendimento?assunto=sugestao&origem=${origin}`}>Enviar sugestão</FooterLink>
            </>
          ) : null}
          <FooterLink href="/painel">Entrar no painel</FooterLink>
        </nav>
      </div>
      <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/10 py-5 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} ClickCatálogo</p>
        <p>Um produto da Justo Tecnologias.</p>
      </div>
    </footer>
  );
}
