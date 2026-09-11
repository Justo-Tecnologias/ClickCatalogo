-- ClickCatálogo — teste de integração financeiro, sem cobrança e sem persistir dados.
-- Execute no SQL Editor depois das migrations 011 e 012. Toda escrita é revertida.

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

rollback;

select 'ok: claims concorrentes, 10 reentregas e rate limit validados; nenhuma escrita persistida' as resultado;
