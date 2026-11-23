# Stripe ključevi, webhookovi i Connect platforma (23. 11. 2026.)

> Stanje Stripe strane nakon što je produkcija dobila punu aplikaciju. Connect
> onboarding organizatora je **namjerno odgođen**; ovaj dokument drži što je
> gotovo, što fali i odluke koje prethode onboardingu.
>
> Vezano: [03 Stripe Connect](03-stripe-connect-0-posto.md),
> [2026-08-08 §5 i §7](2026-08-08-deploy-okruzenja-i-stripe.md),
> [plan do produkcije §3.1](2026-09-03-plan-do-produkcije.md),
> [deploy-dug](deploy-dug.md).

## 1. Računi

| Okruženje | Stripe račun | Pravna osoba | Worker |
| --- | --- | --- | --- |
| produkcija (live) | `italk.hr` `acct_1Kluc3Bz6BKZIuxV` | ITalk d.o.o. (pravna osoba iza Domovine; potvrdio Matija 23. 11.) | `ulaznice.domovina.ai` |
| staging (sandbox) | `domovina-ulaznice-staging` `acct_1U2CO1QoZhPywPyh` (pod italk.hr) | — | `ulaznice-staging.domovina.ai` |

Time je odgovoreno pitanje iz [2026-08-08 §7.2](2026-08-08-deploy-okruzenja-i-stripe.md#72-pravni-subjekt-platforme):
platforma je **ITalk d.o.o.**

## 2. Ključevi i webhookovi

Isti oblik u oba okruženja; vrijednosti su samo u password manageru i u
`wrangler secret` (produkcija bez `--env`, staging s `--env staging`).

**Restricted key**, ne glavni secret key. Dozvole samo u stupcu *Connect
permissions* (Worker sve radi kao direct charge sa `Stripe-Account` headerom);
stupac platforme je svugdje *None*:

| Resurs | Connect dozvola | Poziv u kodu |
| --- | --- | --- |
| Checkout Sessions | Write | `checkout.sessions.create` (`worker/stripe.ts`) |
| Charges and Refunds | Write | `refunds.create` |
| Payment Intents | Read | `paymentIntents.retrieve` (reconcile) |

Provjera webhook potpisa (`webhooks.constructEventAsync`) je lokalna i ne treba
dozvolu. **Publishable key ne treba** — plaćanje je hostani Checkout s
redirectom, `pk_` se nigdje ne koristi.

**Webhook (event destination):**

- *Events from*: **Connected accounts** (obični endpoint ne vidi direct charge događaje)
- *API version*: **`2025-02-24.acacia`** — mora biti ista kao `apiVersion` u
  `worker/stripe.ts`. Zadana verzija računa je `2020-08-27`; verzija se na
  postojećem endpointu **ne može promijeniti** (samo Disable / Roll secret / Delete),
  pa se za novu verziju radi novi endpoint.
- *Događaji* (točno oni koje obrađuje `worker/webhooks.ts`):
  `checkout.session.completed`, `charge.refunded`, `account.updated`,
  `payment_intent.payment_failed`, `charge.dispute.created`
- URL: `https://<host>/webhook/stripe`

| | produkcija | staging |
| --- | --- | --- |
| restricted key | ✅ postavljen 23. 11. | ✅ postavljen 23. 11. |
| webhook | ✅ `domovina-ulaznice-produkcija` | ✅ `domovina-ulaznice-staging` (acacia) |
| `/api/zdravlje` | `stripe:true`, `webhook:true` | `stripe:true`, `webhook:true` |

Stari sandbox endpoint `we_1U2CSIQoZhPywPyhprOeashs` (iz kolovoza) ima isti URL i
događaje, ali API `2020-08-27` — **disabled 23. 11.** (ne brisati odmah, služi kao referenca). Da je ostao aktivan, svaki
događaj stiže dvaput (idempotencija na `webhook_events` PK to podnosi, ali drugi
potpis neće proći jer Worker zna samo jedan `whsec_`, pa se u Stripeu gomilaju
neuspjele isporuke).

## 3. Što blokira pravu prodaju — Connect platforma

1. **Live račun nije Connect platforma.** Pri izradi webhooka Stripe javlja:
   „Your account is not set up as a Connect platform”. Dok se ne prođe
   *Connect → Get started* u live modu (platform profile), ne može postojati
   nijedan connected account, pa ni direct charge. Webhook postoji, ali ne dobiva
   događaje.
2. **Express ili Standard (ili Accounts v2 controller properties).** Odluka iz
   [2026-08-08 §7.1](2026-08-08-deploy-okruzenja-i-stripe.md#71-express-vs-standard--ovo-je-najveće)
   je i dalje otvorena. Preporuka tamo: **Standard** — direct charge je jedini
   tip koji nam treba, chargeback nosi organizator (prodavatelj), nema dodatnog
   Stripe troška. Stripe za nove platforme upućuje na Accounts v2; to provjeriti
   prije implementacije.
3. **Sandbox: „Multiple capabilities paused — a required task is past due”.**
   Banner na `acct_1U2CO1QoZhPywPyh`. Treba otvoriti *View task* i zatvoriti ga,
   inače sandbox kupnja može pasti na capability provjeri.
4. **Onboarding u kodu ne postoji** (dio U3). Kad se radi, restricted keyu
   treba dodati dozvole za **Accounts** i **Account Links** (stupac platforme,
   ne Connect), a `account.updated` već puni `organizer_payment_rails.charges_enabled`.
5. **Most prema računu (FIRA)** je preduvjet za pravi novac, v.
   [2026-08-08 §7.4](2026-08-08-deploy-okruzenja-i-stripe.md#74-most-narudžba--račun-fira-i-dalje-ne-postoji).

Dok 1–4 nisu riješeni, produkcija s postavljenim `sk`/`whsec` je sigurna: bez
connected accounta i objavljenog događaja nema checkouta (`worker/stripe.ts`
odbija organizatora bez `charges_enabled`).

## 4. Staging testna kupnja — prošla 23. 11. (17:31)

- `[TEST]` događaj `test-pregled-web-sucelja` je u jezgri; produkcija ga skriva
  (`SKRIVENI_ORGANIZATORI`, `worker/api.ts` `feed()`).
- Prva testna uplata pala je na Stripeu („Your account cannot currently make
  charges”): sandbox connected account `acct_1U2CRfByTQ1uTmhK` bio je
  **Restricted** (onboarding iz 8. 8. nedovršen).
- Onboarding je dovršen kroz Dashboard → Connected accounts → račun →
  *Request information* (remediation link → Express). Sve testnim podacima:
  adresa `address_full_match`, MBS/telefon nule, predstavnik i direktor
  „Test Predstavnik” (DOB 1. 1. 1901.), direktori potvrđeni *Electronic
  attestation* (upisano ime kao potpis), IBAN gumbom *Use test account*
  (STRIPE TEST BANK), pa *Agree and submit*.
- **Webhook je sam prebacio rail**: 7× `account.updated` u D1 `webhook_events`
  s outcome `rail_updated` (nijedan `rail_unknown_account`); `/api/dogadjaj/…`
  → `kupovno: true`, `stripe_connected: true`. Ručno se ništa nije diralo.
- Kupnja karticom 4242 (imenska, 40,00 €): jezgra `contributions` `ab2e7543…`
  `state = paid`, `payment_rail = stripe`, `external_payment_ref = pi_3Uf09Z…`;
  `tickets` `TES-000001` `issued`; `contribution_events` created → paid →
  `tickets.issued`. D1: `checkout.session.completed` → `paid`;
  `pending_deliveries` 1 red, „RESEND_API_KEY nije postavljen” (očekivano).
- Uočeno, nije popravljeno: `holder_name` = „Matija␣␣Stepanić” (dvostruki
  razmak — provjeriti normalizaciju imena u obrascu/`events-checkout`);
  `terms_accepted_at` je prazan na plaćenoj narudžbi — provjeriti šalje li ga
  Worker uopće.

## 5. Zamke iz ove sesije

- **`npm ci` briše wranglerov zapamćeni račun** (`node_modules/.cache/wrangler`);
  nakon toga `wrangler deploy` pada na „More than one account available”.
  Deploy uvijek s `CLOUDFLARE_ACCOUNT_ID=7dc7167b7e2e00923bfa7cd697df14e4` (D.O.M.).
- **`domovina-api/scripts/db-psql.sh --stdin` tiho ne radi**: `detect_db_container`
  zove `ssh` bez `-n`, koji pojede stdin, pa psql dobije prazan ulaz i izađe s 0.
  Za SQL datoteku: `ssh -n` za ime containera, pa `docker exec -i … psql < file`.
- **Coolify API ne vraća vrijednosti tajni** (`value` izostavljen). Tajne jezgre
  (`EVENTS_STRIPE_CONFIRM_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) čitaju se iz
  environmenta containera `supabase-edge-functions-*` preko SSH-a.
- **Stripe Dashboard: tipkanje bez fokusa ide u tipkovničke prečace** (skok na
  Invoices, otvara Workbench, koji onda prekriva obrazac i hvata klikove). Polja
  puniti kroz native value setter + `input` event, Workbench zatvoriti prije klikova.
- **Zadana API verzija webhooka je verzija računa (`2020-08-27`)** i na postojećem
  endpointu se ne može promijeniti — uvijek ručno odabrati `2025-02-24.acacia`.
- **Stripe CLI** profil `domovina-ulaznice-staging` ima test ključ istekao 6. 11.
  (`stripe login --project-name domovina-ulaznice-staging`). Profil
  `domovina-ulaznice` (italk.hr) drži i `live_mode_api_key` — nepotreban rizik.
- **Stripe Express sesija (remediation link) istječe usred onboardinga** — dvaput
  na koraku *Business directors* („Session expired or invalidated”). Uneseno
  ostaje spremljeno; iz Dashboarda uzeti novi *Request information* link (SMS:
  *Use test code*) i nastaviti. Forma je cross-origin iframe: `find`/`read_page`
  ne vide polja, a `file_upload` ne može do inputa — direktore potvrditi
  *Electronic attestation*, ne uploadom.
