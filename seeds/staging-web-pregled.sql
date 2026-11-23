-- seeds/staging-web-pregled.sql — [TEST] događaj za staging (pripremio Ivan
-- 2026-11-19; 2026-11-23 dodan sandbox Stripe rail i pušten na jezgru).
--
-- Jedan jasno označen TEST događaj da ulaznice-staging.domovina.ai ima što
-- prikazati i prodati u Stripe sandboxu.
--
-- Stripe rail: organizator je vezan na sandbox connected account
-- `acct_1U2CRfByTQ1uTmhK` (Express, HR) pod sandboxom `acct_1U2CO1QoZhPywPyh`,
-- pa je na stagingu `kupovno: true` (i checkout ide u test mode) tek kad Stripe
-- javi `charges_enabled` kroz `account.updated` webhook.
--
-- Jezgra je zajednička: događaj je `public` + `active` i u javnom events-feedu
-- jezgre. Produkcijski Worker ga skriva preko `SKRIVENI_ORGANIZATORI`
-- (wrangler.jsonc) — taj UUID organizatora (…0000000000f2) mora biti ondje
-- PRIJE puštanja ovog seeda, inače bi produkcija pokazala kupovni događaj čiji
-- checkout s live ključem pada. Mobilne aplikacije i ostali klijenti feeda
-- jezgre ga vide; naslov počinje s [TEST].
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
  p_description_hr      => E'Ovo je **testni događaj** za razvoj stranice ulaznica.\n\nKupnja radi samo na stagingu, u Stripe sandboxu (testna kartica 4242 4242 4242 4242).',
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

-- Stripe rail: sandbox connected account (v. zaglavlje). Fiskalizaciju vodi
-- organizator (provider 'organizator'), FIRA se ne zove.
-- charges/payouts NAMJERNO false: stvarno stanje piše samo Stripe, kroz
-- `account.updated` webhook (worker/webhooks.ts → upsertOrganizerRail). Seed
-- koji upiše `true` bez provjere pušta checkout koji Stripe odbije
-- („Your account cannot currently make charges”, 23. 11. 2026.).
insert into pinka_finance.organizer_payment_rails
  (account_id, stripe_account_id, stripe_charges_enabled, stripe_payouts_enabled, invoice_provider)
values ('00000000-0000-4000-8000-0000000000f2', 'acct_1U2CRfByTQ1uTmhK', false, false, 'organizator')
on conflict (account_id) do update
  set stripe_account_id = excluded.stripe_account_id;

commit;

-- Brisanje (NEPROVJERENO — prije pokretanja provjeri FK-ove i da nema narudžbi):
-- begin;
-- delete from pinka_finance.organizer_payment_rails where account_id = '00000000-0000-4000-8000-0000000000f2';
-- delete from pinka_finance.campaign_tiers where campaign_id = '00000000-0000-4000-8000-000000000f01';
-- delete from pinka_finance.events         where campaign_id = '00000000-0000-4000-8000-000000000f01';
-- delete from pinka_finance.campaigns      where id          = '00000000-0000-4000-8000-000000000f01';
-- delete from public.accounts_memberships  where account_id  = '00000000-0000-4000-8000-0000000000f2';
-- delete from public.accounts              where id          = '00000000-0000-4000-8000-0000000000f2';
-- delete from auth.users                   where id          = '00000000-0000-4000-8000-0000000000f1';
-- commit;
