begin;

-- Lista somente os aliases da loja pertencente ao usuário autenticado. A ação
-- do painel usa o resultado para invalidar todos os redirects após uma troca.
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
