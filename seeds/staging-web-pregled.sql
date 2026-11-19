-- seeds/staging-web-pregled.sql — PRIPREMLJENO, NIJE PUŠTENO (2026-11-19).
--
-- Jedan jasno označen TEST događaj da ulaznice-web-staging.domovina.ai i
-- ulaznice-staging.domovina.ai imaju što prikazati. Pušta ga samo Matija, na
-- jezgru api.domovina.ai, nakon odluke (web/docs/decisions.md, odluka 23).
--
-- Razlika prema ostalim seedovima: NEMA Stripe raila (organizer_payment_rails),
-- pa Worker vraća `kupovno: false` i `stripe_connected: false` — stranica
-- događaja se vidi, a kupnja ne može krenuti. Zato nema problema iz
-- docs/deploy-dug.md („događaj bi izgledao kupovno, a naplata ne bi radila”).
--
-- Posljedica koju treba prihvatiti: jezgra je zajednička, pa je događaj
-- `public` + `active` vidljiv i u javnom events-feedu jezgre (i mobilnim
-- aplikacijama koje gađaju staging). Naslov počinje s [TEST].
--
-- Fiksni UUID-evi (…f0…) da se može čisto obrisati — v. dno datoteke.
--
--   psql "$DOMOVINA_API_DB_URL" -f seeds/staging-web-pregled.sql
\set ON_ERROR_STOP on
begin;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('00000000-0000-4000-8000-0000000000f1', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'test-organizator@ulaznice.domovina.ai',
        crypt(gen_random_uuid()::text, gen_salt('bf')),
        now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb)
on conflict (id) do nothing;

insert into public.accounts (id, primary_owner_user_id, is_personal_account, slug, name)
values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000f1',
        false, 'test-organizator-ulaznice', '[TEST] Organizator')
on conflict (id) do nothing;

insert into public.accounts_memberships (account_id, user_id, account_role)
values ('00000000-0000-4000-8000-0000000000f2', '00000000-0000-4000-8000-0000000000f1', 'admin')
on conflict do nothing;

select pinka_finance.create_event(
  p_id                  => '00000000-0000-4000-8000-000000000f01',
  p_account_id          => '00000000-0000-4000-8000-0000000000f2',
  p_title               => '[TEST] Pregled web sučelja',
  p_destination_address => '0x0000000000000000000000000000000000000001',
  p_venue_name          => 'Dom sportova',
  p_venue_address       => 'Trg Krešimira Ćosića 11',
  p_venue_city          => 'Zagreb',
  p_event_type          => 'konferencija',
  p_starts_at           => '2027-06-12T10:00:00+02',
  p_ends_at             => '2027-06-12T18:00:00+02',
  p_description_hr      => E'Ovo je **testni događaj** za razvoj nove stranice ulaznica.\n\nUlaznice se ovdje ne prodaju.',
  p_organizer_name      => '[TEST] Organizator',
  p_visibility          => 'public',
  p_tiers               => '[
    {"title":"Redovna","description":"Testni tier","price_cents":2500,"inventory_total":100,"imenska":false},
    {"title":"Imenska","description":"Testni tier s imenom po ulaznici","price_cents":4000,"inventory_total":20,"imenska":true},
    {"title":"Rasprodana","description":"Za prikaz stanja","price_cents":1000,"inventory_total":10,"imenska":false}
  ]'::jsonb
);

update pinka_finance.campaigns set state = 'active'
 where id = '00000000-0000-4000-8000-000000000f01';

update pinka_finance.campaign_tiers set inventory_claimed = inventory_total
 where campaign_id = '00000000-0000-4000-8000-000000000f01' and title = 'Rasprodana';

commit;

-- Brisanje (NEPROVJERENO — prije pokretanja provjeri FK-ove i da nema narudžbi):
-- begin;
-- delete from pinka_finance.campaign_tiers where campaign_id = '00000000-0000-4000-8000-000000000f01';
-- delete from pinka_finance.events         where campaign_id = '00000000-0000-4000-8000-000000000f01';
-- delete from pinka_finance.campaigns      where id          = '00000000-0000-4000-8000-000000000f01';
-- delete from public.accounts_memberships  where account_id  = '00000000-0000-4000-8000-0000000000f2';
-- delete from public.accounts              where id          = '00000000-0000-4000-8000-0000000000f2';
-- delete from auth.users                   where id          = '00000000-0000-4000-8000-0000000000f1';
-- commit;
