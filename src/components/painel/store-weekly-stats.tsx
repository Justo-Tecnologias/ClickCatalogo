import { ArrowDownRight, ArrowUpRight, Eye, MessageCircle, Minus, Share2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { StoreStat, StoreStatEvent } from "@/lib/analytics/store-stats";
import { cn } from "@/lib/utils/cn";

const LABELS: Record<StoreStatEvent, { icon: typeof Eye; label: string }> = {
  catalog_shared: { icon: Share2, label: "Compartilhamentos da loja" },
  catalog_view: { icon: Eye, label: "Visitas à loja" },
  whatsapp_order_clicked: { icon: MessageCircle, label: "Cliques para pedir no WhatsApp" },
};

const numberFormat = new Intl.NumberFormat("pt-BR");

function Delta({ current, previous }: { current: number; previous: number }) {
  const difference = current - previous;
  if (difference === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--app-foreground-muted)]">
        <Minus aria-hidden="true" className="size-3.5" />
        Igual aos 7 dias anteriores
      </span>
    );
  }
  const up = difference > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("flex items-center gap-1 text-xs font-medium", up ? "text-[var(--app-success)]" : "text-[var(--app-foreground-muted)]")}>
      <Icon aria-hidden="true" className="size-3.5" />
      {up ? "+" : "−"}{numberFormat.format(Math.abs(difference))} vs. 7 dias anteriores
    </span>
  );
}

export function StoreWeeklyStats({ demo = false, stats }: { demo?: boolean; stats: StoreStat[] }) {
  const empty = stats.every((stat) => stat.current === 0 && stat.previous === 0);

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">Sua loja esta semana</p>
          <h2 className="mt-1 text-lg font-bold">Últimos 7 dias</h2>
        </div>
        {demo ? <p className="text-xs text-[var(--app-foreground-muted)]">Números ilustrativos da demonstração</p> : null}
      </div>

      {empty ? (
        <p className="mt-4 rounded-[var(--radius-control)] bg-[var(--app-surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--app-foreground-muted)]">
          Ainda não há visitas registradas. Compartilhe o link da loja no WhatsApp e no Instagram para começar a receber clientes.
        </p>
      ) : (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          {stats.map(({ current, event, previous }) => {
            const { icon: Icon, label } = LABELS[event];
            return (
              <div className="rounded-[var(--radius-card)] border border-[var(--app-border)] p-4" key={event}>
                <dt className="flex items-center gap-2 text-sm text-[var(--app-foreground-muted)]">
                  <Icon aria-hidden="true" className="size-4 text-brand-700" />
                  {label}
                </dt>
                <dd className="mt-2">
                  <span className="block text-3xl font-semibold tracking-tight text-[var(--app-foreground)]">{numberFormat.format(current)}</span>
                  <span className="mt-1 block"><Delta current={current} previous={previous} /></span>
                </dd>
              </div>
            );
          })}
        </dl>
      )}

      <p className="mt-3 text-xs leading-5 text-[var(--app-foreground-muted)]">
        Contagens agregadas por dia, sem identificar clientes. As visitas incluem as vezes em que você mesmo abre a loja.
      </p>
    </Card>
  );
}
