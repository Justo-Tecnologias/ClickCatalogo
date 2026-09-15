"use client";

import { LoaderCircle, TriangleAlert, X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  confirmLabel,
  description,
  onCancel,
  onConfirm,
  open,
  pending = false,
  pendingLabel = "Processando...",
  title,
}: {
  confirmLabel: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  pending?: boolean;
  pendingLabel?: string;
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

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

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[var(--radius-card)] border-0 bg-transparent p-0 text-[var(--app-foreground)] shadow-2xl backdrop:bg-black/50"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
      ref={dialogRef}
    >
      <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--app-border)] bg-white">
        <header className="flex items-start justify-between gap-4 border-b p-5">
          <div className="flex min-w-0 gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-red-50 text-[var(--app-danger)]">
              <TriangleAlert aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 className="font-bold" id={titleId}>{title}</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--app-foreground-muted)]" id={descriptionId}>{description}</p>
            </div>
          </div>
          <Button aria-label="Fechar confirmação" disabled={pending} onClick={onCancel} size="icon" variant="ghost"><X aria-hidden="true" /></Button>
        </header>
        <div className="flex flex-col-reverse gap-3 p-5 sm:flex-row sm:justify-end">
          <Button className="w-full sm:w-auto" disabled={pending} onClick={onCancel} variant="secondary">Voltar</Button>
          <Button className="w-full sm:w-auto" disabled={pending} onClick={onConfirm} variant="danger">
            {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
            {pending ? pendingLabel : confirmLabel}
          </Button>
        </div>
      </section>
    </dialog>
  );
}
