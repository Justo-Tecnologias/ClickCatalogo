-- Funil de aquisição: visitas à landing e a /como-funciona antes do cadastro.
-- Continua sendo contador diário agregado, sem PII, sem cookies e sem IP.
-- A lista de eventos deve ser igual a productMetricNames em
-- src/lib/analytics/events.ts (verificado por teste).
begin;

alter table public.product_metrics_daily
  drop constraint if exists product_metrics_daily_event_check;

alter table public.product_metrics_daily
  add constraint product_metrics_daily_event_check check (
    event_name in (
      'landing_view', 'how_it_works_view',
      'signup_started', 'signup_step_completed', 'checkout_created',
      'payment_confirmed', 'password_created', 'first_category_created',
      'first_product_created', 'fifth_product_created', 'catalog_shared',
      'catalog_view', 'whatsapp_order_clicked', 'cancellation_requested',
      'cancellation_reverted', 'subscription_reactivated'
    )
  );

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
    'landing_view', 'how_it_works_view',
    'signup_started', 'signup_step_completed', 'checkout_created',
    'payment_confirmed', 'password_created', 'first_category_created',
    'first_product_created', 'fifth_product_created', 'catalog_shared',
    'catalog_view', 'whatsapp_order_clicked', 'cancellation_requested',
    'cancellation_reverted', 'subscription_reactivated'
  ) then
    raise exception 'unsupported metric';
  end if;

  if p_tenant_id is not null and not exists (
    select 1 from public.tenants where id = p_tenant_id
  ) then
    raise exception 'unknown tenant';
  end if;

  insert into public.product_metrics_daily (
    metric_date, event_name, scope_key, event_count, updated_at
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

commit;

-- Conferência esperada: true (evento novo aceito) e false (titular sem acesso).
select
  pg_get_constraintdef(oid) like '%how_it_works_view%' as funil_aceita_eventos_novos
from pg_constraint
where conname = 'product_metrics_daily_event_check';

select has_function_privilege('authenticated', 'public.increment_product_metric(text, uuid)', 'EXECUTE')
  as titular_incrementa_metrica;
