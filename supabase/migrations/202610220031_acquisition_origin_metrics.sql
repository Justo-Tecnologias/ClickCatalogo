-- Origem das visitas: links de divulgação com ?origem= (bio, post, dm...).
-- Contadores diários por canal das etapas de aquisição, sem dados pessoais.
-- Tabela separada de product_metrics_daily: o funil geral continua contando
-- cada ocorrência uma única vez; aqui fica só a parte que veio com origem.
-- A loja criada guarda o canal em tenants.origem_cadastro (rótulo, não PII).
-- A lista de eventos deve ser igual a acquisitionMetricNames (verificado por teste).
begin;

create table if not exists public.acquisition_metrics_daily (
  metric_date date not null,
  origem text not null,
  event_name text not null,
  event_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (metric_date, origem, event_name),
  constraint acquisition_metrics_daily_origem_check check (
    origem ~ '^[a-z0-9-]{2,24}$'
  ),
  constraint acquisition_metrics_daily_event_check check (
    event_name in (
      'landing_view', 'how_it_works_view', 'signup_started',
      'signup_step_completed', 'draft_created'
    )
  ),
  constraint acquisition_metrics_daily_count_check check (event_count >= 0)
);

alter table public.acquisition_metrics_daily enable row level security;
revoke all on table public.acquisition_metrics_daily from public, anon, authenticated;

alter table public.tenants
  add column if not exists origem_cadastro text;

alter table public.tenants
  drop constraint if exists tenants_origem_cadastro_check;

alter table public.tenants
  add constraint tenants_origem_cadastro_check check (
    origem_cadastro is null or origem_cadastro ~ '^[a-z0-9-]{2,24}$'
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
    'landing_view', 'how_it_works_view', 'signup_started',
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

-- Conferência esperada: true, true, true.
select
  to_regclass('public.acquisition_metrics_daily') is not null as tabela_por_origem,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tenants' and column_name = 'origem_cadastro'
  ) as origem_na_loja,
  not has_function_privilege('anon', 'public.increment_acquisition_metric(text, text)', 'execute')
    as funcao_fechada_ao_publico;
