"use client";

import { Check, LoaderCircle, Mail, Package, Rocket } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { resendEmailVerificationAction, startPublicationCheckoutAction } from "@/app/painel/(app)/loja/publish-actions";
import { Button } from "@/components/ui/button";
import { CLICKCATALOGO_MONTHLY_PLAN } from "@/lib/billing/plan";
import { DRAFT_RETENTION_DAYS } from "@/lib/signup/draft-emails.mjs";
import { cn } from "@/lib/utils/cn";

export type DraftBannerProps = {
  email: string | null;
  emailConfirmed: boolean;
  productCount: number;
};

// Faixa do painel enquanto a loja está em rascunho: o que falta para
// publicar (e-mail confirmado, ao menos 1 produto) e o botão de publicação.
export function DraftBanner({ email, emailConfirmed, productCount }: DraftBannerProps) {
  const [message, setMessage] = useState<{ text: string; tone: "error" | "info" } | null>(null);
  const [publishing, startPublishing] = useTransition();
  const [resending, startResending] = useTransition();
  const hasProducts = productCount > 0;
  const ready = emailConfirmed && hasProducts;

  function publish() {
    setMessage(null);
    startPublishing(async () => {
      const result = await startPublicationCheckoutAction();
      if (result.ok && result.data) {
        window.location.assign(result.data.checkoutUrl);
        return;
      }
      setMessage({ text: result.error ?? "Não foi possível abrir o pagamento agora.", tone: "error" });
    });
  }

  function resend() {
    setMessage(null);
    startResending(async () => {
      const result = await resendEmailVerificationAction();
      setMessage(result.ok
        ? { text: `Enviamos um novo link para ${email ?? "seu e-mail"}. Confira também a caixa de spam.`, tone: "info" }
        : { text: result.error, tone: "error" });
    });
  }

  return (
    <section aria-labelledby="draft-banner-title" className="rounded-[var(--radius-card)] border border-brand-200 bg-[linear-gradient(135deg,var(--brand-50),#fff_60%)] p-4 shadow-[var(--shadow-elevation)] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Rascunho · só você vê</p>
          <h2 className="mt-1 text-lg font-bold text-brand-900" id="draft-banner-title">
            {ready ? "Sua loja está pronta para ir ao ar" : "Monte sua loja e publique quando quiser"}
          </h2>
          <ul className="mt-3 grid gap-2 text-sm sm:flex sm:flex-wrap sm:gap-x-5">
            <Step done={emailConfirmed} icon={Mail}>
              {emailConfirmed ? "E-mail confirmado" : (
                <>
                  Confirme seu e-mail{" "}
                  <button className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline underline-offset-4 disabled:opacity-60 sm:min-h-0" disabled={resending} onClick={resend} type="button">
                    {resending ? "Enviando..." : "Reenviar link"}
                  </button>
                </>
              )}
            </Step>
            <Step done={hasProducts} icon={Package}>
              {hasProducts ? (productCount === 1 ? "1 produto cadastrado" : `${productCount} produtos cadastrados`) : (
                <Link className="inline-flex min-h-11 items-center font-semibold text-brand-700 underline underline-offset-4 sm:min-h-0" href="/painel/produtos">Cadastre o primeiro produto</Link>
              )}
            </Step>
          </ul>
        </div>

        <div className="grid shrink-0 gap-1.5 lg:justify-items-end">
          <Button className="w-full lg:w-auto" disabled={!ready || publishing} onClick={publish} size="lg">
            {publishing ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Rocket aria-hidden="true" />}
            {publishing ? "Abrindo pagamento..." : "Publicar minha loja"}
          </Button>
          <p className="text-center text-xs text-[var(--app-foreground-muted)] lg:text-right">
            R$ {CLICKCATALOGO_MONTHLY_PLAN.value}/mês no cartão · cancele quando quiser
          </p>
        </div>
      </div>

      {message ? (
        <p aria-live="polite" className={cn("mt-3 text-sm", message.tone === "error" ? "text-[var(--app-danger)]" : "text-brand-800")} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      ) : null}
      <p className="mt-3 text-xs leading-5 text-[var(--app-foreground-muted)]">
        Rascunhos sem acesso ao painel por {DRAFT_RETENTION_DAYS} dias são excluídos. <Link className="font-semibold text-brand-700 underline underline-offset-4" href="/painel/assinatura">Como funciona a publicação</Link>
      </p>
    </section>
  );
}

function Step({ children, done, icon: Icon }: { children: React.ReactNode; done: boolean; icon: typeof Mail }) {
  return (
    <li className="flex items-center gap-2">
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", done ? "bg-brand-700 text-white" : "bg-white text-brand-700 ring-1 ring-brand-200")}>
        {done ? <Check aria-hidden="true" className="size-3.5" /> : <Icon aria-hidden="true" className="size-3.5" />}
      </span>
      <span className={done ? "text-brand-900" : undefined}>
        <span className="sr-only">{done ? "Concluído: " : "Pendente: "}</span>
        {children}
      </span>
    </li>
  );
}
