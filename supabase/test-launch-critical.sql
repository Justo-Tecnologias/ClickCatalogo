-- ClickCatálogo — teste de integração financeiro, sem cobrança e sem persistir dados.
-- Execute no SQL Editor depois das migrations 011 a 015. Toda escrita é revertida.

begin;

do $$
declare
  v_event_id text := 'clickcatalogo-launch-test-' || extensions.gen_random_uuid()::text;
  v_result text;
  v_attempt integer;
begin
  select public.claim_asaas_webhook_event(
    v_event_id,
    'PAYMENT_CONFIRMED',
    jsonb_build_object('id', v_event_id, 'event', 'PAYMENT_CONFIRMED'),
    300
  ) into v_result;
  if v_result <> 'claimed' then
    raise exception 'primeiro claim deveria retornar claimed, retornou %', v_result;
  end if;

  select public.claim_asaas_webhook_event(
    v_event_id,
    'PAYMENT_CONFIRMED',
    jsonb_build_object('id', v_event_id, 'event', 'PAYMENT_CONFIRMED'),
    300
  ) into v_result;
  if v_result <> 'processing' then
    raise exception 'claim concorrente deveria retornar processing, retornou %', v_result;
  end if;

  update public.asaas_webhook_events
  set processed_at = clock_timestamp()
  where event_id = v_event_id;

  for v_attempt in 1..10 loop
    select public.claim_asaas_webhook_event(
      v_event_id,
      'PAYMENT_CONFIRMED',
      jsonb_build_object('id', v_event_id, 'event', 'PAYMENT_CONFIRMED'),
      300
    ) into v_result;
    if v_result <> 'repeated' then
      raise exception 'reentrega % deveria retornar repeated, retornou %', v_attempt, v_result;
    end if;
  end loop;
end;
$$;

do $$
declare
  v_result record;
begin
  select * into v_result
  from public.consume_api_rate_limit(repeat('e', 64), 2, 60);
  if not v_result.allowed or v_result.remaining <> 1 then
    raise exception 'primeiro consumo do rate limit retornou estado inesperado';
  end if;
end;
$$;

do $$
declare
  v_tenant_id uuid;
  v_subscription_id uuid;
  v_claimed public.subscriptions%rowtype;
begin
  select tenant.id into v_tenant_id
  from public.tenants as tenant
  order by tenant.created_at
  limit 1;

  if v_tenant_id is null then
    raise exception 'crie ao menos um tenant antes de testar o claim de conciliação';
  end if;

  insert into public.subscriptions (
    tenant_id,
    asaas_subscription_id,
    status,
    cancel_at_period_end,
    cancellation_requested_at,
    access_until,
    cancellation_reconciliation_status,
    cancellation_reconciliation_checked_at
  ) values (
    v_tenant_id,
    'launch-claim-test-' || extensions.gen_random_uuid()::text,
    'cancelado',
    true,
    clock_timestamp() - interval '100 years',
    clock_timestamp() + interval '1 day',
    'pending',
    null
  ) returning id into v_subscription_id;

  select * into v_claimed
  from public.claim_subscription_cancellation_reconciliations(1);

  if v_claimed.id is distinct from v_subscription_id
    or v_claimed.cancellation_reconciliation_status <> 'processing' then
    raise exception 'claim de conciliação não reservou a assinatura sintética';
  end if;
end;
$$;

rollback;

select 'ok: webhook, claim de conciliação, 10 reentregas e rate limit validados; nenhuma escrita persistida' as resultado;
