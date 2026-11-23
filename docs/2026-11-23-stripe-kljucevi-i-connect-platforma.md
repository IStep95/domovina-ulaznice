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
| restricted key | ✅ postavljen 23. 11. | ⏳ |
| webhook | ✅ `domovina-ulaznice-produkcija` | ⏳ novi `domovina-ulaznice-staging` (acacia) |
| `/api/zdravlje` | `stripe:true`, `webhook:true` | `stripe:false`, `webhook:false` |

Stari sandbox endpoint `we_1U2CSIQoZhPywPyhprOeashs` (iz kolovoza) ima isti URL i
događaje, ali API `2020-08-27`. Kad novi radi: **Disable** stari, inače svaki
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
