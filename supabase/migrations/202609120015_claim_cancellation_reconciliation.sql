-- Serializa a conciliação financeira contra reativação e execuções concorrentes.

alter table public.subscriptions
  drop constraint if exists subscriptions_cancellation_reconciliation_status_check;

alter table public.subscriptions
  add constraint subscriptions_cancellation_reconciliation_status_check check (
    cancellation_reconciliation_status in (
      'not_required', 'pending', 'processing', 'complete', 'attention'
    )
  );

drop index if exists public.subscriptions_cancellation_reconciliation_attention_idx;
create index subscriptions_cancellation_reconciliation_attention_idx
  on public.subscriptions (
    cancellation_reconciliation_status,
    cancellation_reconciliation_checked_at
  )
  where cancellation_reconciliation_status in ('pending', 'processing', 'attention');

create or replace function public.claim_subscription_cancellation_reconciliations(
  p_limit integer default 1
)
returns setof public.subscriptions
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limit < 1 or p_limit > 10 then
    raise exception 'Limite de conciliações inválido.' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select subscription.id
    from public.subscriptions as subscription
    where subscription.cancel_at_period_end = true
      and (
        subscription.cancellation_reconciliation_status = 'pending'
        or (
          subscription.cancellation_reconciliation_status = 'attention'
          and (
            subscription.cancellation_reconciliation_checked_at is null
            or subscription.cancellation_reconciliation_checked_at
              < clock_timestamp() - interval '15 minutes'
          )
        )
        or (
          subscription.cancellation_reconciliation_status = 'processing'
          and (
            subscription.cancellation_reconciliation_checked_at is null
            or subscription.cancellation_reconciliation_checked_at
              < clock_timestamp() - interval '2 minutes'
          )
        )
      )
      and subscription.reactivation_requested_at is null
    order by subscription.cancellation_reconciliation_checked_at nulls first,
      subscription.cancellation_requested_at nulls first,
      subscription.created_at
    for update skip locked
    limit p_limit
  )
  update public.subscriptions as subscription
  set
    cancellation_reconciliation_checked_at = clock_timestamp(),
    cancellation_reconciliation_status = 'processing'
  from candidates
  where subscription.id = candidates.id
  returning subscription.*;
end;
$$;

revoke all on function public.claim_subscription_cancellation_reconciliations(integer)
  from public, anon, authenticated;
grant execute on function public.claim_subscription_cancellation_reconciliations(integer)
  to service_role;

comment on function public.claim_subscription_cancellation_reconciliations(integer) is
  'Reserva conciliações com lease de dois minutos e impede disputa com reativação.';
