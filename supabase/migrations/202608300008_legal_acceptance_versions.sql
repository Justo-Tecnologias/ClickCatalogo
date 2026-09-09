-- Registra qual versão dos documentos legais foi aceita no checkout.
-- Cadastros anteriores à atualização de 30/08/2026 mantêm a versão que
-- estava publicada quando o aceite foi coletado.

begin;

alter table public.signup_intents
  add column if not exists terms_version text,
  add column if not exists privacy_version text;

update public.signup_intents
set
  terms_version = coalesce(terms_version, '2026-08-29'),
  privacy_version = coalesce(privacy_version, '2026-08-29')
where terms_version is null
   or privacy_version is null;

alter table public.signup_intents
  alter column terms_version set default '2026-08-30',
  alter column terms_version set not null,
  alter column privacy_version set default '2026-08-30',
  alter column privacy_version set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'signup_intents_terms_version_check'
      and conrelid = 'public.signup_intents'::regclass
  ) then
    alter table public.signup_intents
      add constraint signup_intents_terms_version_check
      check (terms_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'signup_intents_privacy_version_check'
      and conrelid = 'public.signup_intents'::regclass
  ) then
    alter table public.signup_intents
      add constraint signup_intents_privacy_version_check
      check (privacy_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
  end if;
end;
$$;

commit;

select
  count(*) filter (where terms_version is null) as terms_without_version,
  count(*) filter (where privacy_version is null) as privacy_without_version
from public.signup_intents;
