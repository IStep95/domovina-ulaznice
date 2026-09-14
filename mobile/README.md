# mobile/ — aplikacije za kupce (iOS SwiftUI · Android Compose)

Dvije nativne aplikacije za **kupca ulaznice**: pregled događaja, kupnja
(Stripe Checkout u sistemskom pregledniku), „Moje ulaznice" i **QR na ulazu**
koji radi i bez interneta. Obje pričaju **isključivo s Workerom** (`/api/*`),
nikad s jezgrom — isto pravilo kao SPA (`docs/02-arhitektura.md` §1).

```
mobile/
  ios/        SwiftUI, iOS 17+, XcodeGen (project.yml je izvor istine)
  android/    Jetpack Compose, minSdk 26, Gradle wrapper 8.14.2 + AGP 8.13
  mock-api.mjs   lažni Worker za razvoj bez jezgre i Stripea (port 8797)
```

## Što aplikacija radi (obje platforme, ista funkcionalnost)

| Ekran | Endpoint | Napomena |
| --- | --- | --- |
| Događaji | `GET /api/dogadjaji` | termin bez satnice, rasprodano / uskoro |
| Detalj | `GET /api/dogadjaj/:slug` | tieri, „još N", uvjeti organizatora |
| Kupnja | `POST /api/narudzba` | količina 1–10, e-mail, imena za imenske |
| Checkout | `checkout_url` u `SFSafariViewController` / Custom Tab | kartica nikad ne prolazi kroz aplikaciju |
| Narudžba | `GET /api/ulaznice/:id` | polling nakon povratka (webhook je izvor istine) |
| Prijenos QR-a | `POST /api/ulaznice/:id/preuzmi` | **novo u Workeru**, v. dolje |
| QR ekran | lokalno (CoreImage / ZXing) | payload `dgdj1:<token>`, svjetlina na max |
| Dodaj narudžbu | link iz e-maila + e-mail kupca | za kupnje obavljene na webu |

## Dizajn sustav (brend)

Nema vanjskog UI kita — nativni SwiftUI / Material 3 plus **jedan izvor tokena**
po platformi, usklađen s web SPA-om (`src/styles.css`):

| Što | iOS | Android |
| --- | --- | --- |
| Tokeni (boje, radijusi, razmaci) | `Ulaznice/UI/Theme.swift` (`Tema`) | `ui/Theme.kt` (`Brand`, `UlazniceTheme`) |
| Font | Manrope 400/500/600/700 (`Resources/Fonts`, OFL) | `res/font/manrope_*.ttf` (OFL u `app/OFL-Manrope.txt`) |
| Komponente | `UI/Komponente.swift`: `PrimarniGumb`, `SekundarniGumb`, `.kartica()`, `Oznaka`, `UlaznicaKartica` (oblik s urezima), `PraznoStanje` | `ui/Zajednicko.kt`: `Kartica`, `PrimarniGumb`, `SekundarniGumb`, `Oznaka`, `UlaznicaKartica`, `Prazno` |
| Ikona | `Assets.xcassets/AppIcon` (generirana skriptom, 1024 px) | adaptivna: vektor ulaznice + gradijent; Play Store PNG u `android/art/` |
| Splash | `UILaunchScreen` = brend zelena + bijela ulaznica | `windowSplashScreen*` u `themes.xml` |

Paleta: zelena `#2F855A`, tamna `#14331F`, pozadina `#F6F7F9`, papir `#FFF`,
rub `#E6E8EB`, tekst mutni `#6B7280`, crvena `#B91C1C`, narančasta `#C05621`;
tamna tema ima svoje vrijednosti u istim datotekama. Radijusi 12 / 14 (gumb) /
18 (kartica).

Pravilo: **brend je „Domovina ulaznice", ne organizator.** `brand.accent_color`
organizatora iz D1 koristi se samo kao boja na kartici tiera
(`Tema.boja(hex:)` / `Brand.boja(hex)`), nikad kao tema cijele aplikacije.

Mikroanimacije su nativne (spring na gumbima, `contentTransition(.numericText())`
na iznosu, `sensoryFeedback(.success)` nakon prijenosa, ulaz QR kartice) —
bez Pow-a ili druge ovisnosti.

## Sigurnosni model (pročitati prije mijenjanja)

- **Kupac nema račun.** Narudžba = `order_id` (128-bit random) + e-mail kupca;
  oboje se pamti lokalno (UserDefaults / SharedPreferences). Stanje i popis
  ulaznica su uvijek s Workera.
- **QR tokeni izlaze iz sustava samo kroz `/preuzmi`** i to uz `order_id` **i**
  e-mail kupca (sam `order_id` prolazi kroz Stripeov `success_url` i povijest
  preglednika, pa nije dovoljan). Isti mehanizam kao ponovna dostava: ako su
  tokeni iz e-maila potrošeni, jezgra ih **rotira** i QR iz e-maila prestaje
  vrijediti. Aplikacija to kupcu kaže **prije** klika.
- Tokeni se čuvaju u **Keychainu** (`WhenUnlockedThisDeviceOnly`, bez iCloud
  backupa) odnosno **Android Keystore AES-GCM** + `allowBackup=false`. Nikad u
  logu, nikad u običnim postavkama.
- `http://` je dopušten samo prema localhostu / `10.0.2.2` (lokalni razvoj).

## Pokretanje

### Mock API (bez jezgre, bez Stripea)

```bash
node mobile/mock-api.mjs        # http://localhost:8797 (Android emulator: http://10.0.2.2:8797)
```

Podaci su iz `seeds/prilika-za-susret-2026.sql`; umjesto Stripe Checkouta
servira stranicu s gumbom „Plati (lažno)". U aplikaciji: Postavke → Poslužitelj
→ **Mock API**.

### iOS

```bash
cd mobile/ios
xcodegen generate                       # .xcodeproj se ne commita
open Ulaznice.xcodeproj                 # ili:
xcodebuild -project Ulaznice.xcodeproj -scheme Ulaznice \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

Team ID u `project.yml` je ITalk (`6SCK58757K`, isti kao `domovina-browser`).
Za uređaj treba i Associated Domains capability na App ID-u (entitlement je u
`Ulaznice/Ulaznice.entitlements`).

### Android

```bash
cd mobile/android
./gradlew :app:assembleDebug            # traži JDK 17 (globalni ~/.gradle/gradle.properties ga pinuje)
adb install app/build/outputs/apk/debug/app-debug.apk
```

Emulator na ovom stroju: slike sustava su na vanjskom disku
(`~/Library/Android/sdk/system-images → /Volumes/DOMOVINA_ANDROID`); bez njega
`emulator` javlja „Cannot find AVD system path".

## Povratak iz Checkouta u aplikaciju

Stripe vraća na `https://<host>/ulaznice/<id>?placeno=1`. Da to otvori
aplikaciju, a ne preglednik:

| Platforma | Što treba | Stanje |
| --- | --- | --- |
| iOS Universal Links | Worker servira `/.well-known/apple-app-site-association` iz `APPLE_APP_IDS` | ✅ kod + staging var; treba **App ID s Associated Domains** u Apple Developeru |
| Android App Links | Worker servira `/.well-known/assetlinks.json` iz `ANDROID_CERT_SHA256` | 🟡 kod da; **otisak potpisa prazan** dok ne postoji release keystore |

Dok toga nema, aplikacija i dalje radi: narudžbu pamti **prije** otvaranja
Checkouta i nakon zatvaranja preglednika sama poll-a stanje. Link
`domovina-ulaznice://narudzba/<id>` (vlastita shema) radi odmah i stoji na
web stranici narudžbe.

Otisak debug potpisa (za lokalno testiranje App Linksa):

```bash
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android | grep SHA256
```

## Što nije napravljeno

- Android nije pokrenut na uređaju/emulatoru (nema slika sustava bez vanjskog
  diska); build prolazi, tok je provjeren samo na iOS simulatoru s mock API-jem.
- Ikona je generirana skriptom (Pillow) — dovoljna za razvoj i TestFlight,
  za App Store bi je dizajner trebao doraditi.
- Nema Apple Wallet / Google Wallet propusnica — `docs/09` ih vodi kao TT razliku.
- Nema push obavijesti ni podsjetnika prije događaja.
- Skener za osoblje ostaje web PWA (`src/pages/Skener.tsx`); ova aplikacija je
  samo za kupce.
