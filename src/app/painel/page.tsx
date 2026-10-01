import { ArrowLeft, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { startDemoAction } from "@/app/painel/actions";
import { AccessOptionLink, AccessOptionSubmit } from "@/components/painel/access-option";
import { LoginForm } from "@/components/painel/login-form";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPanelContext } from "@/lib/auth/session";
import { isDemoAccessEnabled } from "@/lib/demo/panel-demo";

export const metadata: Metadata = { title: "Acessar painel" };

export default async function LoginPage() {
  const context = await getPanelContext();
  const demoEnabled = isDemoAccessEnabled();

  if (context.authenticated && context.tenant) redirect("/painel/loja");

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-100 to-transparent" />
      <div className="relative w-full max-w-md">
        <Link className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--app-foreground-muted)] hover:text-brand-700" href="/">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar ao início
        </Link>

        <Card className="overflow-hidden">
          <div className="h-1.5 bg-brand-700" />
          <CardHeader>
            <div className="mb-4 flex items-center gap-2 font-bold tracking-tight text-brand-900">
              <span className="grid size-9 place-items-center rounded-lg bg-brand-100 text-brand-700">
                <ShoppingBag aria-hidden="true" className="size-4" />
              </span>
              ClickCatálogo
            </div>
            <CardTitle as="h1" className="text-2xl">Entrar no painel</CardTitle>
            <CardDescription>Use o e-mail e a senha da sua loja.</CardDescription>
          </CardHeader>
          <CardContent>
            {context.configured ? (
              <LoginForm />
            ) : (
              <Alert
                description="Adicione as variáveis NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY para habilitar o acesso."
                title="Integração aguardando as chaves"
                variant="warning"
              />
            )}
          </CardContent>
        </Card>

        <section aria-labelledby="novo-por-aqui" className="mt-8">
          <h2 className="mb-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-foreground-muted)]" id="novo-por-aqui">
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--app-border)]" />
            Ainda não tem loja?
            <span aria-hidden="true" className="h-px flex-1 bg-[var(--app-border)]" />
          </h2>
          <div className="grid gap-3">
            <AccessOptionLink description="Monte seu catálogo e receba pedidos pelo WhatsApp." href="/cadastro" icon="criar" title="Criar minha loja" />
            {demoEnabled ? (
              <form action={startDemoAction}>
                <AccessOptionSubmit description="Explore um painel preenchido, sem cadastro." icon="demonstracao" pendingTitle="Abrindo demonstração..." title="Ver demonstração" />
              </form>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
