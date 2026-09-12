-- Registra se cobranças futuras já geradas pelo Asaas foram conciliadas
-- depois da interrupção de uma recorrência. Migration incremental e idempotente.

alter table public.subscriptions
  add column if not exists cancellation_reconciliation_status text not null default 'not_required',
  add column if not exists cancellation_reconciliation_checked_at timestamptz;

alter table public.subscriptions
  drop constraint if exists subscriptions_cancellation_reconciliation_status_check;

alter table public.subscriptions
  add constraint subscriptions_cancellation_reconciliation_status_check check (
    cancellation_reconciliation_status in ('not_required', 'pending', 'complete', 'attention')
  );

create index if not exists subscriptions_cancellation_reconciliation_attention_idx
  on public.subscriptions (
    cancellation_reconciliation_status,
    cancellation_reconciliation_checked_at
  )
  where cancellation_reconciliation_status in ('pending', 'attention');

comment on column public.subscriptions.cancellation_reconciliation_status is
  'Confirma se cobranças futuras pendentes foram verificadas após interromper a recorrência.';
comment on column public.subscriptions.cancellation_reconciliation_checked_at is
  'Instante da última tentativa de conciliação das cobranças futuras.';
