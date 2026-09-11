-- ClickCatálogo — recuperação cross-device e reativação segura de assinaturas.
-- Execute após 202609100010_prelaunch_continuity.sql.

alter table public.signup_intents
  add column if not exists intent_type text not null default 'signup',
  add column if not exists target_tenant_id uuid references public.tenants(id) on delete set null,
  add column if not exists asaas_checkout_url text,
  add column if not exists asaas_checkout_expires_at timestamptz;

alter table public.signup_intents
  drop constraint if exists signup_intents_intent_type_check;

alter table public.signup_intents
  add constraint signup_intents_intent_type_check check (
    intent_type in ('signup', 'reactivation')
  ),
  add constraint signup_intents_target_check check (
    (intent_type = 'signup' and target_tenant_id is null)
    or (intent_type = 'reactivation' and target_tenant_id is not null)
  );

-- A constraint antiga impedia registrar uma nova intenção de reativação para
-- um tenant já provisionado. O cadastro inicial continua único pelo índice
-- parcial abaixo.
alter table public.signup_intents
  drop constraint if exists signup_intents_provisioned_tenant_id_key;

drop index if exists public.signup_intents_active_email_unique_idx;
drop index if exists public.signup_intents_active_slug_unique_idx;

create unique index if not exists signup_intents_pending_slug_unique_idx
  on public.signup_intents (slug)
  where status = 'pendente' and intent_type = 'signup';

create unique index if not exists signup_intents_pending_email_unique_idx
  on public.signup_intents (lower(email))
  where status = 'pendente';

create unique index if not exists signup_intents_signup_tenant_unique_idx
  on public.signup_intents (provisioned_tenant_id)
  where intent_type = 'signup' and provisioned_tenant_id is not null;

create unique index if not exists signup_intents_pending_reactivation_unique_idx
  on public.signup_intents (target_tenant_id)
  where intent_type = 'reactivation' and status = 'pendente';

create index if not exists signup_intents_target_tenant_idx
  on public.signup_intents (target_tenant_id, created_at desc)
  where target_tenant_id is not null;

alter table public.subscriptions
  add column if not exists reactivation_requested_at timestamptz,
  add column if not exists asaas_subscription_state text not null default 'unknown';

alter table public.subscriptions
  drop constraint if exists subscriptions_asaas_state_check;

alter table public.subscriptions
  add constraint subscriptions_asaas_state_check check (
    asaas_subscription_state in ('unknown', 'active', 'inactive', 'deleted')
  );

create table if not exists public.signup_recovery_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  signup_intent_id uuid not null references public.signup_intents(id) on delete cascade,
  token_hash text not null unique,
  email_hash text not null,
  requested_ip_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint signup_recovery_tokens_hash_check check (
    token_hash ~ '^[a-f0-9]{64}$'
    and email_hash ~ '^[a-f0-9]{64}$'
    and requested_ip_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint signup_recovery_tokens_expiry_check check (expires_at > created_at)
);

create index if not exists signup_recovery_tokens_intent_active_idx
  on public.signup_recovery_tokens (signup_intent_id, created_at desc)
  where consumed_at is null;

create index if not exists signup_recovery_tokens_expiry_idx
  on public.signup_recovery_tokens (expires_at)
  where consumed_at is null;

alter table public.signup_recovery_tokens enable row level security;
revoke all on table public.signup_recovery_tokens from public, anon, authenticated;

-- Consome o token de forma atômica. Duas abas ou dois dispositivos nunca
-- conseguem utilizar o mesmo link com sucesso.
create or replace function public.consume_signup_recovery_token(p_token_hash text)
returns table (
  external_reference uuid,
  intent_status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return;
  end if;

  return query
  with consumed as (
    update public.signup_recovery_tokens as recovery
    set consumed_at = clock_timestamp()
    where recovery.token_hash = p_token_hash
      and recovery.consumed_at is null
      and recovery.expires_at > clock_timestamp()
    returning recovery.signup_intent_id
  )
  select intent.external_reference, intent.status
  from consumed
  join public.signup_intents as intent on intent.id = consumed.signup_intent_id;
end;
$$;

revoke all on function public.consume_signup_recovery_token(text)
  from public, anon, authenticated;
grant execute on function public.consume_signup_recovery_token(text)
  to service_role;

-- Uma reativação em andamento não pode concorrer com a finalização agendada.
create or replace function public.finalize_due_subscription_cancellations(
  p_now timestamptz default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  finalized_count integer := 0;
begin
  with due_subscriptions as (
    update public.subscriptions
    set status = 'cancelado'
    where cancel_at_period_end = true
      and access_until <= coalesce(p_now, clock_timestamp())
      and (
        reactivation_requested_at is null
        or reactivation_requested_at < coalesce(p_now, clock_timestamp()) - interval '10 minutes'
      )
      and status in ('ativo', 'atrasado')
    returning tenant_id
  ), finalized_tenants as (
    update public.tenants as tenant
    set
      canceled_at = coalesce(tenant.canceled_at, coalesce(p_now, clock_timestamp())),
      status = 'cancelado'
    where tenant.id in (select due.tenant_id from due_subscriptions as due)
    returning tenant.id
  )
  select count(*)::integer
  into finalized_count
  from due_subscriptions;

  return finalized_count;
end;
$$;

revoke all on function public.finalize_due_subscription_cancellations(timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_due_subscription_cancellations(timestamptz)
  to service_role;

-- A fila de expurgo não pode reservar uma loja enquanto há reativação em
-- andamento. Um marcador abandonado funciona como lease e expira em 10 minutos.
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
      and not exists (
        select 1
        from public.signup_intents as intent
        where intent.target_tenant_id = request.tenant_id_original
          and intent.intent_type = 'reactivation'
          and intent.status = 'pendente'
      )
      and not exists (
        select 1
        from public.subscriptions as subscription
        where subscription.tenant_id = request.tenant_id_original
          and subscription.reactivation_requested_at is not null
          and subscription.reactivation_requested_at >= clock_timestamp() - interval '10 minutes'
      )
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

revoke all on function public.claim_account_deletion_requests(integer)
  from public, anon, authenticated;
grant execute on function public.claim_account_deletion_requests(integer)
  to service_role;

comment on column public.signup_intents.intent_type is
  'Distingue o cadastro inicial da reativação de um tenant existente.';
comment on column public.signup_intents.asaas_checkout_url is
  'URL secreta do checkout, acessível somente pelo backend.';
comment on column public.subscriptions.reactivation_requested_at is
  'Marca uma reativação em curso e impede corrida com a finalização agendada.';
comment on column public.subscriptions.asaas_subscription_state is
  'Último estado conhecido da recorrência remota no Asaas.';
comment on table public.signup_recovery_tokens is
  'Tokens de uso único para retomada cross-device; somente hashes são persistidos.';
