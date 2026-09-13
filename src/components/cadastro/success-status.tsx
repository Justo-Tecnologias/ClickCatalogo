"use client";

import { Check, CheckCircle2, Clock3, Copy, ExternalLink, RotateCw, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PasswordSetupForm } from "@/components/cadastro/password-setup-form";

type StatusResponse = { accessConfigured?: boolean; checkoutUrl?: string | null; configured?: boolean; ready?: boolean; slug?: string | null; status?: "pendente" | "pago" | "expirado" | "cancelado" };

export function SuccessStatus({ mode, reference }: { mode: "checkout-return" | "resume"; reference: string | null }) {
  const [status, setStatus] = useState<StatusResponse>({ status: "pendente" });
  const [copied, setCopied] = useState<string | null>(null);
  const [checkCycle, setCheckCycle] = useState(0);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (mode !== "checkout-return" || !reference) return;
    void fetch("/api/cadastro/checkout-retornado", {
      body: JSON.stringify({ reference }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).catch(() => undefined);
  }, [mode, reference]);

  useEffect(() => {
    if (!reference) return;
    let attempts = 0;
    let timer: number | undefined;
    async function check() {
      attempts += 1;
      try {
        const response = await fetch(`/api/cadastro/status?ref=${encodeURIComponent(reference!)}`, {
          cache: "no-store",
          signal: AbortSignal.timeout(8_000),
        });
        const result = await response.json() as StatusResponse & { error?: string };
        if (!response.ok && [400, 403, 404].includes(response.status)) {
          setLookupError(result.error ?? "Não encontramos este cadastro.");
          return;
        }
        setStatus(result);
        if (result.ready || result.status === "cancelado" || result.status === "expirado" || result.configured === false) return;
      } catch { /* Uma nova tentativa será feita. */ }
      if (attempts < 30) timer = window.setTimeout(check, 2000);
      else setTimedOut(true);
    }
    void check();
    return () => window.clearTimeout(timer);
  }, [checkCycle, reference]);

  async function copy(value: string, key: string) {
    await navigator.clipboard.writeText(value);
    setCopied(key);
    window.setTimeout(() => setCopied(null), 1800);
  }

  if (!reference) return <Card className="p-6 sm:p-8"><h1 className="text-2xl font-bold">Acesse sua loja</h1><p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Não encontramos uma confirmação salva neste navegador. Use o mesmo e-mail informado no ClickCatálogo para continuar com segurança.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link className={buttonVariants()} href="/painel/acessar-loja">Acessar minha loja</Link><Link className={buttonVariants({ variant: "secondary" })} href="/painel">Já tenho acesso</Link></div></Card>;
  if (lookupError) return <Card className="p-6 sm:p-8"><h1 className="text-2xl font-bold">Protegemos este acompanhamento</h1><Alert className="mt-5" description="Solicite um link de uso único usando o mesmo e-mail informado no ClickCatálogo." title={lookupError} variant="warning" /><div className="mt-6 flex flex-col gap-3 sm:flex-row"><Link className={buttonVariants()} href="/painel/acessar-loja">Acessar minha loja</Link><Link className={buttonVariants({ variant: "secondary" })} href="/painel">Entrar no painel</Link></div></Card>;
  if (status.configured === false) return <><h1 className="sr-only">Cadastro temporariamente indisponível</h1><Alert description="Não foi possível consultar a confirmação agora. Aguarde um instante e tente novamente sem realizar outro pagamento." title="Estamos com uma instabilidade momentânea" variant="warning" /></>;
  if (status.status === "cancelado" || status.status === "expirado") return <Card className="p-6 sm:p-8"><h1 className="text-2xl font-bold">Checkout encerrado</h1><Alert className="mt-5" description="Nenhuma loja foi criada por este checkout. Você pode revisar os dados e gerar uma nova sessão segura de pagamento." title="Este checkout foi cancelado ou expirou" variant="warning" /><Link className={`${buttonVariants()} mt-6`} href="/cadastro">Voltar ao cadastro</Link></Card>;

  if (mode === "resume" && status.status === "pendente" && status.checkoutUrl) {
    return <Card className="p-6 sm:p-8"><h1 className="text-2xl font-bold">Seu pagamento ainda está pendente</h1><p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Você pode retornar ao checkout já criado. Se acabou de pagar, aguarde a confirmação automática antes de tentar novamente.</p><div className="mt-6 flex flex-col gap-3 sm:flex-row"><a className={buttonVariants()} href={status.checkoutUrl}>Continuar pagamento</a><Button onClick={() => setCheckCycle((cycle) => cycle + 1)} variant="secondary"><RotateCw aria-hidden="true" />Já paguei, verificar</Button></div></Card>;
  }

  if (!status.ready || !status.slug) {
    return <Card className="p-7 text-center sm:p-9"><span className="mx-auto grid size-14 place-items-center rounded-full bg-amber-50 text-amber-700"><Clock3 aria-hidden="true" className="size-6" /></span><h1 className="mt-5 text-2xl font-bold">Estamos preparando sua loja</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--app-foreground-muted)]">O checkout foi concluído. A confirmação do Asaas pode levar alguns instantes; esta página atualiza automaticamente.</p><div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-[var(--app-surface-muted)]"><div className="h-full w-2/3 animate-pulse rounded-full bg-brand-600" /></div>{timedOut ? <div className="mt-6 grid gap-4"><Alert className="text-left" description="Não faça outro pagamento. Guarde o endereço desta página: ele permite consultar novamente sem depender de atendimento." title="A confirmação está levando mais tempo" variant="warning" /><Button className="mx-auto" onClick={() => { setTimedOut(false); setCheckCycle((cycle) => cycle + 1); }} variant="secondary"><RotateCw aria-hidden="true" />Verificar novamente</Button></div> : null}</Card>;
  }

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const storeUrl = `${origin}/loja/${status.slug}`;
  const panelUrl = `${origin}/painel`;

  return (
    <Card className="overflow-hidden"><div className="h-1.5 bg-[var(--app-success)]" /><div className="p-6 sm:p-9"><span className="grid size-14 place-items-center rounded-full bg-[var(--app-success-soft)] text-[var(--app-success)]"><CheckCircle2 aria-hidden="true" className="size-7" /></span><h1 className="mt-5 text-3xl font-bold">Sua loja está no ar!</h1><p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Compartilhe o catálogo e use o painel para cadastrar suas categorias e produtos.</p>
      <div className="mt-7 grid gap-3"><LinkRow copied={copied === "store"} href={storeUrl} icon={ShoppingBag} label="Loja pública" onCopy={() => copy(storeUrl, "store")} /><LinkRow copied={copied === "panel"} href={panelUrl} icon={ExternalLink} label="Painel de edição" onCopy={() => copy(panelUrl, "panel")} /></div>
      {status.accessConfigured ? (
        <div className="mt-6 grid gap-4">
          <Alert description="Entre usando o e-mail da assinatura e a senha que você criou." title="Acesso ao painel configurado" variant="success" />
          <Link className={buttonVariants({ size: "lg" })} href="/painel">Acessar meu painel</Link>
        </div>
      ) : (
        <PasswordSetupForm
          onConfigured={() => setStatus((current) => ({ ...current, accessConfigured: true }))}
          reference={reference}
        />
      )}
    </div></Card>
  );
}

function LinkRow({ copied, href, icon: Icon, label, onCopy }: { copied: boolean; href: string; icon: typeof ShoppingBag; label: string; onCopy: () => void }) {
  return <div className="flex items-center gap-3 rounded-lg border bg-white p-3"><span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-700"><Icon aria-hidden="true" className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-[var(--app-foreground-muted)]">{label}</p><a className="block truncate text-sm font-medium text-brand-700 hover:underline" href={href} rel="noreferrer" target="_blank">{href}</a></div><Button aria-label={`Copiar link de ${label}`} onClick={onCopy} size="icon" variant="ghost">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}</Button></div>;
}
