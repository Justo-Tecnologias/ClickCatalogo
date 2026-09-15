"use client";

import { Ban, CreditCard, ExternalLink, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  cancelSubscriptionAction,
  createReactivationCheckoutAction,
  revertSubscriptionCancellationAction,
} from "@/app/painel/(app)/assinatura/actions";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type SubscriptionCancellationProps = {
  canCancel: boolean;
  canRevert: boolean;
  demo: boolean;
  initialAccessUntil: string | null;
  initialCancelled: boolean;
  initialReconciliationStatus: "attention" | "complete" | "not_required" | "pending" | "processing";
  initialScheduled: boolean;
  portalUrl: string | null;
  storeName: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function SubscriptionCancellation({
  canCancel,
  canRevert,
  demo,
  initialAccessUntil,
  initialCancelled,
  initialReconciliationStatus,
  initialScheduled,
  portalUrl,
  storeName,
}: SubscriptionCancellationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [accessUntil, setAccessUntil] = useState(initialAccessUntil);
  const [state, setState] = useState<"active" | "cancelled" | "scheduled">(
    initialCancelled ? "cancelled" : initialScheduled ? "scheduled" : "active",
  );
  const [confirmation, setConfirmation] = useState("");
  const [reconciliationStatus, setReconciliationStatus] = useState(initialReconciliationStatus);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closeDialog() {
    if (isPending) return;
    setOpen(false);
    setConfirmation("");
    setError(null);
  }

  function submitCancellation() {
    setError(null);
    startTransition(async () => {
      const result = await cancelSubscriptionAction({ confirmation });
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setState(result.data?.status === "agendado" ? "scheduled" : "cancelled");
      setAccessUntil(result.data?.accessUntil ?? null);
      setReconciliationStatus(result.data?.reconciliationStatus ?? "pending");
      setOpen(false);
      setConfirmation("");
    });
  }

  function renewSubscription() {
    setError(null);
    startTransition(async () => {
      const result = await createReactivationCheckoutAction();
      if (!result.ok || !result.data?.checkoutUrl) {
        setError(result.ok ? "Não foi possível abrir a renovação." : result.error);
        return;
      }
      window.location.assign(result.data.checkoutUrl);
    });
  }

  if (state === "cancelled") {
    const reconciliationConfirmed = reconciliationStatus === "complete"
      || reconciliationStatus === "not_required";
    return (
      <div className="grid gap-3">
        <Alert
          description={reconciliationConfirmed
            ? "Sua loja pública está pausada. Os dados operacionais permanecem preservados durante o prazo de retenção e serão reutilizados quando a renovação for confirmada."
            : "Sua loja pública está pausada, mas a conferência de cobranças futuras ainda precisa de atendimento antes de uma nova contratação."}
          title={reconciliationConfirmed ? "Assinatura cancelada" : "Assinatura cancelada — conferência necessária"}
          variant="danger"
        />
        {error ? <Alert title={error} variant="danger" /> : null}
        <div className="flex flex-wrap gap-3">
          <Button disabled={isPending} onClick={renewSubscription}>
            {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <CreditCard aria-hidden="true" />}
            {isPending ? "Abrindo renovação..." : "Renovar assinatura"}
          </Button>
          <AsaasBillingLink cancelled portalUrl={portalUrl} />
        </div>
      </div>
    );
  }

  function revertCancellation() {
    setError(null);
    startTransition(async () => {
      const result = await revertSubscriptionCancellationAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setState("active");
      setAccessUntil(null);
      setReconciliationStatus("not_required");
    });
  }

  function retryReconciliation() {
    setError(null);
    startTransition(async () => {
      const result = await cancelSubscriptionAction({ confirmation: storeName });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReconciliationStatus(result.data?.reconciliationStatus ?? "attention");
    });
  }

  if (state === "scheduled" && accessUntil) {
    const reconciliationConfirmed = reconciliationStatus === "complete";
    return (
      <div className="grid gap-3">
        <Alert
          description={reconciliationConfirmed
            ? `A próxima renovação foi cancelada. Sua loja e o painel permanecem disponíveis até ${formatDate(accessUntil)}; não haverá nova cobrança desta assinatura.`
            : `A recorrência foi interrompida e seu acesso permanece até ${formatDate(accessUntil)}. A conferência de cobranças futuras já geradas ainda precisa ser concluída; fale com o atendimento antes da data de renovação.`}
          title={reconciliationConfirmed ? "Cancelamento agendado" : "Cancelamento em conferência"}
          variant="warning"
        />
        {error ? <Alert title={error} variant="danger" /> : null}
        <div className="flex flex-wrap gap-3">
          {!reconciliationConfirmed ? (
            <Button disabled={isPending} onClick={retryReconciliation}>
              {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              {isPending ? "Verificando..." : "Verificar cancelamento"}
            </Button>
          ) : null}
          {canRevert ? (
            <Button disabled={isPending} onClick={revertCancellation} variant="secondary">
            {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
            {isPending ? "Reativando..." : "Desfazer cancelamento"}
            </Button>
          ) : null}
          <AsaasBillingLink portalUrl={portalUrl} />
        </div>
        {!canRevert ? (
          <Alert description="Esta assinatura antiga foi encerrada de forma definitiva no Asaas. Seu acesso permanece até a data acima; depois disso, será possível renovar sem perder a loja." title="Renovação necessária ao fim do período" />
        ) : null}
      </div>
    );
  }

  if (demo) {
    return (
      <Alert
        description="Este painel usa dados de exemplo e não executa cobranças ou cancelamentos."
        title="Assinatura de demonstração"
      />
    );
  }

  return (
    <>
      <section className="rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-white p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <p className="font-semibold text-[var(--app-foreground)]">Cancelar assinatura</p>
            <p className="mt-1 text-sm leading-6 text-[var(--app-foreground-muted)]">
              Interrompe as próximas renovações. Sua loja e o painel continuam disponíveis até o fim do período já pago.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <AsaasBillingLink portalUrl={portalUrl} />
            <Button disabled={!canCancel} onClick={() => setOpen(true)} variant="danger">
              <Ban aria-hidden="true" />
              Cancelar assinatura
            </Button>
          </div>
        </div>
        {!canCancel ? (
          <p className="mt-3 text-sm text-[var(--app-danger)]">
            O identificador da assinatura no Asaas ainda não está disponível. O cancelamento não pode ser executado agora.
          </p>
        ) : null}
      </section>

      <dialog
        aria-labelledby="cancel-subscription-title"
        className="m-auto w-[calc(100%-2rem)] max-w-[34rem] rounded-[var(--radius-card)] border-0 bg-transparent p-0 text-[var(--app-foreground)] shadow-2xl backdrop:bg-black/50"
        onCancel={(event) => {
          event.preventDefault();
          closeDialog();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDialog();
        }}
        onClose={() => setOpen(false)}
        ref={dialogRef}
      >
        <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--app-border)] bg-white">
          <header className="flex items-start justify-between gap-4 border-b border-[var(--app-border)] p-5 sm:p-6">
            <div className="flex min-w-0 gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--app-danger)_12%,white)] text-[var(--app-danger)]">
                <TriangleAlert aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold" id="cancel-subscription-title">Confirmar cancelamento</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--app-foreground-muted)]">A próxima renovação será interrompida.</p>
              </div>
            </div>
            <Button aria-label="Fechar confirmação" disabled={isPending} onClick={closeDialog} size="icon" variant="ghost">
              <X aria-hidden="true" />
            </Button>
          </header>

          <form
            className="grid gap-5 p-5 sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              submitCancellation();
            }}
          >
            <ul className="grid gap-2 text-sm leading-6 text-[var(--app-foreground-muted)]">
              <li>• A loja e o painel continuarão ativos até o fim do período pago.</li>
              <li>• Depois dessa data, a loja ficará indisponível e começa o prazo de retenção.</li>
              <li>• Novas cobranças recorrentes deixarão de ser geradas.</li>
            </ul>

            <Field>
              <FieldLabel htmlFor="subscription-confirmation">
                Digite <strong>{storeName}</strong> para confirmar
              </FieldLabel>
              <Input
                aria-invalid={Boolean(error)}
                autoComplete="off"
                autoFocus
                disabled={isPending}
                id="subscription-confirmation"
                maxLength={100}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setError(null);
                }}
                value={confirmation}
              />
              <FieldDescription>O nome deve ser digitado exatamente como aparece acima.</FieldDescription>
              {error ? <FieldError>{error}</FieldError> : null}
            </Field>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button className="w-full sm:w-auto" disabled={isPending} onClick={closeDialog} variant="secondary">Voltar</Button>
              <Button
                className="w-full sm:w-auto"
                disabled={isPending || confirmation.trim() !== storeName.trim()}
                type="submit"
                variant="danger"
              >
                {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Ban aria-hidden="true" />}
                {isPending ? "Cancelando..." : "Sim, cancelar assinatura"}
              </Button>
            </div>
          </form>
        </section>
      </dialog>
    </>
  );
}

function AsaasBillingLink({ cancelled = false, portalUrl }: { cancelled?: boolean; portalUrl: string | null }) {
  if (!portalUrl) return null;

  return (
    <a className={buttonVariants({ variant: "secondary" })} href={portalUrl} rel="noreferrer" target="_blank">
      <ExternalLink aria-hidden="true" />
      {cancelled ? "Ver última cobrança no Asaas" : "Ver cobrança no Asaas"}
    </a>
  );
}
