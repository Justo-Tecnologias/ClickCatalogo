-- ClickCatálogo — verificação somente leitura após executar schema.sql.
-- Este arquivo não cria nem altera dados.

select
  tablename,
  rowsecurity as rls_ativo
from pg_tables
where schemaname = 'public'
  and tablename in (
    'tenants',
    'categories',
    'products',
    'subscriptions',
    'signup_intents',
    'asaas_webhook_events',
    'api_rate_limits',
    'signup_recovery_tokens',
    'product_metrics_daily',
    'account_deletion_requests',
    'legal_retention_records'
  )
order by tablename;

select
  routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'expire_stale_signup_intents',
    'finalize_due_subscription_cancellations',
    'claim_subscription_cancellation_reconciliations',
    'consume_api_rate_limit',
    'email_has_tenant',
    'get_public_catalog',
    'get_public_store_status',
    'reorder_categories',
    'set_updated_at',
    'set_tenant_canceled_at',
    'archive_tenant_legal_record',
    'claim_asaas_webhook_event',
    'schedule_retention_deletions',
    'request_account_deletion',
    'withdraw_expedited_account_deletion',
    'claim_account_deletion_requests',
    'purge_expired_operational_records',
    'consume_signup_recovery_token',
    'increment_product_metric'
  )
order by routine_name;

select
  strpos(
    pg_get_functiondef('public.finalize_due_subscription_cancellations(timestamptz)'::regprocedure),
    'cancellation_reconciliation_status = ''complete'''
  ) > 0 as finalizacao_exige_conciliacao_completa;

select
  has_function_privilege(
    'service_role',
    'public.claim_subscription_cancellation_reconciliations(integer)',
    'EXECUTE'
  ) as service_role_pode_reservar_conciliacao,
  not has_function_privilege(
    'authenticated',
    'public.claim_subscription_cancellation_reconciliations(integer)',
    'EXECUTE'
  ) as usuario_nao_pode_reservar_conciliacao;

select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'produtos';

select
  column_name,
  is_nullable,
  column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'signup_intents' and column_name in ('terms_version', 'privacy_version'))
    or (table_name = 'tenants' and column_name = 'canceled_at')
    or (table_name = 'subscriptions' and column_name in (
      'cancel_at_period_end',
      'cancellation_requested_at',
      'access_until',
      'reactivation_requested_at',
      'asaas_subscription_state',
      'cancellation_reconciliation_status',
      'cancellation_reconciliation_checked_at'
    ))
    or (table_name = 'signup_intents' and column_name in (
      'intent_type',
      'target_tenant_id',
      'asaas_checkout_url',
      'asaas_checkout_expires_at'
    ))
  )
order by table_name, column_name;

select
  schemaname,
  tablename,
  policyname,
  roles,
  cmd
from pg_policies
where (schemaname = 'public' and tablename in (
  'tenants',
  'categories',
  'products',
  'subscriptions',
  'account_deletion_requests',
  'legal_retention_records',
  'signup_recovery_tokens',
  'product_metrics_daily'
))
or (schemaname = 'storage' and tablename = 'objects')
order by schemaname, tablename, policyname;

-- Executa a função distribuída dentro de uma transação revertida. Isso valida
-- o tipo dos campos e o caminho real de escrita sem deixar dados de teste.
begin;

select *
from public.consume_api_rate_limit(
  repeat('f', 64),
  2,
  60
);

rollback;
