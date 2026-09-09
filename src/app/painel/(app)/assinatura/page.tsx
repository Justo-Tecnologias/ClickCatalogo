import { CalendarDays, CreditCard, ExternalLink, ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { SubscriptionCancellation } from "@/components/painel/subscription-cancellation";
import { requireTenant } from "@/lib/auth/session";
import { DEMO_SUBSCRIPTION } from "@/lib/demo/panel-demo";
import { formatCurrency } from "@/lib/format/currency";
import { getLegalIdentity } from "@/lib/legal/identity";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Assinatura" };
export const dynamic = "force-dynamic";

export default async function SubscriptionPage() {
  const { demo, tenant } = await requireTenant();
  const { supportEmail } = getLegalIdentity();
  let subscription = demo ? DEMO_SUBSCRIPTION : null;
  if (!demo) {
    const supabase = await createClient();
    const result = await supabase.from("subscriptions").select("*").eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (result.error) throw new Error("Não foi possível carregar sua assinatura.");
    subscription = result.data;
  }

  return (
    <div className="grid gap-7">
      <PageHeader description="Acompanhe o plano, a próxima cobrança e os dados de pagamento." eyebrow="Financeiro" title="Assinatura" />
      {!subscription ? <EmptyState description="Ainda não encontramos uma assinatura vinculada a esta loja. Se o pagamento foi recente, aguarde alguns instantes." icon={ReceiptText} title="Assinatura em processamento" /> : (
        <div className="grid gap-5">
          {subscription.status === "atrasado" ? <Alert description="Sua loja continua visível, mas regularize a cobrança para evitar a suspensão." title="Pagamento pendente" variant="warning" /> : null}
          <Card><CardContent className="grid gap-6 p-6 sm:grid-cols-3">
            <div><p className="text-sm text-[var(--app-foreground-muted)]">Status</p><Badge className="mt-2" variant={subscription.status === "ativo" ? "success" : subscription.status === "atrasado" ? "warning" : "danger"}>{subscription.status}</Badge></div>
            <div><p className="flex items-center gap-2 text-sm text-[var(--app-foreground-muted)]"><CreditCard aria-hidden="true" className="size-4" />Valor mensal</p><p className="mt-2 text-xl font-bold">{formatCurrency(Number(subscription.valor))}</p></div>
            <div><p className="flex items-center gap-2 text-sm text-[var(--app-foreground-muted)]"><CalendarDays aria-hidden="true" className="size-4" />Próxima cobrança</p><p className="mt-2 font-semibold">{subscription.status === "cancelado" ? "Cobrança encerrada" : subscription.next_due_date ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(new Date(`${subscription.next_due_date}T12:00:00Z`)) : "A confirmar"}</p></div>
          </CardContent></Card>
          <SubscriptionCancellation
            canCancel={Boolean(subscription.asaas_subscription_id)}
            demo={demo}
            initialCancelled={subscription.status === "cancelado"}
            storeName={tenant.nome_loja}
          />
          {subscription.portal_url ? <div><Link className={buttonVariants()} href={subscription.portal_url} rel="noreferrer" target="_blank"><ExternalLink aria-hidden="true" />{subscription.status === "cancelado" ? "Ver última cobrança no Asaas" : "Ver cobrança no Asaas"}</Link></div> : subscription.status !== "cancelado" ? <Alert description="O link da cobrança aparecerá aqui quando for enviado pelo Asaas." title="Cobrança ainda sem link" /> : null}
          {supportEmail && !demo ? (
            <Alert
              description={(
                <span>
                  Para dúvidas sobre cobrança ou para solicitar acesso, correção ou exclusão de dados, escreva para{" "}
                  <a className="font-semibold underline underline-offset-4" href={`mailto:${supportEmail}?subject=Atendimento%20ClickCat%C3%A1logo`}>
                    {supportEmail}
                  </a>.
                </span>
              )}
              title="Atendimento e privacidade"
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
