import { draftReminderEmail } from "../../src/lib/signup/draft-emails.mjs";

// Ciclo de vida das lojas em rascunho (cadastro gratuito, docs/PLANO-MONTA-GRATIS.md):
// lembretes dos dias 1, 3 e 7 e exclusão após 30 dias sem acesso ao painel.
// Função separada da rotina de cobrança para ter o próprio limite de 30 s.
const REQUEST_TIMEOUT_MS = 3_000;
const REMINDER_LIMIT = 20;
const REMINDER_TIME_BUDGET_MS = 12_000;
const DELETION_LIMIT = 5;
const DELETION_TIME_BUDGET_MS = 12_000;
const STORAGE_BUCKET = "produtos";

function requireEnvironment() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim().replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceRoleKey) throw new Error("Supabase não configurado para o ciclo de rascunhos.");
  const resendApiKey = process.env.RESEND_API_KEY?.trim();
  const resendFrom = process.env.RESEND_FROM_EMAIL?.trim();
  return {
    resend: resendApiKey && resendFrom ? { apiKey: resendApiKey, from: resendFrom } : null,
    serviceRoleKey,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || "https://clickcatalogo.com",
    supabaseUrl,
  };
}

async function supabaseFetch(env, path, init = {}) {
  return fetch(`${env.supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: env.serviceRoleKey,
      Authorization: `Bearer ${env.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

async function sendResendEmail(env, { html, idempotencyKey, subject, to }) {
  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({ from: env.resend.from, html, subject, to: [to] }),
    headers: {
      Authorization: `Bearer ${env.resend.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`Resend recusou o envio (${response.status}).`);
}

async function updateTenant(env, tenantId, values) {
  const response = await supabaseFetch(env, `/rest/v1/tenants?id=eq.${tenantId}&status=eq.rascunho`, {
    body: JSON.stringify(values),
    method: "PATCH",
  });
  if (!response.ok) throw new Error(`Falha ao atualizar rascunho (${response.status}).`);
}

export async function sendDraftReminders(env) {
  if (!env.resend) {
    console.error(JSON.stringify({ event: "draft.reminder.skipped", reason: "resend_not_configured" }));
    return { skipped: "resend_not_configured" };
  }

  const startedAt = Date.now();
  const deadline = startedAt + REMINDER_TIME_BUDGET_MS;
  const claim = await supabaseFetch(env, "/rest/v1/rpc/claim_draft_reminders", {
    body: JSON.stringify({ p_limit: REMINDER_LIMIT }),
    method: "POST",
  });
  if (!claim.ok) throw new Error(`Falha ao reservar lembretes (${claim.status}).`);
  const rows = await claim.json();
  if (!Array.isArray(rows)) throw new Error("Reserva de lembretes inválida.");

  const result = { failed: 0, released: 0, sent: 0 };
  for (const row of rows) {
    if (Date.now() + REQUEST_TIMEOUT_MS * 2 >= deadline) {
      // Sem tempo para enviar: libera a reserva para a próxima execução.
      await updateTenant(env, row.tenant_id, { draft_reminder_claimed_at: null }).catch(() => undefined);
      result.released += 1;
      continue;
    }
    try {
      const email = draftReminderEmail({
        day: row.reminder_day,
        optOutUrl: `${env.siteUrl}/lembretes/parar#t=${row.lembretes_token}`,
        productCount: row.product_count,
        siteUrl: env.siteUrl,
        storeName: row.nome_loja,
      });
      await sendResendEmail(env, {
        ...email,
        idempotencyKey: `draft-reminder-${row.tenant_id}-${row.reminder_day}`,
        to: row.owner_email,
      });
      await updateTenant(env, row.tenant_id, {
        draft_reminder_claimed_at: null,
        draft_reminder_last_day: row.reminder_day,
      });
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      console.error(JSON.stringify({
        event: "draft.reminder.failed",
        reason: error instanceof Error ? error.message : "Falha desconhecida.",
        reminder_day: row.reminder_day,
        tenant_id: row.tenant_id,
      }));
      await updateTenant(env, row.tenant_id, { draft_reminder_claimed_at: null }).catch(() => undefined);
    }
  }

  return { ...result, duration_ms: Date.now() - startedAt };
}

async function removeStorageFolder(env, tenantId) {
  const list = await supabaseFetch(env, `/storage/v1/object/list/${STORAGE_BUCKET}`, {
    body: JSON.stringify({ limit: 1000, prefix: `${tenantId}/` }),
    method: "POST",
  });
  if (!list.ok) throw new Error(`Falha ao listar fotos (${list.status}).`);
  const objects = await list.json();
  const paths = Array.isArray(objects)
    ? objects.filter((object) => object?.name).map((object) => `${tenantId}/${object.name}`)
    : [];
  if (paths.length === 0) return 0;
  const removed = await supabaseFetch(env, `/storage/v1/object/${STORAGE_BUCKET}`, {
    body: JSON.stringify({ prefixes: paths }),
    method: "DELETE",
  });
  if (!removed.ok) throw new Error(`Falha ao remover fotos (${removed.status}).`);
  return paths.length;
}

export async function deleteStaleDrafts(env) {
  const startedAt = Date.now();
  const deadline = startedAt + DELETION_TIME_BUDGET_MS;
  const claim = await supabaseFetch(env, "/rest/v1/rpc/claim_stale_drafts", {
    body: JSON.stringify({ p_limit: DELETION_LIMIT }),
    method: "POST",
  });
  if (!claim.ok) throw new Error(`Falha ao reservar rascunhos parados (${claim.status}).`);
  const rows = await claim.json();
  if (!Array.isArray(rows)) throw new Error("Reserva de rascunhos inválida.");

  const result = { deleted: 0, failed: 0, photos: 0, postponed: 0 };
  for (const row of rows) {
    // Cada exclusão usa até 4 chamadas; o que não couber volta na próxima hora.
    if (Date.now() + REQUEST_TIMEOUT_MS * 4 >= deadline) {
      result.postponed += 1;
      continue;
    }
    try {
      result.photos += await removeStorageFolder(env, row.tenant_id);
      const deletion = await supabaseFetch(env, "/rest/v1/rpc/delete_stale_draft", {
        body: JSON.stringify({ p_tenant_id: row.tenant_id }),
        method: "POST",
      });
      if (!deletion.ok) throw new Error(`Falha ao excluir rascunho (${deletion.status}).`);
      const ownerUserId = await deletion.json();
      // null: o titular voltou ao painel depois da reserva; nada é apagado.
      if (!ownerUserId) continue;
      const authDeletion = await supabaseFetch(env, `/auth/v1/admin/users/${ownerUserId}`, { method: "DELETE" });
      if (!authDeletion.ok && authDeletion.status !== 404) {
        // A loja já foi apagada; um usuário do Auth sem loja é reaproveitado
        // num novo cadastro com o mesmo e-mail.
        console.error(JSON.stringify({ event: "draft.deletion.auth_user_kept", status: authDeletion.status }));
      }
      result.deleted += 1;
    } catch (error) {
      result.failed += 1;
      console.error(JSON.stringify({
        event: "draft.deletion.failed",
        reason: error instanceof Error ? error.message : "Falha desconhecida.",
        tenant_id: row.tenant_id,
      }));
    }
  }

  return { ...result, duration_ms: Date.now() - startedAt };
}

async function purgeOldVerificationTokens(env) {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const response = await supabaseFetch(env, `/rest/v1/email_verification_tokens?expires_at=lt.${encodeURIComponent(cutoff)}`, {
    headers: { Prefer: "return=minimal" },
    method: "DELETE",
  });
  return response.ok ? "ok" : `failed_${response.status}`;
}

export default async function draftLifecycle() {
  const env = requireEnvironment();
  const reminders = await sendDraftReminders(env).catch((error) => ({ error: error instanceof Error ? error.message : "Falha desconhecida." }));
  const deletions = await deleteStaleDrafts(env).catch((error) => ({ error: error instanceof Error ? error.message : "Falha desconhecida." }));
  const verificationTokens = await purgeOldVerificationTokens(env).catch(() => "failed");
  console.log(JSON.stringify({ deletions, ranAt: new Date().toISOString(), reminders, verificationTokens }));
}

export const config = {
  schedule: "45 * * * *",
};
