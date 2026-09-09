"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import type { ActionResult } from "@/lib/actions/result";
import { requireTenant } from "@/lib/auth/session";
import { requestedDeletionDate } from "@/lib/privacy/retention";
import { createAdminClient } from "@/lib/supabase/admin";

const confirmationSchema = z.object({
  confirmation: z.string().trim().min(1).max(100),
});

type DeletionScheduleResult = {
  scheduledFor: string;
};

export async function requestAccountDeletionAction(
  input: unknown,
): Promise<ActionResult<DeletionScheduleResult>> {
  const parsed = confirmationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Digite o nome da loja para confirmar a solicitação.", ok: false };
  }

  try {
    const { demo, tenant } = await requireTenant();
    if (demo) {
      return { error: "A demonstração não possui dados reais para excluir.", ok: false };
    }
    if (parsed.data.confirmation !== tenant.nome_loja.trim()) {
      return { error: "O nome digitado não corresponde ao nome da sua loja.", ok: false };
    }
    if (tenant.status !== "cancelado" || !tenant.canceled_at) {
      return {
        error: "Cancele a assinatura antes de solicitar a exclusão dos dados da conta.",
        ok: false,
      };
    }

    const admin = createAdminClient();
    const now = new Date();
    const requested = requestedDeletionDate(now);
    const { data, error } = await admin.rpc("request_account_deletion", {
      p_owner_user_id: tenant.owner_user_id,
      p_scheduled_for: requested.toISOString(),
      p_tenant_id: tenant.id,
    });
    if (error?.code === "55000") {
      return { error: "A exclusão já está em processamento ou foi concluída.", ok: false };
    }
    if (error) throw error;
    if (!data?.scheduled_for) throw new Error("A função não devolveu a data agendada.");

    revalidatePath("/painel/privacidade");
    return { data: { scheduledFor: data.scheduled_for }, ok: true };
  } catch (error) {
    console.error("Falha ao agendar exclusão da conta:", error instanceof Error ? error.message : "erro desconhecido");
    return { error: "Não foi possível agendar a exclusão. Tente novamente.", ok: false };
  }
}

export async function withdrawExpeditedDeletionAction(): Promise<ActionResult<DeletionScheduleResult>> {
  try {
    const { demo, tenant } = await requireTenant();
    if (demo) {
      return { error: "A demonstração não possui dados reais para excluir.", ok: false };
    }
    if (tenant.status !== "cancelado" || !tenant.canceled_at) {
      return { error: "Esta loja não está cancelada.", ok: false };
    }

    const admin = createAdminClient();
    const { data, error } = await admin.rpc("withdraw_expedited_account_deletion", {
      p_owner_user_id: tenant.owner_user_id,
      p_tenant_id: tenant.id,
    });
    if (error?.code === "55000") {
      return { error: "O prazo padrão terminou ou a exclusão já começou.", ok: false };
    }
    if (error) throw error;
    if (!data?.scheduled_for) throw new Error("A função não devolveu a data agendada.");

    revalidatePath("/painel/privacidade");
    return { data: { scheduledFor: data.scheduled_for }, ok: true };
  } catch (error) {
    console.error("Falha ao retirar solicitação antecipada:", error instanceof Error ? error.message : "erro desconhecido");
    return { error: "Não foi possível atualizar a solicitação. Tente novamente.", ok: false };
  }
}
