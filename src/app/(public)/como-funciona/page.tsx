import { ArrowRight, ExternalLink, LayoutTemplate, MousePointerClick, PackagePlus, Send, Share2 } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { SiteFooter, SiteHeader } from "@/components/marketing/site-chrome";
import { WhatsAppOrderPreview } from "@/components/marketing/whatsapp-order-preview";
import { buttonVariants } from "@/components/ui/button";
import { PendingLink } from "@/components/ui/pending-link";
import { DEMO_PRODUCTS } from "@/lib/demo/panel-demo";
import { cn } from "@/lib/utils/cn";
import type { CartLine } from "@/lib/whatsapp/cart-message";

export const metadata: Metadata = {
  alternates: { canonical: "/como-funciona" },
  description: "Veja com telas reais como criar sua loja no ClickCatálogo, cadastrar produtos, compartilhar o link e receber pedidos organizados no WhatsApp.",
  openGraph: {
    description: "Do cadastro ao primeiro pedido no WhatsApp, com telas reais do ClickCatálogo.",
    title: "Como funciona o ClickCatálogo",
  },
  title: "Como funciona",
};

// Loja de exemplo publicada (mesmos produtos da demonstração do painel).
const EXAMPLE_STORE_PATH = "/loja/atelie-aurora";
const EXAMPLE_STORE_NAME = "Ateliê Aurora";

// O mesmo pedido que aparece no print do carrinho.
function exampleOrder(): CartLine[] {
  const pick = (nome: string, quantity: number): CartLine => {
    const product = DEMO_PRODUCTS.find((item) => item.nome === nome);
    if (!product) throw new Error(`Produto de exemplo ausente: ${nome}`);
    return {
      product: {
        descricao: product.descricao,
        id: product.id,
        imagem_url: product.imagem_url,
        nome: product.nome,
        ordem: product.ordem,
        preco: Number(product.preco),
        variacao_info: product.variacao_info,
      },
      quantity,
    };
  };
  return [pick("Kit Afeto", 2), pick("Vela Aurora", 1), pick("Vela Jardim", 1)];
}

export default function HowItWorksPage() {
  return (
    <main className="overflow-hidden bg-[var(--app-background)]">
      <SiteHeader />

      <section className="bg-[linear-gradient(135deg,var(--brand-50),white_55%,var(--brand-100))] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Como funciona</p>
          <h1 className="mt-3 text-4xl font-extrabold leading-[1.08] tracking-[-0.03em] text-brand-900 sm:text-5xl">
            Do cadastro ao primeiro pedido no WhatsApp
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--app-foreground-muted)]">
            Veja, com telas reais, o caminho completo de uma loja no ClickCatálogo. O exemplo é a {EXAMPLE_STORE_NAME}, nossa loja de demonstração.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <PendingLink className={buttonVariants({ size: "lg" })} href="/cadastro" pendingLabel="Abrindo cadastro...">
              Quero minha loja
              <ArrowRight aria-hidden="true" />
            </PendingLink>
            <Link className={buttonVariants({ size: "lg", variant: "secondary" })} href={EXAMPLE_STORE_PATH} rel="noopener" target="_blank">
              Ver a loja de exemplo
              <ExternalLink aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <div className="px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <ol className="mx-auto grid max-w-6xl gap-16 sm:gap-24">
          <Step
            description="Informe o nome da loja, o WhatsApp que vai receber os pedidos e o seu e-mail. Depois escolha o endereço da loja: o sistema confere na hora se ele está livre."
            icon={MousePointerClick}
            number={1}
            title="Crie sua loja"
          >
            <ResponsiveShot alt="Formulário de cadastro com nome da loja, WhatsApp, e-mail e endereço preenchidos" desktop="/como-funciona/cadastro-dados.webp" eager mobile="/como-funciona/cadastro-dados-celular.webp" url="clickcatalogo.com/cadastro" />
          </Step>

          <Step
            description="São seis temas prontos. A prévia mostra a sua loja ao vivo enquanto você escolhe, e o tema pode ser trocado depois pelo painel. A assinatura custa R$ 27 por mês, no cartão, sem comissão sobre as vendas."
            icon={LayoutTemplate}
            number={2}
            reverse
            title="Escolha o visual"
          >
            <ResponsiveShot alt="Escolha do tema Elegante com a prévia da loja ao vivo" desktop="/como-funciona/cadastro-tema.webp" mobile="/como-funciona/cadastro-tema-celular.webp" url="clickcatalogo.com/cadastro" />
          </Step>

          <Step
            description="No painel você cadastra foto, preço, descrição e variações, organiza as categorias e decide o que aparece na loja. As fotos são otimizadas automaticamente antes do envio."
            icon={PackagePlus}
            number={3}
            title="Cadastre seus produtos"
          >
            <ResponsiveShot alt="Painel com a lista de produtos da loja, preços e status de publicação" desktop="/como-funciona/painel-produtos.webp" mobile="/como-funciona/painel-produtos-celular.webp" url="clickcatalogo.com/painel/produtos" />
          </Step>

          <Step
            description="Sua loja ganha um endereço próprio, botão de compartilhar e QR Code. Quando o link é enviado no WhatsApp ou no Instagram, aparece uma imagem com o nome e a identidade da loja."
            icon={Share2}
            number={4}
            reverse
            title="Compartilhe o link"
          >
            {/* Desktop: painel em destaque com a loja no celular sobreposta. Celular: só a loja. */}
            <div className="relative hidden lg:block lg:pr-16 lg:pb-10">
              <BrowserFrame alt="Painel da loja com o link para divulgar, botões de copiar, WhatsApp e QR Code" src="/como-funciona/painel-loja.webp" url="clickcatalogo.com/painel/loja" />
              <PhoneFrame alt={`Loja ${EXAMPLE_STORE_NAME} aberta no celular`} className="absolute right-0 bottom-0 max-w-[11rem]" src="/como-funciona/loja-celular.webp" />
            </div>
            <PhoneFrame alt={`Loja ${EXAMPLE_STORE_NAME} aberta no celular`} className="lg:hidden" src="/como-funciona/loja-celular.webp" />
          </Step>

          <Step
            description="O cliente monta o carrinho no celular, sem criar conta e sem instalar nada. Ao tocar em Enviar pedido, a mensagem chega organizada no seu WhatsApp. Pagamento e entrega você combina direto com o cliente."
            icon={Send}
            number={5}
            title="Receba o pedido no WhatsApp"
          >
            <div className="grid items-center gap-6 sm:grid-cols-2">
              <PhoneFrame alt="Carrinho com quatro itens e o botão Enviar pedido pelo WhatsApp" src="/como-funciona/carrinho-celular.webp" />
              <WhatsAppOrderPreview items={exampleOrder()} storeName={EXAMPLE_STORE_NAME} />
            </div>
          </Step>
        </ol>
      </div>

      <section className="border-t border-brand-200 bg-brand-100 px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">Pronto para colocar sua loja no ar?</h2>
          <p className="mt-4 text-[var(--app-foreground-muted)]">
            R$ 27 por mês, sem comissão sobre as vendas e sem fidelidade. Você pode cancelar pelo painel quando quiser.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <PendingLink className={buttonVariants({ size: "lg" })} href="/cadastro" pendingLabel="Abrindo cadastro...">
              Quero minha loja
              <ArrowRight aria-hidden="true" />
            </PendingLink>
            <Link className={buttonVariants({ size: "lg", variant: "secondary" })} href="/#temas">
              Ver os temas
            </Link>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

function Step({
  children,
  description,
  icon: Icon,
  number,
  reverse = false,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: typeof Send;
  number: number;
  reverse?: boolean;
  title: string;
}) {
  return (
    <li className={cn("grid items-center gap-8 lg:gap-12", reverse ? "lg:grid-cols-[1.2fr_0.8fr]" : "lg:grid-cols-[0.8fr_1.2fr]")}>
      <div className={reverse ? "lg:order-2" : undefined}>
        <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
          <Icon aria-hidden="true" className="size-3.5" />
          Passo {number} de 5
        </span>
        <h2 className="mt-4 text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">{title}</h2>
        <p className="mt-3 text-base leading-7 text-[var(--app-foreground-muted)]">{description}</p>
      </div>
      <div className={reverse ? "min-w-0 lg:order-1" : "min-w-0"}>{children}</div>
    </li>
  );
}

// Telas grandes recebem o print de desktop; telas pequenas, o print de celular,
// que continua legível em 390 px.
function ResponsiveShot({ alt, desktop, eager = false, mobile, url }: { alt: string; desktop: string; eager?: boolean; mobile: string; url: string }) {
  return (
    <>
      <div className="hidden lg:block">
        <BrowserFrame alt={alt} eager={eager} src={desktop} url={url} />
      </div>
      <PhoneFrame alt={alt} className="lg:hidden" eager={eager} src={mobile} />
    </>
  );
}

function BrowserFrame({ alt, eager = false, src, url }: { alt: string; eager?: boolean; src: string; url: string }) {
  return (
    <figure className="overflow-hidden rounded-[var(--radius-card)] border border-brand-900/10 bg-white shadow-[0_24px_60px_rgb(19_50_41_/_14%)]">
      <div aria-hidden="true" className="flex items-center gap-3 border-b border-brand-900/10 bg-[var(--app-surface-muted)] px-3 py-2">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-brand-900/15" />
          <span className="size-2.5 rounded-full bg-brand-900/15" />
          <span className="size-2.5 rounded-full bg-brand-900/15" />
        </span>
        <span className="min-w-0 flex-1 truncate rounded-md bg-white px-3 py-1 text-xs text-[var(--app-foreground-muted)]">{url}</span>
      </div>
      <Image
        alt={alt}
        className="h-auto w-full"
        fetchPriority={eager ? "high" : undefined}
        height={900}
        loading={eager ? "eager" : "lazy"}
        sizes="(max-width: 1023px) 100vw, 720px"
        src={src}
        width={1440}
      />
    </figure>
  );
}

function PhoneFrame({ alt, className, eager = false, src }: { alt: string; className?: string; eager?: boolean; src: string }) {
  return (
    <figure className={cn("mx-auto w-full max-w-[15rem] rounded-[2rem] border-[6px] border-brand-900 bg-brand-900 shadow-[0_24px_60px_rgb(19_50_41_/_22%)]", className)}>
      <Image
        alt={alt}
        className="h-auto w-full rounded-[1.6rem]"
        fetchPriority={eager ? "high" : undefined}
        height={1688}
        loading={eager ? "eager" : "lazy"}
        sizes="240px"
        src={src}
        width={780}
      />
    </figure>
  );
}
