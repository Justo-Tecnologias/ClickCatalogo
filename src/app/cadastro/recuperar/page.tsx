import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SignupRecoveryForm } from "@/components/cadastro/signup-recovery-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Recuperar cadastro",
};

export default function SignupRecoveryPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,var(--brand-100),var(--app-background)_45%)] px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <Link className="mb-7 flex min-h-11 items-center justify-center gap-2 font-bold" href="/">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-900 text-white"><ShoppingBag aria-hidden="true" className="size-4" /></span>
          ClickCatálogo
        </Link>
        <Card className="p-6 sm:p-8">
          <h1 className="text-2xl font-bold">Recupere seu cadastro</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Use esta opção se trocou de aparelho, fechou o navegador ou perdeu a tela depois do pagamento.</p>
          <div className="mt-6"><SignupRecoveryForm /></div>
          <Link className="mt-5 inline-flex min-h-11 items-center font-semibold text-brand-700 hover:underline" href="/painel">Já tenho acesso ao painel</Link>
        </Card>
      </div>
    </main>
  );
}
