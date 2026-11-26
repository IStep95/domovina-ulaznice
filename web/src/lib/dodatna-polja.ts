// Dodatna polja kupnje (2026-11-26): pitanja iz organizatorova Google obrasca.
// Pravila su ista kao `provjeriOdgovore` u worker/dodatna-polja.ts — kupac
// grešku vidi prije slanja, a Worker i dalje presuđuje.
import type { DodatnoPolje, OdgovoriDodatnihPolja } from "../../../shared/api-tipovi.ts";

export type { DodatnoPolje, OdgovoriDodatnihPolja };

/** = ODGOVOR_MAX u worker/dodatna-polja.ts. */
export const ODGOVOR_MAX = 2000;

/** Greška polja ili null. Prazno neobavezno polje je u redu. */
export function provjeriDodatnoPolje(p: DodatnoPolje, v: string | string[] | undefined): string | null {
  if (p.vrsta === "visestruki") {
    const niz = Array.isArray(v) ? v : [];
    return p.obavezno && niz.length === 0 ? "Odaberite barem jedan odgovor." : null;
  }
  const s = typeof v === "string" ? v.trim() : "";
  if (!s) {
    if (!p.obavezno) return null;
    return p.opcije ? "Odaberite odgovor." : "Ovo polje je obavezno.";
  }
  if (s.length > ODGOVOR_MAX) return `Najviše ${ODGOVOR_MAX} znakova.`;
  return null;
}

/** Greške po id-u polja (samo neispravna) i jesu li sva obavezna popunjena. */
export function provjeriDodatnaPolja(
  polja: readonly DodatnoPolje[],
  odgovori: OdgovoriDodatnihPolja,
): { greske: Record<string, string>; valjano: boolean } {
  const greske: Record<string, string> = {};
  for (const p of polja) {
    const g = provjeriDodatnoPolje(p, odgovori[p.id]);
    if (g) greske[p.id] = g;
  }
  return { greske, valjano: Object.keys(greske).length === 0 };
}

/** Odgovori za `POST /api/narudzba`: bez praznih, tekst trimiran. */
export function ocisceniOdgovori(polja: readonly DodatnoPolje[], odgovori: OdgovoriDodatnihPolja): OdgovoriDodatnihPolja {
  const out: OdgovoriDodatnihPolja = {};
  for (const p of polja) {
    const v = odgovori[p.id];
    if (Array.isArray(v)) {
      if (v.length) out[p.id] = [...v];
    } else if (typeof v === "string" && v.trim()) {
      out[p.id] = v.trim();
    }
  }
  return out;
}
