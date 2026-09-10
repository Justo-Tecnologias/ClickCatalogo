"use client";

import { Ban, LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import { cancelSubscriptionAction } from "@/app/painel/(app)/assinatura/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type SubscriptionCancellationProps = {
  canCancel: boolean;
  demo: boolean;
  initialAccessUntil: string | null;
  initialCancelled: boolean;
  initialScheduled: boolean;
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
  demo,
  initialAccessUntil,
  initialCancelled,
  initialScheduled,
  storeName,
}: SubscriptionCancellationProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [accessUntil, setAccessUntil] = useState(initialAccessUntil);
  const [state, setState] = useState<"active" | "cancelled" | "scheduled">(
    initialCancelled ? "cancelled" : initialScheduled ? "scheduled" : "active",
  );
  const [confirmation, setConfirmation] = useState("");
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
      setOpen(false);
      setConfirmation("");
    });
  }

  if (state === "cancelled") {
    return (
      <Alert
        description="Sua loja pública está pausada, a cobrança recorrente foi encerrada e os dados operacionais ficam preservados por até 30 dias."
        title="Assinatura cancelada"
        variant="danger"
      />
    );
  }

  if (state === "scheduled" && accessUntil) {
    return (
      <Alert
        description={`A próxima renovação foi cancelada. Sua loja e o painel permanecem disponíveis até ${formatDate(accessUntil)}; não haverá nova cobrança desta assinatura.`}
        title="Cancelamento agendado"
        variant="warning"
      />
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
          <Button disabled={!canCancel} onClick={() => setOpen(true)} variant="danger">
            <Ban aria-hidden="true" />
            Cancelar assinatura
          </Button>
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
