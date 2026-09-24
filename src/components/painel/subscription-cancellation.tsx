"use client";

import { Ban, CreditCard, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  cancelSubscriptionAction,
  checkSubscriptionReactivationAction,
  createReactivationCheckoutAction,
  prepareSubscriptionCancellationAction,
  revertSubscriptionCancellationAction,
} from "@/app/painel/(app)/assinatura/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { SubscriptionViewState } from "@/lib/billing/subscription-view";
import { lastPaidAccessInstant } from "@/lib/billing/access-period";
import { formatCurrency } from "@/lib/format/currency";

type Props = {
  accessUntil: string | null;
  canCancel: boolean;
  canRevert: boolean;
  demo: boolean;
  price: number;
  state: SubscriptionViewState;
  storeName: string;
};

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function lastAccessDay(accessUntil: string) {
  return formatDate(lastPaidAccessInstant(accessUntil));
}

export function SubscriptionCancellation({ accessUntil, canCancel, canRevert, demo, price, state, storeName }: Props) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [dialogType, setDialogType] = useState<"cancel" | "resume" | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [preparedAccessUntil, setPreparedAccessUntil] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (dialogType && !dialog.open) dialog.showModal();
    if (!dialogType && dialog.open) dialog.close();
  }, [dialogType]);

  useEffect(() => {
    if (!dialogType) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [dialogType]);

  function closeDialog() {
    if (isPending) return;
    setDialogType(null);
    setConfirmation("");
    setPreparedAccessUntil(null);
    setError(null);
  }

  function prepareCancellation() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await prepareSubscriptionCancellationAction();
        if (!result.ok || !result.data) return setError(result.ok ? "Não foi possível confirmar o período pago." : result.error);
        setPreparedAccessUntil(result.data.accessUntil);
        setDialogType("cancel");
      } catch {
        setError("Não foi possível consultar o período pago. Tente novamente mais tarde.");
      }
    });
  }

  function cancel() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await cancelSubscriptionAction({ confirmation, expectedAccessUntil: preparedAccessUntil });
        if (!result.ok) return setError(result.error);
        setDialogType(null);
        setConfirmation("");
        router.refresh();
      } catch {
        setError("Não recebemos a confirmação do pedido. Atualize a página antes de tentar qualquer nova ação.");
      }
    });
  }

  function resume() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await revertSubscriptionCancellationAction();
        if (!result.ok) return setError(result.error);
        setDialogType(null);
        router.refresh();
      } catch {
        setError("Não recebemos a confirmação da retomada. Atualize a página antes de tentar qualquer nova ação.");
      }
    });
  }

  function renew() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await createReactivationCheckoutAction();
        if (!result.ok || !result.data?.checkoutUrl) {
          return setError(result.ok ? "Não foi possível abrir a renovação." : result.error);
        }
        window.location.assign(result.data.checkoutUrl);
      } catch {
        setError("Não conseguimos confirmar a abertura da renovação. Atualize a página antes de tentar novamente.");
      }
    });
  }

  function checkResume() {
    setError(null);
    startTransition(async () => {
      try {
        await checkSubscriptionReactivationAction();
        router.refresh();
      } catch {
        setError("Não foi possível consultar a retomada agora. Peça ajuda pelo atendimento se a mensagem continuar.");
      }
    });
  }

  if (demo) return <Alert description="Este painel usa dados de exemplo e não executa cobranças ou cancelamentos." title="Assinatura de demonstração" />;

  return (
    <div className="grid gap-4">
      {state === "active" || state === "past_due" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button disabled={!canCancel || isPending} onClick={prepareCancellation} variant="danger">{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Ban aria-hidden="true" />}{isPending ? "Consultando..." : "Cancelar assinatura"}</Button>
          {!canCancel ? <p className="text-sm text-[var(--app-foreground-muted)]">O cancelamento ainda não está disponível. Peça ajuda pelo atendimento.</p> : null}
        </div>
      ) : null}

      {state === "cancelled_with_access" && accessUntil ? (
        <>
          <Alert
            description={`Você pode continuar usando a loja e o painel até ${lastAccessDay(accessUntil)}. Depois dessa data, sua loja ficará guardada por até 30 dias e poderá ser renovada pelo painel sem cadastrar os produtos novamente.`}
            title="Cancelamento confirmado"
          />
          {canRevert ? <Button className="w-fit" disabled={isPending} onClick={() => setDialogType("resume")}><CreditCard aria-hidden="true" />Retomar assinatura</Button> : <p className="text-sm text-[var(--app-foreground-muted)]">Quando o período atual terminar, a opção <strong>Renovar assinatura</strong> aparecerá nesta página.</p>}
        </>
      ) : null}

      {state === "cancelling" ? (
        <Alert
          description={accessUntil
            ? `Recebemos seu pedido. Seu acesso continua disponível até ${lastAccessDay(accessUntil)}. Você não precisa solicitar novamente.`
            : "Recebemos seu pedido. Seu acesso continua disponível normalmente. Você não precisa solicitar novamente."}
          title="Cancelamento solicitado"
        />
      ) : null}
      {state === "resuming" ? <><Alert description={`Recebemos seu pedido de retomada. Até a confirmação, a assinatura continua cancelada${accessUntil ? ` e o acesso permanece disponível até ${lastAccessDay(accessUntil)}` : ""}.`} title="Retomada solicitada" /><Button className="w-fit" disabled={isPending} onClick={checkResume} variant="secondary">{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{isPending ? "Atualizando..." : "Verificar atualização"}</Button></> : null}
      {state === "ending" ? <Alert description="O período de acesso terminou. A loja não está mais disponível e a opção de assinar novamente aparecerá em instantes." title="Período de acesso concluído" /> : null}
      {state === "ended" ? (
        <>
          <Alert description="O período pago terminou e a loja está indisponível. Seus produtos e configurações ficam guardados por até 30 dias. Renove dentro desse prazo para publicar a mesma loja novamente; o valor será mostrado antes do pagamento." title="Acesso encerrado" />
          <Button className="w-fit" disabled={isPending} onClick={renew}><CreditCard aria-hidden="true" />{isPending ? "Abrindo renovação..." : "Renovar assinatura"}</Button>
        </>
      ) : null}
      {error && !dialogType ? <Alert description={error} title="Não foi possível concluir" variant="danger" /> : null}

      <dialog
        aria-labelledby="subscription-dialog-title"
        className="m-auto w-[calc(100%-2rem)] max-w-[34rem] rounded-[var(--radius-card)] border-0 bg-transparent p-0 text-[var(--app-foreground)] shadow-2xl backdrop:bg-black/50"
        onCancel={(event) => { event.preventDefault(); closeDialog(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeDialog(); }}
        onClose={() => setDialogType(null)}
        ref={dialogRef}
      >
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--app-border)] bg-white">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] p-5 sm:p-6">
            <div className="flex min-w-0 gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[var(--app-surface-muted)]"><TriangleAlert aria-hidden="true" className="size-5" /></span>
              <div><h2 className="text-lg font-bold" id="subscription-dialog-title">{dialogType === "resume" ? "Retomar assinatura?" : "Cancelar assinatura?"}</h2></div>
            </div>
            <Button aria-label="Fechar confirmação" disabled={isPending} onClick={closeDialog} size="icon" variant="ghost"><X aria-hidden="true" /></Button>
          </header>

          {dialogType === "cancel" ? (
            <form className="grid gap-5 p-5 sm:p-6" onSubmit={(event) => { event.preventDefault(); cancel(); }}>
              <p className="text-sm leading-6 text-[var(--app-foreground-muted)]">A renovação automática será cancelada. A loja e o painel continuarão disponíveis até {preparedAccessUntil ? lastAccessDay(preparedAccessUntil) : "o fim do período já pago"}. Cobranças já devidas não são apagadas.</p>
              {state === "past_due" ? <Alert description="Há uma cobrança pendente. Ela permanece devida mesmo que você cancele a assinatura." title="Cobrança existente" variant="warning" /> : null}
              <Field>
                <FieldLabel htmlFor="subscription-confirmation">Digite <strong>{storeName}</strong> para confirmar</FieldLabel>
                <Input aria-invalid={Boolean(error)} autoComplete="off" autoFocus disabled={isPending} id="subscription-confirmation" maxLength={100} onChange={(event) => { setConfirmation(event.target.value); setError(null); }} value={confirmation} />
                <FieldDescription>O nome deve ser digitado exatamente como aparece acima.</FieldDescription>
                {error ? <FieldError>{error}</FieldError> : null}
              </Field>
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button disabled={isPending} onClick={closeDialog} variant="secondary">Manter assinatura</Button>
                <Button disabled={isPending || confirmation.trim() !== storeName.trim()} type="submit" variant="danger">{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Ban aria-hidden="true" />}{isPending ? "Cancelando..." : "Confirmar cancelamento"}</Button>
              </div>
            </form>
          ) : dialogType === "resume" && accessUntil ? (
            <div className="grid gap-5 p-5 sm:p-6">
              <p className="text-sm leading-6 text-[var(--app-foreground-muted)]">A renovação automática voltará a funcionar por {formatCurrency(price)}/mês. A próxima cobrança está prevista para {formatDate(accessUntil)}. A data será confirmada pelo Asaas após a retomada.</p>
              {error ? <Alert description={error} title="Não foi possível retomar" variant="danger" /> : null}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Button disabled={isPending} onClick={closeDialog} variant="secondary">Manter cancelada</Button>
                <Button disabled={isPending} onClick={resume}>{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <CreditCard aria-hidden="true" />}{isPending ? "Retomando..." : "Confirmar retomada"}</Button>
              </div>
            </div>
          ) : null}
        </section>
      </dialog>
    </div>
  );
}
