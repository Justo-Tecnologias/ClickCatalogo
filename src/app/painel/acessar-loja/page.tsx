import { ArrowLeft, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SignupRecoveryForm } from "@/components/cadastro/signup-recovery-form";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Acessar minha loja",
};

export default function AccessStorePage() {
  return <main className="min-h-screen bg-[linear-gradient(180deg,var(--brand-100),var(--app-background)_45%)] px-4 py-10 sm:py-16"><div className="mx-auto w-full max-w-xl"><Link className="mb-7 flex min-h-11 items-center justify-center gap-2 font-bold" href="/"><span className="grid size-8 place-items-center rounded-lg bg-brand-900 text-white"><ShoppingBag aria-hidden="true" className="size-4" /></span>ClickCatálogo</Link><Card className="p-6 sm:p-8"><h1 className="text-2xl font-bold">Acesse sua loja</h1><p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Informe o e-mail utilizado no ClickCatálogo. Enviaremos um link para você continuar.</p><div className="mt-6"><SignupRecoveryForm /></div><Link className="mt-5 inline-flex min-h-11 items-center gap-2 font-semibold text-brand-700 hover:underline" href="/painel"><ArrowLeft aria-hidden="true" className="size-4" />Voltar para o login</Link></Card></div></main>;
}
