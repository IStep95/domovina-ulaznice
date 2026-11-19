# Odluke — web/

Svaka odluka ima broj, datum, razlog i uvjet revizije. Odluka se ne briše: kad se
promijeni, nova odluka je zamjenjuje i navodi koju. Blokovi brojeva po sesiji: S1 od 100,
S2 od 200 … S7 od 700.

## S0 (2026-11-19)

**1. Opseg: samo stranice za kupce.** U `web/` idu `/`, `/dogadjaj/:slug`,
`/dogadjaj/:slug/kupnja`, `/ulaznice/:orderId`, `/uvjeti`, `/privatnost` i 404.
Organizator, skener i prijava ostaju u React SPA-u u `src/`.
Razlog: kupačke stranice dobivaju SSR i pregled linka; organizatorske ne dobivaju ništa.
Revizija: kad se radi editor događaja ili kad SPA postane teret.

**2. Astro s `@astrojs/cloudflare`, `output: "server"`.** Popis, događaj i narudžba se
iscrtavaju na zahtjev; `/uvjeti` i `/privatnost` imaju `export const prerender = true`.
Razlog: podaci o raspoloživosti se mijenjaju, pravni tekst ne.
Revizija: ako S1 izmjeri da SSR na Workersu ne radi ili je prespor.

**3. Interaktivni dijelovi su React otoci (`@astrojs/react`).** Forma za kupnju i
stranica narudžbe prenose se iz `src/pages/*.tsx`.
Razlog: logika već postoji u Reactu i testirana je u stvarnoj kupnji.
Revizija: nema.

**4. `web/` nema D1, KV ni tajne.** `wrangler.jsonc` u `web/` ima samo `API_BASE_URL`.
Razlog: pravilo 1 u korijenskom `CLAUDE.md`; operativni podaci već su u D1 postojećeg
Workera, treća baza samo bi se razilazila.
Revizija: samo uz novu odluku koja kaže što bi baza držala i zašto to ne može Worker.

**5. `web/` zove samo `/api/*` postojećeg Workera, nikad `api.domovina.ai`.**
Razlog: pravila 3 i 4 (HMAC, Stripe, service ključ u jednom Workeru) i isti ugovor kao
mobilne aplikacije.
Revizija: nema.

**6. Ugovor `/api/*` se u ovom lancu ne mijenja.** Potreba za promjenom = zaseban commit
na `worker/` s testom, `mobile/mock-api.mjs` u istom commitu, i odluka u bloku sesije.
Revizija: nema.

**7. Razvoj protiv `mobile/mock-api.mjs`.** Pokreće se s
`PUBLIC_BASE_URL=http://localhost:4321 node mobile/mock-api.mjs`, pa njegov lažni
„Plati” vraća na Astro. Cijela kupnja s jezgrom i lažnim Stripeom ide tek u S6 kroz
`scripts/lokalno/pokreni.sh`.
Razlog: Ivanu ne trebaju tajne ni pristup jezgri za izradu UI-ja.
Revizija: nema.

**8. Ista domena kroz service binding.** Postojeći Worker ostaje ulaz za
`ulaznice-staging.domovina.ai` i kupačke putanje prosljeđuje Astro Workeru kroz binding
`WEB`. `/api/*`, `/webhook/*`, `/.well-known/*`, `/organizator`, `/skener` ostaju
njegovi. Astro do API-ja dolazi preko `API_BASE_URL` (S6 odlučuje treba li i obrnuti
binding).
Razlog: bez CORS-a, prijava organizatora i povratak sa Stripea ostaju na istoj domeni,
a `NAJAVA` i webhook ne mijenjaju mjesto.
Revizija: S6, ako lokalno mjerenje pokaže problem.

**9. Dizajn dolazi iz Claude Designa.** Export ide u `web/design/`, boje i razmaci u
`web/src/styles/tokens.css` kao CSS varijable. `brand.accent_color` iz API-ja nadjačava
naglasnu boju po događaju.
Razlog: dizajn se radi odvojeno od koda i ponovno uvozi kad se mijenja.
Revizija: nema.

**10. Tipovi API-ja su zajednički u `shared/api-tipovi.ts`.** I `src/lib/api.ts` i `web/`
ih uvoze.
Razlog: jedan ugovor, jedan izvor tipova.
Revizija: ako mobilne aplikacije zatraže generirani ugovor (OpenAPI).

**11. Testovi u `web/` su `node:test`, bez mreže.** Isto kao korijenski `npm test`.
`npm --prefix web run check` = `astro check` + testovi + `astro build`.
Revizija: ako Astro komponente trebaju test koji `node:test` ne može (onda Vitest, uz odluku).

**12. Rad u forku `IStep95/domovina-ulaznice`, PR po sesiji.** Matija merga i deploya.
Sljedeća sesija kreće s mergeanog `upstream/main`.
Revizija: kad Ivan dobije pravo pisanja u upstream.

**13. Jezik.** UI, dokumentacija i commit poruke na hrvatskom; kod engleski. Commit:
`feat(web): …`, `fix(web): …`, `docs(web): …`.

## S0, dopuna: Ivanov prijedlog sheme (2026-11-19)

Prijepis i usporedba: [research/2026-11-19-ivanov-prijedlog-sheme.md](research/2026-11-19-ivanov-prijedlog-sheme.md).

**14. Koordinate mjesta: `venue_lat`, `venue_lon`.** `numeric(9,6)`, nullable, ili oba ili
nijedno, raspon −90..90 i −180..180. Koriste se za kartu, link na Google/Apple Maps i
`geo` u JSON-LD-u.
Razlog: adresa je tekst; karta i navigacija trebaju koordinate.
Revizija: nema.

**15. Primarna slika već postoji (`cover_image_url`); dodaje se `cover_image_alt`.**
Tekst ≤ 300, nullable.
Razlog: pristupačnost i `og:image:alt`.
Revizija: nema.

**16. Galerija slika je odgođena.** Kad bude trebala: tablica
`pinka_finance.event_images (campaign_id, position, url, alt)` uz isto ograničenje
`https://` kao naslovna. Upload slika (R2) je zaseban posao.
Razlog: nijedan postojeći događaj je nema, a traži upload i moderaciju.
Revizija: kad je organizator zatraži.

**17. Kategorija je postojeći `event_type`; `city_id` je odgođen.** UI prevodi
`event_type` u oznaku (`konferencija` → „Konferencija”). Grad ostaje tekst
`venue_city`.
Razlog: tablica kategorija i gradova treba tek javnom katalogu s filtrima više
organizatora, a to nije cilj (`docs/08`: ne natječemo se kao marketplace).
Revizija: kad nastane javni katalog događaja.

**18. Tagovi i „tko dolazi” se ne rade.** Ivan ih je prekrižio. Popis dolaznika bi
otkrivao imena nositelja ulaznica (`holders`), a to su osobni podaci kupaca.
Revizija: samo uz izričit pristanak kupca po ulaznici i pravnu provjeru.

**19. `description_hr` / `description_en` su Markdown, bez nove kolone.** Astro ga
iscrta na serveru uz sanitizaciju (bez sirovog HTML-a, linkovi `rel="nofollow noopener"`).
Postojeći opisi (odlomci odvojeni praznim redom) već su valjan Markdown.
Razlog: format je dogovor o sadržaju, ne o shemi.
Revizija: ako organizatori počnu lijepiti HTML.

**20. „Dodaj u kalendar” bez promjene sheme.** Link na Google Calendar
(`calendar.google.com/calendar/render?action=TEMPLATE…`) i `.ics` datoteka koju Astro
generira na `/dogadjaj/[slug].ics`. Bez `ends_at` kraj je `starts_at` + 2 h; bez
`starts_at` gumba nema.
Razlog: svi podaci već postoje.
Revizija: nema.

**21. Ugovor `/api/*` se mijenja samo u S2b, i samo aditivno.** Odluka 6 vrijedi za sve
ostale sesije. Nova polja su nullable, pa stari klijenti (mobilne aplikacije) rade
nepromijenjeno.

## Korak 0: infrastruktura (2026-11-19, Matija)

**22. Dva Workera za `web/` postoje od koraka 0, na računu D.O.M.**
`domovina-ulaznice-web` → `ulaznice-web.domovina.ai` (produkcija) i
`domovina-ulaznice-web-staging` → `ulaznice-web-staging.domovina.ai` (staging). Oba
serviraju statičnu stranicu „u izradi” (`noindex`) iz `web/privremeno/`. Oba se deployaju
**ručno** (Matija, nakon mergea PR-a): `npm --prefix web run deploy:staging`, odnosno
`deploy:prod`. Auto-deploy (Workers Builds) je svjesno odgođen: Cloudflare GitHub app
nije instaliran na organizaciji `domovinatv` i Matija ga zasad ne želi. Imena Workera,
domene i skripte `build`, `deploy:staging`, `deploy:prod` u `web/package.json` se ne
mijenjaju bez nove odluke.
Razlog: Ivan dobiva živi preview bez pristupa Cloudflare računu i bez tajni u forku.
Revizija: auto-deploy kad Matija odobri GitHub app ili API token; S6, kad kupačke stranice prijeđu na `ulaznice(-staging).domovina.ai` kroz
service binding; tada se odlučuje ostaju li `ulaznice-web*` domene kao preview.

**23. Test događaj za staging je pripremljen, ne pušten.**
`seeds/staging-web-pregled.sql`: jedan `[TEST]` događaj bez Stripe raila
(`kupovno: false`). Pušta ga samo Matija, na zajedničku jezgru. Dok nije pušten,
staging API vraća `{"events":[]}` i razvoj ide protiv `mobile/mock-api.mjs`.
Razlog: jezgra je zajednička za staging i produkciju; događaj je vidljiv u javnom
feedu, pa je to Matijina odluka.
Revizija: kad je pušten, upiši datum ovdje.

**24. `ulaznice-web.domovina.ai` ne smije izgledati kao prodaja dok prodaja ne radi.**
Isto načelo kao `NAJAVA=1` na `ulaznice.domovina.ai`. Ručni deploy produkcije prije
S6 servira samo stranicu „u izradi” ili Astro build bez gumba „Kupi”.
Revizija: kad krene prodaja.

## S1 (2026-11-19)

Mjerenje: [research/2026-11-19-ssr-na-workersu.md](research/2026-11-19-ssr-na-workersu.md).

**100. Verzije.** `astro` 7.4.1, `@astrojs/cloudflare` 14.4.9, `@astrojs/react` 7.1.0,
`react`/`react-dom` 19.3.1, `wrangler` 4.165.0, `@astrojs/check` 0.9.12, `typescript` 6.0.3,
`@types/node` ^22 (Node 22).
Revizija: pri nadogradnji Astra ili adaptera.

**101. Zadani bindingi adaptera su isključeni.** U `astro.config.mjs`: `session: false`
(inače adapter sam dodaje `SESSION` KV), `imageService: "passthrough"` (inače Cloudflare
Images binding), `remoteBindings: false`. Jedini bindingi su `ASSETS` i `API_BASE_URL`.
Razlog: odluka 4.
Revizija: ako zatreba optimizacija slika; tada nova odluka o Images bindingu.

**102. Okruženje se bira pri buildu, ne pri deployu.** Wrangler deploya generirani
`dist/server/wrangler.json`, pa `deploy:staging` = `CLOUDFLARE_ENV=staging npm run build &&
wrangler deploy --env staging`, a `deploy:prod` gradi bez `CLOUDFLARE_ENV`. Dry-run je
pokazao da goli `wrangler deploy --env staging` nad produkcijskim buildom tiho deploya
produkciju. Deploy samo kroz skripte. Upisano u `docs/deploy-dug.md`.
Revizija: ako adapter vrati čitanje `--env` pri deployu.

**103. `compatibility_date` ostaje `2025-11-01`, bez `nodejs_compat`.** Build, `astro dev`,
`wrangler dev` i dry-run rade. `@astrojs/react` lijeno uvozi `node:stream` samo izvan edge
puta; izgrađeni Worker nema `node:` uvoza.
Revizija: prvi React otok (S2–S4) se provjerava u `wrangler dev`; ako padne, dodaje se
`compatibility_flags: ["nodejs_compat"]`.

**104. `web/` uvozi zajedničke tipove relativnom putanjom, samo `import type`.**
`../../../shared/api-tipovi.ts`, bez aliasa; u runtimeu nestaje. Testovi idu kroz Nodeovo
skidanje TS tipova (Node ≥ 22.18), bez loadera i bez nove ovisnosti.
Revizija: ako `shared/` dobije runtime kod.

**105. SSR u `astro dev` ide izravno na mock `:8797`.** Nadjačava se s `API_BASE_URL_DEV` u
`web/.dev.vars` (npr. na `:8788` u S6). Preglednik koristi relativni `/api` kroz Vite proxy
(i `/mock-checkout`). Razlog: isti oblik kao produkcija, gdje SSR zove Worker izravno.
Revizija: S6.

**106. Astro telemetrija je isključena u skriptama** (`ASTRO_TELEMETRY_DISABLED=1` u `check`).
Prvi build u S1 vjerojatno je poslao jedan anonimni ping prije nego što je isključena.
Revizija: nema.

**107. Odluka 2 potvrđena mjerenjem.** SSR na Workersu (`wrangler dev --local`) vraća
naslov u `<title>` i `og:title`; nepostojeći slug 404; topli medijan 8,0 ms, hladni prvi
36–42 ms (lokalni workerd, ne produkcijski edge).
Revizija: S7 mjeri na stagingu.
