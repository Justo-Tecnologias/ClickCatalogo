"use client";

import { CreditCard, ExternalLink, Eye, FolderTree, LogOut, Menu, MessageSquarePlus, Package, Settings2, ShieldCheck, ShoppingBag, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { signOutAction } from "@/app/painel/actions";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { PendingLink } from "@/components/ui/pending-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { ToastProvider } from "@/components/ui/toast";
import { cn } from "@/lib/utils/cn";
import type { TenantStatus } from "@/types/database";

const links = [
  { href: "/painel/loja", icon: Settings2, label: "Minha loja" },
  { href: "/painel/categorias", icon: FolderTree, label: "Categorias" },
  { href: "/painel/produtos", icon: Package, label: "Produtos" },
  { href: "/painel/assinatura", icon: CreditCard, label: "Assinatura" },
  { href: "/painel/privacidade", icon: ShieldCheck, label: "Privacidade" },
  { href: "/atendimento?assunto=sugestao&origem=painel", icon: MessageSquarePlus, label: "Sugestões e problemas" },
] as const;

export function PanelShell({ children, demo = false, slug, status, storeName, userEmail }: { children: ReactNode; demo?: boolean; slug: string; status: TenantStatus; storeName: string; userEmail: string | null }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setMenuOpen(false), 0);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const drawer = drawerRef.current;
    const focusable = () => Array.from(drawer?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        menuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-[var(--app-background)] lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="sticky top-0 z-30 border-b bg-white lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <Link className="flex min-h-11 items-center gap-2 font-bold tracking-tight" href="/painel/loja">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-900 text-white"><ShoppingBag aria-hidden="true" className="size-4" /></span>
            ClickCatálogo
          </Link>
          <div className="flex items-center gap-2">
            <Badge variant={status === "ativo" ? "success" : status === "inadimplente" ? "warning" : "danger"}>
              <span className="min-[480px]:hidden">{status === "ativo" ? "Ativa" : status === "inadimplente" ? "Pendente" : "Cancelada"}</span>
              <span className="hidden min-[480px]:inline">{status === "ativo" ? "Loja ativa" : status === "inadimplente" ? "Pagamento pendente" : "Loja cancelada"}</span>
            </Badge>
            <Button
              aria-controls="panel-mobile-menu"
              aria-expanded={menuOpen}
              aria-label="Abrir menu do painel"
              className="lg:hidden"
              onClick={() => setMenuOpen(true)}
              ref={menuButtonRef}
              size="icon"
              variant="ghost"
            >
              <Menu aria-hidden="true" />
            </Button>
          </div>
        </div>

        <nav
          aria-label="Navegação do painel"
          className="hidden gap-1 px-3 py-5 lg:grid"
        >
          {links.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <PendingLink
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-brand-100 text-brand-900" : "text-[var(--app-foreground-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-foreground)]")}
                href={href}
                key={href}
                pendingLabel={label}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </PendingLink>
            );
          })}
        </nav>

        <div className="mt-auto hidden border-t p-4 lg:block">
          <p className="truncate text-sm font-semibold">{storeName}</p>
          <p className="truncate text-xs text-[var(--app-foreground-muted)]">{userEmail}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href={`/loja/${slug}`} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" className="size-4" />Ver loja</Link>
            <form action={signOutAction}><SubmitButton className="w-full" pendingLabel="Saindo..." size="sm" variant="ghost"><LogOut aria-hidden="true" />Sair</SubmitButton></form>
          </div>
        </div>
      </aside>

      {menuOpen ? (
        <div className="lg:hidden">
          <button
            aria-label="Fechar menu do painel"
            className="fixed inset-0 z-40 bg-brand-950/45 backdrop-blur-[1px]"
            onClick={() => {
              setMenuOpen(false);
              menuButtonRef.current?.focus();
            }}
            type="button"
          />
          <div
            aria-labelledby="panel-mobile-menu-title"
            aria-modal="true"
            className="fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100%-3rem))] flex-col border-r bg-white shadow-2xl"
            id="panel-mobile-menu"
            ref={drawerRef}
            role="dialog"
          >
            <div className="flex min-h-16 items-center justify-between border-b px-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-700">ClickCatálogo</p>
                <h2 className="mt-0.5 font-bold" id="panel-mobile-menu-title">Menu do painel</h2>
              </div>
              <Button
                aria-label="Fechar menu"
                data-drawer-close
                onClick={() => {
                  setMenuOpen(false);
                  menuButtonRef.current?.focus();
                }}
                size="icon"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </div>

            <nav aria-label="Navegação móvel do painel" className="grid gap-1 overflow-y-auto p-3">
              {links.map(({ href, icon: Icon, label }) => {
                const active = pathname === href;
                return (
                  <PendingLink
                    aria-current={active ? "page" : undefined}
                    className={cn("flex min-h-12 items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-colors", active ? "bg-brand-100 text-brand-900" : "text-[var(--app-foreground-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-foreground)]")}
                    href={href}
                    key={href}
                    onClick={() => setMenuOpen(false)}
                    pendingLabel={label}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                    {label}
                  </PendingLink>
                );
              })}
            </nav>

            <div className="mt-auto border-t p-4">
              <p className="truncate text-sm font-semibold">{storeName}</p>
              <p className="truncate text-xs text-[var(--app-foreground-muted)]">{userEmail}</p>
              <div className="mt-3 grid gap-2">
                <Link className={buttonVariants({ variant: "secondary" })} href={`/loja/${slug}`} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" />Ver loja</Link>
                <form action={signOutAction}><SubmitButton className="w-full" pendingLabel="Saindo..." variant="ghost"><LogOut aria-hidden="true" />Sair</SubmitButton></form>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <ToastProvider>
          <div className="mx-auto grid min-w-0 w-full max-w-6xl gap-5 [&>*]:min-w-0">{demo ? <Alert description="Explore as telas e altere o preview. Nenhuma mudança será salva neste modo." icon={Eye} title="Modo de demonstração — somente visualização" variant="warning" /> : null}{children}</div>
        </ToastProvider>
      </main>
    </div>
  );
}
