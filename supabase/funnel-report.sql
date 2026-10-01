-- Funil de aquisição dos últimos 30 dias (somente leitura).
-- Contadores diários agregados, sem dados pessoais. Execute no SQL Editor.
-- Observação: em 01/10/2026 houve ~10 eventos artificiais (landing, cadastro e
-- loja vitrine) gerados durante a captura dos prints de /como-funciona.
--
-- Etapas do cadastro gratuito ("monte grátis, pague para publicar", desde
-- 01/10/2026). Eventos de visitante são gravados no escopo global e os da
-- loja no escopo da própria loja; cada ocorrência é contada uma única vez,
-- então o total soma todos os escopos.

with periodo as (
  select
    event_name,
    sum(event_count) as total
  from public.product_metrics_daily
  where metric_date >= (clock_timestamp() at time zone 'America/Sao_Paulo')::date - 30
  group by event_name
),
etapas(ordem, event_name, etapa) as (
  values
    (1, 'landing_view', 'Visitou a landing'),
    (2, 'how_it_works_view', 'Visitou /como-funciona'),
    (3, 'signup_started', 'Abriu o cadastro'),
    (4, 'signup_step_completed', 'Concluiu a etapa de dados'),
    (5, 'draft_created', 'Criou a loja grátis (rascunho)'),
    (6, 'email_verified', 'Confirmou o e-mail'),
    (7, 'first_product_created', 'Cadastrou o primeiro produto'),
    (8, 'checkout_created', 'Abriu o pagamento para publicar'),
    (9, 'payment_confirmed', 'Publicou (pagamento confirmado)')
)
select
  etapas.ordem,
  etapas.etapa,
  coalesce(periodo.total, 0) as total_30_dias,
  case
    when etapas.ordem > 2 and coalesce((select total from periodo where event_name = 'landing_view'), 0) > 0
      then round(100.0 * coalesce(periodo.total, 0) / (select total from periodo where event_name = 'landing_view'), 1)
  end as percentual_sobre_landing,
  case
    when etapas.ordem > 5 and coalesce((select total from periodo where event_name = 'draft_created'), 0) > 0
      then round(100.0 * coalesce(periodo.total, 0) / (select total from periodo where event_name = 'draft_created'), 1)
  end as percentual_sobre_lojas_criadas
from etapas
left join periodo on periodo.event_name = etapas.event_name
order by etapas.ordem;
