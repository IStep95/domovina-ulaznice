// Logika forme kupnje (S4), bez Reacta: granice, validacija i tijelo zahtjeva.
// Pravila su ista kao u Workeru (worker/index.ts, POST /api/narudzba), da kupac
// grešku vidi prije slanja; Worker i jezgra (create_ticket_order) i dalje
// presuđuju. Promjena ovdje bez promjene u Workeru = razilaženje.
import type { CreateOrderRequest, TierView } from "../../../shared/api-tipovi.ts";
import type { OpcijaTiera } from "../components/IzborTiera.tsx";
import { kratkiDatum, stanjeTiera, ZADANA_ZONA } from "./format.ts";
import { PORUKE_POLJA } from "./poruke.ts";

/** = MAX_QTY u worker/index.ts. */
export const MAX_KOLICINA = 10;
/** = EMAIL_RE u worker/index.ts. */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Worker odbija dulju adresu (`buyerEmail.length > 200`). */
export const EMAIL_MAX = 200;
/** Ime na imenskoj ulaznici, nakon trim: 2…120 znakova (Worker i jezgra). */
export const IME_MIN = 2;
export const IME_MAX = 120;

type TierZaKupnju = Pick<TierView, "id" | "buyable" | "available" | "imenska" | "price_cents">;

/** Najviše komada u jednoj narudžbi za tier: min(10, preostalo); rasprodan → 0. */
export function najvecaKolicina(tier: Pick<TierView, "available"> | null | undefined): number {
  if (!tier) return 0;
  if (tier.available === null) return MAX_KOLICINA;
  return Math.max(0, Math.min(MAX_KOLICINA, Math.trunc(tier.available)));
}

/** Količina svedena na 1…max (cijeli broj). Kad je max 0, ostaje 1 (forma je ionako zaključana). */
export function ogranicenaKolicina(n: number, max: number): number {
  const cijeli = Number.isFinite(n) ? Math.trunc(n) : 1;
  return Math.min(Math.max(cijeli, 1), Math.max(1, max));
}

/** Niz imena točno duljine `kolicina`: postojeća se čuvaju, nova su prazna. */
export function prilagodiImena(imena: readonly string[], kolicina: number): string[] {
  return Array.from({ length: Math.max(0, kolicina) }, (_, i) => imena[i] ?? "");
}

/** Prvi kupivi tier (zadani izbor); nijedan → null. */
export function pocetniTier(tiers: readonly Pick<TierView, "id" | "buyable">[]): string | null {
  return tiers.find((t) => t.buyable)?.id ?? null;
}

/** Greška e-maila ili null (Worker: trim, EMAIL_RE, ≤ 200). */
export function provjeriEmail(email: string): string | null {
  const e = email.trim();
  if (!e) return PORUKE_POLJA.emailPrazan;
  if (e.length > EMAIL_MAX) return PORUKE_POLJA.emailPredug;
  if (!EMAIL_RE.test(e)) return PORUKE_POLJA.emailNeispravan;
  return null;
}

/** Greška imena na ulaznici ili null (Worker: trim, 2…120). */
export function provjeriIme(ime: string): string | null {
  const i = ime.trim();
  if (i.length < IME_MIN) return PORUKE_POLJA.imeKratko;
  if (i.length > IME_MAX) return PORUKE_POLJA.imeDugo;
  return null;
}

export interface StanjeForme {
  tier: TierZaKupnju | null;
  kolicina: number;
  /** Duljine `kolicina`; gleda se samo za imenske tierove. */
  imena: readonly string[];
  email: string;
  uvjeti: boolean;
}

export interface ProvjeraForme {
  valjano: boolean;
  email: string | null;
  /** Po komadu; prazno za neimenske tierove. */
  imena: (string | null)[];
  /** Što još nedostaje, za napomenu uz zaključan gumb. */
  nedostaje: string[];
}

/** Cijela forma: gumb se otključa tek kad je `valjano`. */
export function provjeriFormu(s: StanjeForme): ProvjeraForme {
  const nedostaje: string[] = [];
  const max = najvecaKolicina(s.tier);
  const tierOk = !!s.tier && s.tier.buyable && max >= 1;
  if (!tierOk) nedostaje.push("odaberite vrstu ulaznice");
  const kolicinaOk = Number.isInteger(s.kolicina) && s.kolicina >= 1 && s.kolicina <= Math.max(1, max);
  if (tierOk && !kolicinaOk) nedostaje.push(`odaberite između 1 i ${max} ulaznica`);

  const imena = s.tier?.imenska ? prilagodiImena(s.imena, s.kolicina).map(provjeriIme) : [];
  if (imena.some(Boolean)) nedostaje.push("upišite ime i prezime za svaku ulaznicu");

  const email = provjeriEmail(s.email);
  if (email) nedostaje.push("upišite ispravnu e-mail adresu");
  if (!s.uvjeti) nedostaje.push("prihvatite uvjete");

  return { valjano: nedostaje.length === 0, email, imena, nedostaje };
}

/** Tijelo `POST /api/narudzba`, isto kao SPA (src/pages/Kupnja.tsx). */
export function tijeloNarudzbe(campaignId: string, s: StanjeForme & { tier: TierZaKupnju }): CreateOrderRequest {
  return {
    campaign_id: campaignId,
    tier_id: s.tier.id,
    quantity: s.kolicina,
    buyer_email: s.email.trim(),
    holders: s.tier.imenska ? prilagodiImena(s.imena, s.kolicina).map((n) => ({ full_name: n.trim() })) : [],
  };
}

/** Iznos u centima, cjelobrojno. */
export function iznosCenti(tier: Pick<TierView, "price_cents"> | null | undefined, kolicina: number): number {
  return tier ? tier.price_cents * kolicina : 0;
}

/**
 * `checkout_url` iz odgovora prije `location.assign`: samo apsolutni http(s) URL
 * (Stripe Checkout; u devu mockov http://localhost). Ostalo → null.
 */
export function adresaPlacanja(url: unknown): string | null {
  if (typeof url !== "string" || !url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Napomena ispod naziva u izboru tiera: opis · glasi na ime · stanje (Kupnja-1280). */
export function napomenaTiera(
  t: Pick<TierView, "description" | "imenska" | "sold_out" | "not_started" | "ended" | "available" | "sale_start">,
  timeZone = ZADANA_ZONA,
): string {
  const stanje = stanjeTiera(t);
  const dijelovi: (string | null | undefined)[] = [t.description?.trim(), t.imenska ? "glasi na ime" : null];
  if (stanje === "malo") dijelovi.push(`još ${t.available}`);
  if (stanje === "rasprodano") dijelovi.push("rasprodano");
  if (stanje === "nije-pocelo") {
    const od = kratkiDatum(t.sale_start, timeZone);
    dijelovi.push(od ? `prodaja od ${od}` : "prodaja još nije počela");
  }
  if (stanje === "zavrseno") dijelovi.push("prodaja zatvorena");
  return dijelovi.filter(Boolean).join(" · ");
}

/** TierView[] → opcije za IzborTiera; nekupivi tierovi su onemogućeni. */
export function opcijeTiera(
  tiers: readonly (TierZaKupnju & Parameters<typeof napomenaTiera>[0] & Pick<TierView, "title">)[],
  timeZone = ZADANA_ZONA,
): OpcijaTiera[] {
  return tiers.map((t) => ({
    id: t.id,
    naziv: t.title,
    napomena: napomenaTiera(t, timeZone) || undefined,
    cijenaCenti: t.price_cents,
    dostupno: t.buyable && najvecaKolicina(t) >= 1,
  }));
}

/** „najviše 4 za ovu vrstu” (Kupnja-1280, ispod „Broj ulaznica”). */
export function opisKolicine(max: number): string {
  return `najviše ${max} za ovu vrstu`;
}
