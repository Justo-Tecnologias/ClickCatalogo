"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteDraftStoreAction } from "@/app/painel/(app)/privacidade/draft-actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

// Loja ainda não publicada: o titular pode apagar tudo na hora.
export function DraftStoreDeletion({ storeName }: { storeName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const matches = confirmation.trim() === storeName.trim();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await deleteDraftStoreAction({ confirmation });
      if (result.ok) {
        router.replace("/painel?excluida=1");
        router.refresh();
        return;
      }
      setError(result.error);
    });
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-[color-mix(in_srgb,var(--app-danger)_35%,var(--app-border))] bg-white p-5 sm:p-6">
      <p className="flex items-center gap-2 font-semibold text-[var(--app-foreground)]">
        <Trash2 aria-hidden="true" className="size-5 text-[var(--app-danger)]" />
        Excluir minha loja
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--app-foreground-muted)]">
        Sua loja ainda não foi publicada e nada foi cobrado. A exclusão apaga na hora a conta, a loja, os produtos e as fotos, e não pode ser desfeita. Se não fizer nada, o rascunho é excluído automaticamente 30 dias após o último acesso.
      </p>

      {!confirming ? (
        <Button className="mt-4" onClick={() => setConfirming(true)} variant="danger">
          <Trash2 aria-hidden="true" />
          Excluir minha loja
        </Button>
      ) : (
        <form className="mt-5 grid max-w-md gap-4" onSubmit={submit}>
          <Field>
            <FieldLabel htmlFor="draft-delete-confirmation">Digite <strong>{storeName}</strong> para confirmar</FieldLabel>
            <Input autoComplete="off" disabled={isPending} id="draft-delete-confirmation" onChange={(event) => setConfirmation(event.target.value)} value={confirmation} />
            <FieldDescription>Depois disso o endereço da loja fica livre para outro cadastro.</FieldDescription>
          </Field>
          {error ? <Alert title={error} variant="danger" /> : null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={!matches || isPending} type="submit" variant="danger">
              {isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Trash2 aria-hidden="true" />}
              {isPending ? "Excluindo..." : "Excluir definitivamente"}
            </Button>
            <Button disabled={isPending} onClick={() => { setConfirming(false); setConfirmation(""); setError(null); }} type="button" variant="ghost">
              Cancelar
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
