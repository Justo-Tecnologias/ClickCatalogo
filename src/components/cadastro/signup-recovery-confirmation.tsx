"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";

export function SignupRecoveryConfirmation() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", window.location.pathname);

    if (!token) {
      queueMicrotask(() => setError("Este link é inválido ou está incompleto."));
      return;
    }

    void fetch("/api/cadastro/recuperar/confirmar", {
      body: JSON.stringify({ token }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then(async (response) => {
      const result = await response.json() as { error?: string; next?: string };
      if (!response.ok || !result.next) throw new Error(result.error ?? "Não foi possível validar o link.");
      window.location.replace(result.next);
    }).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Não foi possível validar o link.");
    });
  }, []);

  if (error) {
    return (
      <div className="grid gap-5">
        <Alert description="Solicite um novo link usando o mesmo e-mail informado no ClickCatálogo." title={error} variant="warning" />
        <Link className={buttonVariants()} href="/painel/acessar-loja">Solicitar novo link</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700">
        <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
      </span>
      <h1 className="mt-5 text-2xl font-bold">Validando seu acesso</h1>
      <p className="mt-2 text-sm text-[var(--app-foreground-muted)]">Aguarde enquanto identificamos o próximo passo com segurança.</p>
    </div>
  );
}
