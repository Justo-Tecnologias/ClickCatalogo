"use client";

import { CheckCircle2, ExternalLink, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";

const CHECK_EVERY_MS = 3_000;
const MAX_CHECKS = 60;

// Volta do checkout de publicação. Enquanto o webhook não confirma o
// pagamento a loja segue em rascunho; a página se atualiza sozinha.
export function PublicationReturn({ published, storeUrl }: { published: boolean; storeUrl: string }) {
  const router = useRouter();
  const [checks, setChecks] = useState(0);

  useEffect(() => {
    if (published || checks >= MAX_CHECKS) return;
    const timer = window.setTimeout(() => {
      router.refresh();
      setChecks((current) => current + 1);
    }, CHECK_EVERY_MS);
    return () => window.clearTimeout(timer);
  }, [checks, published, router]);

  if (published) {
    return (
      <section aria-live="polite" className="rounded-[var(--radius-card)] border bg-white p-5 shadow-[var(--shadow-elevation)] sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"><CheckCircle2 aria-hidden="true" className="size-6" /></span>
            <div>
              <h2 className="text-lg font-bold text-brand-900">Sua loja está no ar!</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--app-foreground-muted)]">Pagamento confirmado. Compartilhe o link no WhatsApp e no Instagram para receber os primeiros pedidos.</p>
            </div>
          </div>
          <a className={buttonVariants({ className: "shrink-0" })} href={storeUrl} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" />Ver minha loja</a>
        </div>
      </section>
    );
  }

  return (
    <section aria-live="polite" className="flex items-start gap-3 rounded-[var(--radius-card)] border bg-white p-5 shadow-[var(--shadow-elevation)]">
      {checks < MAX_CHECKS ? <LoaderCircle aria-hidden="true" className="mt-0.5 size-5 shrink-0 animate-spin text-brand-700" /> : null}
      <div>
        <h2 className="font-semibold text-brand-900">{checks < MAX_CHECKS ? "Confirmando seu pagamento" : "O pagamento ainda está em confirmação"}</h2>
        <p className="mt-1 text-sm leading-6 text-[var(--app-foreground-muted)]">
          {checks < MAX_CHECKS
            ? "Isso costuma levar poucos segundos. A loja vai ao ar assim que o Asaas confirmar."
            : "Pode levar alguns minutos. Atualize a página mais tarde; se o pagamento não aparecer, fale com o atendimento."}
        </p>
      </div>
    </section>
  );
}
