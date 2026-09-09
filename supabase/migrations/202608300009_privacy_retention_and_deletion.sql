-- ClickCatálogo — retenção, solicitações de exclusão e expurgo auditável.
-- Execute no SQL Editor depois da migration 202608300008.

begin;

-- O hardening criou um índice único com a mesma primeira coluna. O índice
-- simples antigo passou a ser redundante e só aumentaria o custo de escrita.
drop index if exists public.tenants_owner_user_id_idx;

alter table public.tenants
  add column if not exists canceled_at timestamptz;

alter table public.asaas_webhook_events
  add column if not exists processing_started_at timestamptz;

update public.asaas_webhook_events
set processing_started_at = received_at
where processing_started_at is null;

alter table public.asaas_webhook_events
  alter column processing_started_at set default now(),
  alter column processing_started_at set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'asaas_webhook_events_id_length_check'
      and conrelid = 'public.asaas_webhook_events'::regclass
  ) then
    alter table public.asaas_webhook_events
      add constraint asaas_webhook_events_id_length_check
      check (char_length(event_id) between 1 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'asaas_webhook_events_type_length_check'
      and conrelid = 'public.asaas_webhook_events'::regclass
  ) then
    alter table public.asaas_webhook_events
      add constraint asaas_webhook_events_type_length_check
      check (char_length(event_type) between 1 and 100);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'asaas_webhook_events_error_length_check'
      and conrelid = 'public.asaas_webhook_events'::regclass
  ) then
    alter table public.asaas_webhook_events
      add constraint asaas_webhook_events_error_length_check
      check (processing_error is null or char_length(processing_error) <= 500);
  end if;
end;
$$;

update public.tenants
set canceled_at = coalesce(canceled_at, updated_at)
where status = 'cancelado'
  and canceled_at is null;

create or replace function public.set_tenant_canceled_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelado' then
    new.canceled_at = coalesce(new.canceled_at, old.canceled_at, clock_timestamp());
  else
    -- Impede que uma loja reativada seja elegível para expurgo por engano.
    new.canceled_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists tenants_set_canceled_at on public.tenants;
create trigger tenants_set_canceled_at
before update of status, canceled_at on public.tenants
for each row execute function public.set_tenant_canceled_at();

create table if not exists public.account_deletion_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid unique references public.tenants(id) on delete set null,
  tenant_id_original uuid not null unique,
  owner_user_id uuid not null,
  source text not null default 'titular',
  status text not null default 'agendado',
  requested_at timestamptz not null default now(),
  expedited_at timestamptz,
  expedited_withdrawn_at timestamptz,
  scheduled_for timestamptz not null,
  processing_started_at timestamptz,
  completed_at timestamptz,
  canceled_at timestamptz,
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint account_deletion_requests_source_check check (
    source in ('titular', 'retencao')
  ),
  constraint account_deletion_requests_status_check check (
    status in ('agendado', 'processando', 'concluido', 'cancelado', 'falhou')
  ),
  constraint account_deletion_requests_attempts_check check (
    attempts between 0 and 20
  ),
  constraint account_deletion_requests_error_length_check check (
    last_error is null or char_length(last_error) <= 500
  )
);

create index if not exists account_deletion_requests_due_idx
  on public.account_deletion_requests (scheduled_for, attempts)
  where status in ('agendado', 'falhou');

create index if not exists account_deletion_requests_owner_idx
  on public.account_deletion_requests (owner_user_id, requested_at desc);

drop trigger if exists account_deletion_requests_set_updated_at
  on public.account_deletion_requests;
create trigger account_deletion_requests_set_updated_at
before update on public.account_deletion_requests
for each row execute function public.set_updated_at();

-- Contém apenas evidências mínimas de contratação, aceite e cobrança.
-- Dados de catálogo, contato, imagens e credenciais nunca entram nesta tabela.
create table if not exists public.legal_retention_records (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id_original uuid not null unique,
  owner_user_id uuid not null,
  signup_external_reference uuid,
  asaas_customer_id text,
  asaas_subscription_id text,
  subscription_value numeric(10, 2),
  subscription_status text,
  terms_version text,
  terms_accepted_at timestamptz,
  privacy_version text,
  privacy_accepted_at timestamptz,
  service_started_at timestamptz not null,
  service_canceled_at timestamptz not null,
  archived_at timestamptz not null default now(),
  retain_until timestamptz not null,

  constraint legal_retention_subscription_value_check check (
    subscription_value is null or subscription_value > 0
  ),
  constraint legal_retention_subscription_status_check check (
    subscription_status is null or subscription_status in ('ativo', 'atrasado', 'cancelado')
  ),
  constraint legal_retention_period_check check (
    retain_until >= service_canceled_at
  )
);

create index if not exists legal_retention_records_expiry_idx
  on public.legal_retention_records (retain_until);

alter table public.account_deletion_requests enable row level security;
alter table public.legal_retention_records enable row level security;

revoke all on table public.account_deletion_requests from anon, authenticated;
revoke all on table public.legal_retention_records from anon, authenticated;
grant select (
  id,
  tenant_id_original,
  source,
  status,
  requested_at,
  expedited_at,
  expedited_withdrawn_at,
  scheduled_for,
  completed_at,
  canceled_at,
  created_at,
  updated_at
) on table public.account_deletion_requests to authenticated;

drop policy if exists account_deletion_requests_select_own
  on public.account_deletion_requests;
create policy account_deletion_requests_select_own
on public.account_deletion_requests
for select
to authenticated
using (owner_user_id = (select auth.uid()));

create or replace function public.archive_tenant_legal_record(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants%rowtype;
  v_subscription public.subscriptions%rowtype;
  v_intent public.signup_intents%rowtype;
  v_record_id uuid;
begin
  select *
  into v_tenant
  from public.tenants
  where id = p_tenant_id;

  if not found then
    raise exception 'Tenant não encontrado para arquivamento.' using errcode = 'P0002';
  end if;

  if v_tenant.status <> 'cancelado' or v_tenant.canceled_at is null then
    raise exception 'Somente tenants cancelados podem ser arquivados.' using errcode = '22023';
  end if;

  select *
  into v_subscription
  from public.subscriptions
  where tenant_id = p_tenant_id
  order by created_at desc
  limit 1;

  select *
  into v_intent
  from public.signup_intents
  where provisioned_tenant_id = p_tenant_id
  order by created_at desc
  limit 1;

  insert into public.legal_retention_records (
    tenant_id_original,
    owner_user_id,
    signup_external_reference,
    asaas_customer_id,
    asaas_subscription_id,
    subscription_value,
    subscription_status,
    terms_version,
    terms_accepted_at,
    privacy_version,
    privacy_accepted_at,
    service_started_at,
    service_canceled_at,
    archived_at,
    retain_until
  ) values (
    v_tenant.id,
    v_tenant.owner_user_id,
    v_intent.external_reference,
    coalesce(v_subscription.asaas_customer_id, v_intent.asaas_customer_id),
    coalesce(v_subscription.asaas_subscription_id, v_intent.asaas_subscription_id),
    v_subscription.valor,
    v_subscription.status,
    v_intent.terms_version,
    v_intent.terms_accepted_at,
    v_intent.privacy_version,
    v_intent.privacy_accepted_at,
    v_tenant.created_at,
    v_tenant.canceled_at,
    clock_timestamp(),
    greatest(v_tenant.canceled_at, clock_timestamp()) + interval '5 years'
  )
  on conflict (tenant_id_original) do update
  set
    owner_user_id = excluded.owner_user_id,
    signup_external_reference = excluded.signup_external_reference,
    asaas_customer_id = excluded.asaas_customer_id,
    asaas_subscription_id = excluded.asaas_subscription_id,
    subscription_value = excluded.subscription_value,
    subscription_status = excluded.subscription_status,
    terms_version = excluded.terms_version,
    terms_accepted_at = excluded.terms_accepted_at,
    privacy_version = excluded.privacy_version,
    privacy_accepted_at = excluded.privacy_accepted_at,
    service_started_at = excluded.service_started_at,
    service_canceled_at = excluded.service_canceled_at,
    archived_at = excluded.archived_at,
    retain_until = excluded.retain_until
  returning id into v_record_id;

  return v_record_id;
end;
$$;

create or replace function public.claim_asaas_webhook_event(
  p_event_id text,
  p_event_type text,
  p_payload jsonb,
  p_stale_seconds integer default 300
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.asaas_webhook_events%rowtype;
  v_inserted integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  if p_event_id is null or char_length(p_event_id) not between 1 and 200
    or p_event_type is null or char_length(p_event_type) not between 1 and 100
    or p_payload is null
    or p_stale_seconds not between 30 and 3600 then
    raise exception 'Evento de webhook inválido.' using errcode = '22023';
  end if;

  insert into public.asaas_webhook_events (
    event_id,
    event_type,
    payload,
    attempts,
    received_at,
    processing_started_at
  ) values (
    p_event_id,
    p_event_type,
    p_payload,
    1,
    v_now,
    v_now
  )
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 1 then
    return 'claimed';
  end if;

  select * into v_event
  from public.asaas_webhook_events
  where event_id = p_event_id
  for update;

  if not found then
    raise exception 'Evento não encontrado depois do conflito.' using errcode = 'P0002';
  end if;
  if v_event.event_type <> p_event_type then
    raise exception 'O identificador já pertence a outro tipo de evento.' using errcode = '22023';
  end if;
  if v_event.processed_at is not null then
    return 'repeated';
  end if;
  if v_event.processing_error is null
    and v_event.processing_started_at > v_now - make_interval(secs => p_stale_seconds) then
    return 'processing';
  end if;

  update public.asaas_webhook_events
  set
    attempts = attempts + 1,
    processing_error = null,
    processing_started_at = v_now
  where event_id = p_event_id;

  return 'claimed';
end;
$$;

create or replace function public.schedule_retention_deletions(
  p_now timestamptz default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  scheduled_count integer;
begin
  insert into public.account_deletion_requests (
    tenant_id,
    tenant_id_original,
    owner_user_id,
    source,
    status,
    requested_at,
    scheduled_for
  )
  select
    tenant.id,
    tenant.id,
    tenant.owner_user_id,
    'retencao',
    'agendado',
    p_now,
    tenant.canceled_at + interval '30 days'
  from public.tenants as tenant
  where tenant.status = 'cancelado'
    and tenant.canceled_at is not null
    and tenant.canceled_at <= p_now - interval '30 days'
  on conflict (tenant_id_original) do nothing;

  get diagnostics scheduled_count = row_count;
  return scheduled_count;
end;
$$;

create or replace function public.request_account_deletion(
  p_tenant_id uuid,
  p_owner_user_id uuid,
  p_scheduled_for timestamptz
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants%rowtype;
  v_request public.account_deletion_requests%rowtype;
  v_now timestamptz := clock_timestamp();
  v_scheduled_for timestamptz;
begin
  select * into v_tenant
  from public.tenants
  where id = p_tenant_id
  for update;

  if not found or v_tenant.owner_user_id <> p_owner_user_id then
    raise exception 'Tenant não autorizado.' using errcode = '42501';
  end if;
  if v_tenant.status <> 'cancelado' or v_tenant.canceled_at is null then
    raise exception 'A assinatura precisa estar cancelada.' using errcode = '22023';
  end if;
  if p_scheduled_for is null then
    raise exception 'Data de exclusão inválida.' using errcode = '22023';
  end if;

  v_scheduled_for := greatest(
    v_now,
    least(
      p_scheduled_for,
      v_now + interval '15 days',
      v_tenant.canceled_at + interval '30 days'
    )
  );

  insert into public.account_deletion_requests (
    tenant_id,
    tenant_id_original,
    owner_user_id,
    source,
    status,
    requested_at,
    expedited_at,
    expedited_withdrawn_at,
    scheduled_for
  ) values (
    v_tenant.id,
    v_tenant.id,
    v_tenant.owner_user_id,
    'titular',
    'agendado',
    v_now,
    v_now,
    null,
    v_scheduled_for
  )
  on conflict (tenant_id_original) do update
  set
    tenant_id = excluded.tenant_id,
    owner_user_id = excluded.owner_user_id,
    source = 'titular',
    status = 'agendado',
    requested_at = v_now,
    expedited_at = v_now,
    expedited_withdrawn_at = null,
    scheduled_for = v_scheduled_for,
    processing_started_at = null,
    completed_at = null,
    canceled_at = null,
    attempts = 0,
    last_error = null
  where account_deletion_requests.status in ('agendado', 'falhou', 'cancelado')
  returning * into v_request;

  if not found then
    raise exception 'A exclusão já está em processamento ou concluída.' using errcode = '55000';
  end if;

  return v_request;
end;
$$;

create or replace function public.withdraw_expedited_account_deletion(
  p_tenant_id uuid,
  p_owner_user_id uuid
)
returns public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant public.tenants%rowtype;
  v_request public.account_deletion_requests%rowtype;
  v_now timestamptz := clock_timestamp();
  v_default_date timestamptz;
begin
  select * into v_tenant
  from public.tenants
  where id = p_tenant_id
  for update;

  if not found or v_tenant.owner_user_id <> p_owner_user_id then
    raise exception 'Tenant não autorizado.' using errcode = '42501';
  end if;
  if v_tenant.status <> 'cancelado' or v_tenant.canceled_at is null then
    raise exception 'A loja não está cancelada.' using errcode = '22023';
  end if;

  v_default_date := v_tenant.canceled_at + interval '30 days';
  if v_default_date <= v_now then
    raise exception 'O prazo padrão de retenção já terminou.' using errcode = '55000';
  end if;

  update public.account_deletion_requests
  set
    source = 'retencao',
    status = 'agendado',
    expedited_withdrawn_at = v_now,
    scheduled_for = v_default_date,
    processing_started_at = null,
    attempts = 0,
    last_error = null
  where tenant_id_original = v_tenant.id
    and owner_user_id = v_tenant.owner_user_id
    and source = 'titular'
    and status in ('agendado', 'falhou')
  returning * into v_request;

  if not found then
    raise exception 'Não existe solicitação antecipada que possa ser retirada.' using errcode = '55000';
  end if;

  return v_request;
end;
$$;

create or replace function public.claim_account_deletion_requests(
  p_limit integer default 10
)
returns setof public.account_deletion_requests
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 50 then
    raise exception 'Limite de processamento inválido.' using errcode = '22023';
  end if;

  -- Recupera um job abandonado por timeout ou encerramento da Function.
  -- O intervalo é muito maior que o tempo esperado para um lote normal.
  update public.account_deletion_requests
  set
    status = 'falhou',
    processing_started_at = null,
    scheduled_for = clock_timestamp(),
    last_error = 'Processamento anterior interrompido antes da conclusão.'
  where status = 'processando'
    and processing_started_at < clock_timestamp() - interval '30 minutes';

  return query
  with due as (
    select request.id
    from public.account_deletion_requests as request
    where request.status in ('agendado', 'falhou')
      and request.scheduled_for <= clock_timestamp()
      and request.attempts < 5
    order by request.scheduled_for, request.created_at
    for update skip locked
    limit p_limit
  )
  update public.account_deletion_requests as request
  set
    status = 'processando',
    processing_started_at = clock_timestamp(),
    attempts = request.attempts + 1,
    last_error = null
  from due
  where request.id = due.id
  returning request.*;
end;
$$;

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
begin
  delete from public.api_rate_limits
  where reset_at < p_now - interval '1 day';
  get diagnostics rate_limit_count = row_count;

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
    'signup_intents', intent_count,
    'asaas_webhook_events', webhook_count,
    'account_deletion_requests', request_count,
    'legal_retention_records', legal_record_count
  );
end;
$$;

revoke all on function public.archive_tenant_legal_record(uuid)
  from public, anon, authenticated;
revoke all on function public.claim_asaas_webhook_event(text, text, jsonb, integer)
  from public, anon, authenticated;
revoke all on function public.schedule_retention_deletions(timestamptz)
  from public, anon, authenticated;
revoke all on function public.request_account_deletion(uuid, uuid, timestamptz)
  from public, anon, authenticated;
revoke all on function public.withdraw_expedited_account_deletion(uuid, uuid)
  from public, anon, authenticated;
revoke all on function public.claim_account_deletion_requests(integer)
  from public, anon, authenticated;
revoke all on function public.purge_expired_operational_records(timestamptz)
  from public, anon, authenticated;

grant execute on function public.archive_tenant_legal_record(uuid) to service_role;
grant execute on function public.claim_asaas_webhook_event(text, text, jsonb, integer) to service_role;
grant execute on function public.schedule_retention_deletions(timestamptz) to service_role;
grant execute on function public.request_account_deletion(uuid, uuid, timestamptz) to service_role;
grant execute on function public.withdraw_expedited_account_deletion(uuid, uuid) to service_role;
grant execute on function public.claim_account_deletion_requests(integer) to service_role;
grant execute on function public.purge_expired_operational_records(timestamptz) to service_role;

commit;
