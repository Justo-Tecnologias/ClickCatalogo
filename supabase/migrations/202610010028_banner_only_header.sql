-- Topo da loja só com o banner: o lojista com banner de arte própria (que já
-- traz o nome da loja) pode esconder nome, logo e degradê sobre a imagem.
-- O site só aplica a opção quando a loja tem banner.
--
-- Aplique ANTES do deploy do código: o formulário "Minha loja" passa a
-- gravar esta coluna.
begin;

alter table public.tenants
  add column if not exists banner_somente boolean not null default false;

-- O titular edita a nova coluna pelo painel; slug continua fora da lista.
revoke update on table public.tenants from authenticated;
grant update (
  nome_loja,
  logo_url,
  banner_url,
  descricao_curta,
  whatsapp,
  instagram,
  endereco,
  tema,
  formas_pagamento,
  entrega_modo,
  entrega_observacao,
  horario_atendimento,
  banner_somente
) on table public.tenants to authenticated;

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
    'banner_somente', tenant.banner_somente,
    'descricao_curta', tenant.descricao_curta,
    'whatsapp', tenant.whatsapp,
    'instagram', tenant.instagram,
    'endereco', tenant.endereco,
    'formas_pagamento', to_jsonb(tenant.formas_pagamento),
    'entrega_modo', tenant.entrega_modo,
    'entrega_observacao', tenant.entrega_observacao,
    'horario_atendimento', tenant.horario_atendimento,
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

revoke all on function public.get_public_catalog(text) from public;
grant execute on function public.get_public_catalog(text) to anon, authenticated;

commit;

-- Conferência esperada: true, false.
select
  has_column_privilege('authenticated', 'public.tenants', 'banner_somente', 'UPDATE')
    as titular_edita_banner_somente,
  has_column_privilege('authenticated', 'public.tenants', 'slug', 'UPDATE')
    as titular_altera_slug_diretamente;
