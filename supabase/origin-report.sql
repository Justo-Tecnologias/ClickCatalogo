-- Aquisição por canal dos últimos 30 dias (somente leitura). Execute no SQL Editor.
-- Conta só o que chegou por um link com ?origem= (docs/LINKS-DIVULGACAO.md).
-- "sem_origem" é a diferença para o funil geral (funnel-report.sql): acesso
-- direto, Google, link sem etiqueta ou outra aba.
-- A última coluna mostra as lojas criadas por canal e quantas já publicaram.

with periodo as (
  select (clock_timestamp() at time zone 'America/Sao_Paulo')::date - 30 as desde
),
por_canal as (
  select
    origem,
    sum(event_count) filter (where event_name = 'landing_view') as visitas_landing,
    sum(event_count) filter (where event_name = 'how_it_works_view') as visitas_como_funciona,
    sum(event_count) filter (where event_name = 'signup_started') as abriu_cadastro,
    sum(event_count) filter (where event_name = 'signup_step_completed') as concluiu_dados,
    sum(event_count) filter (where event_name = 'draft_created') as criou_loja
  from public.acquisition_metrics_daily, periodo
  where metric_date >= periodo.desde
  group by origem
),
geral as (
  select
    sum(event_count) filter (where event_name = 'landing_view') as visitas_landing,
    sum(event_count) filter (where event_name = 'how_it_works_view') as visitas_como_funciona,
    sum(event_count) filter (where event_name = 'signup_started') as abriu_cadastro,
    sum(event_count) filter (where event_name = 'signup_step_completed') as concluiu_dados,
    sum(event_count) filter (where event_name = 'draft_created') as criou_loja
  from public.product_metrics_daily, periodo
  where metric_date >= periodo.desde
),
lojas as (
  select
    coalesce(origem_cadastro, 'sem_origem') as origem,
    count(*) as lojas_criadas,
    count(*) filter (where status in ('ativo', 'inadimplente', 'cancelado')) as lojas_publicadas
  from public.tenants, periodo
  where created_at >= periodo.desde
  group by 1
),
linhas as (
  select * from por_canal
  union all
  select
    'sem_origem',
    coalesce(geral.visitas_landing, 0) - coalesce((select sum(visitas_landing) from por_canal), 0),
    coalesce(geral.visitas_como_funciona, 0) - coalesce((select sum(visitas_como_funciona) from por_canal), 0),
    coalesce(geral.abriu_cadastro, 0) - coalesce((select sum(abriu_cadastro) from por_canal), 0),
    coalesce(geral.concluiu_dados, 0) - coalesce((select sum(concluiu_dados) from por_canal), 0),
    coalesce(geral.criou_loja, 0) - coalesce((select sum(criou_loja) from por_canal), 0)
  from geral
)
select
  coalesce(linhas.origem, lojas.origem) as origem,
  coalesce(linhas.visitas_landing, 0) as visitas_landing,
  coalesce(linhas.visitas_como_funciona, 0) as visitas_como_funciona,
  coalesce(linhas.abriu_cadastro, 0) as abriu_cadastro,
  coalesce(linhas.concluiu_dados, 0) as concluiu_dados,
  coalesce(linhas.criou_loja, 0) as criou_loja,
  coalesce(lojas.lojas_publicadas, 0) as lojas_publicadas
from linhas
full join lojas on lojas.origem = linhas.origem
order by (coalesce(linhas.origem, lojas.origem) = 'sem_origem'), visitas_landing desc, origem;
