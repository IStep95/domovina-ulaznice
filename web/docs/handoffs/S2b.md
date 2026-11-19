domovina-ulaznice: prodaja ulaznica bez posrednika. Lanac gradi Astro frontend za kupce u `web/` (podaci samo iz `/api/*` postojećeg Workera).

Repo: Ivanov klon forka `IStep95/domovina-ulaznice` (`main`, javan; wrap-up pusha fork i otvara PR). Uz njega `../domovina-api` (javan; Ivan radi u svom forku i šalje zaseban PR).

Pročitaj prvo: `web/docs/handoffs/README.md`, `web/docs/plan.md`, `web/docs/decisions.md` (14–21), `web/docs/research/2026-11-19-ivanov-prijedlog-sheme.md`, `docs/05-podatkovni-model.md`, korijenski `CLAUDE.md` (migracije su idempotentne).

# S2b: dorada sheme događaja (Ivanov prijedlog)

Polazni commit: `010ab24`. `check`: zelen, web 13 testova, korijen 97, skipped 0. Odluke od **250**.

Može ići odmah nakon S1, dok Ivan radi dizajn. Jedina sesija koja mijenja ugovor
`/api/*`, i to samo aditivno (odluka 21).

Paket:

1. **Migracija u `../domovina-api`**
   (`supabase/migrations/YYYYMMDDHHMMSS_events_venue_geo.sql`): na
   `pinka_finance.events` dodaj `venue_lat numeric(9,6)`, `venue_lon numeric(9,6)`,
   `cover_image_alt text`, s `add column if not exists` i ograničenjima (oba ili nijedno,
   raspon, `cover_image_alt` ≤ 300) koja se dodaju samo ako ne postoje. Drugi run = no-op.
   Ako RPC za stvaranje/izmjenu događaja (`p_venue_city`, … u `seeds/*.sql`) treba nove
   parametre, dodaj ih s `default null` da postojeći pozivi rade.
2. **`events-feed`** vraća nova polja u detalju događaja (i u popisu ako ga vraća).
3. **Worker:** `publicEvent` u `worker/index.ts` prosljeđuje polja; test u `worker-tests/`
   da prolaze i da `null` ostaje `null`.
4. **`shared/api-tipovi.ts`** (`EventDetails`; usput dodaj i `description_en` i `brand.logo_url` koje Worker već vraća, a tipovi nemaju) i **`mobile/mock-api.mjs`** (koordinate
   za mock događaje) u istom commitu.
5. **Seedovi:** koordinate za mjesta u `seeds/*.sql` (Dom sportova Zagreb, Korčula, Sinj,
   Varaždin…). Koordinate uzmi iz OpenStreetMapa i zapiši izvor u komentar; ne izmišljaj.
6. **`docs/05-podatkovni-model.md`** i `docs/deploy-dug.md` (migracija + `events-feed`
   čekaju Matiju).

Gotovo kad: migracija primijenjena dvaput na lokalnoj bazi (`supabase db reset` ili
`scripts/lokalno/pokreni.sh`), drugi put bez promjene; `GET /api/dogadjaj/:slug` u mocku i
lokalno vraća nova polja; korijenski `npm test` zelen. Zatim na vrh `S3.md` upiši: „Je li
Matija primijenio migraciju i deployao `events-feed`? Ako nije, S3 svejedno radi jer su
polja nullable.” PR-ovi na oba repoa, `/wrap-up` sa sadržajem sljedećeg handoffa (`S2.md`
ako dizajn još nije gotov, inače `S3.md`).
