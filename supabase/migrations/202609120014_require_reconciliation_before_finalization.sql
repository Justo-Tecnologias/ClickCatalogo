-- Impede que o acesso seja finalizado enquanto a interrupção da recorrência e
-- as cobranças posteriores ao período pago ainda não foram conciliadas.

create or replace function public.finalize_due_subscription_cancellations(
  p_now timestamptz default clock_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  finalized_count integer := 0;
begin
  with due_subscriptions as (
    update public.subscriptions
    set status = 'cancelado'
    where cancel_at_period_end = true
      and cancellation_reconciliation_status = 'complete'
      and access_until <= coalesce(p_now, clock_timestamp())
      and (
        reactivation_requested_at is null
        or reactivation_requested_at < coalesce(p_now, clock_timestamp()) - interval '10 minutes'
      )
      and status in ('ativo', 'atrasado')
    returning tenant_id
  ), finalized_tenants as (
    update public.tenants as tenant
    set
      canceled_at = coalesce(tenant.canceled_at, coalesce(p_now, clock_timestamp())),
      status = 'cancelado'
    where tenant.id in (select due.tenant_id from due_subscriptions as due)
    returning tenant.id
  )
  select count(*)::integer
  into finalized_count
  from due_subscriptions;

  return finalized_count;
end;
$$;

revoke all on function public.finalize_due_subscription_cancellations(timestamptz)
  from public, anon, authenticated;
grant execute on function public.finalize_due_subscription_cancellations(timestamptz)
  to service_role;

comment on function public.finalize_due_subscription_cancellations(timestamptz) is
  'Finaliza somente cancelamentos vencidos cuja conciliação financeira foi concluída.';
