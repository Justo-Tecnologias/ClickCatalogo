"use client";

import { CheckCircle2, Clock3, LoaderCircle, RotateCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PasswordSetupForm } from "@/components/cadastro/password-setup-form";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PendingLink } from "@/components/ui/pending-link";
import type { AccountContinuationState } from "@/lib/signup/continuation-types";

type StatusResponse = {
  configured?: boolean;
  error?: string;
  state?: AccountContinuationState;
};

export function AccountContinuation({ reference }: { reference: string | null }) {
  const [state, setState] = useState<AccountContinuationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [restarting, setRestarting] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!reference) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/cadastro/status?ref=${encodeURIComponent(reference)}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const result = await response.json() as StatusResponse;
      if (!response.ok || !result.state) {
        throw new Error(result.error ?? "Não foi possível consultar sua loja agora.");
      }
      setState(result.state);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível consultar sua loja agora.");
    } finally {
      setLoading(false);
    }
  }, [reference]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  useEffect(() => {
    if (state?.type !== "PAYMENT_CONFIRMING" || pollCount >= 15) return;
    const timer = window.setTimeout(() => {
      setPollCount((value) => value + 1);
      void refresh();
    }, 2_000);
    return () => window.clearTimeout(timer);
  }, [pollCount, refresh, state?.type]);

  async function restartCheckout() {
    if (!reference || restarting) return;
    setRestarting(true);
    setError(null);
    try {
      const response = await fetch("/api/cadastro/continuar-checkout", {
        body: JSON.stringify({ reference }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json() as {
        checkoutUrl?: string;
        error?: string;
        state?: AccountContinuationState;
      };
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      if (result.state) {
        setState(result.state);
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "Não foi possível continuar agora.");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível continuar agora.");
    } finally {
      setRestarting(false);
    }
  }

  if (!reference) {
    return <MessageCard title="Solicite um novo link" text="Por segurança, use novamente o e-mail informado no ClickCatálogo."><PendingLink className={buttonVariants()} href="/painel/acessar-loja" pendingLabel="Abrindo...">Enviar novo link</PendingLink></MessageCard>;
  }
  if (loading) {
    return <Card className="p-7 text-center sm:p-9"><LoaderCircle aria-hidden="true" className="mx-auto size-8 animate-spin text-brand-700" /><h1 className="mt-5 text-2xl font-bold">Identificando sua loja</h1><p className="mt-2 text-sm text-[var(--app-foreground-muted)]">Isso leva apenas alguns instantes.</p></Card>;
  }
  if (error && !state) {
    return <MessageCard title="Não foi possível consultar agora" text={error}><Button onClick={() => void refresh()}><RotateCw aria-hidden="true" />Tentar novamente</Button><PendingLink className={buttonVariants({ variant: "secondary" })} href="/painel/acessar-loja" pendingLabel="Abrindo...">Solicitar novo link</PendingLink></MessageCard>;
  }
  if (!state) return null;

  if (state.type === "PAID_NEEDS_PASSWORD") {
    return <Card className="p-6 sm:p-8"><h1 className="text-2xl font-bold">Crie sua senha</h1><p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Sua loja já está pronta. Crie uma senha para acessar o painel do ClickCatálogo.</p>{error ? <Alert className="mt-5" title={error} variant="danger" /> : null}<PasswordSetupForm onConfigured={() => setState({ slug: state.slug, type: "ACCOUNT_READY" })} reference={reference} /></Card>;
  }
  if (state.type === "ACCOUNT_READY") {
    return <MessageCard icon="success" title="Sua conta já está pronta" text="Este e-mail já possui acesso ao ClickCatálogo."><PendingLink className={buttonVariants()} href="/painel" pendingLabel="Abrindo...">Entrar na minha conta</PendingLink><PendingLink className={buttonVariants({ variant: "secondary" })} href="/painel/recuperar-senha" pendingLabel="Abrindo...">Redefinir senha</PendingLink></MessageCard>;
  }
  if (state.type === "CHECKOUT_PENDING") {
    return <MessageCard title="Continue sua assinatura" text="Seu cadastro foi encontrado. Você pode continuar de onde parou."><a className={buttonVariants()} href={state.checkoutUrl}>Continuar assinatura</a><Button onClick={() => void refresh()} variant="secondary"><RotateCw aria-hidden="true" />Já concluí, verificar</Button></MessageCard>;
  }
  if (state.type === "CHECKOUT_RESTARTABLE") {
    return <MessageCard title="Continue sua assinatura" text="Seu cadastro está salvo. Para continuar, será necessário abrir uma nova página de pagamento.">{error ? <Alert title={error} variant="danger" /> : null}<Button disabled={restarting} onClick={restartCheckout}>{restarting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{restarting ? "Preparando..." : "Continuar assinatura"}</Button></MessageCard>;
  }
  if (state.type === "PAYMENT_CONFIRMING") {
    return <MessageCard icon="waiting" title="Estamos confirmando sua assinatura" text="Seu pagamento está sendo confirmado. Assim que a confirmação for concluída, você poderá acessar sua loja.">{error ? <Alert title={error} variant="warning" /> : null}<Button onClick={() => { setPollCount(0); void refresh(); }} variant="secondary"><RotateCw aria-hidden="true" />Verificar novamente</Button><Link className="inline-flex min-h-11 items-center justify-center text-sm font-semibold text-brand-700 hover:underline" href="/atendimento?assunto=cobranca">Preciso de atendimento</Link></MessageCard>;
  }
  if (state.type === "REACTIVATION_PENDING") {
    return <MessageCard icon="waiting" title="Estamos conferindo sua assinatura" text="Encontramos sua loja e existe uma atualização financeira em andamento. Entre na conta para acompanhar; nenhuma nova cobrança será criada por esta tela."><PendingLink className={buttonVariants()} href="/painel" pendingLabel="Abrindo...">Entrar na minha conta</PendingLink><PendingLink className={buttonVariants({ variant: "secondary" })} href="/painel/recuperar-senha" pendingLabel="Abrindo...">Redefinir senha</PendingLink></MessageCard>;
  }
  if (state.type === "CANCELED_RETAINED") {
    return <MessageCard title="Sua loja pode ser reativada" text="Encontramos sua loja anterior. Entre na conta para reativá-la sem cadastrar seus produtos novamente."><PendingLink className={buttonVariants()} href="/painel" pendingLabel="Abrindo...">Entrar para reativar</PendingLink><PendingLink className={buttonVariants({ variant: "secondary" })} href="/painel/recuperar-senha" pendingLabel="Abrindo...">Redefinir senha</PendingLink></MessageCard>;
  }
  return <MessageCard title="Não encontramos uma loja disponível para recuperação" text="Você pode começar uma nova loja com este e-mail."><PendingLink className={buttonVariants()} href="/cadastro" pendingLabel="Abrindo cadastro...">Criar uma nova loja</PendingLink><PendingLink className={buttonVariants({ variant: "secondary" })} href="/painel" pendingLabel="Abrindo...">Voltar para o login</PendingLink></MessageCard>;
}

function MessageCard({ children, icon, text, title }: { children: React.ReactNode; icon?: "success" | "waiting"; text: string; title: string }) {
  return <Card className="p-6 sm:p-8">{icon ? <span className={`grid size-12 place-items-center rounded-full ${icon === "success" ? "bg-[var(--app-success-soft)] text-[var(--app-success)]" : "bg-amber-50 text-amber-700"}`}>{icon === "success" ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}</span> : null}<h1 className={`${icon ? "mt-5" : ""} text-2xl font-bold`}>{title}</h1><p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">{text}</p><div className="mt-6 grid gap-3 sm:grid-cols-2">{children}</div></Card>;
}
