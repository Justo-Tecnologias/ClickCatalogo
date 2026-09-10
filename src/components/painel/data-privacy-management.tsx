"use client";

import { Clock3, FileDown, LoaderCircle, ShieldCheck, Trash2, TriangleAlert, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  requestAccountDeletionAction,
  withdrawExpeditedDeletionAction,
} from "@/app/painel/(app)/privacidade/actions";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AccountDeletionSource, AccountDeletionStatus, TenantStatus } from "@/types/database";

type RequestSummary = {
  scheduledFor: string;
  source: AccountDeletionSource;
  status: AccountDeletionStatus;
} | null;

type DataPrivacyManagementProps = {
  canceledAt: string | null;
  defaultScheduledFor: string | null;
  demo: boolean;
  request: RequestSummary;
  storeName: string;
  supportEmail: string | null;
  tenantStatus: TenantStatus;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function DataPrivacyManagement({
  canceledAt,
  defaultScheduledFor,
  demo,
  request: initialRequest,
  storeName,
  supportEmail,
  tenantStatus,
}: DataPrivacyManagementProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState(initialRequest);
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

  function submitDeletionRequest() {
    setError(null);
    startTransition(async () => {
      const result = await requestAccountDeletionAction({ confirmation });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRequest({
        scheduledFor: result.data!.scheduledFor,
        source: "titular",
        status: "agendado",
      });
      setOpen(false);
      setConfirmation("");
    });
  }

  function withdrawRequest() {
    setError(null);
    startTransition(async () => {
      const result = await withdrawExpeditedDeletionAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setRequest({
        scheduledFor: result.data!.scheduledFor,
        source: "retencao",
        status: "agendado",
      });
    });
  }

  const requestIsProcessing = request?.status === "processando";
  const requestIsComplete = request?.status === "concluido";
  const requestHasFailed = request?.status === "falhou";
  const isExpedited = request?.source === "titular" && ["agendado", "falhou"].includes(request.status);
  const scheduledFor = request?.scheduledFor ?? defaultScheduledFor;

  return (
    <div className="grid gap-5">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck aria-hidden="true" className="size-5 text-brand-700" />
            Seus dados e seus direitos
          </CardTitle>
          <CardDescription>
            Você pode pedir acesso, correção, portabilidade ou informações sobre o uso dos seus dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-5">
          <p className="text-sm leading-6 text-[var(--app-foreground-muted)]">
            Para proteger a conta, pedidos que envolvem uma cópia de dados ou conferência de identidade são tratados pelo e-mail cadastrado no painel.
          </p>
          {supportEmail ? (
            <a
              className={`${buttonVariants({ variant: "secondary" })} w-full sm:w-fit`}
              href="/atendimento?assunto=dados"
            >
              <FileDown aria-hidden="true" />
              Solicitar atendimento sobre dados
            </a>
          ) : (
            <Alert description="O canal de privacidade será exibido assim que o e-mail de suporte for configurado." title="Canal em configuração" variant="warning" />
          )}
        </CardContent>
      </Card>

      <section className="rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-white p-5 sm:p-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 font-semibold text-[var(--app-foreground)]">
              <Trash2 aria-hidden="true" className="size-5 text-[var(--app-danger)]" />
              Exclusão dos dados da conta
            </p>
            <p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">
              Depois do fim do período pago, catálogo, produtos, imagens e acesso são preservados por até 30 dias para tratamento operacional. Você pode antecipar esse prazo para até 15 dias.
            </p>
          </div>
          {tenantStatus === "cancelado" && !demo && !isExpedited && !requestIsProcessing && !requestIsComplete ? (
            <Button onClick={() => setOpen(true)} variant="danger">
              <Trash2 aria-hidden="true" />
              Solicitar exclusão
            </Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4">
          {demo ? (
            <Alert description="Nenhum dado real é alterado no modo de demonstração." title="Demonstração protegida" />
          ) : tenantStatus !== "cancelado" ? (
            <Alert description="Primeiro encerre a recorrência na tela Assinatura. Cancelar a cobrança não apaga os dados imediatamente." title="Assinatura ainda não cancelada" variant="warning" />
          ) : requestIsProcessing ? (
            <Alert description="O processo já começou e pode envolver remoção de imagens, catálogo e acesso. Nesta fase ele não pode mais ser interrompido pelo painel." title="Exclusão em processamento" variant="danger" />
          ) : requestIsComplete ? (
            <Alert description="Os dados operacionais e o acesso desta conta foram removidos." title="Exclusão concluída" variant="success" />
          ) : requestHasFailed && scheduledFor ? (
            <Alert
              description={`A última tentativa não terminou. Uma nova execução está prevista a partir de ${formatDate(scheduledFor)}. Se o aviso continuar depois dessa data, fale com o suporte.`}
              title="Exclusão aguardando nova tentativa"
              variant="warning"
            />
          ) : isExpedited && scheduledFor ? (
            <Alert
              description={`A exclusão operacional está prevista para ${formatDate(scheduledFor)}. Evidências mínimas de contratação, aceite e pagamento permanecem isoladas pelo prazo legal informado na política de privacidade.`}
              title="Exclusão antecipada agendada"
              variant="danger"
            />
          ) : canceledAt && scheduledFor ? (
            <Alert
              description={`A assinatura foi cancelada em ${formatDate(canceledAt)}. O prazo operacional padrão termina em ${formatDate(scheduledFor)}.`}
              icon={Clock3}
              title="Prazo de retenção em andamento"
            />
          ) : (
            <Alert description="Não foi possível calcular a data de retenção. Fale com o suporte antes de solicitar qualquer exclusão." title="Data de cancelamento indisponível" variant="warning" />
          )}

          {error && !open ? <Alert description={error} title="Solicitação não atualizada" variant="danger" /> : null}

          {isExpedited && !requestIsProcessing ? (
            <div>
              <Button disabled={isPending} onClick={withdrawRequest} variant="secondary">
                {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Clock3 aria-hidden="true" />}
                {isPending ? "Atualizando..." : "Voltar ao prazo padrão de 30 dias"}
              </Button>
            </div>
          ) : null}
        </div>
      </section>

      <dialog
        aria-labelledby="delete-account-title"
        className="m-auto w-[calc(100%-2rem)] max-w-[36rem] rounded-[var(--radius-card)] border-0 bg-transparent p-0 text-[var(--app-foreground)] shadow-2xl backdrop:bg-black/50"
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
                <h2 className="text-lg font-bold" id="delete-account-title">Solicitar exclusão da conta</h2>
                <p className="mt-1 text-sm leading-6 text-[var(--app-foreground-muted)]">O prazo operacional será antecipado para até 15 dias.</p>
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
              submitDeletionRequest();
            }}
          >
            <ul className="grid gap-2 text-sm leading-6 text-[var(--app-foreground-muted)]">
              <li>• Produtos, categorias, imagens e configurações serão apagados.</li>
              <li>• Seu acesso ao painel será removido ao final do processo.</li>
              <li>• A loja já cancelada continuará fora do ar.</li>
              <li>• Evidências mínimas exigidas para obrigações legais e defesa de direitos não fazem parte desta exclusão operacional.</li>
            </ul>

            <Field>
              <FieldLabel htmlFor="account-deletion-confirmation">
                Digite <strong>{storeName}</strong> para confirmar
              </FieldLabel>
              <Input
                aria-invalid={Boolean(error)}
                autoComplete="off"
                autoFocus
                disabled={isPending}
                id="account-deletion-confirmation"
                maxLength={100}
                onChange={(event) => {
                  setConfirmation(event.target.value);
                  setError(null);
                }}
                value={confirmation}
              />
              <FieldDescription>Você poderá retirar a antecipação enquanto o processamento não tiver começado.</FieldDescription>
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
                {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}
                {isPending ? "Agendando..." : "Agendar exclusão"}
              </Button>
            </div>
          </form>
        </section>
      </dialog>
    </div>
  );
}
