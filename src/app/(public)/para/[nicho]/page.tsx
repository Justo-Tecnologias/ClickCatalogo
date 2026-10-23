import { ArrowRight, Check, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PageViewTracker } from "@/components/marketing/page-view-tracker";
import { ShowcaseLive } from "@/components/marketing/showcase-live";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PendingLink } from "@/components/ui/pending-link";
import { NICHE_PAGES } from "@/lib/marketing/niche-pages";
import { SHOWCASE_NICHE_IDS, SHOWCASE_NICHES, type ShowcaseNiche } from "@/lib/marketing/store-showcase";

// Páginas por nicho para busca orgânica. Só os nichos da lista existem.
export const dynamicParams = false;

type Params = Promise<{ nicho: string }>;

export function generateStaticParams() {
  return SHOWCASE_NICHE_IDS.map((nicho) => ({ nicho }));
}

function nicheFrom(value: string): ShowcaseNiche | null {
  return Object.hasOwn(NICHE_PAGES, value) ? value as ShowcaseNiche : null;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const niche = nicheFrom((await params).nicho);
  if (!niche) return {};
  const page = NICHE_PAGES[niche];
  return {
    alternates: { canonical: `/para/${niche}` },
    description: page.description,
    openGraph: { description: page.description, title: page.title },
    title: page.title,
  };
}

export default async function NichePage({ params }: { params: Params }) {
  const niche = nicheFrom((await params).nicho);
  if (!niche) notFound();
  const page = NICHE_PAGES[niche];
  // Dados estruturados das perguntas frequentes (rich results do Google).
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faq.map(({ answer, question }) => ({
      "@type": "Question",
      acceptedAnswer: { "@type": "Answer", text: answer },
      name: question,
    })),
  };

  return (
    <main className="overflow-hidden bg-[var(--app-background)]">
      {/* Página de aquisição: conta como visita à landing no funil. */}
      <PageViewTracker event="landing_view" />
      <script
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c") }}
        type="application/ld+json"
      />
      <SiteHeader />

      <section className="bg-[linear-gradient(135deg,var(--brand-50),white_55%,var(--brand-100))] px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
        <Card className="mx-auto max-w-5xl overflow-hidden border-brand-200 p-6 sm:p-10">
          <ShowcaseLive
            defaultNiche={niche}
            footer={(
              <p className="mt-4 text-sm text-[var(--app-foreground-muted)]">
                Monte grátis · publique por R$ 27/mês · sem comissão · cancele quando quiser
              </p>
            )}
            intro={(
              <>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">{SHOWCASE_NICHES[niche].label}</p>
                <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-brand-900 sm:text-4xl">{page.heading}</h1>
                <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--app-foreground-muted)]">{page.intro}</p>
                <p className="mt-4 text-sm font-semibold text-brand-800">Digite o nome do seu negócio e veja como fica a sua loja:</p>
              </>
            )}
          />
        </Card>
      </section>

      <section className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-2">
          <Card className="p-6 sm:p-8">
            <h2 className="text-xl font-bold text-brand-900">Hoje, no WhatsApp</h2>
            <ul className="mt-5 grid gap-4">
              {page.pains.map((pain) => (
                <li className="flex gap-3 leading-7 text-[var(--app-foreground-muted)]" key={pain}>
                  <X aria-hidden="true" className="mt-1 size-5 shrink-0 text-[var(--app-danger)]" />
                  {pain}
                </li>
              ))}
            </ul>
          </Card>
          <Card className="border-brand-200 p-6 sm:p-8">
            <h2 className="text-xl font-bold text-brand-900">Com o ClickCatálogo</h2>
            <ul className="mt-5 grid gap-4">
              {page.solutions.map((solution) => (
                <li className="flex gap-3 leading-7 text-[var(--app-foreground)]" key={solution}>
                  <Check aria-hidden="true" className="mt-1 size-5 shrink-0 text-brand-700" />
                  {solution}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section className="border-y border-brand-900/5 bg-white px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">Perguntas frequentes</h2>
          <div className="mt-6 grid gap-3">
            {page.faq.map(({ answer, question }) => (
              <details className="group rounded-[var(--radius-card)] border border-[var(--app-border)] bg-[var(--app-background)] p-5" key={question}>
                <summary className="cursor-pointer list-none font-semibold text-brand-900 marker:hidden">{question}</summary>
                <p className="mt-3 leading-7 text-[var(--app-foreground-muted)]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-14 text-center sm:px-6 sm:py-20 lg:px-8">
        <h2 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">Monte a sua loja hoje</h2>
        <p className="mx-auto mt-3 max-w-xl leading-7 text-[var(--app-foreground-muted)]">
          Crie a conta, cadastre os produtos e veja tudo funcionando antes de pagar qualquer coisa.
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <PendingLink className={buttonVariants({ size: "lg" })} href="/cadastro" pendingLabel="Abrindo cadastro...">
            Criar minha loja grátis
            <ArrowRight aria-hidden="true" />
          </PendingLink>
          <Link className={buttonVariants({ size: "lg", variant: "secondary" })} href="/como-funciona">
            Como funciona
          </Link>
        </div>
        <nav aria-label="Outros tipos de loja" className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2 text-sm">
          {SHOWCASE_NICHE_IDS.filter((id) => id !== niche).map((id) => (
            <Link className="inline-flex min-h-11 items-center rounded-full border border-[var(--app-border)] bg-white px-4 font-medium text-brand-800 hover:bg-brand-50" href={`/para/${id}`} key={id}>
              {NICHE_PAGES[id].heading}
            </Link>
          ))}
        </nav>
      </section>

      <SiteFooter />
    </main>
  );
}
