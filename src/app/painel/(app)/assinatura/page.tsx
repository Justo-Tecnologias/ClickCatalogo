import { CalendarDays, CreditCard, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SubscriptionCancellation } from "@/components/painel/subscription-cancellation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { requireTenant } from "@/lib/auth/session";
import { lastPaidAccessInstant } from "@/lib/billing/access-period";
import { subscriptionSituation, subscriptionViewState } from "@/lib/billing/subscription-view";
import { DEMO_SUBSCRIPTION } from "@/lib/demo/panel-demo";
import { CLICKCATALOGO_MONTHLY_PLAN } from "@/lib/billing/plan";
import { formatCurrency } from "@/lib/format/currency";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Assinatura" };
export const dynamic = "force-dynamic";

// Loja em rascunho: ainda não há assinatura. O botão de publicar fica na
// faixa do topo do painel (DraftBanner).
function DraftSubscription() {
  return (
    <div className="grid gap-6">
      <PageHeader description="Monte grátis e pague só quando publicar." eyebrow="Financeiro" title="Assinatura" />
      <Card>
        <CardContent className="grid gap-5 p-5 sm:p-6">
          <div>
            <p className="text-sm text-[var(--app-foreground-muted)]">Situação</p>
            <Badge className="mt-2" variant="neutral">Rascunho — sem cobrança</Badge>
          </div>
          <div className="grid gap-3 text-sm leading-6">
            <p><strong>Enquanto a loja está em rascunho, nada é cobrado.</strong> Você pode cadastrar produtos, trocar o tema e ver tudo pela prévia.</p>
            <p>Ao publicar, você assina o plano de <strong>{formatCurrency(CLICKCATALOGO_MONTHLY_PLAN.value)} por mês</strong> no cartão de crédito, processado pelo Asaas. A loja vai ao ar assim que o pagamento é confirmado, e você pode cancelar quando quiser.</p>
            <p className="text-[var(--app-foreground-muted)]">Para publicar é preciso confirmar o e-mail e ter pelo menos 1 produto. Rascunhos sem acesso ao painel por 30 dias são excluídos.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: Date | string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function formatBillingDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export default async function SubscriptionPage() {
  const { demo, tenant } = await requireTenant();
  if (tenant.status === "rascunho") return <DraftSubscription />;
  let subscription = demo ? DEMO_SUBSCRIPTION : null;
  if (!demo) {
    const supabase = await createClient();
    const result = await supabase.from("subscriptions").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw new Error("Não foi possível carregar sua assinatura.");
    subscription = result.data;
  }

  if (!subscription) {
    return <div className="grid gap-6"><PageHeader description="Gerencie sua assinatura." eyebrow="Financeiro" title="Assinatura" /><EmptyState description="Ainda não encontramos uma assinatura vinculada a esta loja. Se o pagamento foi recente, aguarde alguns instantes." icon={ReceiptText} title="Assinatura em processamento" /></div>;
  }

  const state = subscriptionViewState({
    accessUntil: subscription.access_until,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    reconciliationStatus: subscription.cancellation_reconciliation_status,
    reactivationRequestedAt: subscription.reactivation_requested_at,
    status: subscription.status,
  });
  const valueVisible = state !== "ended";
  const situation = subscriptionSituation(state);
  const situationLabel = situation === "active" ? "Ativa" : situation === "cancelled" ? "Cancelada" : "Encerrada";
  const accessDateVisible = Boolean(subscription.access_until)
    && (state === "cancelling" || state === "cancelled_with_access" || state === "resuming");

  return (
    <div className="grid gap-6">
      <PageHeader description="Gerencie sua assinatura." eyebrow="Financeiro" title="Assinatura" />
      <Card>
        <CardContent className="grid gap-5 p-5 sm:grid-cols-3 sm:p-6">
          <div><p className="text-sm text-[var(--app-foreground-muted)]">Situação</p><Badge className="mt-2" variant={situation === "active" ? "success" : "neutral"}>{situationLabel}</Badge></div>
          {valueVisible ? <div><p className="flex items-center gap-2 text-sm text-[var(--app-foreground-muted)]"><CreditCard aria-hidden="true" className="size-4" />Valor mensal</p><p className="mt-2 text-lg font-semibold">{formatCurrency(Number(subscription.valor))}</p></div> : null}
          {state === "active" && subscription.next_due_date ? <div><p className="flex items-center gap-2 text-sm text-[var(--app-foreground-muted)]"><CalendarDays aria-hidden="true" className="size-4" />Próxima cobrança</p><p className="mt-2 font-semibold">{formatBillingDate(subscription.next_due_date)}</p></div> : null}
          {state === "active" && !subscription.next_due_date ? <div><p className="text-sm text-[var(--app-foreground-muted)]">Próxima cobrança</p><p className="mt-2 font-semibold">Data ainda não confirmada</p></div> : null}
          {accessDateVisible && subscription.access_until ? <div><p className="flex items-center gap-2 text-sm text-[var(--app-foreground-muted)]"><CalendarDays aria-hidden="true" className="size-4" />Acesso disponível até</p><p className="mt-2 font-semibold">{formatDate(lastPaidAccessInstant(subscription.access_until))}</p></div> : null}
        </CardContent>
      </Card>

      {/* Com overdue_since registrado, o aviso detalhado vem do layout do painel. */}
      {state === "past_due" && !subscription.overdue_since ? <Alert description="Existe uma cobrança pendente. Consulte-a para regularizar o pagamento; o cancelamento não apaga valores já devidos." title="Pagamento precisa de atenção" variant="warning" /> : null}
      <SubscriptionCancellation
        accessUntil={subscription.access_until}
        canCancel={Boolean(subscription.asaas_subscription_id)}
        canRevert={subscription.asaas_subscription_state !== "deleted"}
        demo={demo}
        price={Number(subscription.valor)}
        state={state}
        storeName={tenant.nome_loja}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {subscription.portal_url ? <a className="font-semibold text-brand-700 underline underline-offset-4" href={subscription.portal_url} rel="noreferrer" target="_blank">Ver cobrança no Asaas</a> : null}
        <Link className="text-[var(--app-foreground-muted)] underline underline-offset-4" href="/atendimento?assunto=cobranca&origem=assinatura">Precisa de ajuda?</Link>
      </div>
    </div>
  );
}
