-- Auditoria somente leitura da integridade dos endereços públicos.
--
-- Execute no SQL Editor do Supabase antes e depois da migration
-- 202609300023_restrict_tenant_slug_update.sql. Nenhuma consulta altera dados
-- e nenhuma retorna e-mail, WhatsApp ou outro dado pessoal: somente IDs
-- internos, slugs (que já são públicos) e datas.
--
-- Resultado esperado em um banco íntegro: a primeira consulta retorna false
-- depois da migration e as consultas 2 a 5 não retornam linhas. A consulta 6 é
-- apenas para revisão manual.

-- 1. Permissão direta de UPDATE no slug (deve ser false após a migration).
select
  has_column_privilege('authenticated', 'public.tenants', 'slug', 'UPDATE')
    as titular_altera_slug_diretamente;

-- 2. Loja usando um link antigo ainda protegido de outra loja.
select
  tenant.id as tenant_id,
  tenant.slug,
  history.tenant_id as dono_do_alias,
  history.redirect_until
from public.tenants as tenant
join public.tenant_slug_history as history
  on history.slug = tenant.slug
where history.tenant_id <> tenant.id
  and history.redirect_until > clock_timestamp();

-- 3. Loja usando um endereço reservado por cadastro de outra pessoa.
select
  tenant.id as tenant_id,
  tenant.slug,
  intent.id as signup_intent_id,
  intent.status as status_da_intencao,
  intent.created_at as reservado_em
from public.tenants as tenant
join public.signup_intents as intent
  on intent.slug = tenant.slug
where (
    intent.status = 'pendente'
    or (intent.status = 'pago' and intent.provisioned_tenant_id is null)
  )
  and intent.provisioned_tenant_id is distinct from tenant.id
  and intent.target_tenant_id is distinct from tenant.id;

-- 4. Pagamento confirmado sem loja provisionada (sintoma do conflito acima).
select
  intent.id as signup_intent_id,
  intent.slug,
  intent.intent_type,
  intent.created_at,
  intent.updated_at
from public.signup_intents as intent
where intent.status = 'pago'
  and intent.provisioned_tenant_id is null
order by intent.created_at;

-- 5. Webhooks presos por conflito de endereço.
select
  event.event_id,
  event.event_type,
  event.processing_error,
  event.attempts,
  event.received_at
from public.asaas_webhook_events as event
where event.processed_at is null
  and event.processing_error ilike '%slug%'
order by event.received_at;

-- 6. Revisão manual: lojas cujo endereço atual difere do contratado e que não
-- possuem nenhum registro de histórico. Pode ser legítimo quando o alias antigo
-- já expirou (30 dias) e foi removido; confira caso a caso.
select
  tenant.id as tenant_id,
  intent.slug as slug_contratado,
  tenant.slug as slug_atual,
  tenant.updated_at
from public.tenants as tenant
join public.signup_intents as intent
  on intent.provisioned_tenant_id = tenant.id
 and intent.intent_type = 'signup'
where intent.slug <> tenant.slug
  and not exists (
    select 1
    from public.tenant_slug_history as history
    where history.tenant_id = tenant.id
  )
order by tenant.updated_at desc;
