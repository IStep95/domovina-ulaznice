-- seeds/koordinate-mjesta.sql — koordinate mjesta za događaje iz ostalih seedova.
--
-- Traži migraciju domovina-api `20261120120000_events_venue_geo.sql`
-- (stupci venue_lat / venue_lon). Pušta se NAKON nje i nakon seedova događaja;
-- događaj kojeg u bazi nema samo se preskoči (UPDATE 0).
--
-- Zasebna datoteka, a ne parametar u create_event: seedovi događaja su
-- idempotentni pa drugi run ne mijenja postojeći događaj (seeds/README.md).
-- Ovaj `update` radi i na bazi gdje su događaji već upisani.
--
-- Uvjet je campaign_id I venue_name: staging-web-pregled.sql i
-- susret-zagreb-2027.sql dijele campaign_id …f01, a mjesta su im različita.
--
-- Izvor svih koordinata: OpenStreetMap (© OpenStreetMap contributors, ODbL),
-- dohvaćeno 2026-11-20 preko Nominatima i Overpassa; središte objekta
-- zaokruženo na 6 decimala (numeric(9,6)). Ništa nije procijenjeno s karte.
--
-- NEMA koordinata, namjerno:
--   * Pastoralni centar, Varaždin (…f04) — nije u OSM-u; jedini „Pastoralni
--     centar" u Varaždinskoj županiji je u Ludbregu, a adresu nije objavio ni
--     organizator. Ostaje NULL → web prikazuje samo grad, bez linka na kartu.
--
--   psql "postgresql://postgres:postgres@127.0.0.1:55322/postgres" \
--        -f seeds/koordinate-mjesta.sql
--
-- Idempotentno: drugi run vraća UPDATE 0 za svaki red.
\set ON_ERROR_STOP on
begin;

update pinka_finance.events e
set venue_lat = v.lat, venue_lon = v.lon, updated_at = now()
from (values
  -- Dom sportova, Trg Krešimira Ćosića 11, Zagreb — OSM way 30632510
  ('00000000-0000-4000-8000-000000000d01'::uuid, 'Dom sportova', 45.807844, 15.951800),
  ('00000000-0000-4000-8000-000000000f01'::uuid, 'Dom sportova', 45.807844, 15.951800),
  -- Sveučilišni kampus Hrvatskog katoličkog sveučilišta (Aula Magna) — OSM way
  -- 142539349. OSM kampusu daje adresu Ilica 242, organizator piše Ilica 244;
  -- isti kampus, adresa u seedu ostaje organizatorova.
  ('00000000-0000-4000-8000-000000000f01'::uuid, 'Aula Magna, Hrvatsko katoličko sveučilište', 45.814103, 15.945008),
  -- Franjevački samostan Badija, otok Badija (Korčula) — OSM way 727072463
  ('00000000-0000-4000-8000-000000000f02'::uuid, 'Samostan Badija', 42.951921, 17.162976),
  -- crkva Gospe Sinjske (svetište), Sinj — OSM way 45454745
  ('00000000-0000-4000-8000-000000000f03'::uuid, 'Svetište Gospe Sinjske', 43.701461, 16.637357)
) as v(campaign_id, venue_name, lat, lon)
where e.campaign_id = v.campaign_id
  and e.venue_name = v.venue_name
  and (e.venue_lat is distinct from v.lat or e.venue_lon is distinct from v.lon);

commit;

select c.slug, e.venue_name, e.venue_lat, e.venue_lon
from pinka_finance.events e
join pinka_finance.campaigns c on c.id = e.campaign_id
order by c.slug;
