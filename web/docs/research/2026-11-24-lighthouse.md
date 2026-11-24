# Lighthouse: Astro (staging) naspram starog SPA-a

S7, točka 1. Mjereno 2026-11-24. Uspoređuje se stranica događaja `test-pregled-web-sucelja`:
Astro je mjeren živo na stagingu, a stari React SPA s commita `0acf383` (zadnji `main` prije
čišćenja `src/`) lokalno.

## Ukratko

- **Astro šalje 0 B JavaScripta.** Stari SPA šalje 70,1 kB JS-a preko mreže (gzip), odnosno
  217,8 kB nekomprimirano, u jednoj datoteci. Od toga Lighthouse 34 KiB označava kao neiskorišteno.
- **LCP:** Astro 0,82 s, SPA 1,51 s. Iako SPA ima lokalni TTFB od 1 ms, sadržaj događaja
  dolazi tek nakon JS-a i dohvata `/api/dogadjaj/…`.
- **Accessibility:** Astro 100, SPA 90. SPA pada na `color-contrast` na četiri elementa.
- **SEO:** Astro ima 66, ali samo zbog namjernog `noindex, nofollow` (odluka 24, `Osnovni.astro`).
  Svi ostali SEO auditi prolaze. SPA ima 91, ali samo zato što mu je lokalni server za `/robots.txt`
  vraćao `index.html`. Sam SEO zbroj zato ne mjeri isto, a važnije razlike su u sadržaju HTML-a
  prije izvršavanja JS-a (v. „Pregled linka”).
- **Pregled linka:** Astro u sirovom HTML-u ima naslov događaja, opis, `og:*`, `twitter:card` i
  JSON-LD `Event`. SPA crawleru pokazuje samo generički `<title>Ulaznice — Domovina</title>` i
  opis platforme, bez ijedne `og:` oznake, pa ga WhatsApp i Facebook ne mogu povezati s događajem.

## Rezultati (medijan od 3 pokretanja)

| Metrika (mobile) | Astro: događaj (staging) | Astro: početna (staging) | SPA: događaj (lokalno) |
|---|---:|---:|---:|
| Performance | **100** (73 / 100 / 100) | 100 | 100 |
| Accessibility | **100** | 100 | 90 |
| Best practices | 100 | 100 | 100 |
| SEO | 66 ¹ | 66 ¹ | 91 ² |
| FCP | 0,82 s | 0,78 s | 0,75 s |
| LCP | **0,82 s** | 0,78 s | 1,51 s |
| TBT | 59 ms (1691 / 59 / 0) ³ | 27 ms | 0 ms |
| CLS | 0 | 0 | 0 |
| Speed Index | 1,22 s | 0,98 s | 0,75 s |
| TTFB (`server-response-time`) | 233 ms | 153 ms | 1 ms ⁴ |
| Broj JS datoteka | **0** | 0 | 1 |
| JS, prijenos | **0 B** | 0 B | 70 119 B |
| JS, nekomprimirano | **0 B** | 0 B | 217 833 B |
| Ukupno preneseno (`total-byte-weight`) | 43,2 kB | 40,0 kB | 75,5 kB |
| Broj zahtjeva | 6 | 6 | 5 |

¹ Jedini SEO audit koji pada je `is-crawlable`, zbog `<meta name="robots" content="noindex, nofollow">`.
To je namjerno dok produkcija ne prodaje (odluka 24). Kad se `noindex` ukine, SEO bi trebao biti
100, jer svi ostali SEO auditi prolaze. To nije posebno izmjereno.
² SPA pada na `robots-txt` (14 grešaka). To je artefakt mjerenja: moj lokalni server za
`/robots.txt` vraća `index.html` (SPA fallback). Na stagingu `/robots.txt` daje Cloudflareov
upravljani robots.txt. SPA nema `noindex`, pa prolazi `is-crawlable`.
³ Prvo pokretanje (TBT 1691 ms, Performance 73) je izdvojeni slučaj. Stranica nema nijednu
skriptu, a `bootup-time` je 0,0 s, pa se blokiranje glavne niti ne može pripisati stranici.
Najvjerojatnije je riječ o hladnom startu headless Chromea i šumu CPU-a na Macu. Zato medijan.
⁴ SPA se poslužuje s `localhost`, bez mreže. Pogledaj „Ograničenja”.

Raspodjela bajtova (2. pokretanje, iz `network-requests`):

| | Astro događaj | SPA događaj |
|---|---|---|
| HTML | 4,75 kB (15,9 kB nekompr.) | 0,58 kB (prazan `<div id="root">`) |
| CSS | 2 datoteke, 6,3 kB (19,6 kB nekompr.), obje render-blocking | 1 datoteka, 2,5 kB, render-blocking |
| Fontovi | Figtree latin + latin-ext, 31,4 kB woff2 | nema (sistemski font) |
| JS | — | 70,1 kB (217,8 kB nekompr.) |
| API | — (SSR) | `/api/dogadjaj/…` 1,7 kB |

Za usporedbu, `vite build` na `0acf383` ispisuje `dist/assets/index-BrONB3WB.js 217.46 kB │ gzip: 69.87 kB`.

## Pregled linka (Open Graph)

Sirovi HTML dohvaćen je `curl`-om, bez izvršavanja JS-a, isto kao što ga vide WhatsApp i Facebook.

**Astro (staging), `curl -s https://ulaznice-staging.domovina.ai/dogadjaj/test-pregled-web-sucelja`:**

```html
<title>[TEST] Pregled web sučelja · Ulaznice</title>
<meta name="description" content="Ovo je testni događaj za razvoj stranice ulaznica. Kupnja radi samo na stagingu, u Stripe sandboxu (testna kartica 4242 4242 4242 4242).">
<link rel="canonical" href="https://ulaznice-staging.domovina.ai/dogadjaj/test-pregled-web-sucelja">
<meta property="og:type" content="website">
<meta property="og:locale" content="hr_HR">
<meta property="og:site_name" content="Ulaznice">
<meta property="og:title" content="[TEST] Pregled web sučelja · Ulaznice">
<meta property="og:description" content="Ovo je testni događaj … (isto kao description)">
<meta property="og:url" content="https://ulaznice-staging.domovina.ai/dogadjaj/test-pregled-web-sucelja">
<meta property="og:image" content="https://ulaznice-staging.domovina.ai/og-zadana.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Event","name":"[TEST] Pregled web sučelja",
  "startDate":"2027-06-12T08:00:00+00:00","endDate":"2027-06-12T16:00:00+00:00","eventStatus":"…EventScheduled",
  "eventAttendanceMode":"…OfflineEventAttendanceMode","location":{"@type":"Place","name":"Dom sportova",
  "address":{"streetAddress":"Trg Krešimira Ćosića 11","addressLocality":"Zagreb","addressCountry":"HR"}},
  "organizer":{"@type":"Organization","name":"[TEST] Organizator"},
  "offers":[{"name":"Redovna","price":"25.00","priceCurrency":"EUR","availability":"…InStock"},
            {"name":"Imenska","price":"40.00",…,"InStock"},{"name":"Rasprodana","price":"10.00",…,"SoldOut"}]}</script>
```

- `og:image` daje 200, `image/png`, 1200×630 i 42,9 kB. To je unutar preporuka za Facebook i WhatsApp
  (WhatsApp traži manje od ~300 kB). Testni događaj nema naslovnu sliku, pa se koristi zadana.
- Isti HTML stiže i uz `User-Agent: facebookexternalhit/1.1` i `User-Agent: WhatsApp/2.23.20.0`
  (status 200, `og:title` prisutan). Na rubu nema blokade botova.
- Nema `twitter:title`, `twitter:description` ni `twitter:image`. X/Twitter tada uzima `og:*`, pa
  to nije greška. Nema ni `og:image:width`/`og:image:height`/`og:image:type`.

**Stari SPA, `curl -s http://localhost:9137/dogadjaj/test-pregled-web-sucelja` (isti `dist/index.html` za svaku putanju):**

```html
<meta name="description" content="Ulaznice za događaje — kupujete izravno od organizatora, bez naknade posrednika." />
<title>Ulaznice — Domovina</title>
<script type="module" crossorigin src="/assets/index-BrONB3WB.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-DSgRXUkV.css">
…
<div id="root"></div>
```

Nema `og:*`, `twitter:*`, `canonical` ni JSON-LD. Svaki podijeljeni link na događaj izgledao bi
jednako, kao generičke „Ulaznice — Domovina”, bez slike. Google bi naslov i sadržaj vidio tek nakon
renderiranja JS-a, a društvene mreže ga ne vide nikad.

**Facebook Sharing Debugger** (`https://developers.facebook.com/tools/debug/?q=…`) vraća
„Log into Facebook to use this tool.”, pa nije korišten. Pregled u WhatsAppu nije ručno provjeren.
Zaključak o pregledu linka temelji se na sirovom HTML-u, `og:image` odgovoru i UA testu iznad.

## Kako su brojke dobivene

Okruženje: macOS (Darwin 24.6.0), **Lighthouse 13.6.0** (`npx -y lighthouse@13.6.0`), **Google
Chrome 158.0.8127.88** (`/Applications/Google Chrome.app`, headless `--headless=new`, u izvještaju
`Chrome/158.0.0.0`). Zadano mobilno ograničenje Lighthousea je simulirani Slow 4G uz 4× CPU, a
`benchmarkIndex` je bio 1442–1699. JSON izvještaji su u scratch direktoriju sesije i nisu u repou.

Vrata (staging servira Astro): `curl -sI …/dogadjaj/test-pregled-web-sucelja` → `HTTP/2 200`, a HTML
ima 145 atributa `data-astro*`.

**Astro (staging), svaka putanja 3 puta zaredom:**

```sh
for i in 1 2 3; do
  npx -y lighthouse@13.6.0 https://ulaznice-staging.domovina.ai/dogadjaj/test-pregled-web-sucelja \
    --form-factor=mobile --screenEmulation.mobile \
    --only-categories=performance,accessibility,best-practices,seo \
    --output=json --output-path=json/astro-dogadjaj-$i.json --chrome-flags="--headless=new" --quiet
done
# isto za https://ulaznice-staging.domovina.ai/ → json/astro-pocetna-$i.json
```

**Stari SPA (lokalno, bez diranja radnog stabla):**

```sh
git -C /Users/ivanstepanic/Documents/git/domovina-ulaznice archive 0acf383 | tar -x -C spa-stari
cd spa-stari && npm ci && npm run build        # tsc -b && vite build → dist/
node alati/server.mjs spa-stari/dist 9137 https://ulaznice-staging.domovina.ai
for i in 1 2 3; do
  npx -y lighthouse@13.6.0 http://localhost:9137/dogadjaj/test-pregled-web-sucelja \
    --form-factor=mobile --screenEmulation.mobile \
    --only-categories=performance,accessibility,best-practices,seo \
    --output=json --output-path=json/spa-dogadjaj-$i.json --chrome-flags="--headless=new" --quiet
done
```

`alati/server.mjs` je mali Node server od oko 25 redaka. Poslužuje `dist/`, za nepostojeće putanje
vraća `index.html` (SPA fallback, kao `not_found_handling: single-page-application` u Workeru),
`/assets/*` šalje s `immutable` i gzipa tekstualne odgovore u hodu. `/api/*` prosljeđuje na staging
`fetch`-om, a `curl http://localhost:9137/api/dogadjaj/test-pregled-web-sucelja` vraća pravi JSON
događaja. SPA je dakle renderirao isti događaj sa stagingove jezgre.

Medijani i nalazi audita izračunati su iz JSON-a: `categories.*.score`, `audits["first-contentful-paint"
| "largest-contentful-paint" | "total-blocking-time" | "cumulative-layout-shift" | "speed-index" |
"server-response-time" | "total-byte-weight"].numericValue`. JS je zbroj `transferSize`/`resourceSize`
stavki s `resourceType === "Script"` u `audits["network-requests"]`.

## Ograničenja

- **TTFB i sve što o njemu ovisi (FCP, LCP, Speed Index, Performance) nije potpuno usporedivo.**
  Astro ide preko interneta do Cloudflare edgea (Beč, `cf-ray …-VIE`) i radi SSR s dohvatom jezgre
  (TTFB 150–320 ms). SPA se poslužuje s `localhost` (TTFB 1 ms), a samo njegov `/api` poziv ide
  preko proxyja na staging. Lighthouse simulira Slow 4G na izmjereni RTT, pa je SPA ovdje u
  **prednosti**. Unatoč tome ima gori LCP (1,51 s naspram 0,82 s). Na pravom edgeu SPA bi bio još
  sporiji: HTML → JS (70 kB) → `/api` je tri uzastopna round-tripa, a kod Astra je to jedan.
- Metrike koje ne ovise o mreži (veličina JS-a, TBT, a11y, sadržaj HTML-a prije JS-a) jesu
  usporedive i one su glavni rezultat.
- SPA je bundle s `0acf383`, dakle uključuje i organizatorske stranice i prijavu. Nakon čišćenja
  `src/` (S7 točka 2) SPA bundle bit će manji, ali kupci ga više neće učitavati.
- Tri pokretanja su malo. Prvo Astro pokretanje stranice događaja je izdvojeno (³), a medijan to
  apsorbira.
- Staging ima `noindex`, pa SEO zbroj Astra ne odražava produkciju nakon ukidanja odluke 24.
- `robots.txt` SPA-a izmjeren je na lokalnom serveru i ne odgovara stagingu (²).
- Nije mjereno na stvarnom mobitelu ni s WebPageTestom. Pregled linka nije provjeren u samom
  WhatsAppu ni u Facebook debuggeru (traži prijavu).

## Preporuke (gdje Astro gubi bodove ili ima prostora)

1. **SEO `is-crawlable` (66 → 100):** `noindex = true` je zadano u `web/src/layouts/Osnovni.astro`
   (odluka 24). Kad produkcija smije prodavati, zasebnom odlukom postavi zadano na `false` za
   produkciju (npr. prema varijabli okruženja). Na stagingu `noindex` neka ostane, a `/ulaznice/:id`
   i 404 zadrže eksplicitni `noindex`.
2. **`render-blocking-insight` (score 0,5):** stranica događaja ima dva blokirajuća stylesheeta,
   `_astro/Gumb.*.css` (3,1 kB) i `_astro/_slug_.*.css` (3,2 kB), a početna `Gumb.*.css` i
   `index.*.css`. Kod ovako malog CSS-a isplati se `build.inlineStylesheets: "always"` u
   `web/astro.config.mjs` (sada nije postavljeno), čime nestaju dva round-tripa prije prvog iscrtavanja.
3. **`network-dependency-tree-insight` (score 0):** kritični lanac je HTML → CSS → woff2 (Figtree
   latin 20,7 kB + latin-ext 10,8 kB). Dodaj `<link rel="preload" as="font" type="font/woff2"
   crossorigin>` za `figtree-latin-wght-normal` u `Osnovni.astro` (latin-ext ne treba preload jer ga
   `unicode-range` povlači samo za hrvatske znakove). `@fontsource-variable/figtree/wght.css` već ima
   `font-display: swap`, pa je CLS 0.
4. **Pregled linka:** dodaj `og:image:width`/`og:image:height` (1200/630 za `og-zadana.png`) i
   `og:image:type`, kako bi Facebook prikazao sliku već pri prvom dijeljenju, prije nego što je
   asinkrono obradi. U `og:title` vrijedi izostaviti sufiks „· Ulaznice” (`<title>` ga može
   zadržati), jer ga `og:site_name` već nosi, a u WhatsAppu se naslov reže.
5. **Nakon ukidanja `noindex`:** ponovno pokreni iste naredbe na produkciji i provjeri JSON-LD
   `Event` u Googleovom Rich Results Testu. U JSON-LD-u nedostaje `image` (Google ga preporučuje
   za Event), pa dodaj naslovnu sliku ili `og-zadana.png`.
