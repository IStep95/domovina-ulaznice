// Nacrt novog događaja (wizard /organizator/novi, S8): unos u localStorageu da
// refresh ili istek prijave ne izgube upisano, i korak u URL-u (`?korak=N`) da
// „natrag” u pregledniku radi očekivano. Čiste funkcije, testovi u
// web/test/nacrt.test.ts.
//
// Storage je u try/catch: privatni način, puna kvota ili zabranjeni kolačići
// bacaju već na `localStorage` getter, a wizard tada radi i bez nacrta.
// Nacrt nosi i `eventId`: ponovno slanje nakon prekinute veze (ili refresha)
// ide s istim id-om, a `create_event` je idempotentan po id-u (nema duplikata).
import {
  BROJ_KORAKA,
  NAJVISE_TIEROVA,
  jeKorak,
  najdaljiDopusteni,
  prazanUnos,
  type Korak,
  NAJVISE_U_GALERIJI,
  type SlikaUnosa,
  type UnosDogadjaja,
  type UnosTiera,
} from "./editor.ts";

export const KLJUC_NACRTA = "ulaznice.nacrt-dogadjaja";
const VERZIJA = 1;

export interface Nacrt {
  /** E-mail prijavljenog: tuđi nacrt na zajedničkom računalu se ne učitava. */
  email: string;
  eventId: string;
  unos: UnosDogadjaja;
  /** Najdalji posjećeni korak (stepper pušta klik do njega). */
  posjeceno: Korak;
}

/** Dovoljno od Storage API-ja; testovi daju svoj objekt. */
export interface Spremiste {
  getItem(kljuc: string): string | null;
  setItem(kljuc: string, vrijednost: string): void;
  removeItem(kljuc: string): void;
}

function zadanoSpremiste(): Spremiste | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function nacrtUTekst(n: Nacrt): string {
  return JSON.stringify({ v: VERZIJA, ...n });
}

const tekst = (x: unknown, najvise = 5000): string => (typeof x === "string" ? x.slice(0, najvise) : "");

/**
 * Tekst iz storagea → nacrt, ili null (prazno, neispravan JSON, druga verzija,
 * drugi korisnik). Svako polje se svodi na očekivani tip, pa ručno izmijenjen
 * ili stari zapis ne može srušiti formu.
 */
export function nacrtIzTeksta(sirovo: string | null, email: string): Nacrt | null {
  if (!sirovo) return null;
  let p: unknown;
  try {
    p = JSON.parse(sirovo);
  } catch {
    return null;
  }
  if (!p || typeof p !== "object") return null;
  const o = p as Record<string, unknown>;
  if (o.v !== VERZIJA || typeof o.email !== "string" || o.email.toLowerCase() !== email.toLowerCase()) return null;
  if (typeof o.eventId !== "string" || !/^[0-9a-f-]{36}$/i.test(o.eventId)) return null;
  const u = (o.unos && typeof o.unos === "object" ? o.unos : {}) as Record<string, unknown>;
  const zadano = prazanUnos();
  const tieri: UnosTiera[] = Array.isArray(u.tieri)
    ? u.tieri.slice(0, NAJVISE_TIEROVA).map((t) => {
        const r = (t && typeof t === "object" ? t : {}) as Record<string, unknown>;
        return { naziv: tekst(r.naziv, 200), cijena: tekst(r.cijena, 40), kolicina: tekst(r.kolicina, 40), imenska: r.imenska === true };
      })
    : zadano.tieri;
  const galerija: SlikaUnosa[] = Array.isArray(u.galerija)
    ? u.galerija.slice(0, NAJVISE_U_GALERIJI).map((s) => {
        const r = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
        return { url: tekst(r.url, 2000), alt: tekst(r.alt, 400) };
      })
    : [];
  const unos: UnosDogadjaja = {
    accountId: tekst(u.accountId, 100),
    naslov: tekst(u.naslov, 400),
    vrsta: tekst(u.vrsta, 40) || zadano.vrsta,
    pocetak: tekst(u.pocetak, 16),
    kraj: tekst(u.kraj, 16),
    mjesto: tekst(u.mjesto, 400),
    adresa: tekst(u.adresa, 400),
    grad: tekst(u.grad, 200),
    opis: tekst(u.opis, 20_000),
    slika: tekst(u.slika, 2000),
    slikaAlt: tekst(u.slikaAlt, 400),
    galerija,
    organizator: tekst(u.organizator, 400),
    email: tekst(u.email, 400),
    web: tekst(u.web, 400),
    tieri,
  };
  const posjeceno = typeof o.posjeceno === "number" && jeKorak(o.posjeceno) ? o.posjeceno : 1;
  return { email: o.email, eventId: o.eventId, unos, posjeceno };
}

export function ucitajNacrt(email: string, spremiste: Spremiste | null = zadanoSpremiste()): Nacrt | null {
  try {
    return nacrtIzTeksta(spremiste?.getItem(KLJUC_NACRTA) ?? null, email);
  } catch {
    return null;
  }
}

/** false kad storage ne radi (wizard i dalje radi, samo bez nacrta). */
export function spremiNacrt(n: Nacrt, spremiste: Spremiste | null = zadanoSpremiste()): boolean {
  try {
    if (!spremiste) return false;
    spremiste.setItem(KLJUC_NACRTA, nacrtUTekst(n));
    return true;
  } catch {
    return false;
  }
}

export function obrisiNacrt(spremiste: Spremiste | null = zadanoSpremiste()): void {
  try {
    spremiste?.removeItem(KLJUC_NACRTA);
  } catch {
    // nema storagea → nema ni nacrta
  }
}

// ── Korak u URL-u ────────────────────────────────────────────────────────────

/** `?korak=N` kako piše (1 kad nema ili je neispravan), bez provjere unosa. */
export function korakIzUpita(search: string): Korak {
  const n = Number(new URLSearchParams(search).get("korak"));
  return jeKorak(n) ? n : 1;
}

/**
 * Korak iz URL-a, ali ne dalje od prvog nevaljanog koraka: `?korak=5` s
 * praznim nazivom vodi na korak 1 (isto vrijedi za „naprijed” u pregledniku).
 */
export function korakIzUrla(search: string, u: UnosDogadjaja): Korak {
  return Math.min(korakIzUpita(search), najdaljiDopusteni(u)) as Korak;
}

/** URL koraka na istoj putanji; ostali parametri upita ostaju. */
export function urlKoraka(putanja: string, search: string, korak: Korak): string {
  const p = new URLSearchParams(search);
  p.set("korak", String(Math.min(Math.max(korak, 1), BROJ_KORAKA)));
  return `${putanja}?${p.toString()}`;
}
