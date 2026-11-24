// Pregled prodaje i skener (S8): čisti dijelovi otoka PregledProdaje.tsx i
// Skener.tsx, bez Reacta, da ih node:test provjeri. Logika je iz
// src/pages/Organizator.tsx i src/pages/Skener.tsx (SPA, rezerva do S9).
import type { OrgEvent } from "./auth.ts";
import { ZADANA_ZONA, trenutak } from "./format.ts";

// ── pregled prodaje ──────────────────────────────────────────────────────────

export interface ZbrojDogadjaja {
  /** Zbroj `inventory_claimed` po tierovima: plaćene I rezervirane (pending) ulaznice. */
  zauzeto: number;
  /** Cijeli centi: zauzeto × cijena po tieru (optimistično, kao `zauzeto`). */
  prihod: number;
  /** Ima li imenskih tierova; samo tada postoji popis sudionika za izvoz. */
  imenskih: boolean;
}

/**
 * ⚠️ REVIEW(fable), preneseno iz SPA-e: „zauzeto” uključuje i rezervirane
 * narudžbe, ne samo plaćene; 20 min nakon isteka rezervacije broj padne. Zato
 * se u sučelju zove „zauzeto”, ne „prodano”.
 */
export function zbrojDogadjaja(d: Pick<OrgEvent, "tiers">): ZbrojDogadjaja {
  let zauzeto = 0;
  let prihod = 0;
  for (const t of d.tiers) {
    zauzeto += t.inventory_claimed;
    prihod += t.inventory_claimed * t.price_cents;
  }
  return { zauzeto, prihod, imenskih: d.tiers.some((t) => t.imenska) };
}

/** Stanje kampanje → tekst i ton oznake. Nepoznato stanje se prikazuje kako je stiglo. */
export function stanjeDogadjaja(state: string): { tekst: string; ton: "ok" | "neutral" | "wait" } {
  if (state === "active") return { tekst: "objavljen", ton: "ok" };
  if (state === "draft") return { tekst: "skica", ton: "wait" };
  return { tekst: state, ton: "neutral" };
}

/**
 * Ime datoteke izvoza: `sudionici-<slug>.csv`, bez sluga prvih 8 znakova
 * `campaign_id` (kao Workerov `content-disposition`). Slug je već URL-siguran;
 * sve ostalo se svodi na crticu da ime ne razbije preuzimanje.
 */
export function imeCsvDatoteke(d: Pick<OrgEvent, "slug" | "campaign_id">): string {
  const osnova = (d.slug || d.campaign_id.slice(0, 8)).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return `sudionici-${osnova || "dogadjaj"}.csv`;
}

/** „16. 4. 2027.” u zoni događaja, za redak ispod naslova; bez početka prazno. */
export function datumDogadjaja(d: Pick<OrgEvent, "event">): string {
  const t = trenutak(d.event?.starts_at, d.event?.timezone || ZADANA_ZONA);
  return t ? `${t.dan}. ${t.mjesec}. ${t.godina}.` : "";
}

// ── skener ───────────────────────────────────────────────────────────────────

/** Prefiks QR-a ulaznice (isti kao `QR_PREFIX` u worker/index.ts). */
export const QR_PREFIX = "dgdj1:";
const TOKEN_RE = /^[0-9a-f]{64}$/;

/**
 * Pročitani QR ili ručni unos → token od 64 heksa znaka, ili null kad to nije
 * ulaznica ovog sustava (tada se ne šalje na mrežu). Prefiks `dgdj1:` nije
 * obavezan; velika slova i razmaci se praštaju.
 */
export function tokenIzQr(sirovo: string): string | null {
  const s = sirovo.trim();
  const token = (s.startsWith(QR_PREFIX) ? s.slice(QR_PREFIX.length) : s).trim().toLowerCase();
  return TOKEN_RE.test(token) ? token : null;
}

/** Isti kod pred kamerom ne šalje se ponovno unutar ovog razmaka (ms). */
export const PONOVNI_SKEN_MS = 3000;

/** Je li ovo ponovljeno čitanje istog koda (kamera ga vidi svakih 150 ms)? */
export function ponovljenoCitanje(zadnji: { token: string; kad: number }, token: string, sada: number): boolean {
  return zadnji.token === token && sada - zadnji.kad < PONOVNI_SKEN_MS;
}

/** „16. 4. u 19:42” u zoni Zagreba, za „prvi ulazak”; neispravno → prazno. */
export function vrijemeUlaska(iso: string | null | undefined, timeZone = ZADANA_ZONA): string {
  const t = trenutak(iso, timeZone);
  return t ? `${t.dan}. ${t.mjesec}. u ${t.sat}:${String(t.minuta).padStart(2, "0")}` : "";
}
