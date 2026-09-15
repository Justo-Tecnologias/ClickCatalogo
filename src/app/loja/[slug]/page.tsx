import { Ban, Settings, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { StorePreview } from "@/components/loja-publica/store-preview";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getPublicStore } from "@/lib/catalog/public-catalog";
import { getSiteUrl } from "@/lib/env/server";

export const dynamic = "force-static";
export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const store = await getPublicStore(slug);
  if (store.kind !== "available") return { title: "Loja indisponível", robots: { index: false, follow: false } };
  const description = store.catalog.descricao_curta ?? `Catálogo digital de ${store.catalog.nome_loja}.`;
  const canonicalUrl = new URL(`/loja/${encodeURIComponent(store.catalog.slug)}`, getSiteUrl()).toString();
  return {
    alternates: {
      canonical: canonicalUrl,
    },
    description,
    openGraph: {
      description,
      locale: "pt_BR",
      siteName: "ClickCatálogo",
      title: `${store.catalog.nome_loja} | ClickCatálogo`,
      type: "website",
      url: canonicalUrl,
    },
    title: store.catalog.nome_loja,
    twitter: {
      card: "summary_large_image",
      description,
      title: `${store.catalog.nome_loja} | ClickCatálogo`,
    },
  };
}

export default async function PublicStorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = await getPublicStore(slug);

  if (store.kind === "redirect") redirect(`/loja/${encodeURIComponent(store.slug)}`);
  if (store.kind === "missing") notFound();
  if (store.kind === "unconfigured") {
    return <StoreMessage icon={Settings} title="Catálogo aguardando configuração" description="A tela pública está pronta. Configure as chaves do Supabase para carregar os dados reais desta loja." />;
  }
  if (store.kind === "canceled") {
    return <StoreMessage icon={Ban} title="Loja temporariamente indisponível" description="Este catálogo não está recebendo pedidos no momento." />;
  }

  return (
    <div data-tema={store.catalog.tema}>
      <StorePreview catalog={store.catalog} />
    </div>
  );
}

function StoreMessage({ description, icon: Icon, title }: { description: string; icon: typeof Store; title: string }) {
  return <main className="grid min-h-screen place-items-center px-4"><Card className="w-full max-w-lg"><CardContent className="flex flex-col items-center p-8 text-center"><span className="grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700"><Icon aria-hidden="true" className="size-6" /></span><h1 className="mt-5 text-2xl font-bold">{title}</h1><p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">{description}</p><Link className={buttonVariants({ className: "mt-6", variant: "secondary" })} href="/">Conhecer o ClickCatálogo</Link></CardContent></Card></main>;
}
