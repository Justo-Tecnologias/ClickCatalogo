-- ClickCatálogo — teste adversarial de isolamento multi-tenant.
-- Requer pelo menos duas lojas pertencentes a usuários diferentes.
-- Rode no SQL Editor. Tudo ocorre dentro de uma transação revertida.

begin;

create temporary table isolation_probe as
select
  (array_agg(id order by created_at))[1] as tenant_a,
  (array_agg(owner_user_id order by created_at))[1] as owner_a,
  (array_agg(id order by created_at))[2] as tenant_b
from public.tenants;

do $$
begin
  if (select tenant_b is null from isolation_probe) then
    raise exception 'O teste requer duas lojas de usuários diferentes.';
  end if;
end;
$$;

grant select on isolation_probe to authenticated;
set local role authenticated;
select set_config('request.jwt.claim.sub', (select owner_a::text from isolation_probe), true);
select set_config('request.jwt.claim.role', 'authenticated', true);

do $$
declare
  affected integer;
begin
  if exists (
    select 1 from public.tenants
    where id = (select tenant_b from isolation_probe)
  ) then
    raise exception 'Falha RLS: usuário A conseguiu ler a loja B.';
  end if;

  if exists (
    select 1 from public.categories
    where tenant_id = (select tenant_b from isolation_probe)
  ) then
    raise exception 'Falha RLS: usuário A conseguiu ler categorias da loja B.';
  end if;

  if exists (
    select 1 from public.products
    where tenant_id = (select tenant_b from isolation_probe)
  ) then
    raise exception 'Falha RLS: usuário A conseguiu ler produtos da loja B.';
  end if;

  if exists (
    select 1 from public.subscriptions
    where tenant_id = (select tenant_b from isolation_probe)
  ) then
    raise exception 'Falha RLS: usuário A conseguiu ler a assinatura da loja B.';
  end if;

  update public.tenants
  set nome_loja = nome_loja
  where id = (select tenant_b from isolation_probe);
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Falha RLS: usuário A conseguiu alterar a loja B.';
  end if;

  begin
    insert into public.categories (nome, ordem, tenant_id)
    values ('Teste de isolamento', 999, (select tenant_b from isolation_probe));
    raise exception 'Falha RLS: usuário A conseguiu inserir categoria na loja B.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.reorder_categories(
      (select tenant_b from isolation_probe),
      array[]::uuid[]
    );
    raise exception 'Falha RPC: usuário A conseguiu reordenar a loja B.';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into storage.objects (bucket_id, name, metadata)
    values (
      'produtos',
      (select tenant_b::text from isolation_probe) || '/isolation-probe.webp',
      '{}'::jsonb
    );
    raise exception 'Falha Storage: usuário A conseguiu gravar na pasta da loja B.';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

select 'OK — isolamento entre as duas lojas confirmado e nenhuma alteração persistida.' as resultado;

rollback;
