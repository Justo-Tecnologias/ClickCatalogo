import {
  ArrowRight,
  Check,
  CreditCard,
  LayoutTemplate,
  MessageCircle,
  MousePointerClick,
  Paintbrush,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ThemePreviewSection } from "@/components/marketing/theme-preview-section";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PendingLink } from "@/components/ui/pending-link";
import { getLegalIdentity } from "@/lib/legal/identity";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  title: "Catálogo digital para vender pelo WhatsApp",
  description: "Crie sua loja digital, organize produtos e receba pedidos pelo WhatsApp com o ClickCatálogo, um produto da Justo Tecnologias.",
  openGraph: {
    title: "ClickCatálogo — sua loja no WhatsApp",
    description: "Crie um catálogo profissional, compartilhe seu link e receba pedidos direto no WhatsApp.",
  },
};

const steps = [
  {
    description: "Informe o nome da loja, seu WhatsApp, e-mail e escolha o endereço do catálogo.",
    icon: MousePointerClick,
    number: "01",
    title: "Preencha seus dados",
  },
  {
    description: "Escolha um dos seis temas e confira a aparência da sua loja antes de publicar.",
    icon: Paintbrush,
    number: "02",
    title: "Escolha seu tema",
  },
  {
    description: "Cadastre produtos, compartilhe seu link e receba pedidos direto no WhatsApp.",
    icon: Zap,
    number: "03",
    title: "Coloque a loja no ar",
  },
];

const benefits = [
  "Loja publicada 24 horas por dia",
  "6 temas profissionais",
  "Produtos ilimitados",
  "Sem comissão sobre suas vendas",
  "Edição a qualquer momento",
];

const frequentlyAskedQuestions = [
  ["O que é o ClickCatálogo?", "É um catálogo digital para pequenos lojistas organizarem produtos e receberem pedidos pelo WhatsApp."],
  ["Meu cliente precisa instalar um aplicativo?", "Não. Ele abre o link da sua loja em qualquer navegador, escolhe os produtos e envia o pedido pelo WhatsApp."],
  ["Como recebo os pedidos?", "O cliente monta o pedido no catálogo e o ClickCatálogo prepara uma mensagem organizada para o WhatsApp da sua loja."],
  ["Como recebo o pagamento da venda?", "Você combina e recebe o pagamento diretamente do seu cliente. O ClickCatálogo não processa o pagamento dos produtos."],
  ["O ClickCatálogo cobra comissão?", "Não. O plano custa R$ 27 por mês e não cobramos comissão sobre suas vendas."],
  ["Quantos produtos e categorias posso cadastrar?", "O plano atual não possui limite comercial de produtos ou categorias."],
  ["Posso mudar o tema?", "Sim. Você pode trocar entre os seis temas disponíveis pelo painel."],
  ["Posso cancelar? Existe fidelidade?", "Você pode cancelar pelo painel, sem fidelidade. As próximas renovações são interrompidas e o acesso continua até o fim do período já pago."],
  ["O que acontece depois do cancelamento?", "Ao terminar o período pago, a loja fica indisponível e os dados operacionais são preservados durante o prazo de retenção informado nos Termos."],
  ["Preciso ter e-commerce?", "Não. O ClickCatálogo foi feito justamente para quem vende de forma simples pelo WhatsApp ou Instagram."],
] as const;

export default function HomePage() {
  const legalIdentity = getLegalIdentity();

  return (
    <main className="overflow-hidden bg-[var(--app-background)]">
      <nav className="relative z-10 border-b border-brand-900/10 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandLink />
          <div className="flex items-center gap-2">
            <PendingLink className={buttonVariants({ size: "sm", variant: "ghost" })} href="/painel" pendingLabel="Abrindo...">
              Entrar
            </PendingLink>
            <PendingLink className={buttonVariants({ size: "sm" })} href="/cadastro" pendingLabel="Abrindo...">
              Quero minha loja
            </PendingLink>
          </div>
        </div>
      </nav>

      <section className="relative bg-[linear-gradient(135deg,var(--brand-50),white_55%,var(--brand-100))] px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
        <div className="absolute -right-40 -top-40 size-[34rem] rounded-full bg-[var(--brand-accent)]/35 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
              <Sparkles aria-hidden="true" className="size-3.5" />
              Catálogo simples. Pedido direto.
            </span>
            <h1 className="mt-6 max-w-3xl text-4xl font-extrabold leading-[1.05] tracking-[-0.04em] text-brand-900 sm:text-6xl">
              Sua loja no WhatsApp em minutos
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-[var(--app-foreground-muted)]">
              Organize seus produtos em um catálogo bonito, compartilhe o link e receba pedidos no
              WhatsApp — sem complicação.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <PendingLink className={buttonVariants({ size: "lg" })} href="/cadastro" pendingLabel="Abrindo cadastro...">
                Quero minha loja
                <ArrowRight aria-hidden="true" />
              </PendingLink>
              <Link className={buttonVariants({ size: "lg", variant: "secondary" })} href="#temas">
                Ver os temas
              </Link>
            </div>
            <p className="mt-4 text-sm font-medium text-[var(--app-foreground-muted)]">
              R$ 27/mês · cancele quando quiser
            </p>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-lg">
            <div className="absolute -inset-8 rounded-full bg-brand-200/70 blur-3xl" />
            <Card className="relative overflow-hidden border-brand-200 p-3 shadow-[0_30px_80px_rgb(19_50_41_/_20%)] sm:p-5">
              <div className="rounded-xl bg-brand-900 p-5 text-white">
                <div className="flex items-center justify-between gap-4">
                  <span className="grid size-11 place-items-center rounded-xl bg-white/10">
                    <ShoppingBag aria-hidden="true" />
                  </span>
                  <span className="rounded-full bg-[var(--brand-accent)] px-3 py-1 text-xs font-bold text-brand-900">
                    LOJA NO AR
                  </span>
                </div>
                <h2 className="mt-7 text-2xl font-bold">Seu catálogo profissional</h2>
                <p className="mt-2 text-sm text-white/80">Produtos organizados e pedidos sem atrito.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 p-2 pt-5">
                <MiniBenefit icon={LayoutTemplate} label="Visual profissional" />
                <MiniBenefit icon={PackageCheck} label="Itens ilimitados" />
                <MiniBenefit icon={MessageCircle} label="Pedido no WhatsApp" />
                <MiniBenefit icon={CreditCard} label="R$ 27/mês" />
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            description="Você cuida dos produtos; o ClickCatálogo deixa a loja organizada e leva cada pedido até o seu WhatsApp."
            eyebrow="Como funciona"
            title="Do cadastro ao primeiro pedido em três passos"
          />
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {steps.map(({ description, icon: Icon, number, title }) => (
              <Card className="relative overflow-hidden border-brand-200/80 p-6" key={number}>
                <span className="absolute right-4 top-2 text-6xl font-black text-brand-100">{number}</span>
                <span className="relative grid size-11 place-items-center rounded-xl bg-brand-100 text-brand-700">
                  <Icon aria-hidden="true" />
                </span>
                <h3 className="relative mt-5 text-lg font-bold">{title}</h3>
                <p className="relative mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">
                  {description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-brand-900/5 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8" id="temas">
        <div className="mx-auto max-w-7xl">
          <SectionTitle
            description="Troque entre os seis temas e confira a loja completa com produtos de exemplo. Tudo continua organizado no celular e no computador."
            eyebrow="A cara do seu negócio"
            title="Seis temas. Uma loja que parece sua."
          />
          <div className="mt-10">
            <ThemePreviewSection />
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Card className="grid overflow-hidden border-brand-200 lg:grid-cols-[1fr_0.8fr]">
            <div className="p-7 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">Plano completo</p>
              <h2 className="mt-2 text-3xl font-bold">Tudo para vender melhor</h2>
              <ul className="mt-7 grid gap-4">
                {benefits.map((benefit) => (
                  <li className="flex items-center gap-3 text-sm font-medium" key={benefit}>
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                      <Check aria-hidden="true" className="size-3.5" strokeWidth={3} />
                    </span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col justify-center bg-brand-900 p-7 text-white sm:p-10">
              <p className="text-sm text-white/80">Por apenas</p>
              <p className="mt-1 flex items-end gap-2">
                <span className="text-5xl font-black tracking-tight">R$27</span>
                <span className="pb-1 text-white/80">/mês</span>
              </p>
              <p className="mt-4 text-sm leading-6 text-white/80">Pagamento mensal no cartão de crédito. Cancele quando quiser.</p>
              <PendingLink
                className={buttonVariants({
                  className: "mt-7 bg-[var(--brand-accent)] text-brand-900 hover:bg-white",
                  size: "lg",
                })}
                href="/cadastro"
                pendingLabel="Abrindo cadastro..."
              >
                Quero minha loja
                <ArrowRight aria-hidden="true" />
              </PendingLink>
            </div>
          </Card>
        </div>
      </section>

      <section className="border-y border-brand-900/5 bg-white px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <SectionTitle
            description="As respostas mais importantes antes de colocar sua loja no ar."
            eyebrow="Perguntas frequentes"
            title="Simples para você e para seus clientes"
          />
          <div className="mt-9 grid gap-3">
            {frequentlyAskedQuestions.map(([question, answer]) => (
              <details className="group rounded-[var(--radius-card)] border border-brand-200 bg-[var(--app-background)] px-5 py-1 open:bg-white" key={question}>
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold marker:content-none">
                  {question}
                  <span aria-hidden="true" className="text-xl text-brand-700 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="border-t border-brand-100 py-4 text-sm leading-6 text-[var(--app-foreground-muted)]">{answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-brand-200 bg-brand-100 px-4 py-16 text-center sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">
            Seu próximo pedido pode começar aqui
          </h2>
          <p className="mt-4 text-[var(--app-foreground-muted)]">
            Crie seu catálogo, compartilhe o link e deixe seus produtos trabalharem por você.
          </p>
          <PendingLink className={buttonVariants({ className: "mt-7", size: "lg" })} href="/cadastro" pendingLabel="Abrindo cadastro...">
            Quero minha loja
            <ArrowRight aria-hidden="true" />
          </PendingLink>
        </div>
      </section>

      <footer
        className="border-t border-white/10 bg-brand-900 px-4 text-white sm:px-6 lg:px-8"
        id="rodape"
      >
        <div className="mx-auto grid max-w-7xl gap-8 py-10 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="max-w-md">
            <BrandLink inverse />
            <p className="mt-4 text-sm leading-6 text-white/75">
              Catálogo digital simples para organizar produtos e receber pedidos direto no WhatsApp.
            </p>
          </div>
          <nav aria-label="Links institucionais" className="flex flex-col items-start gap-1 sm:items-end">
            <FooterLink href="/termos">Termos de uso</FooterLink>
            <FooterLink href="/privacidade">Política de privacidade</FooterLink>
            {legalIdentity.supportEmail ? (
              <FooterLink href="/atendimento">Atendimento</FooterLink>
            ) : null}
            <FooterLink href="/painel">Entrar no painel</FooterLink>
          </nav>
        </div>
        <div className="mx-auto flex max-w-7xl flex-col gap-2 border-t border-white/10 py-5 text-xs text-white/65 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} ClickCatálogo</p>
          <p>Um produto da Justo Tecnologias.</p>
        </div>
      </footer>
    </main>
  );
}

function BrandLink({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      className={`flex min-h-11 items-center gap-2 font-bold tracking-tight ${inverse ? "text-white" : "text-brand-900"}`}
      href="/"
    >
      <span className={`grid size-8 place-items-center rounded-lg ${inverse ? "bg-white/10" : "bg-brand-900 text-white"}`}>
        <ShoppingBag aria-hidden="true" className="size-4" />
      </span>
      ClickCatálogo
    </Link>
  );
}

function FooterLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <Link
      className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
      href={href}
    >
      {children}
    </Link>
  );
}

function MiniBenefit({ icon: Icon, label }: { icon: typeof LayoutTemplate; label: string }) {
  return (
    <div className="rounded-lg border border-brand-900/5 bg-[var(--app-surface-muted)] p-3">
      <Icon aria-hidden="true" className="size-4 text-brand-700" />
      <p className="mt-3 text-xs font-semibold">{label}</p>
    </div>
  );
}

function SectionTitle({
  description,
  eyebrow,
  title,
}: {
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-700">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-bold tracking-tight text-brand-900 sm:text-4xl">{title}</h2>
      <p className="mt-4 leading-7 text-[var(--app-foreground-muted)]">{description}</p>
    </div>
  );
}
