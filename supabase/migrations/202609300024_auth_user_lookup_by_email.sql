-- O webhook precisa localizar o usuário do Supabase Auth quando createUser
-- informa que o e-mail já existe. Antes, a aplicação paginava todos os
-- usuários com auth.admin.listUsers, custo que cresce com a base inteira.
-- Esta RPC faz a busca direta por e-mail e fica restrita à service_role.
begin;

create or replace function public.find_auth_user_id_by_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth_user.id
  from auth.users as auth_user
  where lower(auth_user.email) = lower(btrim(p_email))
  order by auth_user.created_at
  limit 1;
$$;

revoke all on function public.find_auth_user_id_by_email(text) from public, anon, authenticated;
grant execute on function public.find_auth_user_id_by_email(text) to service_role;

comment on function public.find_auth_user_id_by_email(text) is
  'Localiza o usuário do Auth pelo e-mail normalizado; uso exclusivo do backend.';

commit;

-- Conferência esperada após a execução: true, false, false.
select
  has_function_privilege('service_role', 'public.find_auth_user_id_by_email(text)', 'EXECUTE')
    as backend_pode_buscar_usuario,
  has_function_privilege('authenticated', 'public.find_auth_user_id_by_email(text)', 'EXECUTE')
    as titular_pode_buscar_usuario,
  has_function_privilege('anon', 'public.find_auth_user_id_by_email(text)', 'EXECUTE')
    as visitante_pode_buscar_usuario;
