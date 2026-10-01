-- Funil de aquisição dos últimos 30 dias (somente leitura).
-- Contadores diários agregados, sem dados pessoais. Execute no SQL Editor.
-- Observação: em 01/10/2026 houve ~10 eventos artificiais (landing, cadastro e
-- loja vitrine) gerados durante a captura dos prints de /como-funciona.

with periodo as (
  select
    event_name,
    sum(event_count) as total
  from public.product_metrics_daily
  where scope_key = 'global'
    and metric_date >= (clock_timestamp() at time zone 'America/Sao_Paulo')::date - 30
  group by event_name
),
etapas(ordem, event_name, etapa) as (
  values
    (1, 'landing_view', 'Visitou a landing'),
    (2, 'how_it_works_view', 'Visitou /como-funciona'),
    (3, 'signup_started', 'Abriu o cadastro'),
    (4, 'signup_step_completed', 'Concluiu a etapa de dados'),
    (5, 'checkout_created', 'Abriu o checkout'),
    (6, 'payment_confirmed', 'Pagamento confirmado'),
    (7, 'password_created', 'Criou a senha'),
    (8, 'first_product_created', 'Cadastrou o primeiro produto')
)
select
  etapas.ordem,
  etapas.etapa,
  coalesce(periodo.total, 0) as total_30_dias,
  case
    when etapas.ordem > 2 and coalesce((select total from periodo where event_name = 'landing_view'), 0) > 0
      then round(100.0 * coalesce(periodo.total, 0) / (select total from periodo where event_name = 'landing_view'), 1)
  end as percentual_sobre_landing
from etapas
left join periodo on periodo.event_name = etapas.event_name
order by etapas.ordem;
