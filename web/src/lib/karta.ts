// Mjesto događaja: koordinate i linkovi na Google/Apple Maps (odluka 14).
//
// `venue_lat`/`venue_lon` su iz S2b (migracija `events_venue_geo` u jezgri). Dok je
// jezgra nema, API ih ne vraća, pa su opcionalni. PostgREST `numeric` šalje kao JSON
// broj; numerički string se svejedno prihvaća. Bez valjanog para nema linkova, ostaje
// samo adresa. Ugrađene karte nema
// (odluka 300): pločice bi se dohvaćale s tuđeg poslužitelja.
import type { EventDetails } from "../../../shared/api-tipovi.ts";

export interface Koordinate {
  lat: number;
  lon: number;
}

const broj = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};

/** Oba ili nijedno, u rasponu (isto ograničenje kao u bazi). */
export function koordinate(d: { venue_lat?: unknown; venue_lon?: unknown } | null | undefined): Koordinate | null {
  const lat = broj(d?.venue_lat);
  const lon = broj(d?.venue_lon);
  if (lat === null || lon === null) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** „Trg Krešimira Ćosića 11, Zagreb” (adresa i grad, bez naziva mjesta). */
export function adresa(d: Pick<EventDetails, "venue_address" | "venue_city"> | null | undefined): string {
  return [d?.venue_address, d?.venue_city].map((s) => s?.trim()).filter(Boolean).join(", ");
}

/** „Dom sportova, Trg Krešimira Ćosića 11, Zagreb” (za kalendar i JSON-LD). */
export function punoMjesto(d: Pick<EventDetails, "venue_name" | "venue_address" | "venue_city"> | null | undefined): string {
  return [d?.venue_name?.trim(), adresa(d)].filter(Boolean).join(", ");
}

export interface LinkoviKarte {
  google: string;
  apple: string;
}

export function linkoviKarte(k: Koordinate, naziv?: string | null): LinkoviKarte {
  const ll = `${k.lat},${k.lon}`;
  const google = new URL("https://www.google.com/maps/search/");
  google.searchParams.set("api", "1");
  google.searchParams.set("query", ll);
  const apple = new URL("https://maps.apple.com/");
  apple.searchParams.set("ll", ll);
  if (naziv?.trim()) apple.searchParams.set("q", naziv.trim());
  return { google: google.toString(), apple: apple.toString() };
}
