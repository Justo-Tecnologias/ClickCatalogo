"use client";

import { CreditCard, ExternalLink, Eye, FolderTree, LogOut, Package, Settings2, ShieldCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

import { signOutAction } from "@/app/painel/actions";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { TenantStatus } from "@/types/database";

const links = [
  { href: "/painel/loja", icon: Settings2, label: "Minha loja" },
  { href: "/painel/categorias", icon: FolderTree, label: "Categorias" },
  { href: "/painel/produtos", icon: Package, label: "Produtos" },
  { href: "/painel/assinatura", icon: CreditCard, label: "Assinatura" },
  { href: "/painel/privacidade", icon: ShieldCheck, label: "Privacidade" },
] as const;

export function PanelShell({ children, demo = false, slug, status, storeName, userEmail }: { children: ReactNode; demo?: boolean; slug: string; status: TenantStatus; storeName: string; userEmail: string | null }) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation || window.matchMedia("(min-width: 1024px)").matches) return;

    navigation.querySelector<HTMLElement>('[aria-current="page"]')?.scrollIntoView({
      behavior: "auto",
      block: "nearest",
      inline: "center",
    });
  }, [pathname]);

  return (
    <div className="min-h-screen bg-[var(--app-background)] lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="border-b bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-r lg:border-b-0">
        <div className="flex h-16 items-center justify-between px-4 lg:px-6">
          <Link className="flex min-h-11 items-center gap-2 font-bold tracking-tight" href="/painel/loja">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-900 text-white"><ShoppingBag aria-hidden="true" className="size-4" /></span>
            ClickCatálogo
          </Link>
          <Badge variant={status === "ativo" ? "success" : status === "inadimplente" ? "warning" : "danger"}>{status}</Badge>
        </div>

        <nav
          aria-label="Navegação do painel"
          className="flex gap-1 overflow-x-auto overscroll-x-contain border-t px-3 py-2 [scrollbar-width:none] lg:grid lg:border-t-0 lg:px-3 lg:py-5 [&::-webkit-scrollbar]:hidden"
          ref={navigationRef}
        >
          {links.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={cn("flex min-h-11 shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors", active ? "bg-brand-100 text-brand-900" : "text-[var(--app-foreground-muted)] hover:bg-[var(--app-surface-muted)] hover:text-[var(--app-foreground)]")}
                href={href}
                key={href}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            );
          })}
          <form action={signOutAction} className="shrink-0 lg:hidden">
            <Button className="min-h-11" type="submit" variant="ghost">
              <LogOut aria-hidden="true" className="size-4" />
              Sair
            </Button>
          </form>
        </nav>

        <div className="mt-auto hidden border-t p-4 lg:block">
          <p className="truncate text-sm font-semibold">{storeName}</p>
          <p className="truncate text-xs text-[var(--app-foreground-muted)]">{userEmail}</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href={`/loja/${slug}`} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" className="size-4" />Ver loja</Link>
            <form action={signOutAction}><Button className="w-full" size="sm" type="submit" variant="ghost"><LogOut aria-hidden="true" />Sair</Button></form>
          </div>
        </div>
      </aside>

      <main className="min-w-0 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <div className="mx-auto grid min-w-0 w-full max-w-6xl gap-5 [&>*]:min-w-0">{demo ? <Alert description="Explore as telas e altere o preview. Nenhuma mudança será salva neste modo." icon={Eye} title="Modo de demonstração — somente visualização" variant="warning" /> : null}{children}</div>
      </main>
    </div>
  );
}
