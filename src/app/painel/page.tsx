import { ArrowLeft, Eye, KeyRound, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { startDemoAction } from "@/app/painel/actions";
import { LoginForm } from "@/components/painel/login-form";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PendingLink } from "@/components/ui/pending-link";
import { SubmitButton } from "@/components/ui/submit-button";
import { getPanelContext } from "@/lib/auth/session";
import { isDemoAccessEnabled } from "@/lib/demo/panel-demo";

export const metadata: Metadata = { title: "Acessar painel" };

export default async function LoginPage() {
  const context = await getPanelContext();
  const demoEnabled = isDemoAccessEnabled();

  if (context.authenticated && context.tenant) redirect("/painel/loja");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-12">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-100 to-transparent" />
      <div className="relative w-full max-w-md">
        <Link className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--app-foreground-muted)] hover:text-brand-700" href="/">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar ao início
        </Link>

        <Card className="overflow-hidden">
          <div className="h-1.5 bg-brand-700" />
          <CardHeader>
            <div className="mb-3 flex items-center gap-2 font-bold tracking-tight text-brand-900">
              <span className="grid size-11 place-items-center rounded-xl bg-brand-100 text-brand-700">
                <ShoppingBag aria-hidden="true" className="size-5" />
              </span>
              ClickCatálogo
            </div>
            <CardTitle as="h1" className="text-2xl">Seu catálogo, num clique</CardTitle>
            <CardDescription>Entre para editar sua loja, categorias e produtos.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            {!context.configured ? (
              <Alert
                description="Adicione as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para habilitar o acesso."
                title="Integração aguardando as chaves"
                variant="warning"
              />
            ) : null}
            {context.configured ? <LoginForm /> : null}
            {context.configured ? (
              <div className="grid gap-3 border-t pt-5 text-center">
                <p className="text-sm text-[var(--app-foreground-muted)]">Ainda não conseguiu acessar sua loja?</p>
                <PendingLink className={buttonVariants({ variant: "secondary" })} href="/painel/acessar-loja" pendingLabel="Abrindo...">
                  Acessar minha loja
                </PendingLink>
              </div>
            ) : null}
            <div className="flex items-center gap-2 text-xs leading-5 text-[var(--app-foreground-muted)]">
              <KeyRound aria-hidden="true" className="size-4 shrink-0" />
              Seus dados de acesso são protegidos com segurança.
            </div>
            {demoEnabled ? (
              <div className="grid gap-3 border-t pt-5">
                <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-foreground-muted)]">
                  <span className="h-px flex-1 bg-[var(--app-border)]" />
                  ou explore primeiro
                  <span className="h-px flex-1 bg-[var(--app-border)]" />
                </div>
                <form action={startDemoAction}>
                  <SubmitButton className="w-full" pendingLabel="Abrindo demonstração..." variant="secondary">
                    <Eye aria-hidden="true" />
                    Ver demonstração
                  </SubmitButton>
                </form>
                <p className="text-center text-xs leading-5 text-[var(--app-foreground-muted)]">Abre um catálogo preenchido e somente leitura. Nenhum dado real será alterado.</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <p className="mt-5 text-center text-sm text-[var(--app-foreground-muted)]">
          Ainda não tem catálogo?{" "}
          <PendingLink className="inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline" href="/cadastro" pendingLabel="Abrindo cadastro...">Criar minha loja</PendingLink>
        </p>
      </div>
    </main>
  );
}
