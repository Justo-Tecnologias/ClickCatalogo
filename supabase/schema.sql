-- ClickCatálogo — schema consolidado para um projeto Supabase vazio.
-- Execute este arquivo uma única vez no SQL Editor.
-- Não execute este arquivo depois das migrations individuais.

begin;

create extension if not exists pgcrypto with schema extensions;

create table public.tenants (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  nome_loja text not null,
  logo_url text,
  banner_url text,
  descricao_curta text,
  whatsapp text not null,
  instagram text,
  endereco text,
  tema text not null default 'minimal',
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  status text not null default 'ativo',
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tenants_slug_format_check check (
    slug = lower(slug)
    and char_length(slug) between 3 and 60
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint tenants_slug_reserved_check check (
    slug not in ('admin', 'api', 'painel', 'loja', 'cadastro', 'app', 'www')
  ),
  constraint tenants_nome_loja_length_check check (
    char_length(btrim(nome_loja)) between 2 and 100
  ),
  constraint tenants_descricao_length_check check (
    descricao_curta is null or char_length(descricao_curta) <= 180
  ),
  constraint tenants_whatsapp_format_check check (
    whatsapp ~ '^55[0-9]{10,11}$'
  ),
  constraint tenants_tema_check check (
    tema in ('classico', 'natural', 'tech', 'delivery', 'elegante', 'minimal')
  ),
  constraint tenants_status_check check (
    status in ('ativo', 'inadimplente', 'cancelado')
  )
);

create unique index tenants_owner_user_id_unique_idx
  on public.tenants (owner_user_id);

create table public.tenant_slug_history (
  slug text primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  redirect_until timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint tenant_slug_history_slug_format_check check (
    slug = lower(slug)
    and char_length(slug) between 3 and 60
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint tenant_slug_history_slug_reserved_check check (
    slug not in ('admin', 'api', 'painel', 'loja', 'cadastro', 'app', 'www')
  ),
  constraint tenant_slug_history_redirect_check check (redirect_until > created_at)
);

create index tenant_slug_history_tenant_idx
  on public.tenant_slug_history (tenant_id, redirect_until desc);

create index tenant_slug_history_expiry_idx
  on public.tenant_slug_history (redirect_until);

create table public.categories (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  nome text not null,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint categories_id_tenant_unique unique (id, tenant_id),
  constraint categories_nome_length_check check (
    char_length(btrim(nome)) between 1 and 80
  ),
  constraint categories_ordem_check check (ordem >= 0)
);

create unique index categories_tenant_nome_unique_idx
  on public.categories (tenant_id, lower(btrim(nome)));

create table public.products (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  category_id uuid not null,
  nome text not null,
  preco numeric(10, 2) not null,
  descricao text,
  imagem_url text,
  link_externo text,
  variacao_info text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint products_category_same_tenant_fk
    foreign key (category_id, tenant_id)
    references public.categories(id, tenant_id)
    on delete restrict,
  constraint products_nome_length_check check (
    char_length(btrim(nome)) between 1 and 120
  ),
  constraint products_preco_check check (preco >= 0.01),
  constraint products_descricao_length_check check (
    descricao is null or char_length(descricao) <= 1000
  ),
  constraint products_link_externo_check check (
    link_externo is null
    or (
      char_length(link_externo) <= 2048
      and link_externo ~ '^https://'
    )
  ),
  constraint products_variacao_length_check check (
    variacao_info is null or char_length(variacao_info) <= 300
  ),
  constraint products_ordem_check check (ordem >= 0)
);

create table public.subscriptions (
  id uuid primary key default extensions.gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  asaas_customer_id text,
  asaas_subscription_id text unique,
  asaas_subscription_state text not null default 'unknown',
  valor numeric(10, 2) not null default 27.00,
  status text not null default 'ativo',
  next_due_date date,
  portal_url text,
  cancel_at_period_end boolean not null default false,
  cancellation_requested_at timestamptz,
  access_until timestamptz,
  reactivation_requested_at timestamptz,
  cancellation_reconciliation_status text not null default 'not_required',
  cancellation_reconciliation_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint subscriptions_valor_check check (valor > 0),
  constraint subscriptions_status_check check (
    status in ('ativo', 'atrasado', 'cancelado')
  ),
  constraint subscriptions_asaas_state_check check (
    asaas_subscription_state in ('unknown', 'active', 'inactive', 'deleted')
  ),
  constraint subscriptions_cancellation_reconciliation_status_check check (
    cancellation_reconciliation_status in ('not_required', 'pending', 'processing', 'complete', 'attention')
  ),
  constraint subscriptions_scheduled_cancellation_check check (
    not cancel_at_period_end
    or (
      cancellation_requested_at is not null
      and access_until is not null
    )
  )
);

create unique index subscriptions_one_current_per_tenant_idx
  on public.subscriptions (tenant_id)
  where status in ('ativo', 'atrasado');

create index subscriptions_scheduled_cancellation_idx
  on public.subscriptions (access_until)
  where cancel_at_period_end = true
    and status in ('ativo', 'atrasado');

create index subscriptions_cancellation_reconciliation_attention_idx
  on public.subscriptions (
    cancellation_reconciliation_status,
    cancellation_reconciliation_checked_at
  )
  where cancellation_reconciliation_status in ('pending', 'processing', 'attention');

-- Dados coletados antes do pagamento. Somente o backend com chave secreta
-- acessa esta tabela; o navegador passa por rotas de API validadas.
create table public.signup_intents (
  id uuid primary key default extensions.gen_random_uuid(),
  external_reference uuid not null default extensions.gen_random_uuid() unique,
  nome_loja text not null,
  whatsapp text not null,
  email text not null,
  slug text not null,
  tema text not null default 'minimal',
  terms_accepted_at timestamptz not null,
  terms_version text not null default '2026-08-30',
  privacy_accepted_at timestamptz not null,
  privacy_version text not null default '2026-08-30',
  asaas_customer_id text,
  asaas_subscription_id text unique,
  asaas_checkout_id text unique,
  asaas_checkout_url text,
  asaas_checkout_expires_at timestamptz,
  checkout_creation_started_at timestamptz,
  checkout_returned_at timestamptz,
  status text not null default 'pendente',
  intent_type text not null default 'signup',
  target_tenant_id uuid references public.tenants(id) on delete set null,
  provisioned_tenant_id uuid references public.tenants(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint signup_intents_nome_length_check check (
    char_length(btrim(nome_loja)) between 2 and 100
  ),
  constraint signup_intents_whatsapp_check check (
    whatsapp ~ '^55[0-9]{10,11}$'
  ),
  constraint signup_intents_email_normalized_check check (
    email = lower(email)
    and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  constraint signup_intents_slug_format_check check (
    slug = lower(slug)
    and char_length(slug) between 3 and 60
    and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
  ),
  constraint signup_intents_slug_reserved_check check (
    slug not in ('admin', 'api', 'painel', 'loja', 'cadastro', 'app', 'www')
  ),
  constraint signup_intents_tema_check check (
    tema in ('classico', 'natural', 'tech', 'delivery', 'elegante', 'minimal')
  ),
  constraint signup_intents_terms_version_check check (
    terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ),
  constraint signup_intents_privacy_version_check check (
    privacy_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
  ),
  constraint signup_intents_status_check check (
    status in ('pendente', 'pago', 'expirado', 'cancelado')
  ),
  constraint signup_intents_intent_type_check check (
    intent_type in ('signup', 'reactivation')
  ),
  constraint signup_intents_target_check check (
    (intent_type = 'signup' and target_tenant_id is null)
    or (intent_type = 'reactivation' and target_tenant_id is not null)
  )
);

create table public.signup_recovery_tokens (
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

-- O id do evento evita processar duas vezes a mesma entrega do Asaas.
create table public.asaas_webhook_events (
  event_id text primary key,
  event_type text not null,
  payload jsonb not null,
  attempts integer not null default 1,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error text,
  processing_started_at timestamptz not null default now(),

  constraint asaas_webhook_events_attempts_check check (attempts >= 1),
  constraint asaas_webhook_events_id_length_check check (
    char_length(event_id) between 1 and 200
  ),
  constraint asaas_webhook_events_type_length_check check (
    char_length(event_type) between 1 and 100
  ),
  constraint asaas_webhook_events_error_length_check check (
    processing_error is null or char_length(processing_error) <= 500
  )
);

create table public.account_deletion_requests (
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

create table public.legal_retention_records (
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

create index categories_tenant_order_idx
  on public.categories (tenant_id, ordem, created_at);
create index products_tenant_order_idx
  on public.products (tenant_id, category_id, ordem, created_at);
create index products_public_catalog_idx
  on public.products (tenant_id, category_id, ordem, created_at)
  where ativo = true;
create index subscriptions_tenant_idx on public.subscriptions (tenant_id);
create index subscriptions_asaas_customer_idx
  on public.subscriptions (asaas_customer_id)
  where asaas_customer_id is not null;
create unique index signup_intents_pending_slug_unique_idx
  on public.signup_intents (slug)
  where status = 'pendente' and intent_type = 'signup';

create unique index signup_intents_pending_email_unique_idx
  on public.signup_intents (lower(email))
  where status = 'pendente';
create unique index signup_intents_signup_tenant_unique_idx
  on public.signup_intents (provisioned_tenant_id)
  where intent_type = 'signup' and provisioned_tenant_id is not null;
create unique index signup_intents_pending_reactivation_unique_idx
  on public.signup_intents (target_tenant_id)
  where intent_type = 'reactivation' and status = 'pendente';
create index signup_intents_target_tenant_idx
  on public.signup_intents (target_tenant_id, created_at desc)
  where target_tenant_id is not null;
create index signup_recovery_tokens_intent_active_idx
  on public.signup_recovery_tokens (signup_intent_id, created_at desc)
  where consumed_at is null;
create index signup_recovery_tokens_expiry_idx
  on public.signup_recovery_tokens (expires_at)
  where consumed_at is null;
create index signup_intents_asaas_customer_idx
  on public.signup_intents (asaas_customer_id)
  where asaas_customer_id is not null;
create index signup_intents_pending_expiry_idx
  on public.signup_intents (expires_at)
  where status = 'pendente';
create index account_deletion_requests_due_idx
  on public.account_deletion_requests (scheduled_for, attempts)
  where status in ('agendado', 'falhou');
create index account_deletion_requests_owner_idx
  on public.account_deletion_requests (owner_user_id, requested_at desc);
create index legal_retention_records_expiry_idx
  on public.legal_retention_records (retain_until);

-- Libera slugs de checkouts pendentes que expiraram mesmo quando o webhook
-- CHECKOUT_EXPIRED não chegou. A função só pode ser chamada pela service role.
create or replace function public.expire_stale_signup_intents()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  expired_count integer;
begin
  update public.signup_intents
  set status = 'expirado'
  where status = 'pendente'
    and expires_at <= now();

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

revoke all on function public.expire_stale_signup_intents() from public, anon, authenticated;
grant execute on function public.expire_stale_signup_intents() to service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.set_tenant_canceled_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'cancelado' then
    new.canceled_at = coalesce(new.canceled_at, old.canceled_at, clock_timestamp());
  else
    new.canceled_at = null;
  end if;

  return new;
end;
$$;

create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

create trigger tenants_set_canceled_at
before update of status, canceled_at on public.tenants
for each row execute function public.set_tenant_canceled_at();

create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger signup_intents_set_updated_at
before update on public.signup_intents
for each row execute function public.set_updated_at();

create trigger account_deletion_requests_set_updated_at
before update on public.account_deletion_requests
for each row execute function public.set_updated_at();

alter table public.tenants enable row level security;
alter table public.tenant_slug_history enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.subscriptions enable row level security;
alter table public.signup_intents enable row level security;
alter table public.signup_recovery_tokens enable row level security;
alter table public.asaas_webhook_events enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.legal_retention_records enable row level security;

revoke all on table public.tenants from anon, authenticated;
revoke all on table public.tenant_slug_history from public, anon, authenticated;
revoke all on table public.categories from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.subscriptions from anon, authenticated;
revoke all on table public.signup_intents from anon, authenticated;
revoke all on table public.signup_recovery_tokens from public, anon, authenticated;
revoke all on table public.asaas_webhook_events from anon, authenticated;
revoke all on table public.account_deletion_requests from anon, authenticated;
revoke all on table public.legal_retention_records from anon, authenticated;

grant select on table public.tenants to authenticated;
grant update (
  slug,
  nome_loja,
  logo_url,
  banner_url,
  descricao_curta,
  whatsapp,
  instagram,
  endereco,
  tema
) on table public.tenants to authenticated;
grant select, insert, update, delete on table public.categories to authenticated;
grant select, insert, update, delete on table public.products to authenticated;
grant select on table public.subscriptions to authenticated;
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

create policy tenants_select_own
on public.tenants
for select
to authenticated
using (owner_user_id = (select auth.uid()));

create policy tenants_update_own
on public.tenants
for update
to authenticated
using (owner_user_id = (select auth.uid()))
with check (owner_user_id = (select auth.uid()));

create policy categories_manage_own
on public.categories
for all
to authenticated
using (
  exists (
    select 1
    from public.tenants
    where tenants.id = categories.tenant_id
      and tenants.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.tenants
    where tenants.id = categories.tenant_id
      and tenants.owner_user_id = (select auth.uid())
  )
);

create policy products_manage_own
on public.products
for all
to authenticated
using (
  exists (
    select 1
    from public.tenants
    where tenants.id = products.tenant_id
      and tenants.owner_user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.tenants
    where tenants.id = products.tenant_id
      and tenants.owner_user_id = (select auth.uid())
  )
);

create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using (
  exists (
    select 1
    from public.tenants
    where tenants.id = subscriptions.tenant_id
      and tenants.owner_user_id = (select auth.uid())
  )
);

create policy account_deletion_requests_select_own
on public.account_deletion_requests
for select
to authenticated
using (owner_user_id = (select auth.uid()));

-- Retorna somente os campos necessários ao catálogo público.
create or replace function public.get_public_catalog(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'slug', tenant.slug,
    'nome_loja', tenant.nome_loja,
    'logo_url', tenant.logo_url,
    'banner_url', tenant.banner_url,
    'descricao_curta', tenant.descricao_curta,
    'whatsapp', tenant.whatsapp,
    'instagram', tenant.instagram,
    'endereco', tenant.endereco,
    'tema', tenant.tema,
    'status', tenant.status,
    'categorias', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', category.id,
            'nome', category.nome,
            'ordem', category.ordem,
            'produtos', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'id', product.id,
                    'nome', product.nome,
                    'preco', product.preco,
                    'descricao', product.descricao,
                    'imagem_url', product.imagem_url,
                    'link_externo', product.link_externo,
                    'variacao_info', product.variacao_info,
                    'ordem', product.ordem
                  )
                  order by product.ordem, product.created_at
                )
                from public.products as product
                where product.tenant_id = tenant.id
                  and product.category_id = category.id
                  and product.ativo = true
              ),
              '[]'::jsonb
            )
          )
          order by category.ordem, category.created_at
        )
        from public.categories as category
        where category.tenant_id = tenant.id
      ),
      '[]'::jsonb
    )
  )
  from public.tenants as tenant
  where tenant.slug = lower(btrim(p_slug))
    and tenant.status in ('ativo', 'inadimplente')
    and not exists (
      select 1
      from public.subscriptions as subscription
      where subscription.tenant_id = tenant.id
        and subscription.cancel_at_period_end = true
        and subscription.access_until <= now()
        and subscription.status in ('ativo', 'atrasado')
    );
$$;

create or replace function public.get_public_store_status(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when tenant.status in ('ativo', 'inadimplente') and exists (
      select 1
      from public.subscriptions as subscription
      where subscription.tenant_id = tenant.id
        and subscription.cancel_at_period_end = true
        and subscription.access_until <= now()
        and subscription.status in ('ativo', 'atrasado')
    ) then 'cancelado'
    else tenant.status
  end
  from public.tenants as tenant
  where tenant.slug = lower(btrim(p_slug));
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.get_public_catalog(text) from public;
revoke all on function public.get_public_store_status(text) from public;
grant execute on function public.get_public_catalog(text) to anon, authenticated;
grant execute on function public.get_public_store_status(text) to anon, authenticated;

comment on function public.get_public_catalog(text) is
  'Retorna somente os dados públicos de um catálogo ativo ou inadimplente.';
comment on function public.get_public_store_status(text) is
  'Expõe somente o status necessário para a tela pública de indisponibilidade.';

create or replace function public.email_has_tenant(p_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as auth_user
    join public.tenants as tenant on tenant.owner_user_id = auth_user.id
    where lower(auth_user.email) = lower(btrim(p_email))
  );
$$;

revoke all on function public.email_has_tenant(text) from public, anon, authenticated;
grant execute on function public.email_has_tenant(text) to service_role;

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

create or replace function public.claim_signup_checkout_restart(
  p_external_reference uuid,
  p_lease_seconds integer default 120
)
returns table (
  outcome text,
  checkout_url text,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent public.signup_intents%rowtype;
  v_claimed_at timestamptz;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception 'Lease de checkout inválido.' using errcode = '22023';
  end if;

  select * into v_intent
  from public.signup_intents as intent
  where intent.external_reference = p_external_reference
  for update;

  if not found or v_intent.status = 'pago' or v_intent.provisioned_tenant_id is not null then
    return query select 'state_changed'::text, null::text, null::timestamptz;
    return;
  end if;

  if v_intent.status = 'pendente'
    and v_intent.asaas_checkout_url is not null
    and v_intent.asaas_checkout_url ~ '^https://([a-z0-9-]+\.)*asaas\.com/'
    and v_intent.asaas_checkout_expires_at > clock_timestamp() then
    return query select 'existing'::text, v_intent.asaas_checkout_url, null::timestamptz;
    return;
  end if;

  if v_intent.checkout_creation_started_at is not null
    and v_intent.checkout_creation_started_at
      > clock_timestamp() - make_interval(secs => p_lease_seconds) then
    return query select 'processing'::text, null::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1
    from public.signup_intents as other
    where other.id <> v_intent.id
      and other.status = 'pendente'
      and (
        other.email = v_intent.email
        or (v_intent.intent_type = 'signup' and other.slug = v_intent.slug)
        or (
          v_intent.intent_type = 'reactivation'
          and other.intent_type = 'reactivation'
          and other.target_tenant_id = v_intent.target_tenant_id
        )
      )
  ) then
    return query select 'state_changed'::text, null::text, null::timestamptz;
    return;
  end if;

  v_claimed_at := clock_timestamp();
  update public.signup_intents as intent
  set
    asaas_checkout_expires_at = null,
    asaas_checkout_id = null,
    asaas_checkout_url = null,
    checkout_creation_started_at = v_claimed_at,
    checkout_returned_at = null,
    expires_at = v_claimed_at + interval '24 hours',
    status = 'pendente'
  where intent.id = v_intent.id;

  return query select 'claimed'::text, null::text, v_claimed_at;
end;
$$;

revoke all on function public.claim_signup_checkout_restart(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_signup_checkout_restart(uuid, integer)
  to service_role;

comment on function public.claim_signup_checkout_restart(uuid, integer) is
  'Reserva de forma atômica a recriação de checkout com lease recuperável.';

-- Métricas de produto agregadas. Não persistimos eventos individuais nem PII.
create table public.product_metrics_daily (
  metric_date date not null default current_date,
  event_name text not null,
  scope_key text not null default 'global',
  event_count bigint not null default 0,
  updated_at timestamptz not null default now(),
  primary key (metric_date, event_name, scope_key),
  constraint product_metrics_daily_event_check check (
    event_name in (
      'signup_started', 'signup_step_completed', 'checkout_created',
      'payment_confirmed', 'password_created', 'first_category_created',
      'first_product_created', 'fifth_product_created', 'catalog_shared',
      'catalog_view', 'whatsapp_order_clicked', 'cancellation_requested',
      'cancellation_reverted', 'subscription_reactivated'
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

comment on table public.product_metrics_daily is
  'Contadores diários agregados de produto; não armazena IP, e-mail, telefone, texto livre ou eventos individuais.';

-- Conclui cancelamentos quando termina o período já pago. A Scheduled Function
-- da Netlify chama esta RPC; execuções repetidas são idempotentes.
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
      and cancellation_reconciliation_status = 'complete'
      and access_until <= coalesce(p_now, clock_timestamp())
      and reactivation_requested_at is null
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

comment on column public.subscriptions.cancel_at_period_end is
  'Indica que a recorrência foi encerrada, mantendo acesso até access_until.';
comment on column public.subscriptions.access_until is
  'Fim do período já pago, em instante absoluto.';
comment on column public.subscriptions.reactivation_requested_at is
  'Marca uma reativação em curso e impede corrida com a finalização agendada.';
comment on column public.subscriptions.asaas_subscription_state is
  'Último estado conhecido da recorrência remota no Asaas.';
comment on column public.subscriptions.cancellation_reconciliation_status is
  'Confirma se cobranças futuras pendentes foram verificadas após interromper a recorrência.';
comment on column public.subscriptions.cancellation_reconciliation_checked_at is
  'Instante da última tentativa de conciliação das cobranças futuras.';
comment on column public.signup_intents.intent_type is
  'Distingue o cadastro inicial da reativação de um tenant existente.';
comment on column public.signup_intents.asaas_checkout_url is
  'URL secreta do checkout, acessível somente pelo backend.';
comment on table public.signup_recovery_tokens is
  'Tokens de uso único para retomada cross-device; somente hashes são persistidos.';
comment on function public.finalize_due_subscription_cancellations(timestamptz) is
  'Finaliza somente cancelamentos vencidos cuja conciliação financeira foi concluída.';

create or replace function public.claim_subscription_cancellation_reconciliations(
  p_limit integer default 1
)
returns setof public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'Limite de conciliações inválido.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select subscription.id
    from public.subscriptions as subscription
    where subscription.cancel_at_period_end = true
      and (
        subscription.cancellation_reconciliation_status = 'pending'
        or (
          subscription.cancellation_reconciliation_status = 'attention'
          and (
            subscription.cancellation_reconciliation_checked_at is null
            or subscription.cancellation_reconciliation_checked_at
              < clock_timestamp() - interval '15 minutes'
          )
        )
        or (
          subscription.cancellation_reconciliation_status = 'processing'
          and (
            subscription.cancellation_reconciliation_checked_at is null
            or subscription.cancellation_reconciliation_checked_at
              < clock_timestamp() - interval '2 minutes'
          )
        )
      )
      and subscription.reactivation_requested_at is null
    order by subscription.cancellation_reconciliation_checked_at nulls first,
      subscription.cancellation_requested_at nulls first,
      subscription.created_at
    for update skip locked
    limit p_limit
  )
  update public.subscriptions as subscription
  set
    cancellation_reconciliation_checked_at = clock_timestamp(),
    cancellation_reconciliation_status = 'processing'
  from candidates
  where subscription.id = candidates.id
  returning subscription.*;
end;
$$;

revoke all on function public.claim_subscription_cancellation_reconciliations(integer)
  from public, anon, authenticated;
grant execute on function public.claim_subscription_cancellation_reconciliations(integer)
  to service_role;

comment on function public.claim_subscription_cancellation_reconciliations(integer) is
  'Reserva conciliações com lease de dois minutos e impede disputa com reativação.';

create or replace function public.reorder_categories(p_tenant_id uuid, p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  category_count integer;
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.tenants
    where id = p_tenant_id and owner_user_id = (select auth.uid())
  ) then
    raise exception 'Loja não autorizada.' using errcode = '42501';
  end if;

  select count(*)::integer into category_count
  from public.categories where tenant_id = p_tenant_id;

  if p_ids is null
    or cardinality(p_ids) <> category_count
    or (select count(distinct listed.id) from unnest(p_ids) as listed(id)) <> category_count
    or exists (
      select 1 from unnest(p_ids) as listed(id)
      where not exists (
        select 1 from public.categories
        where categories.id = listed.id and categories.tenant_id = p_tenant_id
      )
    ) then
    raise exception 'Ordem de categorias inválida.' using errcode = '22023';
  end if;

  update public.categories as category
  set ordem = ordered.position - 1
  from unnest(p_ids) with ordinality as ordered(id, position)
  where category.id = ordered.id and category.tenant_id = p_tenant_id;

  return category_count;
end;
$$;

revoke all on function public.reorder_categories(uuid, uuid[]) from public, anon;
grant execute on function public.reorder_categories(uuid, uuid[]) to authenticated;

create table public.api_rate_limits (
  key_hash text primary key,
  request_count integer not null default 1 check (request_count > 0),
  reset_at timestamptz not null,
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;

create index api_rate_limits_reset_at_idx on public.api_rate_limits (reset_at);

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
  current_reset timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if p_key_hash is null or length(p_key_hash) <> 64 or p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Parâmetros de rate limit inválidos.' using errcode = '22023';
  end if;

  if random() < 0.01 then
    delete from public.api_rate_limits
    where reset_at < v_now - interval '1 day';
  end if;

  insert into public.api_rate_limits as rate_limit (key_hash, request_count, reset_at, updated_at)
  values (p_key_hash, 1, v_now + make_interval(secs => p_window_seconds), v_now)
  on conflict (key_hash) do update
  set
    request_count = case when rate_limit.reset_at <= v_now then 1 else rate_limit.request_count + 1 end,
    reset_at = case when rate_limit.reset_at <= v_now then v_now + make_interval(secs => p_window_seconds) else rate_limit.reset_at end,
    updated_at = v_now
  returning request_count, rate_limit.reset_at into current_count, current_reset;

  return query select
    current_count <= p_limit,
    greatest(p_limit - current_count, 0),
    greatest(ceil(extract(epoch from current_reset - v_now))::integer, 1),
    current_reset;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

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
  select * into v_tenant
  from public.tenants
  where id = p_tenant_id;

  if not found then
    raise exception 'Tenant não encontrado para arquivamento.' using errcode = 'P0002';
  end if;

  if v_tenant.status <> 'cancelado' or v_tenant.canceled_at is null then
    raise exception 'Somente tenants cancelados podem ser arquivados.' using errcode = '22023';
  end if;

  select * into v_subscription
  from public.subscriptions
  where tenant_id = p_tenant_id
  order by created_at desc
  limit 1;

  select * into v_intent
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

-- O bucket também armazena logo e banner. A primeira pasta sempre deve ser
-- o UUID do tenant: {tenant_id}/arquivo.webp.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'produtos',
  'produtos',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy produtos_public_read
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'produtos');

create policy produtos_owner_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'produtos'
  and exists (
    select 1
    from public.tenants
    where tenants.id::text = (storage.foldername(name))[1]
      and tenants.owner_user_id = (select auth.uid())
  )
);

create policy produtos_owner_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'produtos'
  and exists (
    select 1
    from public.tenants
    where tenants.id::text = (storage.foldername(name))[1]
      and tenants.owner_user_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'produtos'
  and exists (
    select 1
    from public.tenants
    where tenants.id::text = (storage.foldername(name))[1]
      and tenants.owner_user_id = (select auth.uid())
  )
);

create policy produtos_owner_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'produtos'
  and exists (
    select 1
    from public.tenants
    where tenants.id::text = (storage.foldername(name))[1]
      and tenants.owner_user_id = (select auth.uid())
  )
);

create or replace function public.change_tenant_slug(p_slug text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new_slug text := lower(btrim(p_slug));
  v_tenant public.tenants%rowtype;
  v_history_owner uuid;
  v_active_aliases integer;
  v_next_alias_release_on date;
begin
  if auth.uid() is null then
    raise exception 'Autenticação necessária.' using errcode = '42501';
  end if;

  select tenant.* into v_tenant
  from public.tenants as tenant
  where tenant.owner_user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Loja não encontrada.' using errcode = 'P0002';
  end if;

  if v_new_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or char_length(v_new_slug) not between 3 and 60
    or v_new_slug in ('admin', 'api', 'painel', 'loja', 'cadastro', 'app', 'www') then
    raise exception 'Endereço inválido.' using errcode = '22023';
  end if;

  if v_new_slug = v_tenant.slug then
    return jsonb_build_object('old_slug', v_tenant.slug, 'new_slug', v_tenant.slug, 'redirect_until', null);
  end if;

  delete from public.tenant_slug_history
  where (redirect_until at time zone 'America/Sao_Paulo')::date
    <= (clock_timestamp() at time zone 'America/Sao_Paulo')::date;

  if exists (select 1 from public.tenants as tenant where tenant.slug = v_new_slug) then
    raise exception 'Este endereço já está em uso.' using errcode = '23505';
  end if;

  select history.tenant_id into v_history_owner
  from public.tenant_slug_history as history
  where history.slug = v_new_slug and history.redirect_until > clock_timestamp();

  if v_history_owner is not null and v_history_owner <> v_tenant.id then
    raise exception 'Este endereço está temporariamente reservado.' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.signup_intents as intent
    where intent.slug = v_new_slug
      and (intent.status = 'pendente' or (intent.status = 'pago' and intent.provisioned_tenant_id is null))
  ) then
    raise exception 'Este endereço já está reservado por um cadastro.' using errcode = '23505';
  end if;

  select
    count(*)::integer,
    min((history.redirect_until at time zone 'America/Sao_Paulo')::date)
  into v_active_aliases, v_next_alias_release_on
  from public.tenant_slug_history as history
  where history.tenant_id = v_tenant.id
    and (history.redirect_until at time zone 'America/Sao_Paulo')::date
      > (clock_timestamp() at time zone 'America/Sao_Paulo')::date;

  if v_active_aliases >= 3 and v_history_owner is null then
    raise exception 'Você já possui três links antigos protegidos. Reutilize um deles ou escolha um novo a partir de %.',
      to_char(v_next_alias_release_on, 'DD/MM/YYYY')
      using errcode = '54000';
  end if;

  delete from public.tenant_slug_history where slug = v_new_slug and tenant_id = v_tenant.id;

  insert into public.tenant_slug_history (slug, tenant_id, redirect_until)
  values (v_tenant.slug, v_tenant.id, clock_timestamp() + interval '30 days')
  on conflict (slug) do update
  set tenant_id = excluded.tenant_id,
      redirect_until = excluded.redirect_until,
      created_at = clock_timestamp(),
      updated_at = clock_timestamp();

  update public.tenants set slug = v_new_slug where id = v_tenant.id;

  return jsonb_build_object(
    'old_slug', v_tenant.slug,
    'new_slug', v_new_slug,
    'redirect_until', clock_timestamp() + interval '30 days'
  );
end;
$$;

revoke all on function public.change_tenant_slug(text) from public, anon, authenticated;
grant execute on function public.change_tenant_slug(text) to authenticated;

create or replace function public.resolve_public_store_slug(p_slug text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select tenant.slug
  from public.tenant_slug_history as history
  join public.tenants as tenant on tenant.id = history.tenant_id
  where history.slug = lower(btrim(p_slug))
    and history.redirect_until > clock_timestamp()
    and tenant.status in ('ativo', 'inadimplente')
  limit 1;
$$;

revoke all on function public.resolve_public_store_slug(text) from public, anon, authenticated;
grant execute on function public.resolve_public_store_slug(text) to anon, authenticated;

create or replace function public.get_own_tenant_redirect_slugs()
returns setof text
language sql
stable
security definer
set search_path = ''
as $$
  select history.slug
  from public.tenant_slug_history as history
  join public.tenants as tenant on tenant.id = history.tenant_id
  where tenant.owner_user_id = auth.uid()
    and history.redirect_until > clock_timestamp()
  order by history.created_at;
$$;

revoke all on function public.get_own_tenant_redirect_slugs() from public, anon, authenticated;
grant execute on function public.get_own_tenant_redirect_slugs() to authenticated;

commit;
