# Ivanov prijedlog dorade sheme događaja (rukopis, 2026-11-19)

Izvor: [fotografija bilješke](2026-11-19-ivanov-prijedlog-sheme.jpg). Prijepis i usporedba s
tablicom `pinka_finance.events` (`domovina-api`,
`supabase/migrations/20260716120000_events_ticketing_schema.sql`).

| # | Bilješka | Danas u shemi | Odluka |
| --- | --- | --- | --- |
| 1 | lokacija eventa, GPS lat/lon | nema | **dodati** `venue_lat`, `venue_lon` (odluka 14, S2b) |
| 2 | ~~adresa eventa~~ ✓ | `venue_address` | već postoji, Ivan je prekrižio |
| 3 | slika eventa primarna | `cover_image_url` (https, ≤ 1000) | već postoji; dodaje se samo `cover_image_alt` (odluka 15) |
| 4 | galerija slika? | nema | **odgođeno** (odluka 16) |
| 5 | kategorije? | `event_type` (`konferencija`, `koncert`, `meetup`, `kamp`, `ostalo`) | to već jest kategorija; nova tablica ne treba (odluka 17) |
| 6 | ~~tagovi~~ | nema | ne (Ivan prekrižio) |
| 7 | ~~tko dolazi na event x?~~ (čitanje nesigurno) | nema | ne: imena nositelja su osobni podaci (odluka 18) |
| 8 | description .md? | `description_hr`, `description_en` (tekst ≤ 20000) | bez nove kolone; tekst se čita kao Markdown (odluka 19) |
| 9 | dodaj u Google kalendar feature? | `starts_at`, `ends_at`, `timezone`, mjesto | bez sheme; gumb i `.ics` u S3 (odluka 20) |
| 10 | city id? | `venue_city` (tekst ≤ 80) | **odgođeno**; tekst + koordinate su dovoljni (odluka 17) |

Stavka 7 je prekrižena i teško čitljiva („Tko dolazi na event X?”, kao popis gostiju na
Lumi). Ako je značila nešto drugo, Ivan neka ispravi ovaj red.

Sve stavke liče na ono što prikazuju Entrio (kategorije, grad, galerija) i Luma (karta,
„dodaj u kalendar”, popis gostiju), ali bilješka sama ne kaže iz koje je analize nastala.
