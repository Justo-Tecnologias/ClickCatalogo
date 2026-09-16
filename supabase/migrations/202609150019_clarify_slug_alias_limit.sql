begin;

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
  v_next_alias_release_at timestamptz;
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

  delete from public.tenant_slug_history where redirect_until <= clock_timestamp();

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

  select count(*)::integer, min(history.redirect_until)
  into v_active_aliases, v_next_alias_release_at
  from public.tenant_slug_history as history
  where history.tenant_id = v_tenant.id and history.redirect_until > clock_timestamp();

  if v_active_aliases >= 3 and v_history_owner is null then
    raise exception 'Você já possui três links antigos protegidos. Reutilize um deles ou escolha um novo após %.',
      to_char(v_next_alias_release_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY "às" HH24:MI')
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

commit;
