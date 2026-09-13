-- Permite retomar um checkout expirado sem duplicar sessões em cliques concorrentes.

begin;

alter table public.signup_intents
  add column if not exists checkout_creation_started_at timestamptz,
  add column if not exists checkout_returned_at timestamptz;

create or replace function public.claim_signup_checkout_restart(
  p_external_reference uuid,
  p_lease_seconds integer default 120
)
returns table (
  outcome text,
  checkout_url text,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent public.signup_intents%rowtype;
  v_claimed_at timestamptz;
begin
  if p_lease_seconds < 30 or p_lease_seconds > 300 then
    raise exception 'Lease de checkout inválido.' using errcode = '22023';
  end if;

  select * into v_intent
  from public.signup_intents as intent
  where intent.external_reference = p_external_reference
  for update;

  if not found or v_intent.status = 'pago' or v_intent.provisioned_tenant_id is not null then
    return query select 'state_changed'::text, null::text, null::timestamptz;
    return;
  end if;

  if v_intent.status = 'pendente'
    and v_intent.asaas_checkout_url is not null
    and v_intent.asaas_checkout_url ~ '^https://([a-z0-9-]+\.)*asaas\.com/'
    and v_intent.asaas_checkout_expires_at > clock_timestamp() then
    return query select 'existing'::text, v_intent.asaas_checkout_url, null::timestamptz;
    return;
  end if;

  if v_intent.checkout_creation_started_at is not null
    and v_intent.checkout_creation_started_at
      > clock_timestamp() - make_interval(secs => p_lease_seconds) then
    return query select 'processing'::text, null::text, null::timestamptz;
    return;
  end if;

  if exists (
    select 1
    from public.signup_intents as other
    where other.id <> v_intent.id
      and other.status = 'pendente'
      and (
        other.email = v_intent.email
        or (v_intent.intent_type = 'signup' and other.slug = v_intent.slug)
        or (
          v_intent.intent_type = 'reactivation'
          and other.intent_type = 'reactivation'
          and other.target_tenant_id = v_intent.target_tenant_id
        )
      )
  ) then
    return query select 'state_changed'::text, null::text, null::timestamptz;
    return;
  end if;

  v_claimed_at := clock_timestamp();
  update public.signup_intents as intent
  set
    asaas_checkout_expires_at = null,
    asaas_checkout_id = null,
    asaas_checkout_url = null,
    checkout_creation_started_at = v_claimed_at,
    checkout_returned_at = null,
    expires_at = v_claimed_at + interval '24 hours',
    status = 'pendente'
  where intent.id = v_intent.id;

  return query select 'claimed'::text, null::text, v_claimed_at;
end;
$$;

revoke all on function public.claim_signup_checkout_restart(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.claim_signup_checkout_restart(uuid, integer)
  to service_role;

comment on function public.claim_signup_checkout_restart(uuid, integer) is
  'Reserva de forma atômica a recriação de checkout com lease recuperável.';

commit;
