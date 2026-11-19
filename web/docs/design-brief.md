# Design brief — stranice za kupce ulaznica

Za Claude Design. Napisano u S1 (2026-11-19) iz koda: tipovi `shared/api-tipovi.ts`,
poruke `PORUKE` (danas u `src/lib/api.ts`), greške iz `worker/index.ts`, primjeri iz
`mobile/mock-api.mjs`. Odluke na koje se poziva: `web/docs/decisions.md`.

## 1. Kontekst

Prodaja ulaznica **bez posrednika i bez naknade posrednika**: organizator prodaje sa
svoje stranice, a kupac plaća karticom izravno na organizatorov Stripe račun (Stripe
Checkout, na Stripeovoj domeni). Ulaznica je QR kod koji stiže e-mailom i skenira se na
ulazu. Dizajniramo **samo stranice za kupca**: popis događaja, događaj, kupnja,
narudžba, pravne stranice i 404. Ton: miran, povjerljiv, bez marketinške buke; svaki
događaj nosi boju svog organizatora.

## 2. Što se isporučuje

| Što | Detalj |
| --- | --- |
| Dizajnerski sustav | tokeni: boje (uključujući stanja ok / čekanje / greška / neutralno), tipografija (skala, težine, line-height), razmaci (skala), radijusi, sjene, fokus prsten |
| Komponente | gumb (primarni, sekundarni, tanki, disabled, loading), kartica događaja, red tiera (sva stanja iz §5), oznaka (badge), banner (info / ok / greška), polje forme (normalno, fokus, greška, disabled), select/stepper količine, sažetak cijene, red ulaznice, zaglavlje, podnožje |
| Ekrani | svi iz §4, svaki na **390 px** (mobitel) i **1280 px** (desktop), sa stanjima koja su navedena |
| Export | u `web/design/` (commita se u repo) |

**Tokeni moraju biti prevodivi u CSS varijable** (odluka 9): kod ih drži u
`web/src/styles/tokens.css`, npr. `--color-accent`, `--color-on-accent`,
`--color-bg`, `--color-text`, `--space-4`, `--radius-md`, `--font-size-lg`. Imenuj
tokene semantički (uloga), ne po vrijednosti. Naglasna boja je **jedan token**
(`--color-accent` + izvedeni `--color-on-accent`, `--color-accent-hover`) jer je
događaj nadjačava (§6).

## 3. Opća pravila

| Tema | Pravilo |
| --- | --- |
| Jezik | Sve na hrvatskom. Dijakritici (č ć đ š ž) moraju biti u fontu. |
| Novac | `60,00 €`, `1.234,56 €` (format `hr-HR`, znak iza iznosa). U API-ju su cijeli centi (`price_cents: 6000`). Nikad „60€” ni „€60”. |
| Datum i vrijeme | Uvijek u `Europe/Zagreb` (ili `event.timezone`). Primjeri stvarnog formatiranja niže. |
| Pristupačnost | WCAG 2.1 AA: kontrast teksta ≥ 4.5:1 (velikog ≥ 3:1), komponente i fokus prsten ≥ 3:1, ciljevi dodira ≥ 44 px, stanje nikad samo bojom (uvijek i tekst/ikona), vidljiv fokus. |
| Mobitel prvo | Većina dolazi iz linka na WhatsAppu/Facebooku. Primarna akcija na mobitelu dostupna bez traženja. |
| Bez posrednika | Poruka „Kupujete izravno od organizatora — bez naknade posrednika” je dio identiteta; u sažetku kupnje stoji red „Naknada platforme 0,00 €”. |
| Tamni način | Poželjan (tokeni za oba), nije obavezan za prvu verziju. |

Stvarni izlaz formatera (`terminHr`, `datumHr`, `eur`):

| Ulaz | Prikaz |
| --- | --- |
| višednevni s vremenom (`2027-04-16T07:00Z` – `2027-04-18T16:00Z`) | `petak, 16. 04. 2027. 09:00 – 18. 04. 2027.` |
| isti dan (`19:00`–`22:00`) | `petak, 12. 02. 2027. 19:00 – 22:00` |
| početak točno 00:00 = „satnica nije objavljena” | `21. studenoga 2026.` |
| višednevni bez satnice | `12. – 14. veljače 2027.` |
| `starts_at: null` | `termin još nije objavljen` |
| rok rezervacije (`datumHr`) | `četvrtak, 19. 11. 2026. 15:10` |

Dizajn smije predložiti čitljiviji oblik (npr. „pet, 16. 4. 2027. u 9:00”), ali mora
pokriti svih pet slučajeva.

## 4. Ekrani

### 4.1 Popis događaja — `/`

Prima `GET /api/dogadjaji` → `{ events: EventView[] }`. Po kartici:
`title`, `slug`, `event.starts_at` / `ends_at` / `timezone`, `event.venue_name`,
`event.venue_city`, `event.cover_image_url` (+ `cover_image_alt`, §7), najniža
`tiers[].price_cents` („od 35,00 €”), `kupovno`, `event.event_type` kao oznaka
(`konferencija` → „Konferencija”, odluka 17), `brand.accent_color` ako je u odgovoru.

| Mora se vidjeti | Primarna akcija |
| --- | --- |
| naslov, termin, mjesto + grad, „od X €”, oznaka „prodaja nije otvorena” kad `kupovno: false` | klik na karticu → `/dogadjaj/:slug` |

Stanja: učitano (1, 2, 6+ kartica), prazno („Trenutačno nema objavljenih događaja.”),
greška (banner), kartica bez slike (danas su sve bez slike: `cover_image_url: null`),
dugi naslov (2–3 retka). Uvod iznad popisa: „Ulaznice kupujete izravno od organizatora.
Bez naknade posrednika.”

### 4.2 Događaj — `/dogadjaj/:slug`

Prima `GET /api/dogadjaj/:slug` → `EventView`:

```json
{
  "campaign_id": "00000000-0000-4000-8000-000000000d01",
  "slug": "prilika-za-susret-2027",
  "title": "Prilika za Susret 2027",
  "event": {
    "event_type": "konferencija", "venue_name": "Dom sportova",
    "venue_address": "Trg Krešimira Ćosića 11", "venue_city": "Zagreb",
    "starts_at": "2027-04-16T07:00:00+00:00", "ends_at": "2027-04-18T16:00:00+00:00",
    "timezone": "Europe/Zagreb",
    "description_hr": "Tri dana susreta, predavanja i radionica.\n\nUlaznica vrijedi za sva tri dana i uključuje ručak. …",
    "cover_image_url": null, "organizer_name": "Udruga Prilika za Susret",
    "organizer_email": "prijave@prilikazasusret.hr", "organizer_web": null
  },
  "tiers": [
    { "id": "…d01", "title": "Redovna ulaznica", "description": "Sva tri dana, uključen ručak",
      "price_cents": 6000, "imenska": true, "sale_start": null, "sale_end": null,
      "sold_out": false, "not_started": false, "ended": false, "available": 103, "buyable": true },
    { "id": "…d02", "title": "Studentska", "description": "Uz predočenje indeksa na ulazu",
      "price_cents": 3500, "imenska": true, "available": 4, "buyable": true, "…": "…" },
    { "id": "…d03", "title": "Rani upis", "price_cents": 5000, "imenska": true,
      "sold_out": true, "available": 0, "buyable": false, "…": "…" }
  ],
  "stripe_connected": true,
  "kupovno": true,
  "brand": { "accent_color": "#2f855a", "hero_url": null, "intro_html": null,
             "terms_url": "https://prilikazasusret.hr/uvjeti" }
}
```

| Mora se vidjeti | Primarna akcija |
| --- | --- |
| naslovna slika (ili dizajnirano mjesto bez nje), naslov, oznaka vrste, termin, mjesto (naziv, adresa, grad), organizator (+ web/e-mail ako postoje), opis (Markdown, §7), karta/linkovi (§7), „Dodaj u kalendar” (§7), cjenik sa stanjima tiera (§5), „bez naknade posrednika” | **„Kupi ulaznice”** → `/dogadjaj/:slug/kupnja`, samo kad `kupovno: true`. Na mobitelu neka bude dohvatljiv i nakon skrolanja (npr. ljepljiva traka s „od X €”). |

Dodatna stanja:

- `kupovno: false` → umjesto gumba banner: `stripe_connected: true` → „Online prodaja
  za ovaj događaj trenutačno nije aktivna.”; `false` → „Organizator još nije aktivirao
  online prodaju za ovaj događaj.” (drugi mock događaj, `koncert-bez-satnice`, je takav).
  Ovo je ujedno izgled produkcije dok prodaja ne krene (odluka 24) — stranica mora
  izgledati gotovo i bez gumba.
- `?otkazano=1` (povratak sa Stripea bez plaćanja) → banner „Plaćanje je prekinuto.
  Ulaznice nisu naplaćene — možete pokušati ponovno.”
- `tiers: []` → „Organizator još nije objavio cjenik.”
- `event: null` (dopušteno u tipu) → samo naslov i cjenik.
- `event_not_found` → 404 ekran (§4.6).

### 4.3 Kupnja — `/dogadjaj/:slug/kupnja`

Prima isti `EventView`; šalje `POST /api/narudzba`:

```json
{ "campaign_id": "…d01", "tier_id": "…d01", "quantity": 2,
  "buyer_email": "ana.horvat@primjer.hr",
  "holders": [ { "full_name": "Ana Horvat" }, { "full_name": "Marko Horvat" } ] }
```

Odgovor `{ "order_id": "6fc1…", "checkout_url": "https://checkout.stripe.com/…",
"amount_cents": 12000 }` → preglednik odlazi na Stripe.

| Polje | Pravilo |
| --- | --- |
| vrsta ulaznice | odabir među tierovima; nekupivi su vidljivi ali onemogućeni, s razlogom (§5) |
| broj ulaznica | 1 … min(10, `available`); kod `available: 4` najviše 4 |
| e-mail kupca | obavezan; pomoćni tekst „Ulaznice s QR kodom šaljemo na ovu adresu.” |
| imena posjetitelja | samo kad `imenska: true`: **po jedno polje „N. ulaznica — ime i prezime” za svaki komad** (≥ 2 znaka); broj polja prati količinu (1–10) |
| sažetak | „Redovna ulaznica × 2 … 120,00 €”, „Naknada platforme … 0,00 €”, **Ukupno 120,00 €** |

| Mora se vidjeti | Primarna akcija |
| --- | --- |
| naslov događaja, forma, sažetak, „Plaćanje karticom obrađuje Stripe za organizatora. Mjesta su rezervirana 20 minuta.”, link natrag na događaj | **„Nastavi na plaćanje”** (loading: „Otvaram plaćanje…”); disabled dok forma nije valjana |

Stanja: prazna forma, popunjena, imenska s 1 i s 5 imena, greška polja (inline), greška
servera (banner iznad forme, kodovi u §8), slanje u tijeku, `kupovno: false` („Online
prodaja … nije aktivna.” + natrag). Na desktopu sažetak može biti u bočnom stupcu.

### 4.4 Narudžba — `/ulaznice/:orderId`

Link iz e-maila i povratak sa Stripea (`?placeno=1`). `order_id` je jedini ključ —
nema prijave. **QR kodovi se ovdje namjerno ne prikazuju** (jednokratni su i žive u
e-mailu). Prima `GET /api/ulaznice/:orderId` → `OrderView`:

```json
{
  "order_id": "6fc14507-d597-4eb3-8dcb-97cd254423d7", "state": "paid",
  "quantity": 2, "amount_cents": 12000, "currency": "eur",
  "expires_at": "2026-11-19T14:10:05.139Z", "paid_at": "2026-11-19T13:50:05.186Z",
  "buyer_email": "an••••••••@primjer.hr",
  "event": { "title": "Prilika za Susret 2027", "slug": "prilika-za-susret-2027",
             "venue_name": "Dom sportova", "venue_city": "Zagreb",
             "starts_at": "2027-04-16T07:00:00+00:00", "ends_at": "2027-04-18T16:00:00+00:00", "…": "…" },
  "tickets": [
    { "serial": "MOCK-000001", "holder_name": "Ana Horvat", "state": "issued", "checked_in_at": null },
    { "serial": "MOCK-000002", "holder_name": "Marko Horvat", "state": "issued", "checked_in_at": null }
  ],
  "dostava": { "status": "sent", "at": "2026-11-19T13:50:05.186Z" }
}
```

Uvijek: naslov događaja, termin, mjesto, sažetak (broj ulaznica, iznos, maskirani
e-mail), napomena „Sačuvajte ovaj link — njime pristupate narudžbi bez prijave.”

| `state` | Naslov / tekst (današnji) | Ton | Što još |
| --- | --- | --- | --- |
| `pending` | „Čeka plaćanje” — „Mjesta su rezervirana dok rezervacija ne istekne. Ulaznice izdajemo čim plaćanje bude potvrđeno.” | čekanje | red „Rezervacija vrijedi do …”; `tickets: []` |
| `pending` + `?placeno=1` | „Potvrđujemo plaćanje…” — „Plaćanje je zaprimljeno kod Stripea. Ulaznice izdajemo čim potvrda stigne — ova stranica se osvježava sama.” | čekanje, s indikatorom | stranica se osvježava svake 2 s (do 20 s) |
| `paid` | „Plaćeno” — „Ulaznice su izdane i poslane e-mailom. Na ulazu pokažite QR kod iz poruke.” | ok | popis ulaznica, blok ponovne dostave, link „Otvorite narudžbu u aplikaciji” |
| `expired` | „Rezervacija je istekla” — „Plaćanje nije stiglo na vrijeme pa su mjesta vraćena u prodaju. Ništa nije naplaćeno.” | greška | link natrag na događaj |
| `refunded` | „Vraćeno” — „Uplata je vraćena na karticu, a ulaznice su poništene.” | greška/neutralno | ulaznice sa stanjem „poništena” |
| `failed` | „Plaćanje nije uspjelo” — „Ništa nije naplaćeno. Možete pokušati ponovno sa stranice događaja.” | greška | link na događaj |

Red ulaznice: `holder_name` (ili „Ulaznica”), `serial`, oznaka stanja: `issued` →
„vrijedi”, `checked_in` → „ušlo”, `void` → „poništena”.

Blok **„Niste dobili e-mail?”** (samo `paid`): tekst o mapi neželjene pošte, upozorenje
**prije** klika „Ako je prva poruka stigla, novi QR kodovi poništavaju stare —
proslijeđene ulaznice iz stare poruke prestaju vrijediti.”, sekundarni gumb „Pošalji
ponovno” (loading „Šaljem…”). Rezultati `POST …/ponovna-dostava`:

| Odgovor | Poruka |
| --- | --- |
| `status: "poslano"`, `stari_qr_ponisten: true` | „Poslano na an••••@primjer.hr. Vrijede QR kodovi iz NOVE poruke — stari više ne rade.” (mora biti istaknuto) |
| `status: "poslano"`, `false` | „Poslano na an••••@primjer.hr.” |
| `status: "nema_vazecih_ulaznica"` | „Sve ulaznice iz ove narudžbe su već iskorištene ili poništene.” |
| `status: "neuspjelo"` | „Slanje nije uspjelo. Pokušajte kasnije ili se javite podršci.” |
| greška (§8) | poruka iz tablice |

Primarna akcija: nema jedne — na `paid` je to provjera e-maila; na `expired`/`failed`
„Natrag na događaj”.

### 4.5 Uvjeti i privatnost — `/uvjeti`, `/privatnost`

Statični dugi tekst (prerenderiran). Treba: tipografija za dugo čitanje (h1, h2
numerirani, odlomci, liste, linkovi), širina retka ~65–75 znakova, **banner „Nacrt”**
(„Ovaj tekst još nije pravno provjeren i ne primjenjuje se na stvarnu prodaju…”) i
vidljivi placeholderi tipa `[PRAVNI SUBJEKT PLATFORME — nije određen]` (moraju se
razlikovati od teksta). Sekcije uvjeta: Tko je prodavatelj, Račun, Ulaznica i ulazak,
Otkazivanje i povrat, Odgovornost, Kontakt. Privatnost: Tko obrađuje podatke, Koje
podatke prikupljamo, QR kod, Koliko dugo čuvamo, Vaša prava, Kolačići. Podnožje:
Uvjeti · Privatnost · Popis događaja. Ako događaj ima `brand.terms_url`, na stranici
događaja i kupnje ide link na organizatorove uvjete.

### 4.6 404

Nepostojeća putanja, `event_not_found`, `order_not_found`. Kratko: „Stranica nije
pronađena” / „Događaj nije pronađen.” / „Narudžba nije pronađena.”, i akcija „Na popis
događaja”. Za narudžbu dodati savjet: „Provjerite link iz e-maila.” (Danas SPA
preusmjerava na `/`, pa ovaj ekran ne postoji — novi je.)

## 5. Stanja tiera

Izvedeno iz `TierView` (`sold_out`, `not_started`, `ended`, `available`, `buyable`,
`imenska`, `sale_start`, `sale_end`). Prednost kad ih je više: rasprodano → nije počela →
završila.

| Stanje | Uvjet | Prikaz (današnja oznaka) | Kupiv |
| --- | --- | --- | --- |
| dostupno | `buyable: true` | cijena, opis | da |
| malo preostalo | `buyable` i `available ≤ 10` | „još 4” (ok ton) | da |
| neograničeno | `available: null` | bez broja | da |
| rasprodano | `sold_out: true` | „rasprodano” (greška ton), red prigušen | ne |
| prodaja nije počela | `not_started: true` | „prodaja još nije počela” + poželjno „od 1. 3. 2027. u 10:00” iz `sale_start` | ne |
| prodaja završila | `ended: true` | „prodaja zatvorena” | ne |
| imenska | `imenska: true` | napomena „ulaznica glasi na ime”; u kupnji polje za ime po komadu | — |
| događaj nekupiv | `kupovno: false` na `EventView` | svi tierovi se vide s cijenom, ali nema gumba „Kupi” (banner iz §4.2) | ne |

Prigušen red mora i dalje imati AA kontrast teksta (ne spuštati opacity ispod toga).
U mocku nema primjera za `not_started` i `ended` — dizajniraj ih po tablici.

## 6. Brand po događaju

| Polje | Upotreba |
| --- | --- |
| `brand.accent_color` (hex, npr. `#2f855a`) | nadjačava `--color-accent` na stranicama tog događaja (događaj, kupnja, narudžba). Bez njega vrijedi zadana naglasna boja. |
| `brand.hero_url` | alternativna velika slika; `cover_image_url` ima prednost |
| `brand.terms_url` | link na organizatorove uvjete |
| `brand.intro_html` | danas `null` svugdje; ne dizajnirati posebno |

**Kontrast naglasne boje (obavezno):** boja dolazi od organizatora i može biti bilo
koja. Pravila koja kod mora moći primijeniti, pa ih dizajn mora predvidjeti:

1. Tekst/ikona **na** naglasnoj boji (`--color-on-accent`) bira se automatski: crna ili
   bijela, ona s većim kontrastom (relativna luminancija WCAG). `#2f855a` + bijelo =
   4,5:1 → bijelo.
2. Naglasna boja kao **tekst ili link na pozadini** mora imati ≥ 4,5:1 prema
   `--color-bg`; ako nema, kod je potamni (svijetla tema) ili posvijetli (tamna) dok ne
   prođe. Dizajn neka ne oslanja čitljivost samo na naglasnu boju.
3. Pokaži primjere s tri boje: tamna (`#1a365d`), srednja (`#2f855a`), svijetla
   (`#f6e05e` — žuta, gdje mora pobijediti crni tekst).

## 7. Planirani dodaci — dizajnirati već sada

Polja još nisu u API-ju (dolaze u S2b, nullable); ekran mora izgledati dobro i s njima
i bez njih.

| Dodatak | Polja | Prikaz | Odluka |
| --- | --- | --- | --- |
| Karta i navigacija | `event.venue_lat`, `event.venue_lon` (oboje ili ništa) | mala karta ili statična slika + linkovi „Otvori u Google Maps” / „Apple Maps”; bez koordinata samo adresa kao tekst | 14 |
| Alt naslovne slike | `event.cover_image_alt` (≤ 300) | ne vidi se, ali slika bez alt-a je dekorativna; predvidi i omjer slike (16:9) i stanje bez slike | 15 |
| Markdown opis | `event.description_hr` | odlomci, naslovi (h2/h3), liste, podebljano, linkovi; bez sirovog HTML-a. Dizajniraj tipografiju za sve te elemente; opis može biti i jedna rečenica i 2 000 znakova | 19 |
| Dodaj u kalendar | iz `starts_at`/`ends_at` | gumb ili izbornik: „Google Kalendar” i „.ics (Apple, Outlook)”; bez `starts_at` gumba nema | 20 |

## 8. Greške koje UI mora prikazati

Javne rute (`worker/index.ts`). Poruke su današnje iz `PORUKE`; dizajn smije
predložiti bolji tekst, ali ne smije ispustiti kod. Banner greške: ikona + tekst, bez
tehničkog koda.

| Kod | HTTP | Gdje | Poruka |
| --- | --- | --- | --- |
| `event_not_found` | 404 | događaj, kupnja | Događaj nije pronađen. → 404 ekran |
| `tier_not_found` | 404 | kupnja | Odabrana vrsta ulaznice više ne postoji. |
| `tier_sold_out` | 409 | kupnja | Ulaznice te vrste su rasprodane. (i kad je traženo više od `available`) |
| `sale_not_started` | 409 | kupnja | Prodaja za tu vrstu ulaznice još nije počela. |
| `sale_ended` | 409 | kupnja | Prodaja za tu vrstu ulaznice je zatvorena. |
| `holders_incomplete` | 422 | kupnja | Za imenske ulaznice upišite ime i prezime za svaku ulaznicu. |
| `invalid_quantity` | 400 | kupnja | Odaberite između 1 i 10 ulaznica. |
| `invalid_buyer_email` | 400 | kupnja | Upišite ispravnu e-mail adresu. |
| `organizer_not_connected` | 409 | kupnja | Organizator još nije povezao račun za naplatu. |
| `organizer_charges_disabled` | 409 | kupnja | Organizatorov račun za naplatu još nije aktivan. |
| `stripe_not_configured` | 503 | kupnja | Naplata trenutačno nije dostupna. |
| `previse_pokusaja` | 429 | kupnja, ponovna dostava | Previše pokušaja — pokušajte za koju minutu. Odgovor nosi **`retry_after`** (sekunde; kod rotacije QR-a 3600) — predvidi prikaz „Pokušajte ponovno za N min” i onemogućen gumb do tada. |
| `order_not_found` | 404 | narudžba | Narudžba nije pronađena. → 404 ekran |
| `narudzba_nije_placena` | 409 | ponovna dostava | Narudžba još nije plaćena. (nosi i `state`) |
| `nema_email_adrese` | 409 | ponovna dostava | Za ovu narudžbu nemamo e-mail adresu. |
| `rotacija_nije_uspjela` | 502 | ponovna dostava | Nismo uspjeli izdati nove QR kodove. Javite se podršci. |
| `greska_servera` | 500 | svugdje | Nešto je pošlo po zlu. Pokušajte ponovno. |
| ostalo: `bad_json`, `invalid_campaign_id`, `invalid_tier_id`, `invalid_order_id` (400), `checkout_bez_url`, `api_*` (502), `service_key_missing`, `hmac_secret_missing` (503), `neispravan_odgovor` (klijent) | razno | svugdje | nemaju vlastitu poruku → generička „Nešto je pošlo po zlu. Pokušajte ponovno.” |

Treba nacrtati: greška polja (inline ispod polja), banner greške na vrhu forme, banner
s odbrojavanjem za 429, puna stranica greške (mreža/500) s gumbom „Pokušaj ponovno”.

## 9. Što se NE dizajnira

- organizatorsko sučelje (pregled prodaje, CSV), skener ulaza, prijava organizatora —
  ostaju u postojećem SPA-u (odluka 1);
- prikaz QR koda na webu (QR je samo u e-mailu i mobilnoj aplikaciji);
- Stripe Checkout (Stripeova stranica);
- „tko dolazi” / popis posjetitelja i tagovi (odluka 18 — osobni podaci kupaca);
- galerija slika (odluka 16), filtri po gradu/kategoriji, pretraga, korisnički računi,
  košarica s više događaja, sjedala/karta dvorane;
- e-mail predložak ulaznice (zaseban posao).

## 10. Za lijepljenje u Claude Design

> Dizajniraj dizajnerski sustav i šest ekrana (popis događaja, događaj, kupnja,
> narudžba u 5 stanja, uvjeti/privatnost, 404) za hrvatsku stranicu za prodaju
> ulaznica bez posrednika, na 390 px i 1280 px, prema briefu ispod. Tokeni moraju biti
> semantički imenovani da postanu CSS varijable; naglasna boja se mijenja po događaju i
> mora ostati AA čitljiva. Koristi stvarne podatke iz primjera (Prilika za Susret 2027,
> Dom sportova, Zagreb, 60,00 € / 35,00 € / rasprodani Rani upis).
