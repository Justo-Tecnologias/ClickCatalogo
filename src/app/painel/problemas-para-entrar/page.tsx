import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { AccessOptionLink } from "@/components/painel/access-option";

export const metadata: Metadata = { title: "Problemas para entrar" };

// Separa os dois caminhos de acesso que o login antes mostrava lado a lado:
// recuperar a senha (conta pronta) e concluir o acesso (pagou, sem senha).
export default function AccessHelpPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-100 to-transparent" />
      <div className="relative w-full max-w-md">
        <Link className="mb-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--app-foreground-muted)] hover:text-brand-700" href="/painel">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Voltar para entrar
        </Link>

        <h1 className="text-2xl font-bold tracking-tight text-brand-900">Problemas para entrar?</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Escolha a situação mais parecida com a sua. Os dois caminhos enviam um link para o e-mail da loja.</p>

        <div className="mt-6 grid gap-3">
          <AccessOptionLink description="Já criei minha senha, mas não lembro dela." href="/painel/recuperar-senha" icon="senha" title="Esqueci minha senha" />
          <AccessOptionLink description="Fiz o pagamento ou comecei o cadastro e ainda não tenho senha." href="/painel/acessar-loja" icon="link" title="Ainda não criei minha senha" />
          <AccessOptionLink description="Nenhuma das opções resolveu? Fale com a gente." href="/atendimento" icon="ajuda" title="Falar com o atendimento" />
        </div>
      </div>
    </main>
  );
}
