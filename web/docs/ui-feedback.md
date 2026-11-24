# UI feedback — sabirnik

Ivanov feedback na UI, skupljen u sesiji „feedback” (od 2026-11-23). Ovdje se
**samo bilježi i planira**, ništa se ne implementira. Kad se nakupi dovoljno, stavke
se grupiraju u pakete i ulaze u lanac kao nova sesija (v. „Plan razvoja” na dnu).

Legenda stanja: `novo` · `planirano → Sn` · `gotovo (commit)` · `odbačeno (razlog)`
Prioritet: **P0** smeta kupnji/razumijevanju · **P1** jasno ružno/zbunjujuće · **P2** dotjerivanje

Gdje: `web` = Astro za kupce (`web/src/`) · `spa` = organizator/skener/prijava (`src/pages/`)
· `mob` = mobilne aplikacije (`mobile/`)

## Stavke

| # | Datum | Gdje | Ekran / komponenta | Feedback (Ivanovim riječima) | Prijedlog rješenja | Prio | Stanje |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-11-23 | web | `/dogadjaj/[slug]`, odjeljak „Dodaj u kalendar” (`[slug].astro:177–181`) | Google Kalendar shortcut je super i neka bude **primarni**. ICS (Apple, Outlook) neka ostane kao **sekundarni** gumb, da uvijek postoji fallback za druge kalendare. | Sad su oba `sekundarni` i jednake širine (`flex: 1`). Google → `varijanta="primarni"` (ne `naglasni`, taj je rezerviran za „Kupi”); ICS ostaje `sekundarni`, kraći tekst npr. „Drugi kalendar (.ics)”. Raspored: Google šire, ICS uže (ili ispod, puna širina na mobitelu). Provjeriti na snimci da tamni gumb ne konkurira CTA-u „Kupi”. | P2 | gotovo, izmijenjeno (Ivan 24. 11.: jedan gumb „Dodaj u kalendar”, Google pa .ics; odluka 825) |
| 2 | 2026-11-23 | web + worker | `/ulaznice/[orderId]` (narudžba nakon kupnje) | Ulaznica se šalje na mail, ali neka korisnik **odmah iz browsera može preuzeti PDF s ulaznicom**. | **Sudara se s odlukom 501 i modelom tokena.** QR token je jednokratan i plaintext postoji samo u trenutku webhooka (`worker/mail.ts:8`), ne sprema se. Browser ga može dobiti samo **rotacijom** (`POST /api/ulaznice/:id/preuzmi`, `worker/index.ts:478`), a ona poništava QR iz e-maila. Prijedlog u dva koraka: **(a)** PDF kao privitak u e-mailu (`ticketAttachments`), bez promjene sigurnosti; **(b)** gumb „Preuzmi PDF” na stranici narudžbe: traži e-mail kupca (isto kao `/preuzmi`), upozori da QR iz maila prestaje vrijediti, Worker vrati PDF. Za (b) treba nova odluka (revizija 501), PDF generator na Workeru (npr. `pdf-lib`, provjeriti veličinu bundlea) i dira `worker/` (izvan opsega `web/`, odluka 6). | P1 | novo, čeka primjere i implementaciju |
| 3 | 2026-11-23 | worker + organizator + domovina-fiskal | arhitektura: račun i dostava e-maila | Račune izdaje **domovina Fiskal** (automatski, nakon uspješne naplate) i šalje ih mailom. Organizacija u domovina ulaznicama dodaje svoj **domovina Fiskal API ključ**. Slanje maila (Resend/SMTP) živi **u domovina Fiskalu**, ne ovdje. Ulaznica se generira ovdje (PDF u browseru), a mail može ići kroz domovina Fiskal kao privitak. | v. odjeljak „Arhitektura: račun i dostava kroz domovina Fiskal” ispod | P1 | novo, plan |
| 4 | 2026-11-23 | spa | `/organizator/novi` (`src/pages/NoviDogadjaj.tsx`, `src/lib/editor.ts`) | Organizatori u 99,9 % slučajeva dodaju događaj **na desktopu**. Jedan stupac je super na mobitelu i neka tako ostane (mobile first). Na desktopu iskoristiti prostor lijevo i desno, idealno **bez vertikalnog scrolla**, kao **wizard od 1 do n koraka**: korisnik zna što ga čeka i vodi ga se korak po korak, da kreiranje bude što bezbolnije. | v. odjeljak „Wizard za novi događaj” ispod | P1 | novo, plan |
| 5 | 2026-11-23 | web + spa + jezgra | kupnja `/dogadjaj/[slug]/kupnja` + editor događaja | Kupac pri kupnji popunjava **prilagodljivu formu** s podacima koje organizator treba (i za račun). Zajednička polja (ime, prezime, e-mail, telefon) **iz profila prijavljenog korisnika**, kao na Lumi. Organizator po događaju dodaje **vlastita polja** (npr. alergeni za catering). Treba **form builder ili barem predlošci**. Lista prijavljenih je organizatoru **mini CRM** — veoma važno. Pilot: međunarodni susret osoba otvorenih za katolički brak, Katolička udruga Prilika za susret; Ivan predaje postojeću Google formu. | v. odjeljak „Prilagodljiva forma prijave” ispod | P0 | novo, Google forma mapirana (ispod) |
| 6 | 2026-11-23 | web + worker | staging `ulaznice-staging.domovina.ai/` | (nađeno pri deployu) Početna kroz glavni Worker → **503 „Pokušaj ponovno”**; `ulaznice-web-staging.domovina.ai/` radi. Log Astra: `dohvatiDogadjaje ApiError: neispravan_odgovor`. | Lanac glavni Worker → `WEB` → `fetch(API_BASE_URL)` = javni URL **istog** Workera; Cloudflare taj podzahtjev ne pušta do Workera (zaštita od petlje / isti zone), pa SSR dobije ne-JSON. Popravak: u `web/wrangler.jsonc` `env.staging` service binding `API` → `domovina-ulaznice-staging`, a `api-ssr.ts` zove `env.API.fetch()` kad binding postoji (javni URL ostaje za `ulaznice-web-staging` i dev). Uz test i zapis u `deploy-dug` #6. | P0 (staging) | gotovo (`bb9294a`) |
| 7 | 2026-11-24 | web + worker + spa | sve rute; domene | **Sve na Astro**, i `/organizator` i ostale rute koje danas nisu. Aktivne samo domene `ulaznice-staging.domovina.ai` i `ulaznice.domovina.ai`. | v. odjeljak „Sve na Astro, dvije domene” ispod | P1 | novo, plan |
| 8 | 2026-11-24 | web + worker + jezgra | `/organizator/novi`, korak 3 | Naslovna slika **upload ili URL**, i **galerija** (upload ili URL). | Plan A (upload kroz Worker u Storage `pinka-covers`) i B (galerija i alt kroz `events-organizer`, grana `domovina-api` `events-media`); odluke 819–822, `docs/2026-11-24-upload-slika-i-galerija.md` | P1 | gotovo (ovaj commit; jezgra čeka Matiju, `deploy-dug` #15) |
| 9 | 2026-11-24 | web | `/organizator/novi`, korak 1, izbor organizatora | (agent, uz stavku 8) Osobni računi (`is_personal`) se nude kao organizator. | Filtrirati `is_personal` iz popisa; `organizer_overview` ga već vraća. | P2 | novo, čeka Ivana |
| 10 | 2026-11-24 | web + worker + jezgra | `/organizator` (pregled prodaje), `/organizator/novi` | Dodaj opciju **obriši skicu** i **uredi skicu**. | Odluke 823–824: wizard `?uredi=<id>`, `delete_event_draft` u jezgri (grana `events-media`) | P1 | gotovo (ovaj commit; jezgra čeka Matiju, `deploy-dug` #16) |

### Stavka 2 — dorada (Ivan, 2026-11-23)

- **Generiranje PDF-a: isključivo u browseru, 100 % offline.** Server ne generira PDF,
  nema `pdf-lib` na Workeru. Opcija (a) „PDF kao privitak u mailu” otpada.
- **Template:** Ivan predaje nekoliko primjera ulaznica (vjerojatno Entrio); radi se
  vjerna kopija rasporeda, popunjena našim podacima (događaj, tier, ime za `imenska`,
  serijski broj, QR). Bez tuđeg loga i branda — naš `brand` iz feeda.
- **Implementaciju generatora Ivan predaje gotovu**; naš posao je spojiti je s podacima
  i ekranom, ne pisati generator.
- **Otvoreno — odakle browser dobiva QR token** (plaintext postoji samo pri webhooku):
  1. *link u mailu s tokenima u fragmentu* (`/ulaznice/<id>/pdf#t=…`): fragment ne ide
     na server, PDF se radi offline, QR iz maila i PDF su isti token — nema rotacije.
     Mail ionako već nosi plaintext QR, pa sigurnost ostaje ista. **Preporuka.**
  2. *rotacija kroz `/preuzmi`* sa stranice narudžbe: radi odmah nakon kupnje bez maila,
     ali poništava QR iz maila (revizija odluke 501).
  Moguće oboje: (1) kao zadano, (2) kao „nemam mail” fallback.
- Dira `worker/mail.ts` (link u mailu) → izvan opsega `web/`, treba Matijino odobrenje
  i zapis u `docs/deploy-dug.md`.

### Sve na Astro, dvije domene (stavka 7, Ivan, 2026-11-24)

**Danas:** glavni Worker servira `/api/*`, `/webhook/*`, `/.well-known/*` i SPA (React +
react-router, `src/`) za `/organizator`, `/organizator/novi`, `/skener` i `/assets/*`
(`worker/index.ts:751` `SPA_STRANICE`, `SPA_PREFIKSI`); sve ostalo ide na Astro kroz `WEB`.
Astro Workeri imaju i vlastite domene `ulaznice-web(-staging).domovina.ai`.

**Cilj:** glavni Worker = samo API (`/api/*`, `/webhook/*`, `/.well-known/*`) + prosljeđivanje
svega ostalog na `WEB`. Nema SPA-e, nema `ASSETS` u glavnom Workeru, nema `vite build`.
Javne su samo `ulaznice-staging.domovina.ai` i `ulaznice.domovina.ai`.

**Što se seli (SPA → Astro), ~1050 redaka React-a:**

| SPA | Astro | Kako |
| --- | --- | --- |
| `Prijava.tsx` (205) | komponenta prijave (kod na e-mail, Google, lozinka) | React otok `client:only`; token ostaje u `sessionStorage` (`src/lib/auth.ts`), SSR ne zna za sesiju |
| `Organizator.tsx` (168) | `/organizator` | Astro ljuska (layout, zaglavlje iz dizajnerskog sustava) + React otok za pregled prodaje i CSV |
| `NoviDogadjaj.tsx` (332) + `src/lib/editor.ts` | `/organizator/novi` | React otok; **ovdje odmah wizard iz stavke 4** — ne seliti staru formu pa je prepisivati |
| `Skener.tsx` (334) | `/skener` | React otok `client:only` (kamera, `BarcodeDetector`, ručni unos); `noindex` |
| Popis, Dogadjaj, Kupnja, Narudzba, Pravno | — | već postoje u Astru → brišu se (to je S7) |

Pravila: stranice organizatora/skenera `noindex`, `no-store`, bez SSR poziva s tokenom
(web nema tajni ni sesije, odluka 4 ostaje). React otoci zovu `/api/organizator/*` istog
origina kao danas — ugovor se ne mijenja. Google prijava: povratni URL (`/api/organizator/google`)
mora sletjeti na Astro `/organizator` — provjeriti s PR #9.

**Glavni Worker nakon seobe:**

- `SPA_STRANICE`, `SPA_PREFIKSI`, `ASSETS` i grana `env.ASSETS.fetch` u `app.all("*")` se brišu;
  bez `WEB` bindinga fallback vraća 404 (ili najavu kad je `NAJAVA=1`).
- `wrangler.jsonc`: bez `assets` u oba okruženja; `npm run build` u korijenu više ne gradi SPA.
- `src/`, `vite.config`, `index.html` i React ovisnosti u korijenu se brišu; `shared/` ostaje.
- testovi: `worker-tests/web-binding.test.ts` — sve osim API putanja ide na WEB.

**Domene:**

- `web/wrangler.jsonc`: maknuti `routes` (custom domain) iz oba okruženja, `workers_dev: false`.
  Astro je dostupan **samo kroz binding**. Provjeriti uklanja li `wrangler deploy` custom
  domenu sama; ako ne, ručno u Cloudflareu (Workers → domovina-ulaznice-web(-staging) →
  Domains). Redoslijed: prvo glavni Worker sve prosljeđuje, tek onda gašenje domena.
- `API_BASE_URL` ostaje (host za URL kroz binding API, stavka 6).
- Ažurirati sve što spominje `ulaznice-web(-staging)`: `docs/deploy-dug.md` (provjere #6),
  `web/docs/plan.md`, `decisions.md` (odluke 22–24 → revizija), `CLAUDE.md`, `web/README`.
- Lokalni dev: `:8788` (glavni Worker) + `:8792` (Astro kroz binding) ostaje; `:4321` za
  brzo iteriranje Astra.

**Paketi (prijedlog):**

1. **S7** (već otvoren) proširen: brisanje kupačkih stranica iz SPA-e + mjerenje.
2. **S8 — organizator i skener u Astru:** prijava, `/organizator`, `/skener` kao React otoci;
   `/organizator/novi` odmah kao wizard (stavka 4). Worker i dalje ima SPA kao rezervu.
3. **S9 — gašenje SPA-e i domena:** Worker bez `ASSETS`, brisanje `src/`, domene web Workera
   ugašene, dokumentacija. Deploy: web → glavni Worker → provjere → gašenje domena.

Rizik: mobilne aplikacije i Universal Links (`/.well-known/*`, `/ulaznice/<id>`) ostaju na
glavnom Workeru/Astru na istim domenama — ne diraju se.

### Arhitektura: račun i dostava kroz domovina Fiskal (stavka 3, Ivan, 2026-11-23)

**Namjera:**

- `InvoiceProvider = domovina_fiskal` postaje glavni put (danas pada na `organizator`,
  `worker/racun.ts:63`). Nakon webhooka `checkout.session.completed` Worker zove
  domovina Fiskal, a on izdaje fiskalizirani račun (ZKI + JIR) i **sam ga šalje mailom**.
- **Ključ po organizaciji:** u postavkama organizatora polje „domovina Fiskal API ključ”.
  Danas je FIRA ključ jedan globalni secret (`FIRA_API_KEY`, `worker/env.ts:77`) — novi
  model je po organizaciji (multi-tenant).
- **Mail kredencijali (Resend/SMTP) samo u domovina Fiskalu.** domovina ulaznice ih više
  nemaju; `RESEND_API_KEY` i `worker/mail.ts` za dostavu ulaznica se gase ili postaju
  klijent domovina Fiskal API-ja.
- **Ulaznica:** PDF se generira u browseru (stavka 2). Za dostavu mailom dvije varijante
  u domovina Fiskalu:
  1. API prima **privitak** (ulaznica) i šalje ga u istom mailu kao račun, ili
  2. API endpoint „pošalji mail” koji domovina ulaznice pozovu s istim sadržajem.

**Otvorena pitanja (prije implementacije, odluke u `decisions.md`):**

1. **Gdje se sprema ključ organizacije.** Pravilo 1 kaže: organizatorski podaci jezgre
   su u `domovina-api` (`pinka_finance`, tablica s `invoice_provider`, `docs/05` §112).
   Ključ mora biti šifriran (ne plaintext u Postgresu ni u D1); tko ga dešifrira — Worker?
2. **PDF ulaznice se radi u browseru, a mail šalje server** — tko onda generira PDF za
   privitak? Ako kupac ne otvori stranicu, nema PDF-a. Moguće: mail nosi QR kao danas
   + link na offline PDF (stavka 2, varijanta s `#t=…` fragmentom), a privitak je opcija
   tek kad postoji serverski generator. **Ovo je glavna napetost između stavke 2 i 3.**
3. **QR token i domovina Fiskal:** plaintext tokeni bi prolazili kroz domovina Fiskal
   (mail). Treba li to? Prihvatljivo je ako je isti operater, ali proširuje krug povjerenja.
4. **Bez ključa:** organizacija koja nema domovina Fiskal ključ — tko šalje ulaznice?
   (Pretpostavka: platformski račun domovina Fiskala šalje samo ulaznicu, bez računa.)
5. **Brava iz U5** (`provjeriOkolinu()`, `docs/07`) i porezna provjera (`docs/04` §6)
   vrijede i dalje — sandbox fiskalizacije na stagingu, produkcija tek uz potvrdu.
6. **Ugovor API-ja domovina Fiskala** (izdaj račun, privitak, pošalji mail, idempotencija
   na `order_id`) — repo `../domovina-fiskal` nije lokalno kloniran; ugovor treba dogovoriti
   s Matijom.

**Opseg:** `worker/` (racun, mail, webhook), postavke organizatora u SPA-u, migracija u
`domovina-api`, `domovina-fiskal` (novi endpointi). Sve izvan lanca `web/` → vlastita faza
(U5) uz Matiju; zapis u `docs/deploy-dug.md`.

### Wizard za novi događaj (stavka 4, Ivan, 2026-11-23)

Današnja forma: jedan stupac, šest odjeljaka (Osnovno, Termin, Mjesto, Opis i slika,
Kontakt organizatora, Ulaznice) i „Spremi kao skicu” na dnu. Logika i validacija su u
`src/lib/editor.ts`, ekran u `src/pages/NoviDogadjaj.tsx` (332 retka).

**Koraci (prijedlog, 5):**

| Korak | Sadržaj | Gotov kad |
| --- | --- | --- |
| 1. Osnovno | organizator (ako ih ima više), naziv, vrsta | naziv nije prazan |
| 2. Kada i gdje | termin (početak/kraj) + mjesto, adresa, grad | početak < kraj, mjesto i grad |
| 3. Opis i slika | opis, naslovna slika | neobavezno — „Preskoči” |
| 4. Ulaznice | tierovi: naziv, cijena, količina, imenska | barem jedan valjan tier |
| 5. Pregled | sažetak svih koraka + kontakt (e-mail, web) + „Spremi kao skicu” | — |

Termin i mjesto spojeni jer su kratki; kontakt ide u pregled jer je neobavezan.

**Desktop (≥ 1024 px), bez vertikalnog scrolla:**

- **lijevo** — okomiti stepper s brojevima, nazivima koraka i kvačicom za gotove; klik
  vodi na već posjećeni korak;
- **sredina** — polja trenutnog koraka (max ~560 px);
- **desno** — **živi pregled** kartice događaja kako će je vidjeti kupac (naslov, datum,
  mjesto, slika, cijene „od …”), puni se kako organizator tipka. To motivira i koristi
  prazan prostor;
- dolje fiksna traka: „Natrag” · „Korak 2 od 5” · „Dalje” (zadnji: „Spremi kao skicu”).
- Korak 4 s mnogo tierova: tablični prikaz (jedan red = jedan tier) da stane bez scrolla;
  ako ih je više od ~6, scrolla se samo tablica, ne stranica.

**Mobitel:** ostaje jedan stupac. Iznad forme traka napretka („2/5 · Kada i gdje”),
„Natrag/Dalje” prilijepljeni na dno ekrana, bez živog pregleda (on je korak 5).

**Ponašanje:**

- validacija po koraku (`editor.ts` se razbija na `validirajKorak(n)`), greške na hrvatskom
  uz polje, „Dalje” ne prolazi dok korak nije valjan;
- stanje forme se čuva pri prelasku između koraka; nacrt u `localStorage` (try/catch)
  da refresh ne izgubi unos;
- korak u URL-u (`?korak=2`) da „natrag” u pregledniku radi očekivano;
- ugovor s `events-organizer` se ne mijenja — šalje se isti payload kao danas.

**Opseg:** samo SPA (`src/pages/NoviDogadjaj.tsx`, `src/lib/editor.ts`, `src/styles.css`),
bez promjene API-ja. Organizatorski SPA ostaje i nakon S7, pa vrijedi raditi. Snimke
prije/poslije na 1440×900 (bez scrolla) i 390×844.

### Prilagodljiva forma prijave (stavka 5, Ivan, 2026-11-23)

Odgovara rupi **B5** iz `docs/09-usporedba-ticket-tailor.md` („prilagodljiva checkout
forma + potvrda uvjeta + marketing opt-in”). PzS je već prvi tenant (danas Google Forms →
FIRA, `fira-forms-connector`), pa je ovo **preduvjet da PzS prijeđe na nas** — zato P0.
Ulaz: Ivanova Google forma za susret; polja se prepisuju 1:1 kao prvi predložak.

**Model (prijedlog):**

- **Tri razine polja:**
  1. *profil kupca* — ime, prezime, e-mail, telefon; jednom uneseno, predpopunjeno na
     svakom sljedećem događaju (Luma);
  2. *za račun* — npr. OIB/tvrtka ako traži R1; ovisi o `invoice_provider` (stavka 3);
  3. *po događaju* — organizatorova pitanja (alergeni, dolazak, majica, …).
- **Vrste polja:** kratki tekst, dugi tekst, jedan izbor, više izbora, padajući izbornik,
  datum, broj, da/ne, privola (obavezna kvačica s tekstom). Svako: oznaka, pomoć,
  obavezno, redoslijed. To pokriva tipičnu Google formu.
- **Po kupcu ili po posjetitelju:** svako pitanje ima opseg — `narudzba` (pita se jednom)
  ili `posjetitelj` (ponavlja se za svaku ulaznicu, kao `holders` kod `imenska`).
  Alergeni su po posjetitelju.
- **Predlošci:** organizator bira predložak („Susret / seminar”, „Koncert”, „Radionica s
  cateringom”) i dorađuje; **kopija s prošlog događaja** (veže se uz B12 — PzS ima 5
  istih događaja godišnje).
- **Form builder u editoru događaja** — novi korak u wizardu (stavka 4) između
  „Ulaznice” i „Pregled”: „Pitanja za posjetitelje”, s pregledom kako forma izgleda kupcu.
- **Mini CRM:** lista posjetitelja po događaju s odgovorima, filtriranje, izvoz CSV
  (već postoji CSV — proširiti stupcima odgovora), kasnije pogled po osobi kroz
  događaje (isti e-mail = ista osoba).

**Kritično prije implementacije:**

1. **GDPR — posebne kategorije (čl. 9).** Za ovaj pilot su odgovori sami po sebi
   osjetljivi: sudjelovanje na susretu za katolički brak otkriva **vjersko uvjerenje**,
   alergeni su **zdravstveni podatak**. Treba: izričita privola po svrsi, tko je voditelj
   obrade (organizator) a tko izvršitelj (mi) — ugovor o obradi, rok čuvanja i brisanje
   nakon događaja, minimalan pristup (samo organizator), bez tih podataka u mailovima i
   logovima. Pravni pregled uz `docs/04`.
2. **Pravilo 1:** odgovori pripadaju narudžbi/posjetitelju → **jezgra `domovina-api`**
   (`pinka_finance`), ne lokalni D1. Definicija forme po događaju također u jezgri
   (uz `campaigns`). Migracija idempotentna.
3. **Ugovor API-ja se mijenja:** `CreateOrderRequest` (`shared/api-tipovi.ts:86`) dobiva
   `answers` (i po holderu); `EventView` dobiva definiciju forme. To je promjena ugovora
   `/api/*` → izvan lanca `web/`, treba odluku s Matijom; mobilne aplikacije i
   `mobile/mock-api.mjs` također.
4. **Profil kupca ne postoji.** Danas kupac daje samo e-mail, bez računa. Luma-model traži
   prijavu kupca — može se reusati prijava kodom na e-mail (`0515e85`, organizator/skener).
   Kupnja **mora ostati moguća bez prijave** (gost); prijava samo predpopunjava.
5. **Validacija na serveru** po definiciji forme (Worker), ne samo u browseru; limit
   duljine odgovora, broj polja po formi.
6. **Stripe Checkout** ne nosi ta polja — forma je na našoj stranici prije preusmjerenja,
   odgovori se spremaju uz `pending` narudžbu, a vrijede tek nakon webhooka (pravilo 3).

**Redoslijed (prijedlog):** (a) Ivan preda Google formu → mapiranje polja u predložak;
(b) odluka o modelu i GDPR s Matijom; (c) jezgra: tablice + `events-*`; (d) kupnja u
`web/` renderira formu iz definicije; (e) mini CRM pogled + CSV; (f) form builder u wizardu.
Prvi prolaz za pilot može preskočiti (f): forma PzS-a se unese kao seed (kao događaji
danas, `docs/2026-09-28-unos-dogadjaja-kroz-chat.md`).

#### Pilot: ICSS Zagreb 2027 — mapiranje Google forme (2026-11-23)

Izvor: [Google forma](https://docs.google.com/forms/d/e/1FAIpQLSdEJCr_ep9YTd7HwvTWkfYdyhfZ4X-YmW1xewmuDn-qSnUxlg/viewform)
„International Catholic Singles Summit Zagreb 12-14 February 2027”, organizatori
kathTreff.org, katSus.org i Katolička udruga Prilika za susret; HKS Zagreb, 12.–14. 2. 2027.
Jedna stranica, 15 pitanja + 2 kvačice. Tipovi su izvedeni iz prikaza (nije parsiran
`FB_PUBLIC_LOAD_DATA_`) — prije seeda provjeriti u uređivaču forme.

| # | Pitanje (EN / HR) | Tip | Obavezno | Razina | Napomena |
| --- | --- | --- | --- | --- | --- |
| 1 | E-pošta | e-mail | da | profil | `buyer_email` |
| 2 | Name and surname / Ime i prezime | kratki tekst | da | profil | kod nas ime + prezime odvojeno; `holders.full_name` |
| 3 | Gender / Spol | jedan izbor: Female (ženski), Male (muški) | da | događaj, po posjetitelju | v. kvota ispod |
| 4 | City and Country / Mjesto i država | kratki tekst | da | profil (kandidat) | bolje dva polja: grad + država (izbornik) |
| 5 | Year of birth / Godina rođenja | broj (4 znamenke) | da | događaj | uvjet 27–55 god. → validacija raspona |
| 6 | Phone number / Kontakt broj | telefon | da | profil | međunarodni format |
| 7 | Marital status / Bračni status | jedan izbor (5 opcija: slobodan/a; slobodan/a – u vezi; udovac/ica; rastavljen/a; crkveno ništava ženidba nakon civilnog razvoda) | da | događaj | **osjetljivo** (vjerski kontekst) |
| 8 | Why am I registering / Zašto se prijavljujem | dugi tekst | da | događaj | |
| 9 | Occupation / Zanimanje | kratki tekst | da | događaj (kandidat za profil) | |
| 10 | Specific diet / Posebna prehrana (alergije, vegetarijanska…) | dugi tekst | da | događaj, po posjetitelju | **zdravstveni podatak** |
| 11 | How did I find out / Kako ste saznali | padajući: katsus.org, kathtreff.org, prijatelji, Facebook, Instagram, Other | da | događaj | „Other” → slobodan tekst; u izvoru tipfeler „kathteff” |
| 12 | Experience of similar encounters / Iskustvo sa sličnim susretima | dugi tekst | ne | događaj | |
| 13 | Questions for organizers / Pitanja za organizatore | dugi tekst | ne | događaj | |
| 14 | What do you expect / Što očekujete | dugi tekst | ne | događaj | |
| 15 | Upoznat/a sam s obavijesti o obradi osobnih podataka… | privola | **ne u izvoru → kod nas da** | događaj | tekst obavijesti (GDPR + foto/video) prikazati iznad kvačice |
| 16 | Želim primati Newsletter | privola (opt-in) | ne | događaj/organizator | marketing opt-in, B5 |

**Što forma otkriva, a nemamo (ulaz u plan):**

1. **Dvojezičnost (EN + HR) u svakom polju i opisu.** Međunarodni događaj, službeni jezik
   engleski. Mi smo HR-only, a „više jezika checkouta” je u razredu C (`docs/09`). Za pilot
   minimum: oznake polja kao slobodan tekst (organizator sam piše „Gender / Spol”), UI
   kupnje i dalje HR — ili prioritizirati EN sučelje. **Treba odluka.**
2. **Cijena po razdoblju** (rana do 1. 12. 2026. 100 €, redovna do 15. 1. 2027. 130 €,
   kasna do 12. 2. 2027. 150 €) — tri tiera s prozorima prodaje; stanja „nije počelo /
   završilo” već postoje (S3), provjeriti da jezgra ima `sale_starts/ends` po tieru.
3. **Plaćanje je danas uplatnicom na IBAN** (SUSRET CONSULTING, poziv na broj, barkod).
   Prelaskom na Stripe gube taj kanal → rupa **A4 (offline plaćanja)** postaje relevantna.
4. **Kvota po spolu** („očekuje se podjednak broj muškaraca i žena”, max 450). Ili samo
   prati u CRM-u, ili inventar po spolu (dva tiera „muški/ženski” s po 225). **Pitati PzS.**
5. **Uvjet sudjelovanja** (27–55, slobodni, otvoreni za sakrament ženidbe) — tekst + validacija
   godine rođenja; organizator možda želi **ručno odobrenje prijave** prije plaćanja
   (prijava → odobri → link za plaćanje). Pitati PzS.
6. **Rok prijave** 30. 1. 2027. = kraj prodaje zadnjeg tiera.
7. **Pravila povrata** (puni povrat do 20. 1., 50 % do 30. 1.) — tekst po događaju u
   uvjetima kupnje; refund danas ide kroz Stripe dashboard (A5).
8. **Dugi opis** (program, raspored, prijevoz, vize) — stane u Markdown opis događaja;
   „Odricanje za vize” kao poseban odjeljak.
9. **Foto/video privola** je ugrađena u GDPR obavijest — bolje kao zasebna kvačica.
10. Dijeljeni prijevoz (link na Google Sheets) — samo link u opisu.

**GDPR za ovaj pilot (dopuna točke 1 gore):** bračni status (uklj. crkveno ništavu ženidbu),
spol, godina rođenja, prehrana i sam pristanak na susret za katolički brak — posebne
kategorije. Postojeća obavijest je dobra osnova, ali kvačica u izvoru **nije obavezna**;
kod nas mora biti obavezna i bez nje nema predaje.

## Plan razvoja

Popunjava se kako stavke stižu. Pravila grupiranja:

1. Stavke se grupiraju po ekranu, ne po redoslijedu dolaska — jedan paket dira jedan
   do dva ekrana da snimke prije/poslije budu usporedive.
2. P0 ide u prvi idući paket bez obzira na ekran.
3. Paket = jedna sesija lanca (`web/docs/handoffs/SN.md`), s popisom brojeva stavki
   iz ove tablice; sesija na kraju upiše commit u stupac „Stanje”.
4. Stavke koje traže promjenu ugovora `/api/*`, jezgre ili dizajnerskog sustava
   (`tokens.css`) izdvajaju se kao zasebna odluka u `decisions.md` prije implementacije.
5. `spa` stavke za ekrane koji se u S7 brišu (Popis, Dogadjaj, Kupnja, Narudzba, Pravno)
   se odbacuju — vrijede samo za Astro.

Paketi:

_(još nema)_
