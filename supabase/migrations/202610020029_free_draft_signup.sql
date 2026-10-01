-- "Monte grátis, pague para publicar" (docs/PLANO-MONTA-GRATIS.md).
--
-- O cadastro passa a criar conta e loja em rascunho, sem pagamento. O
-- rascunho não é público (get_public_catalog continua exigindo ativo ou
-- inadimplente) e só o webhook de pagamento o coloca no ar. Lembretes por
-- e-mail (dias 1, 3 e 7) e exclusão após 30 dias sem acesso são feitos pela
-- Scheduled Function draft-lifecycle, com as RPCs abaixo (somente service_role).
--
-- Aplique ANTES do deploy do código.
begin;

-- 1. Loja em rascunho e controles do ciclo de vida.
alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants
  add constraint tenants_status_check check (
    status in ('rascunho', 'ativo', 'inadimplente', 'cancelado')
  );

alter table public.tenants
  add column if not exists email_confirmado_em timestamptz,
  add column if not exists draft_last_seen_at timestamptz,
  add column if not exists draft_reminder_last_day smallint not null default 0,
  add column if not exists draft_reminder_claimed_at timestamptz,
  add column if not exists draft_deletion_claimed_at timestamptz,
  add column if not exists lembretes_desativados_em timestamptz,
  add column if not exists lembretes_token uuid not null default extensions.gen_random_uuid();

alter table public.tenants drop constraint if exists tenants_draft_reminder_last_day_check;
alter table public.tenants
  add constraint tenants_draft_reminder_last_day_check check (
    draft_reminder_last_day in (0, 1, 3, 7)
  );

create unique index if not exists tenants_lembretes_token_unique_idx
  on public.tenants (lembretes_token);
create index if not exists tenants_draft_lifecycle_idx
  on public.tenants (created_at)
  where status = 'rascunho';

-- Lojas criadas pelo fluxo antigo tiveram o e-mail comprovado pelo pagamento
-- e pela criação de senha via link.
update public.tenants
set email_confirmado_em = created_at
where status <> 'rascunho'
  and email_confirmado_em is null;

-- 2. O registro de aceites do cadastro gratuito fica em signup_intents com
-- status "rascunho" e provisioned_tenant_id; ao publicar, vira "pendente"
-- com o checkout e o webhook o marca como "pago".
alter table public.signup_intents drop constraint if exists signup_intents_status_check;
alter table public.signup_intents
  add constraint signup_intents_status_check check (
    status in ('rascunho', 'pendente', 'pago', 'expirado', 'cancelado')
  );

-- 3. Confirmação de e-mail (exigida para publicar).
create table if not exists public.email_verification_tokens (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),

  constraint email_verification_tokens_hash_check check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint email_verification_tokens_expiry_check check (expires_at > created_at)
);

create index if not exists email_verification_tokens_tenant_idx
  on public.email_verification_tokens (tenant_id, created_at desc);

alter table public.email_verification_tokens enable row level security;
revoke all on table public.email_verification_tokens from anon, authenticated;

create or replace function public.consume_email_verification_token(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    return null;
  end if;

  update public.email_verification_tokens
  set consumed_at = clock_timestamp()
  where token_hash = p_token_hash
    and consumed_at is null
    and expires_at > clock_timestamp()
  returning tenant_id into v_tenant_id;

  if v_tenant_id is null then
    return null;
  end if;

  update public.tenants
  set email_confirmado_em = coalesce(email_confirmado_em, clock_timestamp())
  where id = v_tenant_id;

  return v_tenant_id;
end;
$$;

revoke all on function public.consume_email_verification_token(text) from public, anon, authenticated;
grant execute on function public.consume_email_verification_token(text) to service_role;

-- 4. Último acesso do rascunho (base do prazo de 30 dias). Gravado no máximo
-- uma vez por hora, pelo próprio titular autenticado.
create or replace function public.touch_draft_last_seen()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.tenants
  set draft_last_seen_at = clock_timestamp()
  where owner_user_id = auth.uid()
    and status = 'rascunho'
    and (
      draft_last_seen_at is null
      or draft_last_seen_at < clock_timestamp() - interval '1 hour'
    );
$$;

revoke all on function public.touch_draft_last_seen() from public, anon;
grant execute on function public.touch_draft_last_seen() to authenticated;

-- 5. Lembretes dos dias 1, 3 e 7 (reserva idempotente, como claim_overdue_notices).
create or replace function public.claim_draft_reminders(p_limit integer default 20)
returns table (
  tenant_id uuid,
  nome_loja text,
  slug text,
  owner_email text,
  reminder_day smallint,
  product_count integer,
  email_confirmed boolean,
  lembretes_token uuid,
  last_seen_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
begin
  if p_limit < 1 or p_limit > 50 then
    raise exception 'Limite de lembretes inválido.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select
      tenant.id,
      tenant.draft_reminder_last_day,
      (case
        when v_today - (tenant.created_at at time zone 'America/Sao_Paulo')::date >= 7 then 7
        when v_today - (tenant.created_at at time zone 'America/Sao_Paulo')::date >= 3 then 3
        else 1
      end)::smallint as target_day
    from public.tenants as tenant
    where tenant.status = 'rascunho'
      and tenant.lembretes_desativados_em is null
      and v_today - (tenant.created_at at time zone 'America/Sao_Paulo')::date between 1 and 29
      and (
        tenant.draft_reminder_claimed_at is null
        or tenant.draft_reminder_claimed_at < clock_timestamp() - interval '10 minutes'
      )
    order by tenant.created_at, tenant.id
    for update of tenant skip locked
  ), due as (
    select candidates.id, candidates.target_day
    from candidates
    where candidates.target_day > candidates.draft_reminder_last_day
    limit p_limit
  ), claimed as (
    update public.tenants as tenant
    set draft_reminder_claimed_at = clock_timestamp()
    from due
    where tenant.id = due.id
    returning tenant.id, due.target_day
  )
  select
    claimed.id,
    tenant.nome_loja,
    tenant.slug,
    auth_user.email::text,
    claimed.target_day,
    (
      select count(*)::integer
      from public.products as product
      where product.tenant_id = claimed.id
        and product.ativo = true
    ),
    tenant.email_confirmado_em is not null,
    tenant.lembretes_token,
    coalesce(tenant.draft_last_seen_at, tenant.created_at)
  from claimed
  join public.tenants as tenant on tenant.id = claimed.id
  join auth.users as auth_user on auth_user.id = tenant.owner_user_id;
end;
$$;

revoke all on function public.claim_draft_reminders(integer) from public, anon, authenticated;
grant execute on function public.claim_draft_reminders(integer) to service_role;

-- 6. Exclusão de rascunhos sem acesso há 30 dias. A rotina reserva, remove as
-- fotos do Storage, apaga a loja por delete_stale_draft e por fim o usuário do Auth.
create or replace function public.claim_stale_drafts(p_limit integer default 5)
returns table (tenant_id uuid, owner_user_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if p_limit < 1 or p_limit > 20 then
    raise exception 'Limite de exclusões inválido.' using errcode = '22023';
  end if;

  return query
  with stale as (
    select tenant.id
    from public.tenants as tenant
    where tenant.status = 'rascunho'
      and coalesce(tenant.draft_last_seen_at, tenant.created_at) < clock_timestamp() - interval '30 days'
      and (
        tenant.draft_deletion_claimed_at is null
        or tenant.draft_deletion_claimed_at < clock_timestamp() - interval '15 minutes'
      )
    order by coalesce(tenant.draft_last_seen_at, tenant.created_at), tenant.id
    limit p_limit
    for update of tenant skip locked
  )
  update public.tenants as tenant
  set draft_deletion_claimed_at = clock_timestamp()
  from stale
  where tenant.id = stale.id
  returning tenant.id, tenant.owner_user_id;
end;
$$;

revoke all on function public.claim_stale_drafts(integer) from public, anon, authenticated;
grant execute on function public.claim_stale_drafts(integer) to service_role;

create or replace function public.delete_stale_draft(p_tenant_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_owner_user_id uuid;
begin
  select tenant.owner_user_id into v_owner_user_id
  from public.tenants as tenant
  where tenant.id = p_tenant_id
    and tenant.status = 'rascunho'
    and coalesce(tenant.draft_last_seen_at, tenant.created_at) < clock_timestamp() - interval '30 days'
  for update;

  if not found then
    return null;
  end if;

  -- Rascunho nunca pagou: não há registro fiscal a preservar.
  delete from public.signup_intents
  where provisioned_tenant_id = p_tenant_id
     or target_tenant_id = p_tenant_id;
  delete from public.tenants where id = p_tenant_id;

  return v_owner_user_id;
end;
$$;

revoke all on function public.delete_stale_draft(uuid) from public, anon, authenticated;
grant execute on function public.delete_stale_draft(uuid) to service_role;

-- 7. Página pública "Loja em preparação": só o nome, e só de rascunhos.
create or replace function public.get_public_draft_store_name(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tenant.nome_loja
  from public.tenants as tenant
  where tenant.slug = lower(btrim(p_slug))
    and tenant.status = 'rascunho';
$$;

revoke all on function public.get_public_draft_store_name(text) from public;
grant execute on function public.get_public_draft_store_name(text) to anon, authenticated;

-- 8. Métricas do novo funil (lista igual a productMetricNames).
alter table public.product_metrics_daily
  drop constraint if exists product_metrics_daily_event_check;

alter table public.product_metrics_daily
  add constraint product_metrics_daily_event_check check (
    event_name in (
      'landing_view', 'how_it_works_view',
      'signup_started', 'signup_step_completed', 'draft_created',
      'email_verified', 'checkout_created',
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
    'signup_started', 'signup_step_completed', 'draft_created',
    'email_verified', 'checkout_created',
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

-- Conferência esperada (uma linha): true, false, false.
select
  (
    select pg_get_constraintdef(oid) like '%rascunho%'
    from pg_constraint
    where conname = 'tenants_status_check'
  ) as aceita_rascunho,
  has_function_privilege('anon', 'public.claim_draft_reminders(integer)', 'EXECUTE')
    as visitante_reserva_lembretes,
  has_column_privilege('authenticated', 'public.tenants', 'status', 'UPDATE')
    as titular_altera_status;
