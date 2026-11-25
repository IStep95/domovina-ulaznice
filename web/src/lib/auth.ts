// Prijava organizatora i osoblja na ulazu (S8): preneseno iz src/lib/auth.ts
// (SPA, ostaje kao rezerva do S9). Ponašanje je isto, razlike su samo u obliku:
// greške su ApiError iz ./api.ts (isti `code` kao prije, plus `status`), a čisti
// dijelovi (fragment, JWT, istek) su izdvojeni da ih node:test provjeri bez
// preglednika.
//
// Identitet je isti GoTrue kao `domovina.ai` i `domovina-fiskal-app` — nema
// zasebnih korisnika za ulaznice. Browser NE razgovara s GoTrueom izravno nego
// kroz glavni Worker (`/api/organizator/*`), pa web/ ne treba ni anon ključ ni
// adresu jezgre (odluka 4). SSR za sesiju ne zna: token postoji samo u
// pregledniku, a stranice organizatora su `client:only` otoci.
//
// Token stoji u `sessionStorage`, ne u `localStorage`: skener se često otvara na
// posuđenom mobitelu na ulazu i sesija mora umrijeti sa zatvaranjem taba. Cijena
// je da se osoblje ujutro prijavi jednom — to je prihvatljivo; ostavljena
// vječna sesija na tuđem uređaju nije.
//
// ⚠️ REVIEW(fable): refresh token se namjerno ne traži ni ne čuva. Posljedica:
// duga smjena na ulazu (GoTrue access token je tipično 1 h) traži ponovnu
// prijavu usred događaja. To je stvarna neugodnost i legitimno je riješiti je
// drukčije — ali svako rješenje znači trajniju tajnu na tuđem uređaju, pa je
// odluka svjesno na strani kraće sesije.
import type { Skica } from "./editor.ts";
import { ApiError, parseApiResponse } from "./api.ts";

export { ApiError };

/** Ključ u sessionStorageu; isti kao u SPA-i, pa prijava preživi prijelaz SPA → Astro u istom tabu. */
export const KLJUC_SESIJE = "ulaznice.sesija";

export interface Sesija {
  access_token: string;
  email: string;
  /** epoch ms kad token istječe (procjena iz expires_in) */
  istek: number;
}

/** Odgovor `/api/organizator/prijava` i `/potvrdi` (i token iz Googleova fragmenta). */
export interface Token {
  access_token: string;
  expires_in: number;
  email: string;
}

/** sessionStorage ili null: SSR, privatni prozor ili blokirana pohrana bacaju već na pristup. */
function pohrana(): Storage | null {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ sesija

/**
 * Token → sesija. 60 s rezerve da zahtjev ne krene sekundu prije isteka; i
 * kratki token vrijedi barem minutu.
 */
export function sesijaIzTokena(r: Token, sada = Date.now()): Sesija {
  return {
    access_token: r.access_token,
    email: r.email,
    istek: sada + Math.max(60, r.expires_in - 60) * 1000,
  };
}

function sesijaIz(r: Token): Sesija {
  const s = sesijaIzTokena(r);
  spremiSesiju(s);
  return s;
}

/**
 * Sesija za otok: prvo povratak iz Googlea (fragment), pa sessionStorage.
 * Istekla ili neispravna sesija se briše. Bez preglednika (SSR) uvijek null.
 */
export function procitajSesiju(sada = Date.now()): Sesija | null {
  const izGooglea = preuzmiIzFragmenta();
  if (izGooglea) return izGooglea;
  const p = pohrana();
  if (!p) return null;
  try {
    const raw = p.getItem(KLJUC_SESIJE);
    if (!raw) return null;
    const s = JSON.parse(raw) as Sesija;
    if (!s?.access_token || typeof s.istek !== "number" || sada > s.istek) {
      p.removeItem(KLJUC_SESIJE);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function spremiSesiju(s: Sesija): void {
  try {
    pohrana()?.setItem(KLJUC_SESIJE, JSON.stringify(s));
  } catch {
    // privatni prozor bez pohrane: sesija živi samo u memoriji stranice
  }
}

export function odjavi(): void {
  try {
    pohrana()?.removeItem(KLJUC_SESIJE);
  } catch {
    /* nema što počistiti */
  }
}

/**
 * Je li greška poziva istekla sesija (otok tada vraća prijavu)? Po kodu, ne po
 * statusu: 401 nose i `prijava_neuspjela` i `kod_neispravan`, a to su krivi
 * podaci u obrascu, ne istek. `not_authenticated` vraća jezgra kroz skener.
 */
export function jeIstekla(e: unknown): boolean {
  return e instanceof ApiError && (e.code === "nije_prijavljen" || e.code === "not_authenticated");
}

// ------------------------------------------------------------------ pozivi

async function zahtjev<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers ?? {}),
    },
  });
  try {
    return parseApiResponse<T>(res.status, await res.text());
  } catch (e) {
    // Kao u SPA-i: svaki 401 briše spremljenu sesiju (pri prijavi je ionako nema).
    if (e instanceof ApiError && e.status === 401) odjavi();
    throw e;
  }
}

export async function prijavi(email: string, lozinka: string): Promise<Sesija> {
  return sesijaIz(
    await zahtjev<Token>("/api/organizator/prijava", { method: "POST", body: JSON.stringify({ email, lozinka }) }),
  );
}

/** Prijava kodom, korak 1. Odgovor je isti postoji li račun ili ne. */
export async function posaljiKod(email: string): Promise<void> {
  await zahtjev("/api/organizator/kod", {
    method: "POST",
    body: JSON.stringify({ email, povratak: povratakIz(location.pathname) }),
  });
}

/** Prijava kodom, korak 2: kod iz maila → sesija. */
export async function potvrdiKod(email: string, kod: string): Promise<Sesija> {
  return sesijaIz(
    await zahtjev<Token>("/api/organizator/potvrdi", { method: "POST", body: JSON.stringify({ email, kod }) }),
  );
}

// ------------------------------------------------------------------ Google

/**
 * Prijava Googleom, korak 1: Worker preusmjeri na GoTrue `/authorize` s
 * `redirect_to` = ova stranica (`/organizator`, `/organizator/novi` ili
 * `/skener`; ostalo Worker svede na `/organizator`). Adresu jezgre browser i
 * dalje ne zna.
 */
export function prijaviGoogleom(): void {
  location.assign(adresaGooglePrijave(location.pathname));
}

/** URL koraka 1; kosa crta na kraju se skida jer je Worker ne prihvaća u `povratak`. */
export function adresaGooglePrijave(putanja: string): string {
  return `/api/organizator/google?povratak=${encodeURIComponent(povratakIz(putanja))}`;
}

/** Putanja stranice → `povratak` za Worker (Google i link u mailu s kodom). */
export function povratakIz(putanja: string): string {
  return putanja.length > 1 ? putanja.replace(/\/+$/, "") : putanja;
}

/** Greška s povratka iz Googlea, za obrazac prijave (pročita se jednom). */
let googleGreska: string | null = null;
export function preuzmiGoogleGresku(): string | null {
  const g = googleGreska;
  googleGreska = null;
  return g;
}

/**
 * Fragment povratka iz GoTruea (implicit flow): `#access_token=…&expires_in=…&refresh_token=…`
 * ili `#error=…&error_description=…`.
 *   null                  — fragment nije GoTrueov (prazan ili nešto drugo), ne dira se
 *   { greska }            — GoTrue je vratio grešku ili token bez čitljivog e-maila
 *   { token }             — token, istek i e-mail iz JWT-a (refresh token se ne čita)
 * E-mail se iz JWT-a samo čita za prikaz; potpis provjerava Worker na svakom pozivu.
 */
export function tokenIzFragmenta(hash: string): { token: Token } | { greska: "google_neuspjelo" } | null {
  if (hash.length < 2) return null;
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  if (!p.has("access_token") && !p.has("error")) return null;
  const token = p.get("access_token");
  if (!token) return { greska: "google_neuspjelo" };
  const email = emailIzJwt(token);
  if (email === null) return { greska: "google_neuspjelo" };
  return { token: { access_token: token, expires_in: Number(p.get("expires_in")) || 3600, email } };
}

/** `email` iz tijela JWT-a (base64url); neispravan JWT → null, JWT bez e-maila → "". */
export function emailIzJwt(token: string): string | null {
  try {
    const dio = token.split(".")[1];
    if (!dio) return null;
    const b64 = dio.replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="));
    const json = new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
    const tijelo = JSON.parse(json) as { email?: unknown };
    return typeof tijelo.email === "string" ? tijelo.email : "";
  } catch {
    return null;
  }
}

/**
 * Korak 2: token iz fragmenta → sesija. Fragment se odmah briše iz adrese (i iz
 * povijesti, `replaceState`), a refresh token se ne sprema — ista odluka kao
 * za lozinku i kod.
 */
function preuzmiIzFragmenta(): Sesija | null {
  if (typeof location === "undefined") return null;
  const r = tokenIzFragmenta(location.hash);
  if (!r) return null;
  history.replaceState(null, "", location.pathname + location.search);
  if ("greska" in r) {
    googleGreska = r.greska;
    return null;
  }
  return sesijaIz(r.token);
}

// ------------------------------------------------------------------ organizator

export interface OrgTier {
  id: string;
  title: string;
  price_cents: number;
  inventory_total: number | null;
  inventory_claimed: number;
  imenska: boolean;
}

export interface OrgEvent {
  campaign_id: string;
  account_id: string;
  slug: string;
  title: string;
  state: string;
  visibility: string;
  event: { venue_city?: string; starts_at?: string | null; timezone?: string } | null;
  tiers: OrgTier[];
}

export interface OrgPregled {
  accounts: Array<{ id: string; name: string; allowlisted: boolean; has_record: boolean }>;
  events: OrgEvent[];
}

export const dohvatiPregled = (token: string): Promise<OrgPregled> =>
  zahtjev<OrgPregled>("/api/organizator/pregled", { method: "GET" }, token);

/**
 * Editor: nova privatna skica događaja (`POST /api/organizator/dogadjaj` →
 * `events-organizer`). Tijelo složi editor (u SPA-i `src/lib/editor.ts`
 * `tijeloZahtjeva`); Worker propušta samo poznata polja. `event_id` šalje
 * klijent, pa je ponovljeni zahtjev isti događaj (`existing: true`), ne duplikat.
 */
export const kreirajDogadjaj = (
  token: string,
  tijelo: Record<string, unknown>,
): Promise<{ id: string; slug: string; existing: boolean }> =>
  zahtjev("/api/organizator/dogadjaj", { method: "POST", body: JSON.stringify(tijelo) }, token);

/**
 * Upload slike iz editora (`POST /api/organizator/slika` → Storage
 * `ulaznice-media`). Tijelo je sama slika (već smanjena, `lib/slika.ts`);
 * vraća javni URL koji ide u `cover_image_url` ili galeriju.
 */
export const ucitajSliku = (token: string, slika: Blob): Promise<{ url: string }> =>
  zahtjev("/api/organizator/slika", { method: "POST", body: slika, headers: { "content-type": slika.type } }, token);

/** Skica za uređivanje (`GET /api/organizator/dogadjaj/:id`). */
export const dohvatiSkicu = (token: string, id: string): Promise<Skica> =>
  zahtjev(`/api/organizator/dogadjaj/${encodeURIComponent(id)}`, { method: "GET" }, token);

/** Izmjena skice (`PUT` → `events-organizer` update); tijelo složi `zahtjevIzmjene`. */
export const azurirajDogadjaj = (token: string, id: string, tijelo: Record<string, unknown>): Promise<unknown> =>
  zahtjev(`/api/organizator/dogadjaj/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(tijelo) }, token);

/** Brisanje skice (`DELETE` → `delete_event_draft`; objavljeni događaj jezgra odbije). */
export const obrisiSkicu = (token: string, id: string): Promise<unknown> =>
  zahtjev(`/api/organizator/dogadjaj/${encodeURIComponent(id)}`, { method: "DELETE" }, token);

/** Izvoz sudionika (CSV); s tokenom, pa se datoteka dohvaća fetchom, ne linkom. */
export async function preuzmiHoldere(token: string, campaignId: string): Promise<Blob> {
  const res = await fetch(`/api/organizator/holderi.csv?campaign_id=${encodeURIComponent(campaignId)}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (res.ok) return res.blob();
  try {
    // greška je JSON kao i ostali /api/*; parseApiResponse za ne-2xx uvijek baca
    parseApiResponse(res.status, await res.text());
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) odjavi();
    throw e;
  }
  throw new ApiError(`http_${res.status}`, res.status);
}

// ------------------------------------------------------------------ skener

export interface SkenRezultat {
  status: "checked_in" | "already_checked_in" | "void" | "not_found";
  serial?: string;
  holder_name?: string | null;
  tier_title?: string | null;
  event_title?: string | null;
  checked_in_at?: string | null;
  checked_in_by_email?: string | null;
  checked_in_count?: number;
}

export const skenirajToken = (token: string, qr: string): Promise<SkenRezultat> =>
  zahtjev<SkenRezultat>("/api/skener/sken", { method: "POST", body: JSON.stringify({ qr_token: qr }) }, token);
