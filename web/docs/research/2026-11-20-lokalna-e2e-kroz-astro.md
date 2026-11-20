# Lokalna e2e kupnja kroz Astro (S6, točka 4)

Datum: 2026-11-20 · polazni commit: `5145a79` (+ S6 rad u `worker/` i korijenskom
`wrangler.jsonc`: binding `WEB`, `run_worker_first`) · mjereno lokalno (macOS, Node 22.23.1,
headless Chrome kroz CDP)

## Pitanje

Prolazi li kupnja od kraja do kraja kroz Astro (`web/` build u `wrangler dev`) nad lokalnim
stackom iz `scripts/lokalno/pokreni.sh`: popis → događaj → kupnja → lažni Stripe → webhook →
`/ulaznice/<id>?placeno=1` (paid) → e-mail s QR-om u inboxu → link iz maila, i to kroz jednu
adresu, kao na stagingu sa service bindingom `WEB`?

## Odgovor

**Da.** `pokreni.sh` sad diže i Astro Worker (`pokreni-web.sh`, `:8792`), a glavni Worker na
`:8788` mu kroz binding `WEB` šalje stranice kupaca. `npm --prefix web run e2e:stack` prolazi
sva tri slučaja (kupnja, pravne stranice, 404) samo kroz `:8788`: `success_url` i link iz
maila vode na `:8788/ulaznice/<id>` i to je Astrova stranica „Plaćeno”. Mock e2e
(`npm --prefix web run e2e`) ostaje zelen.

Prije bindinga (faza i) ista je kupnja prošla kroz privremeni proxy (Astro + `/api` glavnog
Workera na jednoj adresi), ali se sa Stripea vraćala na `PUBLIC_BASE_URL` glavnog Workera, tj.
na staru SPA. Proxy je s bindingom suvišan i obrisan je.

## Postav

| Port | Proces | Tko ga diže |
| --- | --- | --- |
| `:55390` | edge funkcije `events-*` (Deno, `fn-shim.ts`) | `pokreni.sh` |
| `:8901` | lažni Stripe (checkout `/pay/<sesija>`, webhook na `:8788`) + Resend inbox `/inbox` | `pokreni.sh` |
| `:8788` | glavni Worker (`--env staging`, korijenski wrangler 3.114); `/api`, `/webhook`, `/.well-known`, `/organizator`, `/skener`, `/assets/*` ovdje, ostalo → `WEB` | `pokreni.sh` |
| `:8792` | Astro Worker: kopija `web/dist` (`.wrangler/web-build`) u `wrangler dev`, `API_BASE_URL` = `:8788` | `pokreni-web.sh` (iz `pokreni.sh`) |
| `:4321` | Ivanov `astro dev` (zove `:8788/api`, ne dirati) | Ivan |

Build je `CLOUDFLARE_ENV=staging astro build`, pa se Worker zove `domovina-ulaznice-web-staging`,
kao servis u bindingu; `wrangler dev` ga nalazi u dev registryju
(`~/Library/Preferences/.wrangler/registry/`) po imenu.

## Naredbe

```sh
scripts/lokalno/pokreni.sh                 # sve: jezgra, lažni Stripe, Worker :8788, Astro :8792
npm --prefix web run e2e:stack             # e2e kroz :8788 (--base, --inbox, --slug, --snimke)

# samo Astro, uz stack koji već radi (nakon izmjene u web/; Ctrl+C gasi samo njega)
scripts/lokalno/pokreni-web.sh             # ~10 s s buildom
SKIP_BUILD=1 scripts/lokalno/pokreni-web.sh

# samo glavni Worker (npr. nakon izmjene wrangler.jsonc), u korijenu repoa
eval "$(cd ../domovina-api && supabase status -o env)"
npx wrangler dev --env staging --local --port 8788 --ip 127.0.0.1 \
  --var PUBLIC_BASE_URL:http://127.0.0.1:8788 --var DOMOVINA_API_URL:http://127.0.0.1:55390 \
  --var DOMOVINA_API_ANON_KEY:"$ANON_KEY"
```

Ručno: kupac na `http://127.0.0.1:8788/`, inbox na `http://127.0.0.1:8901/inbox`.

E2E (`web/scripts/e2e-cdp.mjs`, grana `--stack`): popis → događaj → kupnja (zadano
`prilika-za-susret-2027`, postoji i u mocku i u seedu jezgre) → odgovor `POST /api/narudzba`
uhvaćen kroz CDP `Fetch` (id narudžbe prije navigacije na Stripe) → checkout na `:8901` →
narudžba pending (200, `no-store`, `noindex`, „Čeka plaćanje”) → „Plati” → `success_url` mora
biti na base → paid („Plaćeno”, „Pošalji ponovno”) → mail za jedinstven
`ana.e2e+<ms>@primjer.hr` s barem jednom QR slikom (`data:image/png`) → link iz maila na base,
opet paid.

## Izmjereno

E2E kupnja (CDP, od klika do uvjeta, ms):

| Korak | faza i: proxy `:8790` | faza ii: binding, wrangler 4 (`:8789`) | konačno: `:8788`, wrangler 3 |
| --- | --- | --- | --- |
| `POST /api/narudzba` (status 200) | 94–159 | 155 | 149–184 |
| forma → checkout lažnog Stripea učitan | 202–266 | 261 | 258–293 |
| „Plati” → `success_url` učitan | 140–184 | 259 | 294–300 |
| „Plati” → mail u inboxu | 411–435 | 371 | 419–422 |
| cijeli slučaj kupnje | 2148–2320 | 2188 | 2402–2424 |

Cijeli `e2e:stack` s Chromeom ~5 s; mock e2e (diže `dev:mock` na `:4331`) ~17 s.

Statusi na `:8788` (`curl`): `/`, `/dogadjaj/<slug>`, `/uvjeti`, `/favicon.svg`,
`/organizator`, `/skener`, `/api/dogadjaji`, `/.well-known/apple-app-site-association` → 200;
`/nepostoji` → 404 (Astro). `/` je Astro („Događaji · Ulaznice”), `/organizator` SPA.

Latencija (20 zahtjeva, medijan / p90), `/dogadjaj/<slug>`: izravno na Astro 25,3 / 30,3 ms,
kroz binding (wrangler 3) 42,4 / 53,7 ms; pod wranglerom 4 binding je dodavao samo ~2–3 ms
(28,1 → 30,8 ms). Lokalni dodatak wranglera 3 je proxy dev registryja, ne mjera za Cloudflare.
SSR-om dominira poziv API-ju (jezgra ~25 ms). Ništa od ovoga ne mjeri javni URL na Cloudflareu
(Astro → `ulaznice-staging.domovina.ai/api`), samo da lokalni binding nije usko grlo.

## Zamke

1. **Wrangler 3 i 4 ne vide se u dev registryju.** Oba pišu u isti direktorij, ali 3.114
   zapisuje `port`/`entrypointAddresses`, a 4.165 `debugPortAddress`/`userWorkerService`.
   Glavni Worker pod 3.114 Astro Worker pod 4.165 ne nalazi ni kad je registriran:
   `[wrangler] Couldn't find `wrangler dev` session for service "domovina-ulaznice-web-staging"`
   i 503. Zato `pokreni-web.sh` Astro vrti **korijenskim** wranglerom 3.114, ne onim iz `web/`.
   Workerd iz 3.114 zna `compatibility_date` najviše 2025-07-18 i na to spusti Astrov
   2025-11-01 (samo upozorenje; e2e prolazi). Probano je i obrnuto (oba Workera pod wranglerom
   4 iz `web/node_modules`, vlastiti `WRANGLER_REGISTRY_PATH`, glavni na `:8789` sa zasebnim D1):
   radi, ali traži drugi glavni Worker, a webhook lažnog Stripea ide na `:8788`. Kad korijen
   prijeđe na wrangler 4, `pokreni-web.sh` treba prebaciti na isti.
2. **Bez Astra kupačke putanje na `:8788` daju 503** (`/api`, `/webhook`, `/organizator`,
   `/skener`, `/assets/*` rade). `pokreni.sh` ga zato diže sam; ako Astro padne, ponovno
   `scripts/lokalno/pokreni-web.sh`. Ivanov `:4321` zove samo `:8788/api` i radi i bez Astra.
3. **`run_worker_first` se ne pokupi hot reloadom.** Worker iz `pokreni.sh` je izmjenu
   `wrangler.jsonc` primio djelomično: binding da, `run_worker_first` ne (`/` je ostao SPA).
   Nakon izmjene `assets` u configu glavni Worker treba ponovno pokrenuti.
4. **Vrti se kopija builda** (`.wrangler/web-build`): novi `astro build` (npr. `npm run check`)
   briše `web/dist`, a `wrangler dev` nad njim padne (ENOENT `dist/client`).
5. **`astro build` kopira `web/.dev.vars` u `dist/server/.dev.vars`**; kopija ga briše
   (Ivanov `API_BASE_URL_DEV` build ne čita, a `API_BASE_URL` dolazi s `--var`).
6. **Build ne smije dirati Ivanov `astro dev`**: zaseban `WEB_VITE_CACHE`
   (`web/node_modules/.web-stack/vite`); `:4321` je cijelo vrijeme vraćao 200.
7. **`/uvjeti/` kroz binding pod wranglerom 3 daje 200, ne 307** (izravno na `:8792` i kroz
   binding pod wranglerom 4: 307 → `/uvjeti`). Lokalni binding wranglera 3 očito ne prolazi
   kroz Astrov assets router; e2e to ne provjerava. Na stagingu provjeriti (`deploy-dug.md`).
8. **`success_url` i link u mailu su `PUBLIC_BASE_URL` glavnog Workera.** Bez bindinga (ili
   na drugoj adresi) vode na staru SPA; e2e zato traži da su na base.
9. **Svaki `e2e:stack` troši pravu ulaznicu u lokalnoj jezgri** (Redovna, `available` pada).
   Inbox lažnog Resenda živi u memoriji `fake-stripe.mjs` i nestaje s njegovim restartom.
10. **Astro Worker sam nema `/api`**: preglednik zove relativni `/api/narudzba`, pa izravno na
    `:8792` kupnja pada na 404. Kupuje se uvijek kroz `:8788`.
