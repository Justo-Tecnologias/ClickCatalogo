-- ClickCatálogo — prepara duas lojas controladas para demonstração comercial.
--
-- Escopo estrito:
--   1. loja atualmente identificada por sabor-da-vila4 ou sabor-da-vila;
--   2. loja atualmente identificada por loja-teste-netlify ou atelie-aurora.
--
-- Preserva proprietário, WhatsApp, assinatura e registros financeiros.
-- Substitui apenas identidade pública, categorias e produtos desses dois tenants.
-- Execute no SQL Editor de Produção somente depois que os SVGs em public/demo
-- estiverem publicados pela Netlify.

begin;

do $$
declare
  v_food_id uuid;
  v_gift_id uuid;
  v_food_old_slug text;
  v_gift_old_slug text;
  v_category_id uuid;
  v_category jsonb;
  v_product jsonb;
begin
  select id, slug into v_food_id, v_food_old_slug
  from public.tenants
  where slug in ('sabor-da-vila4', 'sabor-da-vila')
  order by case when slug = 'sabor-da-vila4' then 0 else 1 end
  limit 1
  for update;

  select id, slug into v_gift_id, v_gift_old_slug
  from public.tenants
  where slug in ('loja-teste-netlify', 'atelie-aurora')
  order by case when slug = 'loja-teste-netlify' then 0 else 1 end
  limit 1
  for update;

  if v_food_id is null then
    raise exception 'A loja sabor-da-vila4/sabor-da-vila não foi encontrada.';
  end if;
  if v_gift_id is null then
    raise exception 'A loja loja-teste-netlify/atelie-aurora não foi encontrada.';
  end if;
  if v_food_id = v_gift_id then
    raise exception 'Os dois slugs apontaram para o mesmo tenant; operação interrompida.';
  end if;

  if exists (select 1 from public.tenants where slug = 'sabor-da-vila' and id <> v_food_id)
    or exists (
      select 1 from public.tenant_slug_history
      where slug = 'sabor-da-vila' and tenant_id <> v_food_id and redirect_until > clock_timestamp()
    ) then
    raise exception 'O slug sabor-da-vila pertence ou está reservado para outra loja.';
  end if;

  if exists (select 1 from public.tenants where slug = 'atelie-aurora' and id <> v_gift_id)
    or exists (
      select 1 from public.tenant_slug_history
      where slug = 'atelie-aurora' and tenant_id <> v_gift_id and redirect_until > clock_timestamp()
    ) then
    raise exception 'O slug atelie-aurora pertence ou está reservado para outra loja.';
  end if;

  -- Estas são lojas técnicas controladas. Os aliases de testes anteriores são
  -- liberados e somente o endereço imediatamente anterior fica redirecionando.
  delete from public.tenant_slug_history where tenant_id in (v_food_id, v_gift_id);

  if v_food_old_slug <> 'sabor-da-vila' then
    insert into public.tenant_slug_history (slug, tenant_id, redirect_until)
    values (v_food_old_slug, v_food_id, clock_timestamp() + interval '30 days');
  end if;

  if v_gift_old_slug <> 'atelie-aurora' then
    insert into public.tenant_slug_history (slug, tenant_id, redirect_until)
    values (v_gift_old_slug, v_gift_id, clock_timestamp() + interval '30 days');
  end if;

  update public.tenants
  set
    slug = 'sabor-da-vila',
    nome_loja = 'Sabor da Vila',
    descricao_curta = 'Cafés especiais, doces artesanais e presentes preparados com carinho.',
    logo_url = '/demo/sabor-da-vila-logo.svg',
    banner_url = '/demo/sabor-da-vila-banner.svg',
    instagram = null,
    endereco = null,
    tema = 'natural'
  where id = v_food_id;

  update public.tenants
  set
    slug = 'atelie-aurora',
    nome_loja = 'Ateliê Aurora',
    descricao_curta = 'Presentes artesanais, velas e detalhes para transformar pequenos momentos.',
    logo_url = '/demo/atelie-aurora-logo.svg',
    banner_url = '/demo/atelie-aurora-banner.svg',
    instagram = null,
    endereco = null,
    tema = 'elegante'
  where id = v_gift_id;

  delete from public.products where tenant_id in (v_food_id, v_gift_id);
  delete from public.categories where tenant_id in (v_food_id, v_gift_id);

  for v_category in
    select value from jsonb_array_elements(
      '[
        {"name":"Destaques","order":0,"products":[
          ["Cesta café da manhã",89.90,"Uma seleção especial para começar o dia com carinho.","Serve duas pessoas","/demo/kit-afeto.svg"],
          ["Bolo da casa",54.90,"Bolo macio preparado no dia com cobertura artesanal.","Consulte os sabores","/demo/vela-aurora.svg"],
          ["Kit pausa da tarde",69.90,"Café, caneca e acompanhamentos em uma embalagem para presente.","Cartão incluso","/demo/caneca-orvalho.svg"]
        ]},
        {"name":"Cafés","order":1,"products":[
          ["Espresso clássico",8.00,"Café intenso e aromático, extraído na hora.","50 ml","/demo/caneca-orvalho.svg"],
          ["Cappuccino cremoso",14.90,"Café, leite vaporizado e uma camada cremosa.","Tradicional ou canela","/demo/caneca-orvalho.svg"],
          ["Café gelado",16.00,"Café refrescante servido com gelo.","300 ml","/demo/caneca-orvalho.svg"]
        ]},
        {"name":"Doces artesanais","order":2,"products":[
          ["Brigadeiro tradicional",4.50,"Brigadeiro cremoso finalizado com granulado.","Unidade","/demo/kit-afeto.svg"],
          ["Brigadeiro de pistache",6.50,"Brigadeiro artesanal com pistache.","Unidade","/demo/kit-afeto.svg"],
          ["Brownie de chocolate",12.00,"Brownie intenso com casquinha crocante.","Unidade","/demo/vela-aurora.svg"],
          ["Cookie especial",9.50,"Cookie macio com gotas de chocolate.","Unidade","/demo/vela-aurora.svg"],
          ["Cheesecake de frutas vermelhas",16.00,"Cheesecake leve com cobertura de frutas vermelhas.","Fatia","/demo/vela-aurora.svg"]
        ]},
        {"name":"Kits e presentes","order":3,"products":[
          ["Caneca com café especial",49.90,"Caneca acompanhada de café selecionado.","Embalagem para presente","/demo/caneca-orvalho.svg"],
          ["Caixa carinho",79.90,"Uma seleção de doces e pequenos presentes.","Cartão incluso","/demo/kit-afeto.svg"],
          ["Combo café para dois",39.90,"Dois cafés e dois acompanhamentos à escolha.","Serve duas pessoas","/demo/bolsa-essencial.svg"]
        ]}
      ]'::jsonb
    )
  loop
    insert into public.categories (tenant_id, nome, ordem)
    values (v_food_id, v_category->>'name', (v_category->>'order')::integer)
    returning id into v_category_id;

    for v_product in select value from jsonb_array_elements(v_category->'products')
    loop
      insert into public.products (
        tenant_id, category_id, nome, preco, descricao, variacao_info, imagem_url, ativo, ordem
      ) values (
        v_food_id,
        v_category_id,
        v_product->>0,
        (v_product->>1)::numeric(10,2),
        v_product->>2,
        v_product->>3,
        v_product->>4,
        true,
        coalesce((select max(ordem) + 1 from public.products where category_id = v_category_id), 0)
      );
    end loop;
  end loop;

  for v_category in
    select value from jsonb_array_elements(
      '[
        {"name":"Novidades","order":0,"products":[
          ["Kit Afeto",84.90,"Caixa artesanal com vela, caneca e cartão para presentear.","Escolha a mensagem do cartão","/demo/kit-afeto.svg"],
          ["Vela Aurora",42.00,"Vela aromática produzida em pequenos lotes.","Lavanda, baunilha ou capim-limão","/demo/vela-aurora.svg"],
          ["Caneca Orvalho",49.90,"Caneca artesanal em tons suaves para tornar a pausa mais especial.","Verde ou rosé","/demo/caneca-orvalho.svg"]
        ]},
        {"name":"Velas e aromas","order":1,"products":[
          ["Vela Jardim",38.00,"Aroma floral delicado em recipiente reutilizável.","180 g","/demo/vela-aurora.svg"],
          ["Vela Aconchego",46.00,"Notas quentes de baunilha e madeira.","220 g","/demo/vela-aurora.svg"],
          ["Dupla de velas",74.90,"Duas velas artesanais prontas para presentear.","Escolha dois aromas","/demo/vela-aurora.svg"]
        ]},
        {"name":"Casa e afeto","order":2,"products":[
          ["Caneca Essencial",44.90,"Caneca de acabamento fosco para cafés e chás.","300 ml","/demo/caneca-orvalho.svg"],
          ["Bolsa Essencial",69.90,"Bolsa leve para acompanhar a rotina.","Cru ou terracota","/demo/bolsa-essencial.svg"]
        ]},
        {"name":"Para presentear","order":3,"products":[
          ["Caixa Celebração",119.90,"Seleção artesanal para aniversários e datas especiais.","Personalização sob consulta","/demo/kit-afeto.svg"],
          ["Presente Pequenos Momentos",59.90,"Vela aromática e cartão em embalagem delicada.","Mensagem personalizada","/demo/kit-afeto.svg"],
          ["Kit Casa Aconchegante",139.90,"Caneca, vela e bolsa em um conjunto completo.","Embalagem para presente","/demo/bolsa-essencial.svg"]
        ]}
      ]'::jsonb
    )
  loop
    insert into public.categories (tenant_id, nome, ordem)
    values (v_gift_id, v_category->>'name', (v_category->>'order')::integer)
    returning id into v_category_id;

    for v_product in select value from jsonb_array_elements(v_category->'products')
    loop
      insert into public.products (
        tenant_id, category_id, nome, preco, descricao, variacao_info, imagem_url, ativo, ordem
      ) values (
        v_gift_id,
        v_category_id,
        v_product->>0,
        (v_product->>1)::numeric(10,2),
        v_product->>2,
        v_product->>3,
        v_product->>4,
        true,
        coalesce((select max(ordem) + 1 from public.products where category_id = v_category_id), 0)
      );
    end loop;
  end loop;
end
$$;

commit;

-- Resultado sanitizado para conferência.
select
  t.slug,
  t.nome_loja,
  t.tema,
  count(distinct c.id) as categorias,
  count(distinct p.id) filter (where p.ativo) as produtos_ativos
from public.tenants t
left join public.categories c on c.tenant_id = t.id
left join public.products p on p.tenant_id = t.id
where t.slug in ('sabor-da-vila', 'atelie-aurora')
group by t.id, t.slug, t.nome_loja, t.tema
order by t.slug;
