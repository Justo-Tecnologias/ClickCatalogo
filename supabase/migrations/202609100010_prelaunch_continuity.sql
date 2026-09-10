-- ClickCatálogo — continuidade de cadastro e cancelamento no fim do período pago.
-- Execute após 202608300009_privacy_retention_and_deletion.sql.

alter table public.subscriptions
  add column if not exists cancel_at_period_end boolean not null default false,
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists access_until timestamptz;

alter table public.subscriptions
  drop constraint if exists subscriptions_scheduled_cancellation_check;

alter table public.subscriptions
  add constraint subscriptions_scheduled_cancellation_check check (
    not cancel_at_period_end
    or (
      cancellation_requested_at is not null
      and access_until is not null
    )
  );

create index if not exists subscriptions_scheduled_cancellation_idx
  on public.subscriptions (access_until)
  where cancel_at_period_end = true
    and status in ('ativo', 'atrasado');

-- O catálogo também confere access_until, portanto uma eventual falha do
-- agendador não mantém uma loja vencida visível ao público.
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

-- Chamada pela Scheduled Function da Netlify. A operação é idempotente:
-- execuções repetidas não alteram novamente assinaturas já encerradas.
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
comment on function public.finalize_due_subscription_cancellations(timestamptz) is
  'Finaliza assinaturas com cancelamento agendado cujo período pago terminou.';
