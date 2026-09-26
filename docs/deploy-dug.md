# Deploy dug — što je u gitu, a nije na serveru

> Živi dokument, ne dnevnik. Zasad se radi **lokalno**. Svaka promjena koja
> traži deploy upisuje se ovdje **u istom commitu** u kojem nastaje. Kad se
> deploya i provjeri, redak se briše; povijest ostaje u gitu.
>
> Okruženja i zamke: [2026-08-08](2026-08-08-deploy-okruzenja-i-stripe.md).
> Što još treba do prve prave ulaznice: [plan do produkcije](2026-09-03-plan-do-produkcije.md).

Stanje u tablici je **provjereno na živim sustavima** na navedeni datum, ne
pretpostavljeno iz gita. „Nepotvrđeno“ znači da nitko nije pogledao.

## Čeka deploy

| # | Promjena | Commit | Kamo | Kako | Provjera nakon deploya | Stanje |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `events-feed` bez `?limit` vraća 1 događaj umjesto 50 | `domovina-api@ca375ab` | `api.domovina.ai` (edge runtime) | u `domovina-api`: `./scripts/deploy-functions.sh --only=events-feed --restart` | `curl https://api.domovina.ai/functions/v1/events-feed` → `"limit":50` | ❌ 26. 9. vraća `"limit":1` |
| 2 | D1 migracija `0002_racuni_i_alarmi` (tablice `invoices`, `alarms`) | `migrations/0002_racuni_i_alarmi.sql` | staging D1 `domovina-ulaznice-staging` | `npx wrangler d1 execute domovina-ulaznice-staging --env staging --remote --file=migrations/0002_racuni_i_alarmi.sql` — **prije** Workera (#3) | `… --command "select name from sqlite_master where type='table'"` sadrži `invoices` i `alarms` | ❌ 26. 9. nema ih |
| 3 | Staging Worker zaostaje za `main` (P0/P1 od 3. 9., `/preuzmi` za mobilne aplikacije, link „otvori u aplikaciji“) | `main` od `829852d` nadalje | `ulaznice-staging.domovina.ai` | `npm run deploy` (= `--env staging`) | `GET /api/zdravlje` ima polja `prijava`, `alarm`, `racun`; `POST /api/ulaznice/<uuid>/preuzmi` s `{}` → **400**, ne 404 | ❌ 26. 9. nema tih polja, `/preuzmi` je 404 |
| 4 | Migracije `20260903120000` (`event_rail_ready`) i `20260903120100` (`rotate_ticket_tokens`) | `domovina-api@e5a7691` | produkcijska baza | u `domovina-api`: prvo `./scripts/db-migrate.sh --dry-run` — skripta pušta **sve** pending migracije, pa i tuđe (maksimir, voting) | `./scripts/db-psql.sh -c "select proname from pg_proc where proname in ('event_rail_ready','rotate_ticket_tokens')"` → 2 retka | ⚠️ nepotvrđeno; #3 (`/preuzmi`) ovisi o `rotate_ticket_tokens` |

Redoslijed: **4 → 1 → 2 → 3**. Backend ide prije Workera, a D1 shema prije
koda koji je čita (isto pravilo kao u [2026-08-04 §8](2026-08-04-lokalna-verifikacija-i-nalazi.md#8-redoslijed-puštanja-u-pogon-ne-mijenjati)).

Zamka uz #2: `npm run db:staging` i `npm run db:remote` primjenjuju **samo
`0001_init.sql`**. Svaka nova D1 migracija mora se pustiti ručno, kao gore.

## Namjerno se ne deploya

| Što | Zašto | Kada |
| --- | --- | --- |
| `seeds/*.sql` na produkcijsku jezgru | Stripe rail u seedovima ima izmišljen `acct_…`, a Safe je `0x1111…`. Na živom sustavu događaj bi izgledao kupovno, a naplata ne bi radila. | Kad Prilika za Susret završi pravi Stripe onboarding i potvrdi cjenik (TODO poslan Tomislavu Belaviću 26. 9. 2026.) |
| Produkcijski Worker bez `NAJAVA=1` | `ulaznice.domovina.ai` je javna domena i ne smije izgledati kao da prodaja radi | Kad staging proda prvu pravu ulaznicu |
| Stripe/Resend tajne na staging | Odluka vlasnika, v. [implementacija P0/P1](2026-09-03-implementacija-p0-p1.md) | Nakon odluke Standard vs Express ([plan §3.1](2026-09-03-plan-do-produkcije.md)) |
