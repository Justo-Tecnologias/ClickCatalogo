import { ArrowLeft, Headphones, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SupportContact } from "@/components/marketing/support-contact";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = {
  alternates: { canonical: "/atendimento" },
  description: "Canal oficial de atendimento e privacidade do ClickCatálogo.",
  title: "Atendimento",
};

const subjects = {
  cobranca: "Atendimento sobre cobrança — ClickCatálogo",
  dados: "Direitos sobre dados — ClickCatálogo",
  geral: "Atendimento — ClickCatálogo",
} as const;

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<{ assunto?: string | string[] }>;
}) {
  const rawSubject = (await searchParams).assunto;
  const subjectKey = Array.isArray(rawSubject) ? rawSubject[0] : rawSubject;
  const subject = subjectKey && subjectKey in subjects
    ? subjects[subjectKey as keyof typeof subjects]
    : subjects.geral;
  const { supportEmail } = getLegalIdentity();

  return (
    <main className="min-h-screen bg-[var(--app-background)]">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link className="flex min-h-11 items-center gap-2 font-bold" href="/">
            <span className="grid size-8 place-items-center rounded-lg bg-brand-900 text-white"><ShoppingBag aria-hidden="true" className="size-4" /></span>
            ClickCatálogo
          </Link>
          <Link className="flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--app-foreground-muted)] hover:text-brand-700" href="/">
            <ArrowLeft aria-hidden="true" className="size-4" />Voltar
          </Link>
        </div>
      </header>
      <div className="mx-auto grid max-w-2xl gap-6 px-4 py-10 sm:px-6 sm:py-16">
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-brand-700" />
          <CardHeader>
            <span className="mb-3 grid size-11 place-items-center rounded-xl bg-brand-100 text-brand-700"><Headphones aria-hidden="true" className="size-5" /></span>
            <CardTitle as="h1" className="text-2xl">Como podemos ajudar?</CardTitle>
            <CardDescription>Use o canal oficial abaixo. Para proteger sua conta, podemos pedir a confirmação do e-mail cadastrado.</CardDescription>
          </CardHeader>
          <CardContent>
            {supportEmail ? <SupportContact email={supportEmail} subject={subject} /> : <Alert description="O endereço oficial precisa ser configurado antes de receber solicitações." title="Canal em configuração" variant="warning" />}
          </CardContent>
        </Card>
        <p className="text-center text-sm leading-6 text-[var(--app-foreground-muted)]">Não envie senha, número completo de cartão ou código de autenticação.</p>
      </div>
    </main>
  );
}
