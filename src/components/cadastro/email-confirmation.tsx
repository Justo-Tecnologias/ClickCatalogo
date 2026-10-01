"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";

export function EmailConfirmation() {
  const [state, setState] = useState<{ error?: string; status: "checking" | "confirmed" | "failed" }>({ status: "checking" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token");
    window.history.replaceState(null, "", window.location.pathname);

    if (!token) {
      queueMicrotask(() => setState({ error: "Este link é inválido ou está incompleto.", status: "failed" }));
      return;
    }

    void fetch("/api/conta/confirmar-email", {
      body: JSON.stringify({ token }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then(async (response) => {
      const result = await response.json() as { confirmed?: boolean; error?: string };
      if (!response.ok || !result.confirmed) throw new Error(result.error ?? "Não foi possível confirmar o e-mail.");
      setState({ status: "confirmed" });
    }).catch((reason: unknown) => {
      setState({ error: reason instanceof Error ? reason.message : "Não foi possível confirmar o e-mail.", status: "failed" });
    });
  }, []);

  if (state.status === "failed") {
    return (
      <div className="grid gap-5">
        <Alert description="Entre no painel e peça um novo link de confirmação na faixa do topo." title={state.error ?? "Não foi possível confirmar o e-mail."} variant="warning" />
        <Link className={buttonVariants()} href="/painel/loja">Ir para o painel</Link>
      </div>
    );
  }

  if (state.status === "confirmed") {
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700">
          <CheckCircle2 aria-hidden="true" className="size-6" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">E-mail confirmado!</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Agora você pode publicar sua loja quando ela estiver pronta.</p>
        <Link className={buttonVariants({ className: "mt-6" })} href="/painel/loja">Continuar montando a loja</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700">
        <LoaderCircle aria-hidden="true" className="size-6 animate-spin" />
      </span>
      <h1 className="mt-5 text-2xl font-bold">Confirmando seu e-mail</h1>
      <p className="mt-2 text-sm text-[var(--app-foreground-muted)]">Só um instante.</p>
    </div>
  );
}
