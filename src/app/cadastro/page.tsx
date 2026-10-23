import { ArrowLeft, RotateCw, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SignupForm } from "@/components/cadastro/signup-form";
import { THEMES } from "@/lib/design-system/themes";
import { parseShowcaseNiche } from "@/lib/marketing/store-showcase";
import { buttonVariants } from "@/components/ui/button";
import { SIGNUP_RESUME_COOKIE_NAME } from "@/lib/signup/resume";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Criar minha loja",
};

type SignupSearchParams = { nicho?: string | string[]; nome?: string | string[]; ref?: string | string[]; tema?: string | string[] };

const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function SignupPage({ searchParams }: { searchParams: Promise<SignupSearchParams> }) {
  const params = await searchParams;
  const reference = firstParam(params.ref);
  if (reference) redirect(`/cadastro/continuar?ref=${encodeURIComponent(reference)}`);

  // Vindo da prévia (/exemplo): o formulário já abre com o nome e o tema.
  const prefillName = (firstParam(params.nome) ?? "").replace(/[\p{Cc}\p{Cf}]/gu, "").replace(/\s+/g, " ").trim().slice(0, 100);
  const prefillTheme = THEMES.find((theme) => theme.id === firstParam(params.tema))?.id;
  const prefill = prefillName.length >= 2
    ? { nicho: parseShowcaseNiche(firstParam(params.nicho)), nomeLoja: prefillName, tema: prefillTheme ?? "natural" }
    : null;

  const savedReference = (await cookies()).get(SIGNUP_RESUME_COOKIE_NAME)?.value;
  return <main className="min-h-screen"><header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"><Link className="flex min-h-11 items-center gap-2 font-bold" href="/"><span className="grid size-8 place-items-center rounded-lg bg-brand-900 text-white"><ShoppingBag aria-hidden="true" className="size-4" /></span>ClickCatálogo</Link><Link className="flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--app-foreground-muted)] hover:text-brand-700" href="/"><ArrowLeft aria-hidden="true" className="size-4" />Voltar</Link></div></header><div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">{savedReference ? <section className="mx-auto mb-7 flex max-w-xl flex-col gap-4 rounded-[var(--radius-card)] border border-brand-200 bg-brand-50 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-brand-900">Você tem um cadastro em andamento</p><p className="mt-1 text-sm leading-6 text-brand-800">Continue a confirmação antes de iniciar outro pagamento.</p></div><Link className={buttonVariants({ variant: "secondary" })} href="/cadastro/continuar"><RotateCw aria-hidden="true" />Continuar cadastro</Link></section> : null}<SignupForm prefill={prefill} /></div></main>;
}
