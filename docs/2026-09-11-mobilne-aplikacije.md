# 2026-09-11 — Mobilne aplikacije za kupce (iOS SwiftUI + Android Compose)

> Autonoman prolaz. Zahtjev: „napravi iOS i Android SwiftUI i Compose aplikacije
> za korisnike za ulaznice", uz dopuštenje da se usput dokodira što fali na
> backendu i web frontendu. Drugi (neovisni) prolaz: v. §3.

## 1. Što je isporučeno

| Dio | Gdje | Stanje |
| --- | --- | --- |
| iOS aplikacija (SwiftUI, iOS 17+) | `mobile/ios/` | ✅ build prolazi; cijeli tok provjeren na simulatoru s mock API-jem (deep link → dodaj narudžbu → prijenos → rotacija → QR) |
| Android aplikacija (Compose, minSdk 26) | `mobile/android/` | ✅ `assembleDebug` prolazi (APK 19 MB); **nije pokrenuta** — slike sustava za emulator su na nemontiranom vanjskom disku |
| Mock Worker za razvoj | `mobile/mock-api.mjs` | ✅ port 8797, podaci iz `seeds/` |
| **Novi endpoint** `POST /api/ulaznice/:id/preuzmi` | `worker/index.ts` | ✅ + 5 testova (`worker-tests/preuzmi-app.test.ts`) |
| Refaktor: `izdajTokene()` zajednički za ponovnu dostavu i prijenos | `worker/index.ts` | ✅ ponašanje ponovne dostave nepromijenjeno, isti testovi prolaze |
| `/.well-known/apple-app-site-association` i `assetlinks.json` | `worker/index.ts`, `worker/env.ts`, `wrangler.jsonc` | ✅ + 3 testa; staging var `APPLE_APP_IDS` postavljen, `ANDROID_CERT_SHA256` prazan |
| Web: link „Otvorite narudžbu u aplikaciji" na stranici narudžbe | `src/pages/Narudzba.tsx` | ✅ vlastita shema `domovina-ulaznice://narudzba/<id>` |
| Dokumentacija | `mobile/README.md` (kako se gradi, sigurnosni model, što fali) | ✅ |

Testovi: 89 → **97**, `npm run build` i `npm run test:types` prolaze.

## 2. Ključna odluka: kako QR dolazi u aplikaciju

Do sada je vrijedilo: **API kupcu ne vraća QR tokene** (jednokratni su, žive u
e-mailu; U1 §Gotcha 3, U2 §2). Mobilna aplikacija bez QR-a na ulazu nema
smisla, pa je dodan **jedan** izlaz tokena mimo e-maila:

```
POST /api/ulaznice/:id/preuzmi  { buyer_email }
  → 403 email_ne_odgovara   ako e-mail nije e-mail kupca
  → events-tickets          ako tokeni još postoje (prva dostava nije prošla)
  → rotate_ticket_tokens    inače: NOVI tokeni, stari QR iz e-maila prestaje vrijediti
  → { status:"preuzeto", stari_qr_ponisten, qr_prefix:"dgdj1:", tickets:[{serial,holder_name,state,qr_token}] }
```

To je **isti mehanizam kao ponovna dostava** (`izdajTokene`), samo je odredište
JSON umjesto e-maila. Invarijanti jezgre ostaju: u bazi samo hash, tvrdi limit
rotacija 5/24 h, `resend` KV limit 3/10 min po narudžbi. Trag u
`sent_emails` s `template='preuzimanje_app'`, `pending_deliveries` se briše
(dostava je obavljena).

Aplikacija tokene čuva u Keychainu (`WhenUnlockedThisDeviceOnly`) odnosno
Android Keystore AES-GCM, i crta QR lokalno s payloadom `dgdj1:<token>` —
isto što skener već prima.

## 3. Odluke koje su mogle biti drukčije (`⚠️ REVIEW(fable)`)

| # | Gdje | Odluka | Alternativa |
| --- | --- | --- | --- |
| 1 | `worker/index.ts` `/preuzmi` | Drugi faktor je **e-mail kupca** (uz `order_id`). | Jednokratni kod poslan na e-mail prije izdavanja (jače, ali još jedan mail i još jedan ekran). |
| 2 | `worker/index.ts` `/preuzmi` | Ako tokeni još postoje, isporuče se aplikaciji **bez rotacije** — e-mail koji cron još nije poslao ostat će bez QR-a, ali `pending_deliveries` se briše pa se ni ne šalje. | Uvijek rotirati (jednostavnije za razmišljanje, ali troši rotacijski limit). |
| 3 | `mobile/*` Checkout | Stripe Checkout u `SFSafariViewController` / Custom Tabu; aplikacija pamti narudžbu **prije** otvaranja i poll-a stanje nakon zatvaranja. | Stripe mobile SDK + PaymentSheet: nativnije, ali vuče SDK, Connect direct charge traži `stripeAccount` na klijentu (curi `acct_…`, što docs/03 §2 zabranjuje). |
| 4 | `wrangler.jsonc` | `APPLE_APP_IDS` odmah u stagingu s ITalk Team ID-om (`6SCK58757K`, iz `domovina-browser`). | Ostaviti prazno dok App ID ne postoji u Apple Developeru — ali onda AASA vraća 404 i iOS to cachea. |
| 5 | Android `SecureStore` | Vlastiti AES-GCM nad Android Keystoreom (40 redaka) umjesto `security-crypto` (deprecated). | Jetpack DataStore + Tink. |
| 6 | Android `CheckoutScreen` | Custom Tab se otvara i **odmah** navigira na ekran narudžbe (Custom Tab nema callback zatvaranja). | Pratiti `onResume` aktivnosti i tek tada navigirati. |
| 7 | iOS `Keychain.spremi` | Neuspjeh zapisa ruši prijenos s porukom (`keychain`), tokeni se ne pamte u memoriji. | Fallback u memoriju za trajanje sesije. |
| 8 | Web `Narudzba.tsx` | Link s vlastitom shemom prikazan svima; tko nema aplikaciju, klik ne radi ništa. | Smart App Banner (`apple-itunes-app` meta) tek kad aplikacija bude u App Storeu. |

## 3a. Dizajn sustav (drugi prolaz, 12.9.2026.)

Pitanje je bilo „postoji li premium SwiftUI UI kit za brendiranje". Odgovor i
odluka: **ne postoji „shadcn za SwiftUI"**; plaćeni kitovi (The Swift Kit,
AppLayoutsUI, CodeCanyon) su starter boilerplati s paywallom i authom koje
aplikacija nema. Napravljen je vlastiti mali dizajn sustav na obje platforme,
usklađen s webom — detalji u `mobile/README.md` §Dizajn sustav.

| # | Gdje | Odluka | Alternativa |
| --- | --- | --- | --- |
| 9 | `Theme.swift`, `Theme.kt` | Font **Manrope** (OFL), 4 statičke težine u bundleu. | Sistemski font (nula rizika, nula karaktera); Inter (češći, manje prepoznatljiv). |
| 10 | obje platforme | Bez Pow-a — mikroanimacije nativno. | Pow (EmergeTools, MIT) daje bogatije efekte, ali je SPM ovisnost u javnom repou. |
| 11 | ikona | Generirana Pillow skriptom (gradijent + bijela ulaznica s urezima). | Dizajner; Icon Composer (Xcode 26) za slojevitu Liquid Glass ikonu. |
| 12 | `Tema.boja(hex:)` | Organizatorov `accent_color` samo kao traka na tier kartici. | Cijela tema po organizatoru (aplikacija je multi-organizator, pa bi skakala iz boje u boju). |
| 13 | `OrdersView` | Put navigacije postavlja se u `sheet(onDismiss:)`, ne odmah nakon `dismiss()`. | — (bug nađen u provjeri: put postavljen tijekom zatvaranja sheeta NavigationStack odbaci). |

## 4. Što nije napravljeno i zašto

- **Android nije pokrenut.** `~/Library/Android/sdk/system-images` je symlink na
  `/Volumes/DOMOVINA_ANDROID` koji nije montiran; `sdkmanager` ne može pisati.
  Na USB-u su bila dva fizička uređaja, ali instalacija na tuđi telefon nije
  napravljena bez izričitog zahtjeva. Naredba je spremna:
  `adb -s <serial> install mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
- **Universal/App Links nisu provjereni end-to-end** — traže App ID s
  Associated Domains (Apple) i otisak potpisa (Android); oboje vanjsko.
- **Nema Wallet propusnica, pusheva, podsjetnika.** `docs/09` ih vodi kao
  razliku prema Ticket Tailoru; nisu bile u zahtjevu.
- **Skener za osoblje** ostaje web PWA; aplikacija je samo za kupce.
- **Staging i dalje ne prodaje** (feed prazan, Stripe/Resend tajne nedostaju —
  `docs/2026-09-03-plan-do-produkcije.md`). Aplikacije su zato provjerene s
  mock API-jem.

## 5. Zapisnik provjere (iOS simulator, iPhone 16, mock API)

1. Popis događaja: termin s rasponom, termin bez satnice (00:00 → samo datum),
   „od 35,00 €", oznaka „uskoro u prodaji". ✅
2. `domovina-ulaznice://narudzba/<id>` s nepoznatom narudžbom → sheet „Dodaj
   narudžbu" s upisanim ID-om. ✅
3. Dodavanje s e-mailom kupca → ekran narudžbe „Plaćeno", 2 ulaznice, e-mail
   maskiran. ✅
4. Prijenos (tokeni potrošeni na mocku) → rotacija → „Vrijede QR kodovi iz
   aplikacije — oni iz e-maila više ne rade", gumbi QR. ✅
5. QR ekran: bijela pozadina, ime, serijski broj, termin. ✅
6. Nađen i popravljen bug: popis lokalnih ulaznica bio je computed property pa
   se ekran nije osvježio nakon prijenosa → sada `@State` koji se puni u
   `ucitaj()`.

### 5a. Provjera dizajn sustava (12.9.2026., iOS simulator, mock API)

7. Popis događaja: Manrope učitan, kartice s naslovnicom (brend gradijent kad
   nema slike), cijena zeleno, oznaka „USKORO U PRODAJI". ✅
8. Deep link → „Dodaj narudžbu" u novom stilu, e-mail upamćen. ✅
9. Narudžba: stanje s ikonom, kartica iznosa, ulaznice u obliku ulaznice s
   urezima poravnatim na perforaciju, primarni gumb prijenosa. ✅
10. Prijenos → haptika + „Preneseno 2 ulaznica." + gumbi „Pokaži QR". ✅
11. QR ekran: kartica-ulaznica s QR-om, ime, događaj, termin; ulazna
    animacija. ✅
12. Nađeni i popravljeni bugovi: (a) put navigacije nakon sheeta (REVIEW #13);
    (b) urezi ulaznice bili izvan kartice zbog krivog offseta.
13. Android: `assembleDebug` prolazi s novim temom/komponentama; nije pokrenut
    (isti razlog kao §4).

