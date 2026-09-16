-- ClickCatálogo — catálogo de teste para a loja sabor-da-vila.
--
-- Objetivo:
--   - validar grid, busca, categorias, carrinho e "Carregar mais";
--   - popular somente o tenant cujo slug atual é "sabor-da-vila";
--   - permitir nova execução sem duplicar categorias ou produtos.
--
-- Este arquivo NÃO faz parte do schema de produção. Execute manualmente no
-- SQL Editor do Supabase apenas no projeto/ambiente em que a loja de teste existe.

begin;

do $$
declare
  v_tenant_id uuid;
  v_category_id uuid;
  v_category jsonb;
  v_product jsonb;
begin
  select t.id
    into v_tenant_id
  from public.tenants t
  where t.slug = 'sabor-da-vila'
     or exists (
       select 1
       from public.tenant_slug_history h
       where h.tenant_id = t.id
         and h.slug = 'sabor-da-vila'
     )
  limit 1;

  if v_tenant_id is null then
    raise exception 'A loja de teste com slug sabor-da-vila não foi encontrada';
  end if;

  for v_category in
    select value
    from jsonb_array_elements(
      $catalog$
      [
        {
          "name": "Destaques",
          "order": 0,
          "products": [
            ["Cesta café da manhã", 89.90, "Uma seleção especial para começar o dia com carinho.", "Serve duas pessoas", "/demo/kit-afeto.svg"],
            ["Bolo da casa", 54.90, "Bolo macio preparado no dia com cobertura artesanal.", "Consulte os sabores", "/demo/vela-aurora.svg"],
            ["Kit pausa da tarde", 69.90, "Café, caneca e acompanhamentos para presentear.", "Embalagem para presente", "/demo/caneca-orvalho.svg"]
          ]
        },
        {
          "name": "Cafés",
          "order": 1,
          "products": [
            ["Espresso clássico", 8.00, "Café intenso e aromático, extraído na hora.", "50 ml", "/demo/caneca-orvalho.svg"],
            ["Cappuccino cremoso", 14.90, "Café, leite vaporizado e uma camada cremosa.", "Tradicional ou canela", "/demo/caneca-orvalho.svg"]
          ]
        },
        {
          "name": "Bolos e tortas",
          "order": 2,
          "products": [
            ["Bolo de cenoura", 42.00, "Massa fofinha com cobertura de chocolate.", "Aproximadamente 8 fatias", "/demo/vela-aurora.svg"],
            ["Torta de limão", 58.00, "Base crocante, creme de limão e merengue leve.", "Aproximadamente 10 fatias", "/demo/vela-aurora.svg"]
          ]
        },
        {
          "name": "Doces e sobremesas",
          "order": 3,
          "products": [
            ["Brigadeiro tradicional", 4.50, "Brigadeiro cremoso finalizado com granulado.", "Unidade", "/demo/kit-afeto.svg"],
            ["Brigadeiro de pistache", 6.50, "Brigadeiro artesanal com pistache.", "Unidade", "/demo/kit-afeto.svg"],
            ["Beijinho de coco", 4.50, "Doce de coco macio e delicado.", "Unidade", "/demo/kit-afeto.svg"],
            ["Brownie de chocolate", 12.00, "Brownie intenso com casquinha crocante.", "Unidade", "/demo/vela-aurora.svg"],
            ["Cookie com gotas de chocolate", 9.50, "Cookie macio por dentro e dourado por fora.", "Unidade", "/demo/vela-aurora.svg"],
            ["Palha italiana", 8.00, "Brigadeiro com biscoito em uma porção generosa.", "Unidade", "/demo/kit-afeto.svg"],
            ["Pudim de leite", 10.00, "Pudim cremoso com calda de caramelo.", "Fatia", "/demo/vela-aurora.svg"],
            ["Cheesecake de frutas vermelhas", 16.00, "Cheesecake leve com cobertura de frutas vermelhas.", "Fatia", "/demo/vela-aurora.svg"],
            ["Banoffee", 15.00, "Banana, doce de leite e chantilly sobre base crocante.", "Fatia", "/demo/vela-aurora.svg"],
            ["Mousse de maracujá", 9.00, "Sobremesa leve com sabor marcante de maracujá.", "Pote individual", "/demo/kit-afeto.svg"],
            ["Mousse de chocolate", 10.00, "Mousse aerada feita com chocolate meio amargo.", "Pote individual", "/demo/kit-afeto.svg"],
            ["Mini churros", 14.00, "Porção de mini churros com açúcar e canela.", "6 unidades", "/demo/kit-afeto.svg"],
            ["Sonho recheado", 9.00, "Massa leve com recheio cremoso.", "Creme ou doce de leite", "/demo/vela-aurora.svg"],
            ["Fatia de red velvet", 17.00, "Massa aveludada com creme suave.", "Fatia", "/demo/vela-aurora.svg"],
            ["Fatia de chocolate", 15.00, "Bolo de chocolate com recheio cremoso.", "Fatia", "/demo/vela-aurora.svg"],
            ["Fatia de coco", 14.00, "Bolo úmido de coco com cobertura delicada.", "Fatia", "/demo/vela-aurora.svg"],
            ["Cupcake de baunilha", 11.00, "Cupcake de baunilha com cobertura cremosa.", "Unidade", "/demo/kit-afeto.svg"],
            ["Cupcake de chocolate", 12.00, "Cupcake de chocolate com ganache.", "Unidade", "/demo/kit-afeto.svg"],
            ["Caixa com 4 doces", 22.00, "Seleção de quatro doces artesanais.", "Sabores variados", "/demo/kit-afeto.svg"],
            ["Caixa com 8 doces", 40.00, "Seleção de oito doces artesanais.", "Sabores variados", "/demo/kit-afeto.svg"],
            ["Caixa com 12 doces", 57.00, "Seleção de doze doces artesanais.", "Sabores variados", "/demo/kit-afeto.svg"]
          ]
        },
        {
          "name": "Salgados",
          "order": 4,
          "products": [
            ["Pão de queijo", 7.00, "Pão de queijo assado na hora.", "Porção com 4 unidades", "/demo/bolsa-essencial.svg"],
            ["Quiche do dia", 13.00, "Quiche artesanal com recheio especial do dia.", "Consulte o sabor", "/demo/bolsa-essencial.svg"]
          ]
        },
        {
          "name": "Bebidas geladas",
          "order": 5,
          "products": [
            ["Café gelado", 16.00, "Café refrescante servido com gelo.", "300 ml", "/demo/caneca-orvalho.svg"],
            ["Suco natural", 12.00, "Suco preparado na hora com fruta selecionada.", "Consulte os sabores", "/demo/caneca-orvalho.svg"]
          ]
        },
        {
          "name": "Presentes",
          "order": 6,
          "products": [
            ["Caneca com café especial", 49.90, "Caneca acompanhada de café selecionado.", "Embalagem para presente", "/demo/caneca-orvalho.svg"],
            ["Caixa carinho", 79.90, "Uma seleção de doces e pequenos presentes.", "Cartão incluso", "/demo/kit-afeto.svg"]
          ]
        },
        {
          "name": "Kits e combos",
          "order": 7,
          "products": [
            ["Combo café para dois", 39.90, "Dois cafés e dois acompanhamentos à escolha.", "Serve duas pessoas", "/demo/bolsa-essencial.svg"],
            ["Combo família", 99.90, "Bolo, bebida e doces para compartilhar.", "Serve até quatro pessoas", "/demo/kit-afeto.svg"]
          ]
        },
        {
          "name": "Datas especiais",
          "order": 8,
          "products": [
            ["Caixa celebração", 119.90, "Kit completo para transformar uma data em lembrança.", "Personalização sob consulta", "/demo/kit-afeto.svg"],
            ["Mini festa", 149.90, "Bolo, doces e salgados em um único kit.", "Serve até seis pessoas", "/demo/vela-aurora.svg"]
          ]
        }
      ]
      $catalog$::jsonb
    )
  loop
    insert into public.categories (tenant_id, nome, ordem)
    values (
      v_tenant_id,
      v_category->>'name',
      (v_category->>'order')::integer
    )
    on conflict do nothing;

    select id
      into v_category_id
    from public.categories
    where tenant_id = v_tenant_id
      and lower(btrim(nome)) = lower(btrim(v_category->>'name'))
    limit 1;

    for v_product in
      select value
      from jsonb_array_elements(v_category->'products')
    loop
      if not exists (
        select 1
        from public.products
        where tenant_id = v_tenant_id
          and category_id = v_category_id
          and lower(btrim(nome)) = lower(btrim(v_product->>0))
      ) then
        insert into public.products (
          tenant_id,
          category_id,
          nome,
          preco,
          descricao,
          variacao_info,
          imagem_url,
          ativo,
          ordem
        )
        values (
          v_tenant_id,
          v_category_id,
          v_product->>0,
          (v_product->>1)::numeric(10, 2),
          v_product->>2,
          v_product->>3,
          v_product->>4,
          true,
          coalesce((
            select max(ordem) + 1
            from public.products
            where tenant_id = v_tenant_id
              and category_id = v_category_id
          ), 0)
        );
      end if;
    end loop;
  end loop;
end
$$;

commit;

select
  t.slug as slug_atual,
  count(distinct c.id) as categorias,
  count(distinct p.id) filter (where p.ativo) as produtos_ativos
from public.tenants t
left join public.categories c on c.tenant_id = t.id
left join public.products p on p.tenant_id = t.id and p.category_id = c.id
where t.slug = 'sabor-da-vila'
   or exists (
     select 1
     from public.tenant_slug_history h
     where h.tenant_id = t.id
       and h.slug = 'sabor-da-vila'
   )
group by t.slug;
