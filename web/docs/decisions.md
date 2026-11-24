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
`global.css` na `body`: dvije radijalne mrlje `--color-accent` (22 % lijevo, 12 % desno) koje
blijede do `--color-bg` oko 250 px, samo iza zaglavlja i naslova, kao Luma Discover. Ivan je
podešavao na oko: 34/20 % do 500 px previše zeleno, 14/8 % do 250 px preslabo. Na popisu je zadana zelena, na događaju boja
organizatora. Izračunati kontrast `--color-text-muted` na najzelenijim mjestima s tekstom
(„Uvjeti” u zaglavlju, podnaslov popisa) je ≥ 5,1:1 za zadanu zelenu. Dizajn
iz Claude Designa ovo nema; ako se dizajn ponovno uvozi, dodati ga i tamo.
Revizija: ako tamna naglasna boja organizatora spusti kontrast ispod 4,5:1.

## S2b (2026-11-20)

**250. `create_event` / `update_event` ne dobivaju nove parametre.** Koordinate i alt tekst
postavljaju se izravnim `update pinka_finance.events` u `seeds/koordinate-mjesta.sql`.
Razlog: novi parametar mijenja potpis funkcije (drop, novi `grant`, `events-organizer`), a
događaje danas unosi agent kroz seed jer je editor odgođen. Zaseban `update` radi i nad
događajima koji su već u bazi, što seed događaja (idempotentan po `p_id`) ne može.
Revizija: kad se radi editor događaja.

**251. Koordinate se vežu na `campaign_id` i `venue_name`.** `staging-web-pregled.sql` i
`susret-zagreb-2027.sql` dijele `campaign_id …f01` s različitim mjestom, pa samo id nije
dovoljan. Mjesto koje nije u OpenStreetMapu (Pastoralni centar, Varaždin) ostaje `NULL`.
Revizija: kad se sudar `…f01` riješi u seedovima (Matija).

**252. `venue_lat`/`venue_lon` su u tipovima `number | null`, opcionalni.** PostgREST
`numeric` šalje kao JSON broj (provjereno lokalno). Opcionalni su dok jezgra nema
migraciju; `koordinate()` i dalje prihvaća numerički string. Tip `EventDetailsS2b` iz
`karta.ts` je uklonjen (odluka 308). `EventDetails` dobiva i `description_en`, a `brand`
`logo_url`, koje Worker već vraća.
Revizija: nema.

**253. Worker polja ne prepisuje pojedinačno.** `publicEvent` već prosljeđuje `event` iz
feeda cijeli, pa se mijenja samo tip `FeedEvent`; test (`worker-tests/dogadjaj-s2b.test.ts`)
čuva da polja prolaze, da `null` ostaje `null` i da feed bez njih ne dobiva izmišljena polja.
Revizija: nema.

## S4 (2026-11-20)

**400. Stranica kupnje je `no-store`** (`CACHE_KUPNJA` u `stranica.ts`), i forma i greške.
Raspoloživost mora biti svježa, a povratak sa Stripea tipkom „natrag” ne smije pokazati
staru stranicu ni zaključan gumb iz bfcachea (otok za to ima i `pageshow`). Stranica nije za
dijeljenje ni tražilice; cijena je jedan SSR poziv po otvaranju.
Revizija: S7, ako mjerenje pokaže da je SSR spor.

**401. Validacija je u `src/lib/kupnja.ts` i zrcali Worker:** `EMAIL_RE`, e-mail ≤ 200,
ime nakon trim 2–120, količina 1…min(10, `available`). Test čita `worker/index.ts` i ruši
se ako se pravila razilaze. Gumb je zaključan dok forma nije valjana, a ispod njega piše
„Za nastavak: …” (aria-describedby). Inline greške polja pojave se nakon blura ili odmah
kad poslužitelj vrati `holders_incomplete`/`invalid_holder`/`invalid_buyer_email`.
Revizija: nema.

**402. Dvostruko slanje sprječava ref, ne samo stanje.** Nakon uspjeha gumb ostaje
„Otvaram plaćanje…” do odlaska. `checkout_url` mora biti apsolutni http(s) URL, inače
greška `neispravan_odgovor`.
Revizija: nema.

**403. Poruka ovisi o kodu, ne o statusu** (`src/lib/poruke.ts`). `http_5xx` ima svoju
poruku, ostali `http_*` i nepoznati kodovi generičku; `greska_servera` je namjerno
generička. Tehnički kod se kupcu nikad ne prikazuje. Test `kodovi-gresaka.test.ts` grepa
`fail(...)` iz handlera narudžbe (i ternarne grane), `app.onError`, 404 fallback i
`HttpError` iz `worker/api.ts` i `worker/stripe.ts` (27 kodova); novi kod bez poruke ruši
test. Šest `HttpError` kodova izvan puta narudžbe je u `IZVAN_KUPNJE` s razlogom.
Revizija: kad Worker dobije novi put narudžbe.

**404. Nakon odbijanja raspoloživost se ponovno učita** (`GET /api/dogadjaj/:slug`) za
`tier_sold_out`, `sale_*`, `tier_not_found`/`tier_not_ticket`/`tier_price_missing`. Ako
odabrani tier više nije kupiv, izbor se poništava i kupac bira sam. Ako je i dalje kupiv,
`tier_sold_out` je značio „traženo više nego što je ostalo” i prikazuje se klijentski kod
`nedovoljno_ulaznica` (Worker vraća isti kod za oba slučaja).
Revizija: ako Worker počne razlikovati ta dva slučaja.

**405. Konačne greške zaključaju formu** s linkom „Natrag na događaj”:
`organizer_not_connected`, `organizer_charges_disabled`, `event_not_found`,
`campaign_not_found`, `campaign_not_tickets`, `campaign_not_active`.
Revizija: nema.

**406. 429 prikazuje zaokruženo vrijeme u banneru i točno odbrojavanje u gumbu**
(„Pokušajte ponovno za 2 min.”, „Nastavi na plaćanje · 1:28”), kao Kupnja-390. Bez
`retry_after` (ili s 0) čeka se 60 s; Worker ionako šalje ≥ 1. `OdbrojavanjeGumb` je
proširen, nova komponenta nije uvedena.
Revizija: nema.

**407. `Banner.tsx` je React parnjak `Banner.astro`** i dijeli isti CSS modul (odluka 205).
Revizija: nema.

**408. Linkovi na uvjete u kvačici otvaraju se u novoj kartici**, da se forma ne izgubi.
Uvjeti organizatora prikazuju se samo uz `brand.terms_url` koji prođe `sigurniUrl`.
`/uvjeti` dolazi u S5.
Revizija: S5.

**409. Bundle nakon S4:** server 1 580 744 B sirovo (≈ 390 KB gzip), zbroj
`dist/server/**/*.{mjs,js}` bez `.map` (S3: 1 526 616 B). Klijent: `client.js` (react-dom)
212 836 B, `KupnjaForma.js` 21 937 B, `react.js` 7 909 B.
Revizija: S7.

**410. Odluka 103 vrijedi i za prvi otok.** U `wrangler dev` nad buildom stranica kupnje
vraća 200 i otok se hidrira bez grešaka, pa `nodejs_compat` nije potreban; `node:stream`
je u bundleu samo kao lijeni `import()`.
Revizija: S6 (service binding).

**411. Kartica na popisu: bez naslovne slike ostaje datumska pločica** (Ivan, 2026-11-20).
Sa `cover_image_url` kartica prikazuje kvadratni izrez slike (već od S2/S3), bez nje
pločicu s datumom, iako datum piše i u lijevom stupcu. Zamjena plohom s ikonom vrste ili
karticom bez desnog dijela razmotrena je i odbijena.
Revizija: nema.

**412. Mock se za e2e pokreće na zasebnom portu, ne izmjenom `web/.dev.vars`.**
`web/.dev.vars` (Ivanov, izvan gita) šalje SSR na lokalni stack `:8788`; izmjena te
datoteke prebaci i Ivanov `astro dev` na mock. S4 ju je za e2e privremeno zakomentirao i vratio
(isti shasum), a Ivanova stranica je za to vrijeme na kratko pokazivala podatke iz mocka.
`dev:mock` ima i port 4321 tvrdo upisan, pa je S4 ručno pokrenuo mock
(`PUBLIC_BASE_URL=http://localhost:4331`) i `astro dev --port 4331`. Za S5: `dev-mock.mjs`
dobiva port kroz env i adresu mocka koja ne ovisi o `.dev.vars`.
Revizija: S5.

## S5 (2026-11-20)

**500. Narudžba je SSR s dva mala otoka** (`PotvrdaPlacanja`, `PonovnaDostava`). Prijelaz
pending → paid prikazuje se ponovnim učitavanjem stranice, pa svako stanje crtaju isti Astro
dijelovi i ništa se ne duplicira u Reactu. Logika bez Astra i Reacta je u `src/lib/narudzba.ts`.
Revizija: nema.

**501. Web ne prikazuje QR i ne zove `/preuzmi`**, kao stara SPA (`src/pages/Narudzba.tsx`),
design-brief §4.4/§9 i Narudzba-1280: tokeni su jednokratni i žive u e-mailu, a `/preuzmi`
je put aplikacije. „Preuzimanje u aplikaciju” je link `domovina-ulaznice://narudzba/<id>` s
upozorenjem prije klika da prijenos može poništiti QR iz e-maila. Handoff S5 („prikaz QR-a”,
„poziv `/preuzmi`”) bio je netočno sažet; mjerodavna je SPA. Poruke za kodove `/preuzmi`
ipak postoje.
Revizija: ako se promijeni model prijetnji.

**502. Neispravan id daje 404 bez poziva API-ju** (`ORDER_ID_RE` = `UUID_RE` iz Workera,
grep-test). `order_not_found`/`invalid_order_id` → 404, ostalo → 503 s „Pokušaj ponovno”.
Svi odgovori `no-store` (`CACHE_NARUDZBA`) i `noindex`.
Revizija: nema.

**503. Osvježavanje kao SPA: svake 2 s, najviše 10 puta**, zatim neutralni banner s gumbom
„Osvježi” (nova serija). Greška jedne provjere samo troši pokušaj. Bez JavaScripta
`<noscript>` meta refresh 5 s, samo za pending + `?placeno=1`.
Revizija: nema.

**504. `PORUKE_ULAZNICA` je zasebna tablica** od poruka kupnje, jer `order_not_found` u
kupnji znači nešto drugo. 429 ponovne dostave: „Novi QR kodovi mogu se zatražiti za N min”
(iz dizajna) i odbrojavanje u gumbu.
Revizija: nema.

**505. Rok rezervacije u zoni događaja, bez dana u tjednu** (dizajnovo „do četvrtak” je
gramatički krivo). U zaglavlju samo za običan pending, u sažetku za svaki pending.
Revizija: nema.

**506. Sažetak narudžbe bez naziva tiera i u platformskoj boji**: `OrderView` nema tier ni
`event.brand`. Prikazuje „Ulaznica N” i iznos.
Revizija: ako Worker doda ta polja u `OrderView` (ugovor se u lancu ne mijenja).

**507. Nakon ponovne dostave narudžba se ne učitava ponovno**: rotacija ne mijenja
serijske brojeve ni stanja.
Revizija: nema.

**508. Nepoznato `TicketView.state` nema oznaku**, da stranica ne tvrdi da ulaznica vrijedi.
Revizija: nema.

**509. Pravne stranice po Pravno-1280, bez scrollspyja** (traži JavaScript). Sadržaj
doslovno iz `Pravno.tsx` osim placeholdera §4 iz dizajna; banner „Nacrt” i `noindex`
ostaju.
Revizija: kad pravnik da konačan tekst.

**510. `404.astro` se renderira na zahtjev**, da sigurno nosi status 404 i `cache-control`
60 s (odluka 303).
Revizija: nema.

**511. Bundle nakon S5:** server 1 621 957 B (S4: 1 580 744 B), isti način mjerenja kao 409.
Klijent: `PonovnaDostava` 1 348 B, `PotvrdaPlacanja` 818 B, `narudzba` 506 B.
Revizija: S7.

**512. `dev:mock` nadjačava `.dev.vars` zasebnim Wrangler configom.** U wrangleru 4.165
`.dev.vars` iz direktorija configa uvijek pobjeđuje `vars`, a uz njega se `process.env` i
`.env` ne čitaju. Zato `dev-mock.mjs` generira `node_modules/.dev-mock-<port>/wrangler.json`
(kopija `wrangler.jsonc`) s vlastitim `.dev.vars` (`API_BASE_URL_DEV` = mock) i predaje ga
Astru kroz `WEB_WRANGLER_CONFIG`. Port: `WEB_PORT` (zadano 4321), mock `MOCK_PORT` (8797).
Revizija: ako Cloudflare adapter dopusti nadjačavanje varijabli iz env-a.

**513. Vite proxy u devu prati `API_BASE_URL_DEV` kao i SSR**, inače mock. Prije je bio
tvrdo na mock, pa je na Ivanovom `:4321` SSR čitao stack `:8788`, a preglednikov `/api`
dobivao 502 (forma kupnje nije mogla poslati narudžbu). Vrijednost se čita pri pokretanju.
Revizija: nema.

**514. Vite cache za `dev:mock` je po portu** (`node_modules/.dev-mock-<port>/vite`,
`WEB_VITE_CACHE`); `npm run dev` ostaje na `node_modules/.vite`. Bez env-a config je isti kao
prije.
Revizija: nema.

**515. E2E je `npm run e2e`** (`scripts/e2e-cdp.mjs`): headless Chrome kroz CDP s Nodeovim
`WebSocket`om, bez ovisnosti. Sam diže `dev:mock` na `:4331` (mock `:8798`) ili prima
`--base`; zauzet port ruši s prijedlogom `--base`. CDP port bira Chrome
(`--remote-debugging-port=0`), snimke idu u tmp (`--snimke <dir>`).
Revizija: S6 (e2e kroz lokalni stack).

**516. Svaka `Runtime.exceptionThrown` ruši e2e slučaj** (hvata pad hidracije i
`_jsxDEV`). Kvačica uvjeta klika se kroz `el.click()` jer label sadrži linkove.
Revizija: nema.

**517. `build.format: "file"`**: Cloudflare assets (`auto-trailing-slash`) inače
preusmjeravaju prerenderirane `/uvjeti` i `/privatnost` (307) na putanju s kosom crtom.
Kanonski oblik je bez kose crte; `/uvjeti/` sada vodi 307 na `/uvjeti`. SSR rute se ne mijenjaju
(provjereno u `wrangler dev` nad buildom: `/`, događaj, kupnja, narudžba, 404). Alternativa
`assets.html_handling: "drop-trailing-slash"` u `web/wrangler.jsonc`.
Revizija: nema.

## S6 (2026-11-20)

**600. Podjela putanja: eksplicitan popis SPA-e, sve ostalo ide Astru.** Glavni Worker
odgovara na `/api/*`, `/webhook/*`, AASA i assetlinks. SPA (ASSETS) dobiva `/organizator*`,
`/skener*`, `/assets/*` (Viteov `assetsDir`) i ostale `/.well-known/*`. Sve ostalo ide na `WEB`,
uključujući `/`, `/_astro/*`, `web/public/*` i nepoznate putanje. Manja strana (SPA) se
nabraja, pa nova Astrova stranica ne traži izmjenu Workera. Nepoznata putanja dobiva Astrov
404 umjesto SPA-ovog 200 s `index.html` (odluka 510). Bez heuristike („ima ekstenziju”,
„WEB 404 → ASSETS”), jer bi sakrila sudar. Statična datoteka u korijenu domene pripada Astru.
Test `worker-tests/web-binding.test.ts` provjerava i da svaka datoteka iz `web/public/` ide na WEB.
Revizija: S7 (kad se kupačke stranice uklone iz SPA-a).

**601. `assets.run_worker_first: true` u `env.staging`.** Bez toga Cloudflare `/` i
`/index.html` poslužuje ravno iz `dist/` (SPA) i Worker zahtjev ni ne vidi (izmjereno u
`wrangler dev`). Wrangler 3.114 prima samo boolean, pa se Worker poziva i za statiku SPA-e.
Bez bindinga `WEB` odgovori su isti kao prije.
Revizija: kad korijen prijeđe na wrangler 4 (popis uzoraka).

**602. Astro do API-ja ide preko javnog `API_BASE_URL`, bez obrnutog bindinga.** Svaka SSR
stranica radi jedan GET bez IP rate limita (`consume()` je samo na narudžbi, prijavi, skenu i
webhooku, koje zove preglednik). `/api/*` se nikad ne prosljeđuje na WEB, pa nema petlje.
Lokalno (wrangler 3, 40 zahtjeva, p50/p90): `/api/dogadjaji` 18,4/22,6 ms, Astro izravno
`/` 27,4/34,1 ms, glavni → WEB → Astro `/` 46,4/59,4 ms. Lokalni binding ide kroz HTTP proxy
dev registryja, pa brojke nisu edge.
Revizija: staging. Ako SSR stranica s jednim API pozivom ima više od ~50 ms viška u odnosu na
izravni `/api`, ili ako fetch na istu zonu ne radi, uvesti binding Astro → glavni Worker.

**603. Lokalno oba Workera na istoj major verziji wranglera i s istim registryjem.**
Korijen je na 3.114, `web/` na 4.165, a njihovi dev registryji su u različitim formatima i ne
vide se. Astro build se lokalno vrti korijenskim wranglerom 3 s
`-c web/dist/server/wrangler.json` (compat date se spusti na 2025-07-18, samo upozorenje).
`wrangler dev` nad `web/dist` padne čim novi `astro build` obriše `dist/client`.
Revizija: kad korijen prijeđe na wrangler 4.

**604. Lokalni stack sam diže Astro.** `pokreni.sh` poziva `pokreni-web.sh` (Astro na `:8792`),
a glavni Worker na `:8788` mu kroz `WEB` daje stranice kupaca. Bez toga kupačke putanje na
`:8788` daju 503. E2E kroz stack je `npm --prefix web run e2e:stack` (lažni Stripe na `:8901`,
mail u inboxu). Svako pokretanje troši jednu ulaznicu u lokalnoj jezgri.
Revizija: kad korijen prijeđe na wrangler 4 (odluka 603).

**605. `wrangler dev` vrti kopiju Astro builda** (`.wrangler/web-build`, bez `.dev.vars`), jer
svaki novi `astro build` briše `web/dist` i ruši proces. Build ide sa zasebnim Vite cacheom, pa
Ivanov `:4321` ostaje netaknut.
Revizija: nema.

**606. E2E stacka traži da `success_url` i link u mailu budu na istoj adresi kao kupnja.**
Id narudžbe se hvata iz odgovora `POST /api/narudzba` (CDP `Fetch`). Bez bindinga test pada,
jer povratak sa Stripea vodi na staru SPA. Tako je namjerno.
Revizija: nema.

**607. `run_worker_first` se ne pokupi hot reloadom**, za razliku od `services`. Nakon izmjene
`assets` u korijenskom `wrangler.jsonc` lokalni Worker treba restartati. Napola učitan config
daje 503 na kupačkim putanjama i SPA na `/`.
Revizija: nema.

## S7 (2026-11-24)

**700. Vrata S7 prošla bez Matijinog deploya:** staging (oba Workera) i produkcija deployani
su 2026-11-23 na Ivanov zahtjev (`docs/deploy-dug.md`). `/dogadjaj/test-pregled-web-sucelja`
na stagingu dolazi iz Astra; `/uvjeti/` → 307 na `/uvjeti` kroz binding.
Revizija: nema.

**701. Odluka 602 riješena bindingom, ne mjerenjem.** Fetch Astra na javni URL istog Workera
kroz `WEB` nije radio (`/` → 503, `ApiError: neispravan_odgovor`), pa SSR ide kroz service
binding `API` (`bb9294a`, `web/src/lib/api-ssr.ts`). Višak SSR-a nakon toga: 5 mjerenja
`curl -w %{time_total}`, medijan ~0,20 s naspram ~0,18 s za izravni `/api` — ispod kriterija.
Revizija: nema.

**702. SPA u `src/` drži samo organizatora, skener i prijavu** (`885ffb7`). Obrisani Popis,
Dogadjaj, Kupnja, Narudzba, Pravno; neuhvaćena putanja SPA-e → `/organizator`. `src/lib/api.ts`
ostaje cijel: uvoze ga organizatorske stranice, a `web/test/api.test.ts` ga koristi za paritet
(`spa.dohvatiDogadjaj`). Ako se te funkcije brišu, referenca ide u sam test.
Revizija: S9 (gašenje SPA-e).

**703. CSS SPA-e očišćen samo gdje je grep jednoznačan** (6 klasa); sve što dijele Skener i
Organizator ostaje. Komentari u `web/` koji upućuju na obrisane datoteke označeni su
„(bivši SPA, obrisan u S7)” umjesto brisanja, da ostane trag podrijetla logike.
Revizija: nema.

**704. `index.html` SPA-e ostaje kupački** (naslov i opis), iako ga služi samo organizator.
Nema smisla dorađivati ga jer se SPA seli u Astro (S8) i gasi (S9).
Revizija: S9.

**705. Lighthouse (mobile, medijan od 3, `research/2026-11-24-lighthouse.md`):** Astro 0 B JS-a
naspram 70 kB (gzip) u SPA-i, LCP 0,82 s naspram 1,51 s, a11y 100 naspram 90. SEO 66 samo zbog
`noindex` (odluka 24). Preporuke (inline CSS, preload fonta, `og:image:width/height`, `image` u
JSON-LD-u) idu u S8 kao sitnice, ukidanje `noindex` na produkciji je zasebna odluka.
Revizija: kad se ukine `noindex`.

**706. Lanac se nastavlja sa S8 i S9** (Ivan, 2026-11-24, `ui-feedback.md` stavka 7): sve na
Astro, javne samo `ulaznice(-staging).domovina.ai`. S8 seli organizatora, skener i prijavu
(s wizardom iz stavke 4), S9 gasi SPA-u i domene `ulaznice-web(-staging)`.
Revizija: nema.


## S8 (2026-11-24)

**800. Greške organizatora su `ApiError` iz `web/src/lib/api.ts`** (`6dacfb6`); `AuthError` iz
SPA-e ne postoji u `web/`. `jeIstekla(e)` gleda kod (`nije_prijavljen`, `not_authenticated`),
ne status: 401 vraćaju i `prijava_neuspjela` i `kod_neispravan`. Svaki 401 i dalje briše
spremljenu sesiju, kao u SPA-i.
Revizija: nema.

**801. Sesija ostaje `sessionStorage["ulaznice.sesija"]`**, isti ključ kao u SPA-i (prijelaz
između SPA-e i Astra tijekom deploya ne odjavljuje); refresh token se ne sprema. SSR ne zna
za sesiju, web ostaje bez tajni (odluka 4).
Revizija: nema.

**802. Google povratak bez kose crte na kraju:** `adresaGooglePrijave` skida završni `/` iz
`povratak`, jer Workerov regex (`/api/organizator/google`) prihvaća samo `/organizator`,
`/organizator/novi` i `/skener`. Token iz fragmenta preuzima otok (`web/src/lib/auth.ts`).
Revizija: nema.

**803. Poruke organizatora su zasebna tablica `PORUKE_ORGANIZATORA`** u `web/src/lib/poruke.ts`
(`porukaOrganizatora`, `porukaIzGreske`), preuzeta iz SPA `PORUKE` uz `auth_greska`,
`api_error`, `invalid_account_id`, `invalid_event_id`, `api_*`. `kodovi-gresaka.test.ts`
provjerava i rute organizatora/skenera; kodovi jezgre su ručni popis `JEZGRA_ORGANIZATORA`.
Revizija: nema.

**804. `SaPrijavom` je zajednički omot otoka** (render-prop `{ sesija, odjava, istekla }`);
istek sesije vraća prijavu s „Prijava je istekla”. `Zaglavlje.astro` se ne mijenja: naslov,
e-mail i „Odjava” su u `TrakaSesije` unutar otoka.
Revizija: nema.

**805. Skener:** ikone `kvacica`/`x-krug` umjesto emojija; vrijeme prvog ulaska u zoni
Europe/Zagreb („16. 4. u 9:12”), SPA je koristila zonu preglednika. Safari i dalje bez
`BarcodeDetector` (ručni unos).
Revizija: nema.

**806. Pregled prodaje:** „zauzeto: N” umjesto „N ulaznica” (bez množine), datum u meta
retku, „Skica” u tonu čekanja, zastavice računa kao oznake. Ime CSV-a očišćeno od opasnih
znakova, bez sluga `sudionici-dogadjaj.csv`.
Revizija: nema.

**807. Stranice organizatora:** otoci `client:only="react"` s fallbackom „Učitavanje…” i
`<noscript>`, `noindex`, `cache-control: no-store` (`CACHE_ORGANIZATOR` u `stranica.ts`),
bez SSR poziva prema API-ju.
Revizija: nema.

**808. Lighthouse sitnice iz 705** (`8d397d2`): `inlineStylesheets: "always"`; preload samo
latin Figtree woff2; `og:image:width/height` samo uz zadanu sliku (mjere u `OG_ZADANA_MJERE`,
test ih čita iz PNG-a); `og:image:type` iz nastavka; JSON-LD `image` = naslovna, inače
`og-zadana.png`.
Revizija: nema.

**809. Worker bez `SPA_STRANICE`** (`2059ebf`): `/organizator*` i `/skener` idu na `WEB`,
nepoznato pod `/organizator/` dobiva Astrov 404. Bez `WEB` bindinga sve ide u `ASSETS`
(rezerva do S9). Deploy: prvo `web`, pa glavni Worker (`docs/deploy-dug.md` #13).
Revizija: S9 (brisanje `ASSETS`).

**810. Wizard `/organizator/novi`** (`62359dc`, `ui-feedback.md` stavka 4): 5 koraka, logika u
`web/src/lib/editor.ts` (`validirajKorak`, `provjeri` = unija koraka, `prviNevaljaniKorak`,
`najdaljiDopusteni`, `korakZaKod`), payload prema `events-organizer` isti kao u SPA-i.
Na 1440×900 svih 5 koraka bez scrolla (scrollHeight 900, najtješnji korak 5, ~70 px rezerve);
1280×800 korak 5 ima 30 px scrolla. Snimke: `web/docs/research/2026-11-24-s8-wizard/`.
Revizija: nema.

**811. Birač datuma je `web/src/lib/birac-datuma.ts`**: `kalendar.ts` u `web/` već radi
„Dodaj u kalendar” (.ics). Odabrani dan je `--color-ink`, ne naglasna boja.
Revizija: nema.

**812. `Osnovni.astro` dobiva `sirina="puna"` (1280 px) i prop `aplikacija`:** bez podnožja,
`<main>` je flex stupac koji ispuni prozor. Vrijedi za cijelu `/organizator/novi`.
Revizija: nema.

**813. Nacrt u `localStorage["ulaznice.nacrt-dogadjaja"]`** (`v: 1`, e-mail, `eventId`,
unos, najdalji posjećeni korak). Tuđi nacrt (drugi e-mail) se ne učitava; `eventId` u
nacrtu znači da ponovno slanje nakon refresha ili isteka prijave ne pravi duplikat
(idempotencija jezgre). „Odbaci nacrt” traži `confirm` i daje novi `event_id`.
Revizija: nema.

**814. Navigacija wizarda:** korak u `?korak=N` (`pushState`, `popstate`); stepper, URL i
„naprijed” idu najdalje do min(najdalji posjećeni, prvi nevaljani). „Natrag” u traci radi
`pushState` na prethodni korak, ne `history.back()` (nakon reloada bi izašao sa stranice).
Greške polja se vide tek nakon prvog „Dalje” na koraku, fokus na prvo nevaljano. U koraku 3
„Dalje” piše „Preskoči” dok su opis i slika prazni.
Revizija: nema.

**815. Greška jezgre nakon spremanja vodi na svoj korak** (`korakZaKod`: `slug_collision` → 1,
`invalid_tier_*` → 4). Nova pravila po koraku (duljina mjesta 160, grada 80, vrsta iz popisa)
samo ponavljaju jezgru. Ime organizatora u pregledu kartice je naziv događaja kad je polje
prazno, kao `coalesce(organizer_name, title)` u `create_event`.
Revizija: nema.

**816. S8 provjeren na pravom lokalnom stacku** (:8788 → `WEB` :8792, jezgra, Mailpit):
prijava kodom i spremanje skice rade, skica je u `pinka_finance.campaigns` (`draft`).
Recept: `web/docs/research/2026-11-24-s8-wizard.md`. Google prijava nije isprobana uživo
(povratak pokrivaju `web/test/auth.test.ts` i `worker-tests/web-binding.test.ts`).
Revizija: nema.

**817. Gumb „Nastavi s Googleom” je iz dizajnerskog sustava** (`gumb.sekundarni gumb.velik
gumb.blok`, `web/src/components/Prijava.tsx`), ne kopija SPA-e (plavi tekst, svijetli rub,
`src/styles.css` `.prijava__google`). Agent ga je u S8 preslikao bez zapisa; Ivan je 24. 11.
potvrdio da zasad ostaje tako. Logo je isti SVG.
Revizija: po potrebi u feedback sesiji.

**818. Tablica vrsta ulaznica u wizardu ovisi o širini stupca, ne prozora** (`@container`
na `.tierovi`, prag 520 px). Od 1024 px srednji stupac je uži (~290 px sadržaja na
1024–1100) nego na tabletu, a fiksni stupci (cijena, količina, imenska, ukloni) traže
~364 px, pa je `@media (min-width: 720px)` „Naziv” stisnuo na nulu (Ivan, staging, 24. 11.).
Ispod praga vrste su kartice; izmjereno CDP-om na 1000/1100/1280/1440/390 bez vodoravnog
scrolla, „Naziv” 170–518 px.
Revizija: nema.

**819. Upload slike ide kroz glavni Worker u Supabase Storage, ne u R2** (paket izvan lanca,
Ivan, 24. 11.). `POST /api/organizator/slika` tijelo je sama slika; Worker je šalje u bucket
`pinka-covers` (`{auth.uid()}/{uuid}.{ext}`) korisnikovim JWT-om, nikad service ključem.
Bucket i RLS već postoje u jezgri (`20260611120000_pinka_campaign_hardening`): javno čitanje,
upis samo u vlastitu mapu i samo uz provjeren identitet, isti uvjet kao `create_event`. Nema
novog spremišta ni tajne. `sub` se iz JWT-a čita bez provjere potpisa: krivi `sub` samo
završi na RLS-u. Limit 60 uploada / 10 min po IP-u (`slika`).
Revizija: nema.

**820. Preglednik sliku smanji prije slanja** (`web/src/lib/slika.ts`): dulja stranica
≤ 1600 px, WebP 0,85 (JPEG gdje canvas ne zna WebP). Mala slika (≤ 1 MB, ≤ 1600 px) u vrsti
koju bucket prima ide kakva jest. Lokalno: 6016 px JPEG od 10 MB → WebP od 203 kB.
Revizija: nema.

**821. Galerija u jezgri bez promjene RPC potpisa.** `events-organizer` (grana `domovina-api`
`events-media`) prima `gallery` (`[{url}]`) i upiše je izravnim `update pinka_finance.events`
korisnikovim klijentom nakon `create_event`/`update_event`, kao seed za venue_geo i galeriju.
RLS `events_write` i check `events_gallery_shape` vrijede; oblik (≤ 20, https ≤ 1000) se
provjerava prije RPC-a. Novi kodovi: `invalid_gallery`, `invalid_gallery_url` (korak 3).
**Bez alt teksta** ni za naslovnu ni za galeriju (Ivan, 24. 11.: „ne treba nam”); stranica
događaja alt i dalje složi iz naslova (`slikeGalerije`), a `cover_image_alt` iz seeda ostaje.
Revizija: nema.

**822. Korak 3 wizarda: naslovna i galerija, link ili upload.** Naslovna: pregled, link,
„Učitaj sliku”. Galerija: do 20 slika, redoslijed strelicama, „Dodaj” link ili „Učitaj
slike” (više odjednom). Bez opisa slika (odluka 821). Nacrt nosi `galerija` kao listu linkova
(stari nacrt bez nje → prazno, `v` ostaje 1). Poznato:
lokalno Storage vraća `http://` URL, pa ga validacija koraka 3 odbije (na stagingu je
`https://api.domovina.ai`); na 1440×900 korak 3 sada ima scroll stranice; na mobitelu gumbi
„Učitaj…” padaju u svoj red. Izgled ide na Ivanovo oko.
Revizija: po potrebi u feedback sesiji.

**823. „Uredi skicu” je isti wizard nad skicom iz jezgre** (`/organizator/novi?uredi=<id>`,
Ivan, 24. 11.). `GET /api/organizator/dogadjaj/:id` čita kampanju, event i vrste ulaznica
korisnikovim JWT-om (PostgREST embed, RLS člana računa); `unosIzSkice` ih vrati u oblik
forme (UTC → zidno vrijeme u Zagrebu, centi → „25,50”), vrste nose `id`. Spremanje je
`PUT` → `events-organizer` `update` (`zahtjevIzmjene`): ispražnjeno neobavezno polje ide kao
`""` jer `null` u `update_event` znači „ne diraj”; maknute vrste idu u `remove_tier_ids`.
Uređivanje ne koristi lokalni nacrt (izvor je jezgra, nacrt novog događaja ostaje), pa
refresh usred uređivanja vraća spremljeno stanje. Organizator se ne mijenja. Jezgra ne zna
obrisati kraj događaja ni ime organizatora (`coalesce`): prazno polje tamo ostavlja staro.
Objavljeni događaj se ovdje ne uređuje (poruka umjesto forme).
Revizija: nema.

**824. „Obriši skicu” je meko brisanje kroz novi RPC `delete_event_draft`** (jezgra, grana
`events-media`, migracija `20261124170000`). Korisnikov PATCH `deleted_at` kroz PostgREST
pada na RLS (novi red više ne prolazi `campaigns_select`), pa je RPC DEFINER s istim
provjerama kao `publish_event` (admin računa) i uvjetom: skica (`draft`) bez ijedne
narudžbe (`event_not_draft`, `event_has_orders`). Brisanje vrste ulaznice pri uređivanju
radi kroz RLS `tiers_write`, ali `events-organizer` ga pušta samo dok je događaj skica.
Gumbi su na kartici skice u pregledu prodaje i u stepperu wizarda (uz `confirm`).
Revizija: nema.

