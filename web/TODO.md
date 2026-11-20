# TODO — web/ (Astro frontend za kupce)

Radna lista. Čuva se u repou da napredak preživi između sesija. Označene stavke su gotove
i provjerene (`npm --prefix web run check` i `npm test` u korijenu zeleni). Odluke idu u
[docs/decisions.md](docs/decisions.md).

Plan po sesijama: [docs/plan.md](docs/plan.md). Handoff po sesiji: [docs/handoffs/](docs/handoffs/).

Legenda: `[x]` gotovo · `[ ]` otvoreno · `[~]` u radu · `(!)` traži korisnika · `→ Sn` planirana sesija

## F0 — temelj i mjerenje

- [x] `web/` kao Astro projekt: `astro`, `@astrojs/cloudflare`, `@astrojs/react`, TypeScript strict → S1
- [x] `web/wrangler.jsonc` bez D1, KV i tajni; jedini var `API_BASE_URL` → S1
- [x] zajednički tipovi API-ja u `shared/api-tipovi.ts`; `src/lib/api.ts` i `web/` ih uvoze → S1
- [x] dev proxy `/api/*` → `node mobile/mock-api.mjs` (port 8797, `PUBLIC_BASE_URL=http://localhost:4321`) → S1
- [x] mjerenje: SSR stranica događaja iz `wrangler dev` vraća `<title>` i `og:title` s naslovom događaja → S1
- [x] `npm --prefix web run check` = `astro check` + testovi (`node:test`) + `astro build` → S1
- [x] `web/docs/design-brief.md`: ekrani, stanja i podaci za Claude Design → S1
- [x] (!) dizajnerski sustav i ekrani po briefu u Claude Designu, export u `web/design/` → vrata prije S2

## F1 — stranice za kupce

- [x] migracija u `domovina-api`: `venue_lat`, `venue_lon` (oba ili nijedno, raspon), `cover_image_alt`; idempotentna → S2b
- [x] `events-feed` vraća nova polja; Worker `publicEvent` ih prosljeđuje; `shared/api-tipovi.ts` i `mobile/mock-api.mjs` ih imaju → S2b
- [x] seedovi (`seeds/*.sql`) dobiju koordinate za postojeće događaje → S2b (`seeds/koordinate-mjesta.sql`; Varaždin nije u OSM-u)
- [ ] (!) Matija primijeni migraciju i deploya `events-feed` → vrata nakon S2b

- [x] tokeni iz Claude Designa u `web/src/styles/tokens.css`, `brand.accent_color` nadjačava naglasnu boju → S2
- [x] osnovni layout, zaglavlje, podnožje (link na uvjete i privatnost), komponente iz dizajna → S2
- [x] `/` popis događaja, SSR → S3
- [x] `/dogadjaj/[slug]`: SSR, `og:*`, `twitter:*`, JSON-LD `Event`, stanja tierova (rasprodano, nije počelo, završilo, `kupovno: false`) → S3
- [x] link na Google/Apple Maps (bez ugrađene karte, odluka 300) iz `venue_lat`/`venue_lon`; `geo` u JSON-LD-u; bez koordinata samo adresa → S3
- [x] opis kao Markdown, iscrtan na serveru i sanitiziran → S3
- [x] „Dodaj u Google kalendar” i `/dogadjaj/[slug].ics` → S3
- [x] formatiranje novca iz centi (`6000` → `60,00 €`) i datuma (Europe/Zagreb) s testovima → S3
- [x] `/dogadjaj/[slug]/kupnja`: React otok (tier, količina, imena za `imenska`, e-mail, uvjeti), `POST /api/narudzba`, preusmjerenje na `checkout_url` → S4
- [x] svaki kod greške iz `POST /api/narudzba` ima poruku na hrvatskom, 429 poštuje `retry_after` → S4
- [x] `/ulaznice/[orderId]`: isto ponašanje kao `src/pages/Narudzba.tsx` (pending → paid, ponovna dostava, link u aplikaciju; QR namjerno ne, odluka 501) → S5
- [x] `/uvjeti`, `/privatnost` prerenderirane; 404 stranica → S5

## F2 — spajanje, staging, čišćenje

- [x] postojeći Worker prosljeđuje kupačke putanje Astro Workeru kroz service binding `WEB`; `/api/*`, `/webhook/*`, `/.well-known/*`, `/organizator`, `/skener` ostaju njegovi → S6
- [x] test u `worker-tests/` za podjelu putanja → S6
- [x] cijela kupnja lokalno kroz Astro (`scripts/lokalno/pokreni.sh` + Astro) → S6
- [x] zapis u `docs/deploy-dug.md` → S6
- [ ] (!) deploy na `ulaznice-staging.domovina.ai` (Matija) → vrata nakon S6
- [ ] izmjereno na stagingu: Lighthouse (performance, SEO, a11y) Astro naspram starog SPA-a, pregled linka u WhatsAppu → S7
- [ ] kupačke stranice uklonjene iz `src/` (Popis, Dogadjaj, Kupnja, Narudzba, Pravno); SPA drži samo organizatora, skener i prijavu → S7
- [ ] `CLAUDE.md` i `docs/02-arhitektura.md` opisuju novu podjelu → S7
