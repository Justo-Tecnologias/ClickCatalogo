-- ClickCatálogo — métricas diárias agregadas, sem PII e sem eventos brutos.
-- Execute após 202609100011_launch_recovery_and_reactivation.sql.

create table if not exists public.product_metrics_daily (
  metric_date date not null default current_date,
  event_name text not null,
  scope_key text not null default 'global',
  event_count bigint not null default 0,
  updated_at timestamptz not null default now(),

  primary key (metric_date, event_name, scope_key),
  constraint product_metrics_daily_event_check check (
    event_name in (
      'signup_started',
      'signup_step_completed',
      'checkout_created',
      'payment_confirmed',
      'password_created',
      'first_category_created',
      'first_product_created',
      'fifth_product_created',
      'catalog_shared',
      'catalog_view',
      'whatsapp_order_clicked',
      'cancellation_requested',
      'cancellation_reverted',
      'subscription_reactivated'
    )
  ),
  constraint product_metrics_daily_scope_check check (
    scope_key = 'global' or scope_key ~ '^[a-f0-9-]{36}$'
  ),
  constraint product_metrics_daily_count_check check (event_count >= 0)
);

alter table public.product_metrics_daily enable row level security;
revoke all on table public.product_metrics_daily from public, anon, authenticated;

create or replace function public.increment_product_metric(
  p_event_name text,
  p_tenant_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope_key text := coalesce(p_tenant_id::text, 'global');
begin
  if p_event_name not in (
    'signup_started',
    'signup_step_completed',
    'checkout_created',
    'payment_confirmed',
    'password_created',
    'first_category_created',
    'first_product_created',
    'fifth_product_created',
    'catalog_shared',
    'catalog_view',
    'whatsapp_order_clicked',
    'cancellation_requested',
    'cancellation_reverted',
    'subscription_reactivated'
  ) then
    raise exception 'unsupported metric';
  end if;

  if p_tenant_id is not null and not exists (
    select 1 from public.tenants where id = p_tenant_id
  ) then
    raise exception 'unknown tenant';
  end if;

  insert into public.product_metrics_daily (
    metric_date,
    event_name,
    scope_key,
    event_count,
    updated_at
  ) values (
    (clock_timestamp() at time zone 'America/Sao_Paulo')::date,
    p_event_name,
    v_scope_key,
    1,
    clock_timestamp()
  )
  on conflict (metric_date, event_name, scope_key)
  do update set
    event_count = public.product_metrics_daily.event_count + 1,
    updated_at = clock_timestamp();
end;
$$;

revoke all on function public.increment_product_metric(text, uuid)
  from public, anon, authenticated;
grant execute on function public.increment_product_metric(text, uuid)
  to service_role;

comment on table public.product_metrics_daily is
  'Contadores diários agregados de produto; não armazena IP, e-mail, telefone, texto livre ou eventos individuais.';

-- Incorpora a limpeza dos tokens efêmeros e das métricas agregadas à rotina
-- operacional que já é executada pelo operador.
create or replace function public.purge_expired_operational_records(
  p_now timestamptz default clock_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  rate_limit_count integer := 0;
  intent_count integer := 0;
  webhook_count integer := 0;
  request_count integer := 0;
  legal_record_count integer := 0;
  recovery_token_count integer := 0;
  product_metric_count integer := 0;
begin
  delete from public.api_rate_limits
  where reset_at < p_now - interval '1 day';
  get diagnostics rate_limit_count = row_count;

  delete from public.signup_recovery_tokens
  where expires_at < p_now - interval '1 day'
    or consumed_at < p_now - interval '1 day';
  get diagnostics recovery_token_count = row_count;

  delete from public.product_metrics_daily
  where metric_date < (p_now at time zone 'America/Sao_Paulo')::date - 400;
  get diagnostics product_metric_count = row_count;

  delete from public.signup_intents
  where provisioned_tenant_id is null
    and status in ('expirado', 'cancelado')
    and updated_at < p_now - interval '90 days';
  get diagnostics intent_count = row_count;

  delete from public.asaas_webhook_events
  where processed_at is not null
    and processing_error is null
    and processed_at < p_now - interval '180 days';
  get diagnostics webhook_count = row_count;

  delete from public.account_deletion_requests
  where status in ('concluido', 'cancelado')
    and coalesce(completed_at, canceled_at, updated_at) < p_now - interval '5 years';
  get diagnostics request_count = row_count;

  delete from public.legal_retention_records
  where retain_until <= p_now;
  get diagnostics legal_record_count = row_count;

  return jsonb_build_object(
    'api_rate_limits', rate_limit_count,
    'signup_recovery_tokens', recovery_token_count,
    'product_metrics_daily', product_metric_count,
    'signup_intents', intent_count,
    'asaas_webhook_events', webhook_count,
    'account_deletion_requests', request_count,
    'legal_retention_records', legal_record_count
  );
end;
$$;

revoke all on function public.purge_expired_operational_records(timestamptz)
  from public, anon, authenticated;
grant execute on function public.purge_expired_operational_records(timestamptz)
  to service_role;
