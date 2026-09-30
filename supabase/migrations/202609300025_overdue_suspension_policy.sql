-- Política de pagamento em atraso (Release B).
--
-- overdue_since guarda a data de vencimento da cobrança não paga. Com base no
-- calendário de São Paulo:
--   * dias 0 a 7: loja no ar, painel avisa e o titular recebe e-mails;
--   * a partir do dia 8: catálogo público fica indisponível (mensagem neutra);
--   * no dia 30: a Scheduled Function inativa a recorrência, remove cobranças
--     abertas no Asaas e encerra a assinatura, iniciando a retenção.
-- Avisos por e-mail nos dias 1, 6 e 25, enviados uma única vez.
--
-- Mantenha os números alinhados com src/lib/billing/overdue-policy.mjs.
begin;

alter table public.subscriptions
  add column if not exists overdue_since date,
  add column if not exists overdue_invoice_url text,
  add column if not exists overdue_last_notice_day smallint not null default 0,
  add column if not exists overdue_notice_claimed_at timestamptz,
  add column if not exists overdue_cancellation_status text not null default 'not_required',
  add column if not exists overdue_cancellation_checked_at timestamptz;

alter table public.subscriptions
  drop constraint if exists subscriptions_overdue_invoice_url_check,
  drop constraint if exists subscriptions_overdue_last_notice_day_check,
  drop constraint if exists subscriptions_overdue_cancellation_status_check;

alter table public.subscriptions
  add constraint subscriptions_overdue_invoice_url_check check (
    overdue_invoice_url is null
    or (char_length(overdue_invoice_url) <= 2048 and overdue_invoice_url ~ '^https://')
  ),
  add constraint subscriptions_overdue_last_notice_day_check check (
    overdue_last_notice_day in (0, 1, 6, 25)
  ),
  add constraint subscriptions_overdue_cancellation_status_check check (
    overdue_cancellation_status in ('not_required', 'processing', 'attention', 'complete')
  );

create index if not exists subscriptions_overdue_since_idx
  on public.subscriptions (overdue_since)
  where status = 'atrasado' and overdue_since is not null;

-- Transição: quem já estava inadimplente começa a contagem na aplicação desta
-- migration, recebendo o ciclo completo de avisos antes de sair do ar.
update public.subscriptions as subscription
set overdue_since = (clock_timestamp() at time zone 'America/Sao_Paulo')::date
where subscription.status = 'atrasado'
  and subscription.overdue_since is null
  and subscription.cancel_at_period_end = false;

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
    )
    and not exists (
      select 1
      from public.subscriptions as subscription
      where subscription.tenant_id = tenant.id
        and subscription.status = 'atrasado'
        and subscription.cancel_at_period_end = false
        and subscription.overdue_since
          <= (clock_timestamp() at time zone 'America/Sao_Paulo')::date - 8
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
    when tenant.status in ('ativo', 'inadimplente') and exists (
      select 1
      from public.subscriptions as subscription
      where subscription.tenant_id = tenant.id
        and subscription.status = 'atrasado'
        and subscription.cancel_at_period_end = false
        and subscription.overdue_since
          <= (clock_timestamp() at time zone 'America/Sao_Paulo')::date - 8
    ) then 'suspenso'
    else tenant.status
  end
  from public.tenants as tenant
  where tenant.slug = lower(btrim(p_slug));
$$;

revoke all on function public.get_public_catalog(text) from public;
revoke all on function public.get_public_store_status(text) from public;
grant execute on function public.get_public_catalog(text) to anon, authenticated;
grant execute on function public.get_public_store_status(text) to anon, authenticated;

-- Reserva avisos de atraso pendentes. O lease de 10 minutos impede envio
-- duplicado entre execuções concorrentes; o e-mail do titular só sai para a
-- service_role.
create or replace function public.claim_overdue_notices(p_limit integer default 10)
returns table (
  subscription_id uuid,
  tenant_id uuid,
  nome_loja text,
  slug text,
  owner_email text,
  overdue_since date,
  invoice_url text,
  notice_day smallint
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
    raise exception 'Limite de avisos inválido.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select
      subscription.id,
      (case
        when v_today - subscription.overdue_since >= 25 then 25
        when v_today - subscription.overdue_since >= 6 then 6
        else 1
      end)::smallint as target_day
    from public.subscriptions as subscription
    join public.tenants as tenant on tenant.id = subscription.tenant_id
    where subscription.status = 'atrasado'
      and subscription.cancel_at_period_end = false
      and subscription.overdue_since is not null
      and v_today - subscription.overdue_since between 1 and 29
      and tenant.status = 'inadimplente'
      and (
        subscription.overdue_notice_claimed_at is null
        or subscription.overdue_notice_claimed_at < clock_timestamp() - interval '10 minutes'
      )
    order by subscription.overdue_since, subscription.id
    for update of subscription skip locked
  ), due as (
    select candidates.id, candidates.target_day
    from candidates
    join public.subscriptions as subscription on subscription.id = candidates.id
    where candidates.target_day > subscription.overdue_last_notice_day
    limit p_limit
  ), claimed as (
    update public.subscriptions as subscription
    set overdue_notice_claimed_at = clock_timestamp()
    from due
    where subscription.id = due.id
    returning subscription.id, subscription.tenant_id, subscription.overdue_since,
      subscription.overdue_invoice_url, due.target_day
  )
  select
    claimed.id,
    claimed.tenant_id,
    tenant.nome_loja,
    tenant.slug,
    auth_user.email::text,
    claimed.overdue_since,
    claimed.overdue_invoice_url,
    claimed.target_day
  from claimed
  join public.tenants as tenant on tenant.id = claimed.tenant_id
  join auth.users as auth_user on auth_user.id = tenant.owner_user_id;
end;
$$;

-- Reserva assinaturas que chegaram ao 30º dia de atraso para encerramento.
create or replace function public.claim_overdue_cancellations(p_limit integer default 1)
returns setof public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (clock_timestamp() at time zone 'America/Sao_Paulo')::date;
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'Limite de encerramentos inválido.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select subscription.id
    from public.subscriptions as subscription
    where subscription.status = 'atrasado'
      and subscription.cancel_at_period_end = false
      and subscription.reactivation_requested_at is null
      and subscription.overdue_since is not null
      and subscription.overdue_since <= v_today - 30
      and (
        subscription.overdue_cancellation_status = 'not_required'
        or (
          subscription.overdue_cancellation_status = 'attention'
          and (
            subscription.overdue_cancellation_checked_at is null
            or subscription.overdue_cancellation_checked_at < clock_timestamp() - interval '15 minutes'
          )
        )
        or (
          subscription.overdue_cancellation_status = 'processing'
          and (
            subscription.overdue_cancellation_checked_at is null
            or subscription.overdue_cancellation_checked_at < clock_timestamp() - interval '5 minutes'
          )
        )
      )
    order by subscription.overdue_since, subscription.id
    for update skip locked
    limit p_limit
  )
  update public.subscriptions as subscription
  set
    overdue_cancellation_checked_at = clock_timestamp(),
    overdue_cancellation_status = 'processing'
  from candidates
  where subscription.id = candidates.id
  returning subscription.*;
end;
$$;

-- Conclui o encerramento somente se a reserva continua válida e nenhum
-- pagamento reativou a assinatura enquanto o Asaas era conciliado.
create or replace function public.finalize_overdue_cancellation(
  p_subscription_id uuid,
  p_checked_at timestamptz,
  p_remote_state text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
begin
  if p_remote_state not in ('inactive', 'deleted') then
    raise exception 'Estado remoto inválido.' using errcode = '22023';
  end if;

  update public.subscriptions as subscription
  set
    asaas_subscription_state = p_remote_state,
    overdue_cancellation_checked_at = clock_timestamp(),
    overdue_cancellation_status = 'complete',
    overdue_notice_claimed_at = null,
    status = 'cancelado'
  where subscription.id = p_subscription_id
    and subscription.status = 'atrasado'
    and subscription.overdue_cancellation_status = 'processing'
    and subscription.overdue_cancellation_checked_at = p_checked_at
  returning subscription.tenant_id into v_tenant_id;

  if v_tenant_id is null then
    return false;
  end if;

  update public.tenants
  set status = 'cancelado'
  where id = v_tenant_id
    and status in ('ativo', 'inadimplente');

  return true;
end;
$$;

revoke all on function public.claim_overdue_notices(integer) from public, anon, authenticated;
revoke all on function public.claim_overdue_cancellations(integer) from public, anon, authenticated;
revoke all on function public.finalize_overdue_cancellation(uuid, timestamptz, text)
  from public, anon, authenticated;
grant execute on function public.claim_overdue_notices(integer) to service_role;
grant execute on function public.claim_overdue_cancellations(integer) to service_role;
grant execute on function public.finalize_overdue_cancellation(uuid, timestamptz, text) to service_role;

commit;

-- Conferência esperada: as três funções executáveis somente pela service_role
-- (true, false, false) e a quantidade de assinaturas em atraso na transição.
select
  has_function_privilege('service_role', 'public.claim_overdue_notices(integer)', 'EXECUTE')
    as backend_reserva_avisos,
  has_function_privilege('authenticated', 'public.claim_overdue_notices(integer)', 'EXECUTE')
    as titular_reserva_avisos,
  has_function_privilege('anon', 'public.finalize_overdue_cancellation(uuid, timestamptz, text)', 'EXECUTE')
    as visitante_encerra_assinatura,
  (select count(*) from public.subscriptions where status = 'atrasado' and overdue_since is not null)
    as assinaturas_em_atraso;
