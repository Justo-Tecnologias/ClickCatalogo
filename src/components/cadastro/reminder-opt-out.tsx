"use client";

import { BellOff, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";

// O token vem no fragmento (#t=...) para não ficar em logs do servidor.
export function ReminderOptOut() {
  const [state, setState] = useState<{ error?: string; status: "done" | "failed" | "working" }>({ status: "working" });

  useEffect(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t");
    window.history.replaceState(null, "", window.location.pathname);
    if (!token) {
      queueMicrotask(() => setState({ error: "Este link é inválido ou está incompleto.", status: "failed" }));
      return;
    }
    void fetch("/api/lembretes/parar", {
      body: JSON.stringify({ token }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }).then(async (response) => {
      const result = await response.json() as { error?: string; stopped?: boolean };
      if (!response.ok || !result.stopped) throw new Error(result.error ?? "Não foi possível atualizar.");
      setState({ status: "done" });
    }).catch((reason: unknown) => {
      setState({ error: reason instanceof Error ? reason.message : "Não foi possível atualizar.", status: "failed" });
    });
  }, []);

  if (state.status === "failed") {
    return <Alert description="Abra novamente o link do e-mail ou fale com o atendimento." title={state.error ?? "Não foi possível atualizar."} variant="warning" />;
  }

  if (state.status === "done") {
    return (
      <div className="flex flex-col items-center py-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700"><BellOff aria-hidden="true" className="size-6" /></span>
        <h1 className="mt-5 text-2xl font-bold">Lembretes desativados</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Você não receberá mais lembretes sobre a publicação da loja. O rascunho continua disponível no painel.</p>
        <Link className={buttonVariants({ className: "mt-6", variant: "secondary" })} href="/painel">Entrar no painel</Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-6 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-brand-100 text-brand-700"><LoaderCircle aria-hidden="true" className="size-6 animate-spin" /></span>
      <h1 className="mt-5 text-2xl font-bold">Atualizando preferência</h1>
    </div>
  );
}
