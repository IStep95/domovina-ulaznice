// Stranica narudžbe (S5; Narudzba-1280, Narudzba-390, Narudzba-stanja-1280):
// pravila bez Astra i Reacta, da ih node:test provjeri. Ponašanje prati
// src/pages/Narudzba.tsx (SPA): stanja, osvježavanje nakon povratka sa Stripea,
// ishodi ponovne dostave. QR se na webu ne prikazuje (design-brief §4.4, §9).
import type { OrderView, ResendResponse } from "./api.ts";

/** Isti uzorak kao UUID_RE u worker/index.ts; id koji ne prolazi ne šalje se API-ju. */
export const ORDER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function ispravanOrderId(id: string | null | undefined): boolean {
  return typeof id === "string" && ORDER_ID_RE.test(id);
}

/**
 * Nakon povratka sa Stripea (`?placeno=1`) narudžba je često još `pending`:
 * webhook je izvor istine i stiže u sekundi-dvije. Kao SPA: provjera svake 2 s,
 * najviše 10 puta (20 s), zatim „Potvrda još nije stigla” (Narudzba-390).
 */
export const OSVJEZAVANJE_MS = 2000;
export const MAX_OSVJEZAVANJA = 10;

/** `?placeno=1` iz success_url Stripe Checkouta (worker/stripe.ts). */
export function placenoIzUrla(params: URLSearchParams): boolean {
  return params.get("placeno") === "1";
}

/** Čeka li stranica webhook: tada se sama osvježava. Redirect nije dokaz uplate. */
export function cekaPotvrdu(state: string, placeno: boolean): boolean {
  return placeno && state === "pending";
}

export type StanjeZaglavlja = "pending" | "pending-placeno" | "paid" | "expired" | "refunded" | "failed";

const POZNATA: ReadonlySet<string> = new Set(["pending", "paid", "expired", "refunded", "failed"]);

/** `state` (+ `?placeno=1`) → zaglavlje. Nepoznato stanje je `pending`, kao u SPA-u. */
export function stanjeZaglavlja(state: OrderView["state"] | string, placeno: boolean): StanjeZaglavlja {
  if (cekaPotvrdu(state, placeno)) return "pending-placeno";
  return POZNATA.has(state) ? (state as StanjeZaglavlja) : "pending";
}

export type StanjeUlaznice = "vrijedi" | "uslo" | "ponistena";

/** `TicketView.state` → oznaka reda; nepoznato stanje nema oznaku (ne tvrdimo da vrijedi). */
export function stanjeUlaznice(state: string): StanjeUlaznice | null {
  if (state === "issued") return "vrijedi";
  if (state === "checked_in") return "uslo";
  if (state === "void") return "ponistena";
  return null;
}

export interface IshodDostave {
  ton: "ok" | "neutral" | "error";
  tekst: string;
  /** Podebljani nastavak koji se ne smije previdjeti (banner istaknut). */
  istaknuto?: string;
}

/** Odgovor `POST /api/ulaznice/:id/ponovna-dostava` (200) → banner ispod gumba. */
export function ishodDostave(r: ResendResponse): IshodDostave {
  if (r.status === "poslano") {
    const tekst = r.recipient ? `Poslano na ${r.recipient}.` : "Poslano na adresu iz narudžbe.";
    // Rotacija: stari QR (možda već proslijeđen) više ne vrijedi; kupcu se to MORA reći.
    return r.stari_qr_ponisten
      ? { ton: "ok", tekst, istaknuto: "Vrijede QR kodovi iz NOVE poruke — stari više ne rade." }
      : { ton: "ok", tekst };
  }
  if (r.status === "nema_vazecih_ulaznica") {
    return { ton: "neutral", tekst: "Sve ulaznice iz ove narudžbe su već iskorištene ili poništene." };
  }
  return { ton: "error", tekst: "Slanje nije uspjelo. Pokušajte kasnije ili se javite podršci." };
}

/**
 * Link u mobilnu aplikaciju (mobile/): ona zove POST /api/ulaznice/:id/preuzmi
 * i čuva QR u Keychainu/Keystoreu. Vlastita shema radi bez AASA/assetlinks; tko
 * nema aplikaciju, klik ne radi ništa, zato je tekst uz link uvjetan.
 */
export function linkAplikacije(orderId: string): string {
  return `domovina-ulaznice://narudzba/${encodeURIComponent(orderId)}`;
}
