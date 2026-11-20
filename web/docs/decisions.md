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

## S2 (2026-11-19)

Snimke: [research/2026-11-19-komponente-390.png](research/2026-11-19-komponente-390.png),
[research/2026-11-19-komponente-1280.png](research/2026-11-19-komponente-1280.png)
(`/_komponente` u `astro dev`, snimljeno kroz Chrome DevTools protokol, bez dev toolbara).

**200. Figtree je samohostan** (`@fontsource-variable/figtree`, `wght.css`, latin + latin-ext,
samo uspravni rez), ne s Google Fonts CDN-a. Kupčev preglednik ne šalje ništa Googleu.
`--font` počinje s `"Figtree Variable"`.
Revizija: ako zatreba kurziv.

**201. Kontrast naglaska se računa prema `--color-bg` (#f3f4f2)**, kako kaže pravilo 2 u
`Main.dc.html` (opis događaja stoji na podlozi); što prođe tu, prolazi i na bijelom.
Zato je zadani `--color-accent-text` `#2c7d55` (zadana #2f855a kao tekst ima 4,1:1).
Konstanta `ZADANA_PODLOGA` u `src/lib/naglasak.ts`.
Revizija: nema.

**202. Potamnjivanje je najmanje potrebno**: HSL svjetlina pada po 0,5 % do 4,5:1, nijansa i
zasićenje ostaju. `#f6e05e` → `#816f07` (README dizajna navodi tamniji `#6e5a00`, 6,7:1).
Revizija: nema.

**203. `onAccent` bira između stvarnih `#ffffff` i `#131714`**, ne čiste crne kao
`renderVals()` u dizajnu; formula dizajna bi za zadanu zelenu izabrala tamni tekst, a token
traži bijeli. Otvoreno: srednje zasićene boje (npr. `#e53e3e`, najviše 4,39:1) ne daju AA ni
s jednim; zasad se prihvaća (gumb je 16/700, „velik tekst” ≥ 3:1). Odluka u S3 ako smeta.
Revizija: S3.

**204. `brand.accent_color` prihvaća se samo kao `#rgb`/`#rrggbb`**, inače zadana boja; ide u
inline `style`, pa kroz nju ne može ući CSS.
Revizija: nema.

**205. Stil komponenti**: Gumb, Oznaka i Banner su `.astro` sa stilom u `*.module.css` da ih
React otoci (S4, S5) dijele; dijelovi forme (Polje, PotvrdniOkvir, Stepper, IzborTiera,
SazetakNarudzbe, OdbrojavanjeGumb) su `.tsx` + CSS modul i bez `client:` se iscrtavaju kao
HTML; ostalo `.astro` sa scoped `<style>`. Jedan prijelom: 720 px.
Revizija: nema.

**206. Datumi i novac u komponentama su privremeni.** Komponente primaju gotov tekst datuma;
novac ide kroz `eurPrivremeno` u `src/lib/prikaz.ts`, svako mjesto označeno „PRIVREMENO … S3”.
Datumska pločica sama računa dan i mjesec u zoni događaja.
Revizija: S3 (`format.ts`) zamjenjuje.

**207. Layout `Osnovni.astro`**: `noindex` zadano uključen (odluka 24); širine 760/960/1040 px;
link „Preskoči na sadržaj”; slot `dno` za ljepljivu traku; naglasak samo kad je prop zadan.
Revizija: kad produkcija krene u prodaju (odluka 24).

**208. `/_komponente` postoji samo u `astro dev`**: Astro ignorira stranice s `_`, pa je ruta
ubačena integracijom u `astro.config.mjs` (`injectRoute` kad je `command === 'dev'`) prema
`src/dev/komponente.astro`. U produkcijskom `dist/` je nema.
Revizija: nema.

**209. React otok u `wrangler dev` (odluka 103) nije provjeren** jer produkcijske stranice
još nemaju otoka; u `astro dev` sva četiri otoka na `/_komponente` se hidriraju bez
upozorenja. Provjera se seli u S4. Worker bundle: 1 266 755 B sirovo (≈ 298 KB gzip), +12 KB
prema S1 (zbroj `dist/server/**/*.js` bez `.map`).
Revizija: S4.

## S3 (2026-11-20)

Snimke: [research/2026-11-20-dogadjaj-1280.png](research/2026-11-20-dogadjaj-1280.png),
[research/2026-11-20-dogadjaj-mobitel.png](research/2026-11-20-dogadjaj-mobitel.png) (500 px, s
`?otkazano=1`), [research/2026-11-20-popis-1280.png](research/2026-11-20-popis-1280.png);
`astro dev` protiv mocka, headless Chrome.

**300. Bez ugrađene karte; samo linkovi na Google i Apple Maps.** Iz `venue_lat`/`venue_lon`
(`src/lib/karta.ts`); bez valjanog para (oba, u rasponu) nema ni gumba, ostaje adresa. Dizajn
ima ilustraciju karte, ali prava karta (OSM iframe ili pločice) znači da kupčev preglednik
pri otvaranju stranice javlja IP tuđem poslužitelju, protivno duhu odluke 200; statična
karta traži API ključ, a `web/` nema tajni (odluka 4).
Revizija: ako organizatori zatraže kartu; tada samohostane pločice ili slika generirana pri
objavi događaja.

**301. Tekst datuma prati dizajn, ne `terminHr` iz SPA-a** (pravilo 4 u README-u dizajna).
`src/lib/format.ts`: „petak, 16. travnja 2027.” + „9:00 – nedjelja, 18. travnja”; na kartici
popisa samo drugi redak (datum je u zaglavlju grupe); ploha „16.–18.” / „travnja 2027.”;
početak prodaje tiera „1. 3. 2027. u 10:00”. Ponoć u zoni događaja = satnica nije objavljena
(isti dogovor kao SPA). Nazivi mjeseci i dana su tablice, Intl samo za pretvorbu zone, pa
izlaz ne ovisi o ICU-u runtimea. Godina kraja i zaglavlja grupe piše se samo kad se razlikuje.
Kraj prije početka tretira se kao da kraja nema.
Revizija: nema.

**302. Markdown opis: `markdown-it` s `html: false`, bez slika.** Sanitizacija po konstrukciji
(`src/lib/opis.ts`): sirovi HTML se escapea, `validateLink` odbija `javascript:`/`data:`,
pravilo `image` je isključeno (odluka 300, isti razlog), naslovi se spuštaju na h3+, svaki
link dobiva `rel="nofollow noopener"`, `breaks: true` jer organizatori pišu redak po redak.
Odabran umjesto sanitizera HTML-a jer ne treba DOM na Workersu. Cijena: +208 KB sirovog
bundlea (markdown-it, entities, punycode).
Revizija: ako bundle postane problem (S7 mjeri) ili organizatori zatraže slike u opisu.

**303. `cache-control: public, max-age=60` za popis i događaj, `no-store` za greške,
300 s za `.ics`** (`src/lib/stranica.ts`). Raspoloživost („još 4”, „rasprodano”) mora biti
svježa, a kupnju ionako presuđuje `POST /api/narudzba`. Cloudflare odgovore Workera ne
kešira sam, pa je ovo samo preglednik; `s-maxage` i Cache API svjesno nisu uvedeni.
404 se kešira kao i stranica (60 s).
Revizija: S7, ako Lighthouse ili promet pokažu da treba CDN keš.

**304. `.ics` i Google kalendar u UTC-u, bez VTIMEZONE.** `DTSTART:…Z` je točan u svakoj
zoni i ne treba tablicu prijelaza na ljetno vrijeme. Događaj bez satnice je cjelodnevni
(`VALUE=DATE`, kraj isključiv, +1 dan); bez `ends_at` kraj je početak + 2 h (odluka 20);
bez `starts_at` ruta vraća 404 i gumba nema. Ruta `/dogadjaj/[slug].ics.ts` ima prednost
pred `[slug].astro` zbog statičnog sufiksa. Retci se preklapaju na 75 okteta bez rezanja
UTF-8 znaka.
Revizija: nema.

**305. JSON-LD `Event` samo kad postoji `starts_at`** (Google ga traži). `offers` po tieru,
cijena „60.00” cjelobrojno iz centi, valuta EUR (ugovor nema valutu tiera); `availability`:
rasprodano → SoldOut, nije počelo → PreSale, završeno → Discontinued, „još N” →
LimitedAvailability, inače InStock. `geo` samo s koordinatama. `<` u JSON-u se escapea.
Revizija: kad ugovor dobije valutu po tieru.

**306. Zadana OG slika je statična `public/og-zadana.png` (1200×630)**, za događaje bez
naslovne i za popis. Snimljena headless Chromeom iz `docs/research/og-zadana.izvor.html`
(Figtree iz `node_modules`). Nije po događaju jer generiranje slike na Workersu traži
dodatnu biblioteku i fontove u bundleu.
Revizija: S7, ako pregled linka u WhatsAppu treba naslov događaja na slici.

**307. Raspored stranice događaja: jedan DOM, dva rasporeda.** Na ≥ 720 px grid 340 px +
ostatak (Dogadjaj-1280); ispod toga stupci su `display: contents` i djeca se slažu `order`om
redoslijedom iz Dogadjaj-390, bez dupliciranja sadržaja. Na mobitelu „Kupi” živi samo u
`ProdajnaTraka`, dno cjenika se skriva. Klase koje stranica daje komponenti (`Odjeljak`)
nemaju Astro scope, pa se ciljaju s `:global(.o-…)`.
Revizija: nema.

**308. URL-ovi iz API-ja prolaze `sigurniUrl`** (samo http/https; `organizer_web` bez sheme
dobiva `https://`). `brand.intro_html` se i dalje ne iscrtava (sirovi HTML, odluka 19);
`cover_image_url`, pa `brand.hero_url` su naslovna slika. `venue_lat`, `venue_lon` i
`cover_image_alt` čitaju se opcionalno (`EventDetailsS2b` u `karta.ts`) jer S2b još nije
napravljen; S2b ih treba dodati u `shared/api-tipovi.ts` i maknuti taj tip.
Revizija: S2b.

**309. Odluka 203 ostaje: crvene srednje zasićenosti prihvaćaju se na gumbu** („Kupi
ulaznice” je 16/700, velik tekst, ≥ 3:1). Pozadina se ne potamnjuje, jer bi organizator
dobio drukčiju boju od one koju je odabrao, a tekst naglaska (`--color-accent-text`) već
se potamni do 4,5:1. Nijedan postojeći događaj nema takvu boju.
Revizija: kad organizator s takvom bojom krene u prodaju.

**310. Bundle Workera nakon S3:** 1 526 616 B sirovo (≈ 367 KB gzip), zbroj
`dist/server/**/*.{mjs,js}` bez `.map` (S2 je zbrajao samo `.js`; usporedba je približna).
Najveći novi dio je markdown-it (odluka 302).
Revizija: S7.

**311. Gradijent naglasne boje na vrhu stranice, kao na Lumi** (Ivan, nakon S3). U
`global.css` na `body`: dvije radijalne mrlje `--color-accent` (34 % lijevo, 20 % desno) koje
blijede do `--color-bg` oko 500 px. Na popisu je zadana zelena, na događaju boja
organizatora. Izračunati kontrast `--color-text-muted` na najzelenijim mjestima s tekstom
(„Uvjeti” u zaglavlju 4,71, podnaslov popisa 4,68) ostaje ≥ 4,5:1 za zadanu zelenu. Dizajn
iz Claude Designa ovo nema; ako se dizajn ponovno uvozi, dodati ga i tamo.
Revizija: ako tamna naglasna boja organizatora spusti kontrast ispod 4,5:1.
