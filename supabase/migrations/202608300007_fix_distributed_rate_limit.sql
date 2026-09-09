-- Corrige a função de rate limiting criada na auditoria pré-lançamento.
-- `current_time` é uma palavra reservada do PostgreSQL e era interpretada
-- como `time with time zone`, em vez da variável `timestamptz` pretendida.

begin;

create or replace function public.consume_api_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (
  allowed boolean,
  remaining integer,
  retry_after integer,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_count integer;
  current_reset timestamptz;
  v_now timestamptz := clock_timestamp();
begin
  if p_key_hash is null or length(p_key_hash) <> 64
    or p_limit < 1
    or p_window_seconds < 1 then
    raise exception 'Parâmetros de rate limit inválidos.' using errcode = '22023';
  end if;

  if random() < 0.01 then
    delete from public.api_rate_limits
    where reset_at < v_now - interval '1 day';
  end if;

  insert into public.api_rate_limits as rate_limit (
    key_hash,
    request_count,
    reset_at,
    updated_at
  )
  values (
    p_key_hash,
    1,
    v_now + make_interval(secs => p_window_seconds),
    v_now
  )
  on conflict (key_hash) do update
  set
    request_count = case
      when rate_limit.reset_at <= v_now then 1
      else rate_limit.request_count + 1
    end,
    reset_at = case
      when rate_limit.reset_at <= v_now
        then v_now + make_interval(secs => p_window_seconds)
      else rate_limit.reset_at
    end,
    updated_at = v_now
  returning request_count, rate_limit.reset_at
  into current_count, current_reset;

  return query select
    current_count <= p_limit,
    greatest(p_limit - current_count, 0),
    greatest(ceil(extract(epoch from current_reset - v_now))::integer, 1),
    current_reset;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer)
  to service_role;

commit;

-- Deve retornar allowed = true e remaining = 1, sem manter a linha de teste.
begin;

select *
from public.consume_api_rate_limit(
  repeat('0', 64),
  2,
  60
);

rollback;
