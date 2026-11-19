// Privremeni pomoćnici za prikaz u komponentama iz S2 (dizajnerski sustav).
//
// PRIVREMENO do S3: pravi formateri novca i datuma (s testovima, odluka 4 i
// web/design/README.md pravilo 4) dolaze u S3, koji odlučuje prati li formater
// kraći oblik iz dizajna. Ovdje je samo ono što komponente trebaju da se mogu
// prikazati u /_komponente. Bez Intl-a za novac: cijeli centi, cjelobrojna aritmetika.

/** Cijeli centi → „1.234,56 €” (hr-HR). Samo cjelobrojna aritmetika. */
export function eurPrivremeno(centi: number): string {
  const c = Math.trunc(centi);
  const predznak = c < 0 ? "−" : "";
  const abs = Math.abs(c);
  const eura = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const ostatak = (abs % 100).toString().padStart(2, "0");
  return `${predznak}${eura},${ostatak} €`;
}

/** Kratice mjeseci na datumskoj pločici (dizajn: STU, VELJ, TRA). Indeks 0 = siječanj. */
export const MJESECI_KRATICE = [
  "SIJ", "VELJ", "OŽU", "TRA", "SVI", "LIP", "SRP", "KOL", "RUJ", "LIS", "STU", "PRO",
] as const;

export interface DatumDijelovi {
  dan: number;
  /** 1…12 */
  mjesec: number;
  godina: number;
  mjesecKratica: (typeof MJESECI_KRATICE)[number];
}

/**
 * Dan, mjesec i godina ISO trenutka u zadanoj zoni (događaj ima `timezone`, zadano
 * Europe/Zagreb). Neispravan ulaz → null. Intl samo za pretvorbu zone, ne za tekst.
 */
export function datumDijelovi(iso: string | null | undefined, timeZone = "Europe/Zagreb"): DatumDijelovi | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dijelovi = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(d);
  const broj = (tip: string) => Number(dijelovi.find((p) => p.type === tip)?.value);
  const mjesec = broj("month");
  return { dan: broj("day"), mjesec, godina: broj("year"), mjesecKratica: MJESECI_KRATICE[mjesec - 1] };
}

/** Odbrojavanje u gumbu: 3552 → „59:12”, 3600 → „60:00” (bez sati; prozor 429 je 60 min). */
export function mmss(sekunde: number): string {
  const s = Math.max(0, Math.ceil(sekunde));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
