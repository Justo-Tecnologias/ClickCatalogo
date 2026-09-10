"use client";

import { Check, Copy, Mail } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";

export function SupportContact({ email, subject }: { email: string; subject: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}`;

  async function copyEmail() {
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopyError(true);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--app-foreground-muted)]">E-mail oficial</p>
        <a className="mt-2 block break-all text-lg font-bold text-brand-700 underline underline-offset-4" href={mailto}>{email}</a>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <a className={buttonVariants({ size: "lg" })} href={mailto}><Mail aria-hidden="true" />Abrir meu e-mail</a>
        <Button onClick={copyEmail} size="lg" variant="secondary">{copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}{copied ? "E-mail copiado" : "Copiar endereço"}</Button>
      </div>
      {copyError ? <Alert description={`Copie manualmente: ${email}`} title="Não foi possível copiar automaticamente" variant="warning" /> : null}
    </div>
  );
}
