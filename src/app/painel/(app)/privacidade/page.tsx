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

  if (!demo) {
    const supabase = await createClient();
    const result = await supabase
      .from("account_deletion_requests")
      .select("scheduled_for,source,status")
      .eq("tenant_id_original", tenant.id)
      .maybeSingle();
    if (result.error) throw new Error("Não foi possível carregar as configurações de privacidade.");
    request = result.data
      ? {
          scheduledFor: result.data.scheduled_for,
          source: result.data.source,
          status: result.data.status,
        }
      : null;
  }

  return (
    <div className="grid gap-7">
      <PageHeader
        description="Acompanhe os prazos de retenção e exerça seus direitos sobre os dados da conta."
        eyebrow="Segurança e controle"
        title="Privacidade e dados"
      />
      <DataPrivacyManagement
        canceledAt={tenant.canceled_at}
        defaultScheduledFor={tenant.canceled_at ? defaultDeletionDate(tenant.canceled_at).toISOString() : null}
        demo={demo}
        request={request}
        storeName={tenant.nome_loja}
        supportEmail={supportEmail}
        tenantStatus={tenant.status}
      />
    </div>
  );
}
