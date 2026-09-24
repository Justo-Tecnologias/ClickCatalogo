import type { Metadata } from "next";

import { DataPrivacyManagement } from "@/components/painel/data-privacy-management";
import { PageHeader } from "@/components/ui/page-header";
import { requireTenant } from "@/lib/auth/session";
import { getLegalIdentity } from "@/lib/legal/identity";
import { defaultDeletionDate } from "@/lib/privacy/retention";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Privacidade e dados" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const { demo, tenant } = await requireTenant();
  const { supportEmail } = getLegalIdentity();
  let request = null;
  let scheduledAccessUntil: string | null = null;
  let cancellationScheduled = false;
  let cancellationReconciliationComplete = false;

  if (!demo) {
    const supabase = await createClient();
    const [deletionResult, subscriptionResult] = await Promise.all([
      supabase.from("account_deletion_requests")
        .select("scheduled_for,source,status")
        .eq("tenant_id_original", tenant.id)
        .maybeSingle(),
      supabase.from("subscriptions")
        .select("access_until,cancel_at_period_end,cancellation_reconciliation_status")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (deletionResult.error || subscriptionResult.error) throw new Error("Não foi possível carregar as configurações de privacidade.");
    request = deletionResult.data
      ? {
          scheduledFor: deletionResult.data.scheduled_for,
          source: deletionResult.data.source,
          status: deletionResult.data.status,
        }
      : null;
    cancellationScheduled = Boolean(subscriptionResult.data?.cancel_at_period_end);
    scheduledAccessUntil = subscriptionResult.data?.access_until ?? null;
    cancellationReconciliationComplete = subscriptionResult.data?.cancellation_reconciliation_status === "complete";
  }

  return (
    <div className="grid gap-7">
      <PageHeader
        description="Consulte as regras de retenção, as datas da sua conta quando disponíveis e seus direitos sobre os dados."
        eyebrow="Segurança e controle"
        title="Privacidade e dados"
      />
      <DataPrivacyManagement
        canceledAt={tenant.canceled_at}
        cancellationScheduled={cancellationScheduled}
        cancellationReconciliationComplete={cancellationReconciliationComplete}
        defaultScheduledFor={tenant.canceled_at ? defaultDeletionDate(tenant.canceled_at).toISOString() : null}
        demo={demo}
        request={request}
        scheduledAccessUntil={scheduledAccessUntil}
        storeName={tenant.nome_loja}
        supportEmail={supportEmail}
        tenantStatus={tenant.status}
      />
    </div>
  );
}
