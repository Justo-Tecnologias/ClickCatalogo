import { CreditCard } from "lucide-react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { addDays } from "@/lib/billing/overdue-policy.mjs";

export type OverdueBannerProps = {
  cancellationDate: string;
  invoiceUrl: string | null;
  lastOnlineDate: string;
  phase: "online" | "suspended" | "cancellation_due";
  suspensionDate: string;
};

function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

export function OverdueBanner({ cancellationDate, invoiceUrl, lastOnlineDate, phase, suspensionDate }: OverdueBannerProps) {
  const lastPaymentDate = formatDate(addDays(cancellationDate, -1));
  const content = phase === "online"
    ? {
      description: `Sua loja continua no ar até ${formatDate(lastOnlineDate)}. Sem a confirmação do pagamento, o catálogo sai do ar a partir de ${formatDate(suspensionDate)}.`,
      title: "Pagamento da assinatura não aprovado",
      variant: "warning" as const,
    }
    : phase === "suspended"
      ? {
        description: `Seu catálogo está fora do ar para os clientes desde ${formatDate(suspensionDate)}. Seus dados continuam guardados. Se o pagamento não for confirmado até ${lastPaymentDate}, a assinatura será encerrada.`,
        title: "Loja fora do ar por falta de pagamento",
        variant: "danger" as const,
      }
      : {
        description: "O prazo de regularização terminou e o encerramento da assinatura está sendo processado. Em caso de dúvida, fale com o atendimento.",
        title: "Assinatura em encerramento",
        variant: "danger" as const,
      };

  return (
    <Alert
      description={(
        <>
          <p>{content.description}</p>
          {phase !== "cancellation_due" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {invoiceUrl ? (
                <a className={buttonVariants({ size: "sm" })} href={invoiceUrl} rel="noopener noreferrer" target="_blank">
                  <CreditCard aria-hidden="true" />
                  Pagar fatura
                </a>
              ) : null}
              <Link className={buttonVariants({ size: "sm", variant: "secondary" })} href="/painel/assinatura">
                Ver assinatura
              </Link>
            </div>
          ) : null}
        </>
      )}
      title={content.title}
      variant={content.variant}
    />
  );
}
