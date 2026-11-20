# SSR na Workersu: mjerenje (S1, točka 6)

Datum: 2026-11-19 · polazni commit: `f53c277` · mjereno lokalno (macOS, Node 22.23.1)

## Pitanje

Radi li Astro SSR (`output: "server"`, odluka 2) u Cloudflare Workeru, tj. renderira li
`web/src/pages/dogadjaj/[slug].astro` `<title>` i `<meta property="og:title">` iz
`GET /api/dogadjaj/:slug` kad se build pokrene u `wrangler dev` (workerd), a ne samo u
`astro dev`? Kolik je Worker bundle i koliko traje odgovor?

## Odgovor

**Da, SSR na Workersu radi.** Produkcijski build pokrenut u `wrangler dev --local`
dohvaća događaj s mocka i vraća naslov u oba taga; nepostojeći slug daje 404.
Bundle je 1225.54 KiB (gzip 289.22 KiB), daleko ispod Cloudflareovih limita
(3 MiB gzip na Free, 10 MiB na Paid planu). Lokalno: prvi zahtjev nakon pokretanja ~37–42 ms,
topli ~8 ms (medijan). Plan se ne mijenja.

## Postav

| Što | Verzija / vrijednost |
|---|---|
| astro | 7.4.1 |
| @astrojs/cloudflare | 14.4.9 |
| @astrojs/react | 7.1.0 (react / react-dom 19.3.1) |
| @astrojs/check | 0.9.12, typescript 6.0.3 |
| wrangler | 4.165.0 (miniflare 5.20261118.0-beta, workerd 1.20261118.1) |
| `compatibility_date` | `2025-11-01` (nepromijenjen, adapter nije tražio noviji) |
| `compatibility_flags` | `[]` — **bez `nodejs_compat`** |
| Bindingi | samo `ASSETS` i var `API_BASE_URL` (odluka 4) |
| Node | 22.23.1 |

Build je produkcijski (bez `CLOUDFLARE_ENV`), pa `dist/server/wrangler.json` ima
`API_BASE_URL=https://ulaznice.domovina.ai`. Za mjerenje se ta vrijednost nadjačava s
`--var`, inače bi `wrangler dev` zvao pravi Worker. `wrangler` sam nalazi generirani
config preko `web/.wrangler/deploy/config.json` („Using redirected Wrangler
configuration … dist/server/wrangler.json”), pa `--config` nije potreban.

Mock: `mobile/mock-api.mjs`, lokalni proces, bez mreže.

## Naredbe i sirovi rezultati

Sve iz korijena repoa, osim gdje piše `cd web`.

```bash
# build (produkcijski config)
cd web && ASTRO_TELEMETRY_DISABLED=1 npx astro build

# mock na 8797
PORT=8797 PUBLIC_BASE_URL=http://localhost:8789 node mobile/mock-api.mjs

# Worker iz builda na 8789
cd web && ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false \
  npx wrangler dev --local --port 8789 --ip 127.0.0.1 \
  --var API_BASE_URL:http://localhost:8797 --show-interactive-dev-session=false
```

### Naslov u oba taga

```
$ curl -s localhost:8789/dogadjaj/prilika-za-susret-2027 | grep -E '<title>|og:title'
<!DOCTYPE html><html lang="hr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Prilika za Susret 2027</title><meta property="og:title" content="Prilika za Susret 2027"></head><body><main><h1>Prilika za Susret 2027</h1></main></body></html>
```

(Astro piše cijeli dokument u jednom retku, pa `grep` vraća cijeli HTML.)

### Statusi

```
$ for u in / /dogadjaj/prilika-za-susret-2027 /dogadjaj/ne-postoji /nema-ove-stranice; do
    printf '%s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code} %{size_download}B %{content_type}' localhost:8789$u)"; done
/ 200 356B text/html
/dogadjaj/prilika-za-susret-2027 200 342B text/html
/dogadjaj/ne-postoji 404 345B text/html
/nema-ove-stranice 404 4311B text/html
```

`/dogadjaj/ne-postoji` → mock vraća `404 {error: "event_not_found"}`, stranica postavlja
`Astro.response.status = 404` i naslov „Događaj nije pronađen”. `/nema-ove-stranice` je
Astrova zadana 404 stranica (vlastitu radi S3).

### Vrijeme odgovora (topli Worker)

12 zahtjeva po putanji, prva 2 odbačena, mjereno zadnjih 10 (`time_total` iz curla,
uključuje spajanje na `localhost`):

```bash
for i in $(seq 1 12); do curl -s -o /dev/null -w '%{time_total}\n' "http://localhost:8789$u"; done \
  | tail -10 | sort -n | awk '{a[NR]=$1} END{printf "n=%d min=%.4f median=%.4f max=%.4f\n",NR,a[1],(a[5]+a[6])/2,a[NR]}'
```

| Putanja | n | min | medijan | max |
|---|---|---|---|---|
| `/dogadjaj/prilika-za-susret-2027` (SSR + fetch na mock) | 10 | 6.9 ms | 8.0 ms | 11.7 ms |
| `/` (SSR bez fetcha) | 10 | 5.2 ms | 6.2 ms | 7.2 ms |
| `/dogadjaj/ne-postoji` (404) | 10 | 6.7 ms | 7.5 ms | 20.0 ms |
| mock izravno, `:8797/api/dogadjaj/prilika-za-susret-2027` | 10 | 0.8 ms | 0.9 ms | 2.0 ms |

### Prvi (hladni) zahtjev

`wrangler dev` pokrenut tri puta ispočetka; čeka se redak `Ready on` u logu (bez ijednog
zahtjeva Workeru), zatim prvi pa drugi `curl -s -o /dev/null -w '%{http_code} %{time_total}\n'
http://localhost:8789/dogadjaj/prilika-za-susret-2027`:

| Pokretanje | 1. zahtjev | 2. zahtjev | wrangler log (1. / 2.) |
|---|---|---|---|
| 1 | 200, 36.4 ms | 200, 8.4 ms | 29 ms / 7 ms |
| 2 | 200, 36.7 ms | 200, 10.3 ms | 35 ms / 7 ms |
| 3 | 200, 41.8 ms | 200, 8.9 ms | 29 ms / 8 ms |

### Veličina Worker bundlea

```
$ cd web && ASTRO_TELEMETRY_DISABLED=1 WRANGLER_SEND_METRICS=false \
    npx wrangler deploy --dry-run --outdir <scratchpad>/dry
Using redirected Wrangler configuration.
 - Configuration being used: "dist/server/wrangler.json"
...
│ Total (16 modules)                                        │      │ 453.51 KiB │
✨ Read 4 files from the assets directory .../web/dist/client
Total Upload: 1225.54 KiB / gzip: 289.22 KiB
...
--dry-run: exiting now.
```

`--dry-run` ništa ne šalje Cloudflareu (nema prijave, nema uploada). „Total Upload”
= `entry.mjs` (790 557 B) + 16 dodatnih modula (453.51 KiB). Provjera izravno:

```
$ du -sk web/dist/server web/dist/client        # s .map datotekama
3884  web/dist/server
224   web/dist/client
$ find web/dist/server -name '*.mjs' ! -name '*.map' -exec cat {} + | wc -c
1254955
```

Grubi sastav (zbroj `sourcesContent` iz source mapa po paketu, izvorni kod prije
minifikacije, samo za orijentaciju): astro ~693 KiB, react-dom ~548 KiB, zod ~362 KiB,
picomatch ~61 KiB, devalue ~37 KiB, @astrojs/cloudflare ~25 KiB, @astrojs/react ~20 KiB.
React i react-dom ulaze u bundle već sad jer je `@astrojs/react` integracija uključena,
iako stranica još nema nijedan otok.

## Testovi i `check`

`npm --prefix web run check` = `astro check` → `npm test` (`node --test "test/**/*.test.ts"`)
→ `astro build`, sve s `ASTRO_TELEMETRY_DISABLED=1`; lanac `&&` pa svaka greška daje
izlazni kod ≠ 0 (provjereno namjernom TS greškom i namjerno palim testom: oba `exit=1`).

Testovi su `.ts` i pokreću se **Node 22 ugrađenim uklanjanjem tipova** (bez flaga od
Node 22.18; `process.features.typescript === "strip"`), bez loadera i bez nove
ovisnosti. To radi jer `web/src/lib/api.ts` uvozi s eksplicitnim `.ts` nastavkom i
koristi samo `import type` iz `shared/`. SPA klijent `src/lib/api.ts` uvozi
`../../shared/api-tipovi` bez nastavka, ali je to `import type` pa ga Node briše prije
razrješavanja. `astro check` provjerava i `web/test/` (tsconfig `include: **/*`).

`web/test/api.test.ts`: 13 testova (ApiError iz `{error:"tier_sold_out"}` + 409,
`neispravan_odgovor`, `http_<status>`, `apiUrl` sa i bez `baseUrl`, injektirani fetch i
`encodeURIComponent` sluga, POST `kreirajNarudzbu` s JSON tijelom, putanje narudžbe) i
test pariteta sa SPA klijentom: za 8 parova (status, tijelo) oba klijenta daju isti URL i
isti ishod. Svjesne razlike (nisu u paritetu): tijelo `null` (SPA baca `TypeError`, web
`http_<status>`) i `{error: <ne-string>}` (SPA prenosi vrijednost kao `code`, web
`http_<status>`).

## Zamke i ograde

- **Lokalni workerd ≠ produkcijski edge.** Ista izvršna okolina (workerd), ali bez mreže
  između Workera i API-ja, bez TLS-a, bez CPU limita i na brzom stroju. Brojke su donja
  granica i služe za usporedbu između sesija, ne kao obećanje latencije. U produkciji
  (S6) Worker zove postojeći Worker kroz service binding, što ovdje nije mjereno.
- **`nodejs_compat` nije uključen.** `@astrojs/react` u `server.js` ima lijeni
  `await import("node:stream")` (varijabla kao ime modula, `@vite-ignore`), koji ostaje u
  `dist/server/entry.mjs`. Bundler je razriješio `react-dom/server.edge.js`, koji ima
  `renderToReadableStream`, pa bi se taj put trebao preskočiti; to se ne može potvrditi
  dok stranica nema React otok. **Prvi React otok (S2/S3) provjeriti u `wrangler dev`**;
  ako padne na `node:stream`, dodati `nodejs_compat` u `web/wrangler.jsonc` i zapisati
  odluku.
- **`wrangler dev` nad produkcijskim buildom gađa produkciju** ako se ne zada
  `--var API_BASE_URL:...` (var iz `dist/server/wrangler.json`). Za lokalni rad koristiti
  `astro dev` / `npm --prefix web run dev:mock`; `wrangler dev` samo za mjerenja, uvijek s
  `--var`. Je li `web/.dev.vars` čitan i kroz preusmjereni config nije provjereno.
- `wrangler dev` u agentu ispisuje „Local Explorer API” rute; nebitno za mjerenje.
- `localhost` u curlu: Worker je vezan na `127.0.0.1` (`--ip`), pa curl može prvo
  pokušati `::1`; razlika je unutar šuma (< 1 ms).
