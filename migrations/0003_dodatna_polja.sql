-- domovina-ulaznice — D1 migracija 3: dodatna polja kupnje (2026-11-26)
--
-- Organizator uz događaj spremi link na javni Google obrazac; kupnja prikaže
-- njegova pitanja (worker/dodatna-polja.ts). Ista granica kao 0001: ovdje NE
-- ulaze ulaznice, narudžbe ni inventory — ni odgovori kupaca: oni su u jezgri
-- (`ulaznice.order_answers`, domovina-api 20261126120000).
--
-- Idempotentno (`if not exists`): scripts/lokalno/pokreni.sh pušta sve
-- migracije pri svakom startu, pa ovdje nema `alter table`.

-- Link obrasca je dio prodajne stranice, ne ticketing podatak. Zasebna tablica
-- (ne stupac u event_pages) jer SQLite nema `add column if not exists`.
create table if not exists event_forms (
  campaign_id text primary key,         -- = ulaznice.events.id
  form_url text not null,               -- kanonski …/viewform (worker/dodatna-polja.ts)
  updated_at text not null default (datetime('now'))
);
