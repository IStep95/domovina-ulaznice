# Deploy dug — što je u gitu, a nije na serveru

> Živi dokument, ne dnevnik. Zasad se radi **lokalno**. Svaka promjena koja
> traži deploy upisuje se ovdje **u istom commitu** u kojem nastaje. Kad se
> deploya i provjeri, redak se briše; povijest ostaje u gitu.
>
> Okruženja i zamke: [2026-08-08](2026-08-08-deploy-okruzenja-i-stripe.md).
> Što još treba do prve prave ulaznice: [plan do produkcije](2026-09-03-plan-do-produkcije.md).

Produkcija 23. 11. (Ivan): `NAJAVA` maknut, `ulaznice.domovina.ai` je puna aplikacija (Worker `ca26f532`, web `6b996d75`, D1 `0002` puštena). `/`, `/organizator`, `/skener`, `/api/dogadjaji` → 200; `/api/zdravlje`: `stripe`, `webhook`, `hmac`, `mail` = false — **#10**.

Jezgra 23. 11. (Matija): migracija `20261120120000_events_venue_geo` i `events-feed` s `venue_lat`/`venue_lon`/`cover_image_alt` na `api.domovina.ai` (bivši #5, `domovina-api` journal `20261123T140548Z-b1272d4`). U GoTrue `ADDITIONAL_REDIRECT_URLS` dodani `https://ulaznice.domovina.ai/**` i `https://ulaznice-staging.domovina.ai/**` — preduvjet za #11.

Staging Stripe 23. 11. (Matija): novi sandbox restricted key i Connect webhook (API `2025-02-24.acacia`) postavljeni, `/api/zdravlje` → `stripe`, `webhook` = true; stari endpoint `we_1U2CSIQoZhPywPyhprOeashs` (`2020-08-27`) **disabled** (bivši #12).

Produkcija 23. 11. (Matija): `SKRIVENI_ORGANIZATORI` = test organizator `…0000000000f2` — jezgra je zajednička, pa produkcija ne prikazuje ni ne prodaje `[TEST]` događaje sa sandbox railom (`worker/api.ts` `feed()`). Svaki novi test organizator ide u tu varijablu **prije** seeda.

Jezgra 23. 11. (Matija): pušten `seeds/staging-web-pregled.sql` sa sandbox railom (`acct_1U2CRfByTQ1uTmhK`). Produkcija: `[]` i 404 na događaju. Staging: sandbox onboarding dovršen, `account.updated` webhook sam postavio rail → `kupovno: true`; **prva testna kupnja prošla** (narudžba `ab2e7543`, ulaznica `TES-000001`). Mail ne ide dok nema `RESEND_API_KEY` (#10). Detalji: [2026-11-23 §4](2026-11-23-stripe-kljucevi-i-connect-platforma.md).

Staging 23. 11.: D1 `0002` puštena (`invoices`, `alarms` postoje); Worker na `main` — `/api/zdravlje` ima `prijava`, `alarm`, `racun`, `/preuzmi` s `{}` → 400 (bivši #2 i #3).

Stanje u tablici je **provjereno na živim sustavima** na navedeni datum, ne
pretpostavljeno iz gita. „Nepotvrđeno“ znači da nitko nije pogledao.

## Čeka deploy

| # | Promjena | Commit | Kamo | Kako | Provjera nakon deploya | Stanje |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `events-feed` bez `?limit` vraća 1 događaj umjesto 50 | `domovina-api@ca375ab` | `api.domovina.ai` (edge runtime) | u `domovina-api`: `./scripts/deploy-functions.sh --only=events-feed --restart` | `curl https://api.domovina.ai/functions/v1/events-feed` → `"limit":50` | ❌ 26. 9. vraća `"limit":1` |
| 4 | Migracije `20260903120000` (`event_rail_ready`) i `20260903120100` (`rotate_ticket_tokens`) | `domovina-api@e5a7691` | produkcijska baza | u `domovina-api`: prvo `./scripts/db-migrate.sh --dry-run` — skripta pušta **sve** pending migracije, pa i tuđe (maksimir, voting) | `./scripts/db-psql.sh -c "select proname from pg_proc where proname in ('event_rail_ready','rotate_ticket_tokens')"` → 2 retka | ⚠️ nepotvrđeno; #3 (`/preuzmi`) ovisi o `rotate_ticket_tokens` |
| 6 | Stranice kupaca na stagingu kroz Astro: binding `WEB` (+ `assets.run_worker_first`) u `env.staging` glavnog Workera, podjela putanja u `worker/index.ts` (S6 lanca `web/`) | S6 lanca `web/` (PR iz `IStep95/domovina-ulaznice`) | prvo `domovina-ulaznice-web-staging` (`ulaznice-web-staging.domovina.ai`), pa `ulaznice-staging.domovina.ai` | v. „Binding `WEB` (S6)” niže | v. „Binding `WEB` (S6)” niže | ⚠️ deployano 23. 11. (web `0833e5c0`, Worker `c794c86a`): `/uvjeti`, `/organizator`, `/skener` 200, ali **`/` → 503 „Pokušaj ponovno”**: SSR pozvan kroz binding dobiva `ApiError: neispravan_odgovor` na `API_BASE_URL` (javni URL istog Workera); izravno na `ulaznice-web-staging` radi. Popravak: v. `web/docs/ui-feedback.md` stavka 6 |
| 7 | Prijava organizatora i skenera kodom na e-mail: `POST /api/organizator/kod` i `/potvrdi` (GoTrue `/otp` + `/verify`), novi izgled `/organizator` i `/skener`; lozinka ostaje sporedni put | ovaj commit | `ulaznice-staging.domovina.ai` | isti `npm run deploy` kao #3/#6. **Prije toga** u GoTrueu (`api.domovina.ai`, Auth → Email Templates → Magic Link) predložak mora imati `{{ .Token }}`, inače mail nosi samo link i kod se ne može upisati. „Nastavi s Googleom” v. #11 | `POST /api/organizator/kod` → `{"ok":true}`, mail za postojeći račun sadrži 6-znamenkasti kod, upis koda na `/organizator` otvara pregled | ⚠️ Worker deployan 23. 11.; `POST /api/organizator/kod` → `{"ok":true}`; predložak s `{{ .Token }}` u GoTrueu nepotvrđen |
| 8 | Galerija događaja: migracija `20261120170000_events_gallery` (`events.gallery` jsonb `[{url, alt}]`, ≤ 20) i `events-feed` koji je vraća; Astro je prikazuje ispod „Dodaj u kalendar” kad je slika više od jedne | `domovina-api@d5cdae3` (grana `events-gallery`) + ovaj commit | produkcijska baza, pa `api.domovina.ai` (edge runtime), pa `web` | kao #5: **migracija strogo prije `events-feed`** (feed nad starom shemom vraća 500 na `column events.gallery does not exist`); Worker ne treba ništa osim tipa | `curl …/events-feed` → svaki `event` ima `"gallery":[]`; `/dogadjaj/<slug>` s ≥ 2 slike ima odjeljak „Galerija” | ⏳ lokalno provjereno 20. 11. |
| 9 | Editor događaja, prva verzija: `POST /api/organizator/dogadjaj` → `events-organizer` (`action: create`, korisnikov JWT) i SPA `/organizator/novi`; sprema privatnu skicu s ulaznicama | ovaj commit | `ulaznice-staging.domovina.ai` | isti `npm run deploy` kao #3/#6/#7. Preduvjet: `events-organizer` deployan na `api.domovina.ai` (nepotvrđeno). Organizator mora biti admin računa **i** imati redak u `identity_verifications` (eOsobna na domovina.ai), inače `403 nema_prava_kreiranja` | prijava → „+ Novi događaj” → „Spremi kao skicu” → skica se vidi na pregledu kao „skica” | ⚠️ Worker deployan 23. 11.; `/organizator/novi` 200; `events-organizer` na `api.domovina.ai` nepotvrđen |

| 10 | Produkcijske tajne glavnog Workera | — | `ulaznice.domovina.ai` | `wrangler secret put <IME>` (bez `--env`): `DOMOVINA_API_SERVICE_KEY`, `EVENTS_STRIPE_CONFIRM_SECRET` (iste vrijednosti kao staging, ista jezgra), `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_WEBHOOK_SECRET` (Connect endpoint `https://ulaznice.domovina.ai/webhook/stripe`), `RESEND_API_KEY`; po potrebi `FIRA_API_KEY` | `/api/zdravlje` → `stripe`, `webhook`, `hmac`, `mail` = true | ⚠️ 23. 11.: `EVENTS_STRIPE_CONFIRM_SECRET`, `DOMOVINA_API_SERVICE_KEY`, `STRIPE_SECRET_KEY` (restricted) i `STRIPE_WEBHOOK_SECRET` postavljeni; `/api/zdravlje` → `stripe`, `webhook`, `hmac` = true. Fali `RESEND_API_KEY` (`mail:false`). Live račun još nije Connect platforma — [2026-11-23](2026-11-23-stripe-kljucevi-i-connect-platforma.md) |
| 11 | Prijava Googleom: `GET /api/organizator/google` → GoTrue `/authorize?provider=google` (implicit flow), SPA preuzme token iz fragmenta (`src/lib/auth.ts`), refresh token se ne sprema | ovaj commit | `ulaznice-staging.domovina.ai`, pa `ulaznice.domovina.ai` | `npm run deploy`, pa `npm run deploy:prod`. Preduvjet (✅ 23. 11.): origin u GoTrue `ADDITIONAL_REDIRECT_URLS` | `GET /api/organizator/google` → 302 na `api.domovina.ai/auth/v1/authorize`; „Nastavi s Googleom” na `/organizator` vraća prijavljenog korisnika | ⚠️ staging `1b61e0ae` (prava prijava provjerena, Ivan); produkcija `25e0df1b` 23. 11.: `GET /api/organizator/google` → 302 na `api.domovina.ai/auth/v1/authorize?provider=google&redirect_to=https://ulaznice.domovina.ai/organizator`; prava prijava na produkciji nepotvrđena |

Redoslijed: **4 → 1 → 2 → 3**, #6 nakon #3 (isti Worker, isti `npm run deploy`); #5 je neovisan, ali unutar njega **migracija strogo prije `events-feed`**: novi feed nad starom shemom vraća 500 (`column events.venue_lat does not exist`) i ruši popis događaja. Backend ide prije Workera, a D1 shema prije
koda koji je čita (isto pravilo kao u [2026-08-04 §8](2026-08-04-lokalna-verifikacija-i-nalazi.md#8-redoslijed-puštanja-u-pogon-ne-mijenjati)).

Zamka uz #2: `npm run db:staging` i `npm run db:remote` primjenjuju **samo
`0001_init.sql`**. Svaka nova D1 migracija mora se pustiti ručno, kao gore.

## `web/` (korak 0, 2026-11-19)

`domovina-ulaznice-web` (`ulaznice-web.domovina.ai`) i `domovina-ulaznice-web-staging`
(`ulaznice-web-staging.domovina.ai`) su deployani sa stranicom „u izradi” iz
`web/privremeno/`. Auto-deploya nema: nakon svakog mergea Ivanovog PR-a koji dira
`web/` pokreni `npm --prefix web ci && npm --prefix web run deploy:staging`
([web odluka 22](../web/docs/decisions.md)). Produkciju `web/` ne deployaj prije S6
osim kao „u izradi” (odluka 24).

S1 (2026-11-19): `web/` je sad Astro build (`dist/`), `privremeno/` je obrisan. Okruženje
se bira **pri buildu** (`CLOUDFLARE_ENV`), ne s `--env` pri deployu, pa uvijek preko
skripti: `npm --prefix web run deploy:staging`, odnosno `deploy:prod`. Goli
`wrangler deploy --env staging` nad produkcijskim buildom deploya produkcijsku
konfiguraciju. Provjera nakon deploya: `/` vraća „u izradi” (`noindex`), a
`/dogadjaj/<slug>` naslov događaja (na stagingu tek kad je pušten test događaj, odluka 23).

### Binding `WEB` (S6)

Glavni staging Worker stranice kupaca (`/`, `/dogadjaj/*`, `/ulaznice/*`, `/uvjeti`,
`/privatnost`, nepoznate putanje, Astrova statika) prosljeđuje Astro Workeru kroz service
binding; `/api/*`, `/webhook/*`, `/.well-known/*`, `/organizator`, `/skener` i `/assets/*`
(SPA) ostaju njegovi. Povratak sa Stripea (`success_url`) i link u mailu (`PUBLIC_BASE_URL`)
time vode na Astro. Produkcija od 23. 11. ima isti binding (`WEB` → `domovina-ulaznice-web`).

1. **Prvo `web`**, s istog commita: `npm --prefix web ci && npm --prefix web run deploy:staging`.
   Binding na servis koji ne postoji ruši deploy glavnog Workera, a stari `web` bi kupcima
   servirao stare stranice. Provjera: `curl -s -o /dev/null -w '%{http_code}'
   https://ulaznice-web-staging.domovina.ai/uvjeti` → 200.
2. **Pa glavni Worker**: `npm run deploy` (= `--env staging`).

Varijable: ništa novo za postaviti, sve je u configu. `web` staging ima `API_BASE_URL` =
`https://ulaznice-staging.domovina.ai` (`web/wrangler.jsonc`, `env.staging.vars`): SSR zove
`/api` glavnog Workera javnim URL-om. Glavni Worker: `services: [{ binding: "WEB", service:
"domovina-ulaznice-web-staging" }]` i `assets.run_worker_first: true` u `env.staging`
korijenskog `wrangler.jsonc`; `PUBLIC_BASE_URL` ostaje `https://ulaznice-staging.domovina.ai`.
Bez novih tajni.

Provjere nakon deploya (dodaj `?cb=$RANDOM` ako sumnjaš na cache, [2026-08-08 §4.4](2026-08-08-deploy-okruzenja-i-stripe.md)):

| Zahtjev na `https://ulaznice-staging.domovina.ai` | Očekivano |
| --- | --- |
| `/` | 200, `<title>Događaji · Ulaznice` (Astro), ne SPA; nema stranice „Pokušaj ponovno” (to znači da SSR ne dohvaća `/api` javnim URL-om, web S6 točka 3) |
| `/uvjeti`, `/privatnost` | 200; `/uvjeti/` → 307 na `/uvjeti` (lokalno pod wranglerom 3 binding daje 200, [research](../web/docs/research/2026-11-20-lokalna-e2e-kroz-astro.md) zamka 7) |
| `/nepostoji-$RANDOM`, `/ulaznice/00000000-0000-4000-8000-000000000000` | 404 iz Astra („Stranica nije pronađena”), ne SPA 200 |
| `/organizator`, `/skener` | 200, SPA |
| `/api/zdravlje`, `/.well-known/apple-app-site-association` | 200 JSON |
| `/dogadjaj/<slug>` | 200 tek kad je u jezgri objavljen događaj ([web odluka 23](../web/docs/decisions.md)) |

Uz to `npx wrangler tail --env staging` dok se otvaraju stranice: bez `[worker] neuhvaćena
greška` i bez 5xx s `WEB`. Kupnja od kraja do kraja na stagingu čeka Stripe/Resend tajne
(„Namjerno se ne deploya”); lokalno je prošla kroz `scripts/lokalno/pokreni.sh` +
`npm --prefix web run e2e:stack`.

Povratak: ukloniti `services` iz `env.staging` i `npm run deploy` — bez `env.WEB` Worker sve
što nije `/api` ili `/webhook` servira iz `ASSETS` kao prije S6 (`run_worker_first` tada samo
znači da Worker vidi i statiku SPA-e, ponašanje je isto). Brže, bez commita: prethodna verzija
Workera u Cloudflare dashboardu (Workers → `domovina-ulaznice-staging` → Deployments →
Rollback). `domovina-ulaznice-web-staging` može ostati deployan, na svojoj domeni ne smeta.

## Namjerno se ne deploya

| Što | Zašto | Kada |
| --- | --- | --- |
| `seeds/*.sql` na produkcijsku jezgru | Stripe rail u seedovima ima izmišljen `acct_…`, a Safe je `0x1111…`. Na živom sustavu događaj bi izgledao kupovno, a naplata ne bi radila. | Kad Prilika za Susret završi pravi Stripe onboarding i potvrdi cjenik (TODO poslan Tomislavu Belaviću 26. 9. 2026.) |
| Resend tajna na staging (Stripe je postavljen 23. 11.) | Odluka vlasnika, v. [implementacija P0/P1](2026-09-03-implementacija-p0-p1.md) | Nakon odluke Standard vs Express ([plan §3.1](2026-09-03-plan-do-produkcije.md)) |
