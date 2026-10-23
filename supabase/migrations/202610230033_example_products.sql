-- Produtos de exemplo: quem vem da prévia (/exemplo) pode criar a loja já com
-- os 6 produtos do nicho, marcados com products.exemplo = true. Eles não contam
-- para publicar nem para os lembretes, e a publicação fica bloqueada enquanto
-- existirem (o titular edita, o que desmarca, ou apaga todos de uma vez).
begin;

alter table public.products
  add column if not exists exemplo boolean not null default false;

-- Lembretes: "adicione produtos" continua valendo enquanto só há exemplos.
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
        and product.exemplo = false
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

commit;

-- Conferência esperada: true, true.
select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'products' and column_name = 'exemplo'
  ) as coluna_exemplo,
  pg_get_functiondef('public.claim_draft_reminders(integer)'::regprocedure) like '%product.exemplo = false%' as lembretes_ignoram_exemplos;
