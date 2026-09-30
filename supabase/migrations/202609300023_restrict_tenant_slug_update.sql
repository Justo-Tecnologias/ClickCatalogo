-- O endereço público só pode mudar pela RPC change_tenant_slug, que registra o
-- histórico, respeita aliases protegidos, reservas de cadastro e o limite de
-- links antigos. A permissão direta de UPDATE na coluna slug permitia contornar
-- essas regras pela API do Supabase com a sessão do próprio titular.
--
-- Revogar o UPDATE da tabela remove também os privilégios por coluna; em
-- seguida, somente as colunas editáveis pelo painel são concedidas novamente.
-- A RPC security definer continua alterando o slug com o papel proprietário.
begin;

revoke update on table public.tenants from authenticated;

grant update (
  nome_loja,
  logo_url,
  banner_url,
  descricao_curta,
  whatsapp,
  instagram,
  endereco,
  tema
) on table public.tenants to authenticated;

commit;

-- Conferência esperada após a execução: false, true, true.
select
  has_column_privilege('authenticated', 'public.tenants', 'slug', 'UPDATE')
    as titular_altera_slug_diretamente,
  has_column_privilege('authenticated', 'public.tenants', 'nome_loja', 'UPDATE')
    as titular_altera_nome_da_loja,
  has_function_privilege('authenticated', 'public.change_tenant_slug(text)', 'EXECUTE')
    as titular_altera_slug_pela_rpc;
