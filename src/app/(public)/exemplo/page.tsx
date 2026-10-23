import { ArrowRight, Check, Pencil, ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageViewTracker } from "@/components/marketing/page-view-tracker";
import { ShowcaseForm } from "@/components/marketing/showcase-form";
import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { StorePreview } from "@/components/loja-publica/store-preview";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { parseAcquisitionOrigin } from "@/lib/analytics/origins";
import { THEMES } from "@/lib/design-system/themes";
import {
  buildShowcaseCatalog,
  parseShowcaseParams,
  SHOWCASE_NICHE_IDS,
  SHOWCASE_NICHES,
  showcaseHref,
  showcaseSignupHref,
} from "@/lib/marketing/store-showcase";
import { cn } from "@/lib/utils/cn";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const params = parseShowcaseParams(await searchParams);
  if (params) {
    // Cada prévia é só um exemplo montado pela URL: não entra na busca.
    return { alternates: { canonical: "/exemplo" }, robots: { follow: false, index: false }, title: `Prévia: ${params.nome}` };
  }
  return {
    alternates: { canonical: "/exemplo" },
    description: "Digite o nome do seu negócio e veja na hora como fica a sua loja no ClickCatálogo, com produtos de exemplo e pedido pelo WhatsApp.",
    title: "Veja como fica a sua loja",
  };
}

export default async function ShowcasePage({ searchParams }: { searchParams: SearchParams }) {
  const rawParams = await searchParams;
  const params = parseShowcaseParams(rawParams);

  if (!params) {
    const origin = parseAcquisitionOrigin(Array.isArray(rawParams.origem) ? rawParams.origem[0] : rawParams.origem);
    return (
      <main className="min-h-screen bg-[var(--app-background)]">
        <SiteHeader />
        <section className="bg-[linear-gradient(135deg,var(--brand-50),white_55%,var(--brand-100))] px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
          <Card className="mx-auto max-w-2xl p-6 sm:p-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Sua loja em 10 segundos</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-brand-900 sm:text-4xl">Veja como fica a sua loja</h1>
            <p className="mt-3 leading-7 text-[var(--app-foreground-muted)]">
              Digite o nome do seu negócio e escolha o que você vende. Montamos uma prévia com produtos de exemplo para
              você navegar e simular um pedido. Não precisa de cadastro.
            </p>
            <ShowcaseForm className="mt-8" origin={origin} />
          </Card>
        </section>
        <SiteFooter origin="exemplo" />
      </main>
    );
  }

  const catalog = buildShowcaseCatalog(params);
  const signupHref = showcaseSignupHref(params);
  const niche = SHOWCASE_NICHES[params.nicho];

  return (
    <>
      <PageViewTracker event="store_preview_view" />
      <div className="sticky top-0 z-30 border-b border-brand-900/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link className="flex min-h-11 min-w-0 items-center gap-2 text-sm font-semibold text-brand-900" href="/">
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-brand-900 text-white">
              <ShoppingBag aria-hidden="true" className="size-3.5" />
            </span>
            <span className="truncate">Prévia da sua loja</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Link className={cn(buttonVariants({ size: "sm", variant: "ghost" }), "hidden sm:inline-flex")} href="#sobre-a-previa">
              <Pencil aria-hidden="true" />
              Mudar
            </Link>
            <Link className={buttonVariants({ size: "sm" })} href={signupHref}>
              Quero essa loja
            </Link>
          </div>
        </div>
      </div>

      <StorePreview catalog={catalog} demo={{ contactHref: "#sobre-a-previa", signupHref }} />

      <section className="scroll-mt-14 bg-[var(--app-background)] px-4 py-12 sm:px-6 sm:py-16 lg:px-8" id="sobre-a-previa">
        <Card className="mx-auto grid max-w-3xl gap-8 p-6 sm:p-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Gostou?</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">A {params.nome} pode estar no ar hoje</h2>
            <ul className="mt-5 grid gap-3 text-sm leading-6 text-[var(--app-foreground-muted)]">
              {[
                "Os produtos acima são exemplos: você coloca os seus, com foto, preço e descrição.",
                "Na sua loja, os botões de WhatsApp abrem uma conversa com o seu número, e o pedido chega pronto, com itens e total.",
                "Monte grátis e só pague se quiser publicar: R$ 27/mês, sem comissão e sem fidelidade.",
              ].map((item) => (
                <li className="flex gap-3" key={item}>
                  <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-brand-700" />
                  {item}
                </li>
              ))}
            </ul>
            <Link className={buttonVariants({ className: "mt-7 w-full sm:w-auto", size: "lg" })} href={signupHref}>
              Criar a minha loja grátis
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-3 border-t border-[var(--app-border)] pt-6">
            <h3 className="text-sm font-semibold text-brand-900">Experimente outro visual</h3>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((theme) => (
                <Link
                  aria-current={theme.id === params.tema ? "true" : undefined}
                  className={buttonVariants({ size: "sm", variant: theme.id === params.tema ? "primary" : "secondary" })}
                  href={showcaseHref({ ...params, tema: theme.id })}
                  key={theme.id}
                  scroll={false}
                >
                  {theme.name}
                </Link>
              ))}
            </div>
            <h3 className="mt-3 text-sm font-semibold text-brand-900">Ou outro tipo de produto</h3>
            <div className="flex flex-wrap gap-2">
              {SHOWCASE_NICHE_IDS.map((id) => (
                <Link
                  aria-current={id === params.nicho ? "true" : undefined}
                  className={buttonVariants({ size: "sm", variant: id === params.nicho ? "primary" : "secondary" })}
                  href={showcaseHref({ nicho: id, nome: params.nome, tema: SHOWCASE_NICHES[id].tema })}
                  key={id}
                >
                  {SHOWCASE_NICHES[id].label}
                </Link>
              ))}
            </div>
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer font-semibold text-brand-900">Mudar o nome</summary>
              <ShowcaseForm className="mt-4" defaultName={params.nome} defaultNiche={params.nicho} />
            </details>
            <p className="text-xs leading-5 text-[var(--app-foreground-muted)]">
              Prévia de {niche.label.toLowerCase()} com fotos ilustrativas. Nada do que você digitou aqui fica salvo.
            </p>
          </div>
        </Card>
      </section>
    </>
  );
}
