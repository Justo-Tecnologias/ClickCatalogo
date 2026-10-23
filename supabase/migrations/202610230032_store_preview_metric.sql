-- "Sua loja em 10 segundos" (/exemplo): conta quem viu a prévia da própria
-- loja (store_preview_view), no funil geral e por canal (?origem=).
-- As listas devem ser iguais a productMetricNames e acquisitionMetricNames
-- (verificado por teste).
begin;

alter table public.product_metrics_daily
  drop constraint if exists product_metrics_daily_event_check;

alter table public.product_metrics_daily
  add constraint product_metrics_daily_event_check check (
    event_name in (
      'landing_view', 'how_it_works_view', 'store_preview_view',
      'signup_started', 'signup_step_completed', 'draft_created',
      'email_verified', 'checkout_created',
      'payment_confirmed', 'password_created', 'first_category_created',
      'first_product_created', 'fifth_product_created', 'catalog_shared',
      'catalog_view', 'whatsapp_order_clicked', 'store_brand_clicked',
      'cancellation_requested',
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
    'landing_view', 'how_it_works_view', 'store_preview_view',
    'signup_started', 'signup_step_completed', 'draft_created',
    'email_verified', 'checkout_created',
    'payment_confirmed', 'password_created', 'first_category_created',
    'first_product_created', 'fifth_product_created', 'catalog_shared',
    'catalog_view', 'whatsapp_order_clicked', 'store_brand_clicked',
      'cancellation_requested',
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

alter table public.acquisition_metrics_daily
  drop constraint if exists acquisition_metrics_daily_event_check;

alter table public.acquisition_metrics_daily
  add constraint acquisition_metrics_daily_event_check check (
    event_name in (
      'landing_view', 'how_it_works_view', 'store_preview_view', 'signup_started',
      'signup_step_completed', 'draft_created'
    )
  );

create or replace function public.increment_acquisition_metric(
  p_event_name text,
  p_origem text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_event_name not in (
    'landing_view', 'how_it_works_view', 'store_preview_view', 'signup_started',
    'signup_step_completed', 'draft_created'
  ) then
    raise exception 'unsupported metric';
  end if;

  if p_origem is null or p_origem !~ '^[a-z0-9-]{2,24}$' then
    raise exception 'invalid origin';
  end if;

  insert into public.acquisition_metrics_daily (
    metric_date, origem, event_name, event_count, updated_at
  ) values (
    (clock_timestamp() at time zone 'America/Sao_Paulo')::date,
    p_origem,
    p_event_name,
    1,
    clock_timestamp()
  )
  on conflict (metric_date, origem, event_name)
  do update set
    event_count = public.acquisition_metrics_daily.event_count + 1,
    updated_at = clock_timestamp();
end;
$$;

revoke all on function public.increment_acquisition_metric(text, text)
  from public, anon, authenticated;
grant execute on function public.increment_acquisition_metric(text, text)
  to service_role;

commit;

-- Conferência esperada: true, true.
select
  (select pg_get_constraintdef(oid) like '%store_preview_view%' from pg_constraint
    where conname = 'product_metrics_daily_event_check') as funil_geral,
  (select pg_get_constraintdef(oid) like '%store_preview_view%' from pg_constraint
    where conname = 'acquisition_metrics_daily_event_check') as por_canal;
