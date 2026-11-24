// Poruke grešaka kupnje (S4) i narudžbe (S5): strojni kod → rečenica na hrvatskom.
//
// Poruka ovisi o KODU, ne o HTTP statusu: isti kod stiže s dva statusa (npr.
// `tier_sold_out` je 409 iz Workera, a 502 kad ga vrati jezgra kroz
// `api.createOrder`, worker/api.ts `callFunction`). Nepoznat kod → GENERICKA_PORUKA;
// tehnički kod se kupcu nikad ne prikazuje (design-brief §8).
//
// Čist modul (bez Reacta i Astra), da ga node:test provjeri protiv
// `worker/index.ts`. Popis kodova je izvučen grepom (S4), po izvoru:
//   worker/index.ts  POST /api/narudzba: fail("…") i ternarni izraz u provjeri tiera,
//                    plus app.onError (`greska_servera`) i 404 fallback (`not_found`)
//   worker/api.ts    HttpError na putu narudžbe (feed, rest, callFunction)
//   worker/stripe.ts HttpError iz createCheckoutSession / stripeClient
//   jezgra           events-order (create_ticket_order) i events-stripe-intent;
//                    kroz callFunction stižu kao 502 (404 ostaje 404) s kodom jezgre
//   klijent          web/src/lib/api.ts (`neispravan_odgovor`, `http_<status>`) i
//                    ovaj modul (`mrezna_greska`, `nedovoljno_ulaznica`)
import { ApiError } from "./api.ts";

export const GENERICKA_PORUKA = "Nešto je pošlo po zlu. Pokušajte ponovno.";

/** Klijentski kod: fetch nije stigao do poslužitelja (nema mreže, prekid, CORS). */
export const KOD_MREZA = "mrezna_greska";
/**
 * Klijentski kod: `tier_sold_out` za tier koji je nakon osvježavanja i dalje
 * kupiv, dakle traženo je više nego što je ostalo (Worker vraća isti kod za oba
 * slučaja, worker/index.ts: `quantity > avail.available`).
 */
export const KOD_NEDOVOLJNO = "nedovoljno_ulaznica";

const NARUDZBA_NIJE_POSLANA = "Narudžba nije ispravno poslana. Osvježite stranicu i pokušajte ponovno.";
const NAPLATA_NEDOSTUPNA = "Naplata trenutačno nije dostupna. Pokušajte ponovno kasnije.";
const SUSTAV_NE_ODGOVARA = "Sustav prodaje trenutačno ne odgovara. Pokušajte ponovno za trenutak.";
const NARUDZBA_NIJE_PRIPREMLJENA = "Narudžbu nismo uspjeli pripremiti. Pokušajte ponovno.";
const TIER_NE_POSTOJI = "Odabrana vrsta ulaznice više nije u prodaji. Odaberite drugu vrstu.";

/** Kod → poruka za sve što `POST /api/narudzba` (i klijent oko njega) može vratiti. */
export const PORUKE_NARUDZBE: Readonly<Record<string, string>> = {
  // ── worker/index.ts, POST /api/narudzba ──
  previse_pokusaja: "Previše pokušaja.",
  bad_json: NARUDZBA_NIJE_POSLANA,
  invalid_campaign_id: NARUDZBA_NIJE_POSLANA,
  invalid_tier_id: NARUDZBA_NIJE_POSLANA,
  invalid_quantity: "Odaberite između 1 i 10 ulaznica.",
  invalid_buyer_email: "Upišite ispravnu e-mail adresu.",
  event_not_found: "Događaj više nije u prodaji.",
  tier_not_found: TIER_NE_POSTOJI,
  tier_sold_out: "Ulaznice te vrste su rasprodane. Odaberite drugu vrstu.",
  sale_not_started: "Prodaja za tu vrstu ulaznice još nije počela.",
  sale_ended: "Prodaja za tu vrstu ulaznice je zatvorena.",
  holders_incomplete: "Za imenske ulaznice upišite ime i prezime za svaku ulaznicu.",
  organizer_not_connected: "Organizator još nije povezao račun za naplatu, pa online kupnja nije moguća.",
  organizer_charges_disabled: "Organizatorov račun za naplatu još nije aktivan, pa online kupnja trenutačno nije moguća.",
  checkout_bez_url: "Stranica za plaćanje se nije otvorila. Pokušajte ponovno.",
  // app.onError i 404 fallback za nepostojeću /api/ rutu
  greska_servera: GENERICKA_PORUKA,
  not_found: NARUDZBA_NIJE_POSLANA,

  // ── worker/api.ts (HttpError na putu narudžbe) ──
  api_feed_error: SUSTAV_NE_ODGOVARA,
  api_rest_error: SUSTAV_NE_ODGOVARA,
  api_rpc_error: SUSTAV_NE_ODGOVARA,
  api_bad_json: SUSTAV_NE_ODGOVARA,
  service_key_missing: NAPLATA_NEDOSTUPNA,
  hmac_secret_missing: NAPLATA_NEDOSTUPNA,

  // ── worker/stripe.ts ──
  stripe_not_configured: NAPLATA_NEDOSTUPNA,
  stripe_api_base_invalid: NAPLATA_NEDOSTUPNA,
  stripe_api_base_forbidden: NAPLATA_NEDOSTUPNA,

  // ── jezgra: events-order + create_ticket_order (domovina-api) ──
  method_not_allowed: NARUDZBA_NIJE_POSLANA,
  invalid_order_id: NARUDZBA_NIJE_PRIPREMLJENA,
  order_id_required: NARUDZBA_NIJE_PRIPREMLJENA,
  invalid_payer_address: NARUDZBA_NIJE_POSLANA,
  campaign_not_found: "Događaj više nije u prodaji.",
  campaign_not_tickets: "Za ovaj događaj se ne prodaju ulaznice.",
  campaign_not_active: "Prodaja za ovaj događaj je zatvorena.",
  tier_not_ticket: TIER_NE_POSTOJI,
  tier_price_missing: "Organizator još nije postavio cijenu za tu vrstu ulaznice.",
  invalid_holder: "Ime na ulaznici nije ispravno. Upišite ime i prezime (2 do 120 znakova).",
  order_rate_limited: "Previše narudžbi u kratkom vremenu. Pokušajte ponovno kasnije.",

  // ── jezgra: events-stripe-intent (poziva ga Worker odmah nakon createOrder) ──
  order_not_found: NARUDZBA_NIJE_PRIPREMLJENA,
  order_not_pending: NARUDZBA_NIJE_PRIPREMLJENA,
  order_expired: "Rezervacija je istekla prije plaćanja. Pokušajte ponovno.",
  secret_not_configured: NAPLATA_NEDOSTUPNA,
  missing_signature: NAPLATA_NEDOSTUPNA,
  bad_signature: NAPLATA_NEDOSTUPNA,

  // ── klijent ──
  neispravan_odgovor: "Poslužitelj je vratio neočekivan odgovor. Pokušajte ponovno.",
  [KOD_MREZA]: "Nema veze s poslužiteljem. Provjerite internetsku vezu i pokušajte ponovno.",
  [KOD_NEDOVOLJNO]: "Ulaznica te vrste nema u traženom broju. Smanjite broj ili odaberite drugu vrstu.",
};

const HTTP_5XX = "Poslužitelj trenutačno ne odgovara. Pokušajte ponovno za trenutak.";

/** Poruka za kod; `http_<status>` (bez koda u tijelu) po klasi statusa; ostalo generički. */
export function porukaGreske(kod: string): string {
  if (Object.hasOwn(PORUKE_NARUDZBE, kod)) return PORUKE_NARUDZBE[kod]!;
  const http = /^http_(\d{3})$/.exec(kod);
  if (http && Number(http[1]) >= 500) return HTTP_5XX;
  return GENERICKA_PORUKA;
}

// ── Ponašanje forme po kodu ──────────────────────────────────────────────────

/** Polje forme na koje se greška odnosi (inline poruka uz banner). */
export type CiljGreske = "email" | "imena" | null;

export interface GreskaNarudzbe {
  kod: string;
  /** Glavna rečenica bannera (podebljana). */
  poruka: string;
  /** Dopuna iza poruke, npr. „Pokušajte ponovno za 2 min.” */
  dopuna?: string;
  /** wait = 429 (čekanje), error = sve ostalo. */
  ton: "error" | "wait";
  cilj: CiljGreske;
  /** Raspoloživost se promijenila: ponovno učitati događaj (tierove). */
  osvjezi: boolean;
  /** Ponovni pokušaj ne pomaže (organizator, kampanja): forma se zaključa. */
  konacno: boolean;
  /** > 0: gumb je zaključan toliko sekundi (429). */
  cekajSekundi: number;
}

/** Kad 429 dođe bez `retry_after`, čeka se minuta (prozor narudžbi je 10 min, worker/ratelimit.ts). */
export const ZADANO_CEKANJE_S = 60;

const OSVJEZI = new Set([
  "tier_sold_out",
  "sale_not_started",
  "sale_ended",
  "tier_not_found",
  "tier_not_ticket",
  "tier_price_missing",
  KOD_NEDOVOLJNO,
]);
const KONACNO = new Set([
  "event_not_found",
  "campaign_not_found",
  "campaign_not_tickets",
  "campaign_not_active",
  "organizer_not_connected",
  "organizer_charges_disabled",
]);

/**
 * „2 min” / „45 s”: preostalo čekanje nakon 429. Minute se zaokružuju naviše, da
 * kupac ne pokuša prerano; gumb ionako odbrojava točno.
 */
export function trajanjeCekanja(sekundi: number): string {
  const s = Math.max(1, Math.ceil(sekundi));
  return s < 60 ? `${s} s` : `${Math.ceil(s / 60)} min`;
}

/** Banner 429 kupnje (Kupnja-390): „Pokušajte ponovno za 2 min.” */
export function porukaCekanja(sekundi: number): string {
  return `Pokušajte ponovno za ${trajanjeCekanja(sekundi)}.`;
}

/** `retry_after` iz 429 → cijele sekunde čekanja; bez njega (ili 0) ZADANO_CEKANJE_S. */
export function sekundeCekanja(retryAfter?: number): number {
  return retryAfter !== undefined && Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : ZADANO_CEKANJE_S;
}

/** Kod (+ `retry_after`) → što forma prikazuje i kako se ponaša. */
export function greskaNarudzbe(kod: string, retryAfter?: number): GreskaNarudzbe {
  const g: GreskaNarudzbe = {
    kod,
    poruka: porukaGreske(kod),
    ton: "error",
    cilj: null,
    osvjezi: OSVJEZI.has(kod),
    konacno: KONACNO.has(kod),
    cekajSekundi: 0,
  };
  if (kod === "previse_pokusaja") {
    const s = sekundeCekanja(retryAfter);
    g.ton = "wait";
    g.cekajSekundi = s;
    g.dopuna = porukaCekanja(s);
  } else if (kod === "invalid_buyer_email") {
    g.cilj = "email";
    g.dopuna = "Ispravite označeno polje i pokušajte ponovno.";
  } else if (kod === "holders_incomplete" || kod === "invalid_holder") {
    g.cilj = "imena";
    g.dopuna = "Ispravite označena polja i pokušajte ponovno.";
  }
  return g;
}

/**
 * Bilo što bačeno iz `kreirajNarudzbu` → kod i `retry_after`. ApiError nosi kod
 * s backenda; TypeError je fetch koji nije stigao do poslužitelja; ostalo je
 * neočekivano i ide na generičku poruku.
 */
export function kodIzGreske(e: unknown): { kod: string; retryAfter?: number } {
  if (e instanceof ApiError) return { kod: e.code, retryAfter: e.retryAfter };
  if (e instanceof TypeError) return { kod: KOD_MREZA };
  return { kod: "nepoznata_greska" };
}

// ── Narudžba: /api/ulaznice/* (S5) ──────────────────────────────────────────
//
// Zasebna tablica jer isti kod znači drugo nego u kupnji: `order_not_found` iz
// kupnje je jezgra koja nije našla tek stvorenu narudžbu (events-stripe-intent),
// a ovdje je kupac otvorio link narudžbe koja ne postoji. Izvori:
//   worker/index.ts  GET /api/ulaznice/:id, POST …/ponovna-dostava, POST …/preuzmi
//                    (fail("…")), app.onError i 404 fallback
//   worker/api.ts    HttpError na tom putu: orderStatus (rest), feed, deliverTickets
//                    (callFunction → events-tickets), rotateTicketTokens (restRpc)
//   jezgra           events-tickets (kroz callFunction kao 502)
//   klijent          isto kao u kupnji
// `/preuzmi` zove samo mobilna aplikacija; web na nju vodi linkom (odluka 501),
// ali njezini kodovi su ovdje da poruke za cijeli put budu na jednom mjestu.

const NARUDZBA_NE_POSTOJI = "Narudžba nije pronađena. Provjerite link iz e-maila — mora biti cijeli, do zadnjeg znaka.";
const ZAHTJEV_NIJE_POSLAN = "Zahtjev nije ispravno poslan. Osvježite stranicu i pokušajte ponovno.";
const ULAZNICE_NEDOSTUPNE = "Ulaznice trenutačno ne možemo poslati. Pokušajte ponovno kasnije.";

/** Kod → poruka za sve što `/api/ulaznice/*` (i klijent oko njega) može vratiti. */
export const PORUKE_ULAZNICA: Readonly<Record<string, string>> = {
  // ── worker/index.ts, /api/ulaznice/* ──
  invalid_order_id: NARUDZBA_NE_POSTOJI,
  order_not_found: NARUDZBA_NE_POSTOJI,
  previse_pokusaja: "Previše pokušaja.",
  narudzba_nije_placena: "Narudžba još nije plaćena, pa ulaznice još nisu izdane.",
  nema_email_adrese: "Za ovu narudžbu nemamo e-mail adresu, pa ulaznice ne možemo poslati. Javite se na podrska@domovina.ai.",
  rotacija_nije_uspjela: "Nismo uspjeli izdati nove QR kodove. Javite se na podrska@domovina.ai.",
  // samo /preuzmi (mobilna aplikacija šalje e-mail kupca)
  bad_json: ZAHTJEV_NIJE_POSLAN,
  invalid_buyer_email: "Upišite ispravnu e-mail adresu.",
  email_ne_odgovara: "E-mail adresa ne odgovara onoj iz narudžbe. Upišite adresu na koju su stigle ulaznice.",
  // app.onError i 404 fallback za nepostojeću /api/ rutu
  greska_servera: GENERICKA_PORUKA,
  not_found: ZAHTJEV_NIJE_POSLAN,

  // ── worker/api.ts (HttpError na putu narudžbe i dostave) ──
  api_feed_error: SUSTAV_NE_ODGOVARA,
  api_rest_error: SUSTAV_NE_ODGOVARA,
  api_rpc_error: SUSTAV_NE_ODGOVARA,
  api_bad_json: SUSTAV_NE_ODGOVARA,
  service_key_missing: ULAZNICE_NEDOSTUPNE,
  hmac_secret_missing: ULAZNICE_NEDOSTUPNE,

  // ── jezgra: events-tickets (deliverTickets) ──
  method_not_allowed: ULAZNICE_NEDOSTUPNE,
  too_many_orders: ULAZNICE_NEDOSTUPNE,

  // ── klijent ──
  neispravan_odgovor: PORUKE_NARUDZBE.neispravan_odgovor!,
  [KOD_MREZA]: PORUKE_NARUDZBE[KOD_MREZA]!,
};

/** Kao porukaGreske, ali iz PORUKE_ULAZNICA (stranica narudžbe, ponovna dostava). */
export function porukaUlaznica(kod: string): string {
  if (Object.hasOwn(PORUKE_ULAZNICA, kod)) return PORUKE_ULAZNICA[kod]!;
  const http = /^http_(\d{3})$/.exec(kod);
  if (http && Number(http[1]) >= 500) return HTTP_5XX;
  return GENERICKA_PORUKA;
}

export interface GreskaUlaznica {
  kod: string;
  /** Glavna rečenica bannera. */
  poruka: string;
  /** Dopuna iza poruke, npr. „Novi QR kodovi mogu se zatražiti za 60 min.” */
  dopuna?: string;
  /** wait = 429 (čekanje), error = sve ostalo. */
  ton: "error" | "wait";
  /** > 0: gumb „Pošalji ponovno” je zaključan toliko sekundi (429). */
  cekajSekundi: number;
}

/**
 * Kod (+ `retry_after`) → banner ispod gumba „Pošalji ponovno”. 429 nosi
 * `retry_after` iz rate limita (prozor 10 min) ili 3600 kad jezgra odbije
 * rotaciju; tekst je iz Narudzba-stanja-1280.
 */
export function greskaUlaznica(kod: string, retryAfter?: number): GreskaUlaznica {
  if (kod === "previse_pokusaja") {
    const s = sekundeCekanja(retryAfter);
    return {
      kod,
      poruka: porukaUlaznica(kod),
      dopuna: `Novi QR kodovi mogu se zatražiti za ${trajanjeCekanja(s)}.`,
      ton: "wait",
      cekajSekundi: s,
    };
  }
  return { kod, poruka: porukaUlaznica(kod), ton: "error", cekajSekundi: 0 };
}

// ── Poruke polja forme (klijentska validacija, src/lib/kupnja.ts) ────────────

export const PORUKE_POLJA = {
  emailPrazan: "Upišite e-mail adresu.",
  emailNeispravan: "Upišite ispravnu e-mail adresu (npr. ime@primjer.hr).",
  emailPredug: "E-mail adresa je preduga (najviše 200 znakova).",
  imeKratko: "Upišite ime i prezime (najmanje 2 znaka).",
  imeDugo: "Ime je predugo (najviše 120 znakova).",
} as const;

// ── Organizator, prijava i skener: /api/organizator/*, /api/skener/sken (S8) ──
//
// Zasebna tablica iz istog razloga kao PORUKE_ULAZNICA: ovdje govorimo
// organizatoru i osoblju na ulazu, ne kupcu (`invalid_buyer_email` je ovdje
// e-mail za prijavu). Tekstovi su iz PORUKE u src/lib/api.ts (SPA), da prijelaz
// SPA → Astro ne promijeni ni rečenicu. Izvori:
//   worker/index.ts  rute /api/organizator/* i /api/skener/sken (fail("…")),
//                    app.onError i 404 fallback
//   worker/api.ts    prijava, posaljiKod, potvrdiKod, korisnickiRpc/Rest,
//                    kreirajDogadjaj (events-organizer), checkin (events-checkin)
//   jezgra           events-organizer (create_event) i events-checkin (redeem_ticket);
//                    kroz Worker stižu kao 400/401/403 sa svojim kodom
//   klijent          web/src/lib/api.ts (`neispravan_odgovor`) i KOD_MREZA

const PRIJAVA_NEDOSTUPNA = "Prijava trenutačno nije dostupna. Pokušaj ponovno za koju minutu.";

/** Kod → poruka za prijavu, pregled prodaje, izvoz sudionika, editor i skener. */
export const PORUKE_ORGANIZATORA: Readonly<Record<string, string>> = {
  // ── worker/index.ts, /api/organizator/* i /api/skener/sken ──
  previse_pokusaja: "Previše pokušaja — pokušajte za koju minutu.",
  bad_json: ZAHTJEV_NIJE_POSLAN,
  invalid_buyer_email: "Upiši ispravnu e-mail adresu.",
  prijava_neuspjela: "Neispravna e-mail adresa ili lozinka.",
  kod_neispravan: "Kod nije ispravan ili je istekao. Zatraži novi.",
  nije_prijavljen: "Prijava je istekla. Prijavite se ponovno.",
  invalid_campaign_id: ZAHTJEV_NIJE_POSLAN,
  invalid_event_id: ZAHTJEV_NIJE_POSLAN,
  invalid_account_id: "Odaberi organizatora za koji se događaj stvara.",
  invalid_tiers: "Dodaj barem jednu vrstu ulaznice (najviše 50).",
  neispravan_qr: "To nije ulaznica ovog sustava.",
  // app.onError i 404 fallback za nepostojeću /api/ rutu
  greska_servera: GENERICKA_PORUKA,
  not_found: ZAHTJEV_NIJE_POSLAN,

  // ── worker/api.ts ──
  anon_key_missing: "Prijava trenutačno nije dostupna (nedostaje konfiguracija).",
  auth_greska: PRIJAVA_NEDOSTUPNA,
  api_rpc_error: SUSTAV_NE_ODGOVARA,
  api_rest_error: SUSTAV_NE_ODGOVARA,
  api_bad_json: SUSTAV_NE_ODGOVARA,
  api_error: "Događaj nismo uspjeli spremiti. Pokušaj ponovno.",
  nema_prava_kreiranja:
    "Ne možeš kreirati događaj za ovog organizatora. Trebaš biti administrator i imati provjeren identitet (eOsobna) na domovina.ai.",

  // ── jezgra: events-organizer (create_event), editor događaja ──
  invalid_title: "Naziv događaja nije ispravan.",
  invalid_venue_name: "Naziv mjesta nije ispravan (najviše 160 znakova).",
  invalid_venue_city: "Grad nije ispravan (najviše 80 znakova).",
  invalid_event_type: "Vrsta događaja nije ispravna.",
  invalid_dates: "Kraj događaja mora biti nakon početka.",
  invalid_cover_url: "Link naslovne slike nije ispravan.",
  invalid_description: "Opis je predug.",
  invalid_tier_title: "Svaka ulaznica treba naziv (najviše 160 znakova).",
  invalid_tier_price: "Cijena ulaznice nije ispravna.",
  invalid_tier_inventory: "Količina ulaznica nije ispravna.",
  campaign_rate_limited: "Previše novih događaja u kratkom vremenu. Pokušaj za koju minutu.",
  slug_collision: "Događaj s tim nazivom već postoji. Promijeni naziv.",

  // ── jezgra: events-checkin (redeem_ticket), skener ──
  not_authorized: "Nemate ovlasti za ovaj događaj.",
  not_authenticated: "Prijava je istekla. Prijavite se ponovno.",

  // ── klijent ──
  google_neuspjelo: "Prijava Googleom nije uspjela. Pokušaj ponovno ili koristi kod na e-mail.",
  neispravan_odgovor: PORUKE_NARUDZBE.neispravan_odgovor!,
  [KOD_MREZA]: PORUKE_NARUDZBE[KOD_MREZA]!,
};

/** Kao porukaGreske, ali iz PORUKE_ORGANIZATORA (prijava, pregled prodaje, editor, skener). */
export function porukaOrganizatora(kod: string): string {
  if (Object.hasOwn(PORUKE_ORGANIZATORA, kod)) return PORUKE_ORGANIZATORA[kod]!;
  const http = /^http_(\d{3})$/.exec(kod);
  if (http && Number(http[1]) >= 500) return HTTP_5XX;
  return GENERICKA_PORUKA;
}

/** Bilo što bačeno iz poziva u src/lib/auth.ts → poruka za banner otoka. */
export function porukaIzGreske(e: unknown): string {
  return porukaOrganizatora(kodIzGreske(e).kod);
}
