// Formatiranje za prikaz: novac iz centi, datumi u zoni događaja, stanje tiera.
// Zamjenjuje privremene pomoćnike iz S2 (odluka 206). Odluka 301: tekst datuma
// prati kraći oblik iz dizajna (web/design/README.md, pravilo 4), a ne
// terminHr iz src/lib/api.ts.
//
// Intl se koristi samo za pretvorbu vremenske zone; nazivi mjeseci i dana su
// tablice ispod, pa izlaz ne ovisi o ICU podacima runtimea (Node, workerd).
import type { TierView } from "../../../shared/api-tipovi.ts";

export const ZADANA_ZONA = "Europe/Zagreb";

// ── Novac ────────────────────────────────────────────────────────────────────

/** Cijeli centi → „1.234,56 €” (hr-HR). Samo cjelobrojna aritmetika. */
export function eur(centi: number): string {
  const c = Math.trunc(centi);
  const predznak = c < 0 ? "−" : "";
  const abs = Math.abs(c);
  const eura = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const ostatak = (abs % 100).toString().padStart(2, "0");
  return `${predznak}${eura},${ostatak} €`;
}

/** Cijeli centi → „60.00” (schema.org `price`: točka, bez valute i tisućica). */
export function cijenaDecimalno(centi: number): string {
  const c = Math.trunc(centi);
  const abs = Math.abs(c);
  return `${c < 0 ? "-" : ""}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, "0")}`;
}

// ── Datumi ───────────────────────────────────────────────────────────────────

/** Kratice mjeseci na datumskoj pločici (dizajn: STU, VELJ, TRA). Indeks 0 = siječanj. */
export const MJESECI_KRATICE = [
  "SIJ", "VELJ", "OŽU", "TRA", "SVI", "LIP", "SRP", "KOL", "RUJ", "LIS", "STU", "PRO",
] as const;

/** Mjeseci u genitivu („16. travnja”). */
export const MJESECI_GENITIV = [
  "siječnja", "veljače", "ožujka", "travnja", "svibnja", "lipnja",
  "srpnja", "kolovoza", "rujna", "listopada", "studenoga", "prosinca",
] as const;

/** Dani u tjednu; indeks 0 = nedjelja (kao Date#getUTCDay). */
export const DANI = ["nedjelja", "ponedjeljak", "utorak", "srijeda", "četvrtak", "petak", "subota"] as const;

export interface Trenutak {
  godina: number;
  /** 1…12 */
  mjesec: number;
  dan: number;
  sat: number;
  minuta: number;
  /** 0 = nedjelja */
  danUTjednu: number;
}

/** ISO trenutak rastavljen u zadanoj zoni. Neispravan ili prazan ulaz → null. */
export function trenutak(iso: string | null | undefined, timeZone = ZADANA_ZONA): Trenutak | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dijelovi = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);
  const broj = (tip: string) => Number(dijelovi.find((p) => p.type === tip)?.value);
  const godina = broj("year");
  const mjesec = broj("month");
  const dan = broj("day");
  return {
    godina,
    mjesec,
    dan,
    sat: broj("hour") % 24,
    minuta: broj("minute"),
    danUTjednu: new Date(Date.UTC(godina, mjesec - 1, dan)).getUTCDay(),
  };
}

export interface DatumDijelovi {
  dan: number;
  /** 1…12 */
  mjesec: number;
  godina: number;
  mjesecKratica: (typeof MJESECI_KRATICE)[number];
}

/** Dan, mjesec, godina i kratica mjeseca za datumsku pločicu. */
export function datumDijelovi(iso: string | null | undefined, timeZone = ZADANA_ZONA): DatumDijelovi | null {
  const t = trenutak(iso, timeZone);
  if (!t) return null;
  return { dan: t.dan, mjesec: t.mjesec, godina: t.godina, mjesecKratica: MJESECI_KRATICE[t.mjesec - 1] };
}

/**
 * Ponoć po lokalnom vremenu znači „satnica nije objavljena” (isti dogovor kao
 * terminHr u SPA-u: organizator unese samo datum).
 */
export function imaSatnicu(t: Trenutak): boolean {
  return t.sat !== 0 || t.minuta !== 0;
}

const istiDan = (a: Trenutak, b: Trenutak) => a.godina === b.godina && a.mjesec === b.mjesec && a.dan === b.dan;

/** „9:00” */
export const sat = (t: Trenutak) => `${t.sat}:${String(t.minuta).padStart(2, "0")}`;
/** „16. travnja” */
const danMjesec = (t: Trenutak) => `${t.dan}. ${MJESECI_GENITIV[t.mjesec - 1]}`;
/** „16. travnja 2027.” */
const puniDatum = (t: Trenutak) => `${danMjesec(t)} ${t.godina}.`;

/**
 * Raspon dana bez satnice: „12. – 14. veljače 2027.”, „30. travnja – 2. svibnja 2027.”,
 * „31. prosinca 2026. – 2. siječnja 2027.”.
 */
function rasponDana(s: Trenutak, e: Trenutak): string {
  if (s.godina !== e.godina) return `${puniDatum(s)} – ${puniDatum(e)}`;
  if (s.mjesec !== e.mjesec) return `${danMjesec(s)} – ${puniDatum(e)}`;
  return `${s.dan}. – ${puniDatum(e)}`;
}

/**
 * Drugi redak termina (ispod datuma na stranici događaja, i redak termina na
 * kartici popisa, gdje je datum već u zaglavlju grupe):
 *   „9:00”, „19:30 – 22:00”, „9:00 – nedjelja, 18. travnja”,
 *   bez satnice: „satnica još nije objavljena”, a za više dana „do 14. veljače”.
 * Godina kraja piše se samo kad se razlikuje od godine početka.
 */
function satnicaOd(s: Trenutak, e: Trenutak | null): string {
  const visednevni = e !== null && !istiDan(s, e);
  if (!imaSatnicu(s)) {
    if (!visednevni) return "satnica još nije objavljena";
    return `do ${e.godina !== s.godina ? puniDatum(e) : danMjesec(e)}`;
  }
  if (!e) return sat(s);
  if (!visednevni) return `${sat(s)} – ${sat(e)}`;
  const kraj = e.godina !== s.godina ? puniDatum(e) : danMjesec(e);
  return `${sat(s)} – ${DANI[e.danUTjednu]}, ${kraj}`;
}

export const TERMIN_NEPOZNAT = "termin još nije objavljen";

export interface TerminDogadjaja {
  /** „petak, 16. travnja 2027.” */
  datum: string;
  /** „9:00 – nedjelja, 18. travnja” */
  satnica: string;
}

/** Termin na stranici događaja (Dogadjaj-1280): dva retka uz datumsku pločicu. Bez početka → null. */
export function terminDogadjaja(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  timeZone = ZADANA_ZONA,
): TerminDogadjaja | null {
  const s = trenutak(startsAt, timeZone);
  if (!s) return null;
  const e = valjanKraj(s, trenutak(endsAt, timeZone));
  return { datum: `${DANI[s.danUTjednu]}, ${puniDatum(s)}`, satnica: satnicaOd(s, e) };
}

/**
 * Redak termina na kartici popisa (Popis-1280): datum je u zaglavlju grupe, pa
 * kartica nosi satnicu; višednevni događaj bez satnice nosi cijeli raspon.
 */
export function terminKartice(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  timeZone = ZADANA_ZONA,
): string {
  const s = trenutak(startsAt, timeZone);
  if (!s) return TERMIN_NEPOZNAT;
  const e = valjanKraj(s, trenutak(endsAt, timeZone));
  if (!imaSatnicu(s) && e && !istiDan(s, e)) return rasponDana(s, e);
  return satnicaOd(s, e);
}

/** Kraj prije početka (greška u unosu) tretira se kao da kraja nema. */
function valjanKraj(s: Trenutak, e: Trenutak | null): Trenutak | null {
  if (!e) return null;
  const kljuc = (t: Trenutak) => [t.godina, t.mjesec, t.dan, t.sat, t.minuta].map((n) => String(n).padStart(4, "0")).join("");
  return kljuc(e) < kljuc(s) ? null : e;
}

export interface ZaglavljeGrupe {
  /** „2027-02-12”: ključ za grupiranje; „bez-datuma” kad početak nije poznat. */
  kljuc: string;
  /** „12. veljače” */
  datum: string;
  /** „petak” */
  danUTjednu: string;
  /** „2027.”; prazno za tekuću godinu (u zoni događaja). */
  godina?: string;
}

/** Zaglavlje grupe na popisu (GrupaPoDatumu). `sada` je za testove. */
export function zaglavljeGrupe(
  startsAt: string | null | undefined,
  timeZone = ZADANA_ZONA,
  sada: Date = new Date(),
): ZaglavljeGrupe {
  const s = trenutak(startsAt, timeZone);
  if (!s) return { kljuc: "bez-datuma", datum: "Termin uskoro", danUTjednu: "datum još nije objavljen" };
  const tekucaGodina = trenutak(sada.toISOString(), timeZone)?.godina;
  return {
    kljuc: `${s.godina}-${String(s.mjesec).padStart(2, "0")}-${String(s.dan).padStart(2, "0")}`,
    datum: danMjesec(s),
    danUTjednu: DANI[s.danUTjednu],
    godina: s.godina === tekucaGodina ? undefined : `${s.godina}.`,
  };
}

export interface DatumPlohe {
  /** „16.–18.” */
  veliki: string;
  /** „travnja 2027.” */
  mali: string;
}

/** Datum na naslovnoj plohi bez slike (NaslovnaPloha). Bez početka → null. */
export function datumPlohe(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  timeZone = ZADANA_ZONA,
): DatumPlohe | null {
  const s = trenutak(startsAt, timeZone);
  if (!s) return null;
  const e = valjanKraj(s, trenutak(endsAt, timeZone));
  if (!e || istiDan(s, e)) return { veliki: `${s.dan}.`, mali: `${MJESECI_GENITIV[s.mjesec - 1]} ${s.godina}.` };
  if (s.godina !== e.godina) {
    return { veliki: `${s.dan}.–${e.dan}.`, mali: `${MJESECI_GENITIV[s.mjesec - 1]} ${s.godina}. – ${MJESECI_GENITIV[e.mjesec - 1]} ${e.godina}.` };
  }
  if (s.mjesec !== e.mjesec) {
    return { veliki: `${s.dan}.–${e.dan}.`, mali: `${MJESECI_GENITIV[s.mjesec - 1]} – ${MJESECI_GENITIV[e.mjesec - 1]} ${e.godina}.` };
  }
  return { veliki: `${s.dan}.–${e.dan}.`, mali: `${MJESECI_GENITIV[s.mjesec - 1]} ${s.godina}.` };
}

/**
 * Termin u jednom retku (sažetak narudžbe, Narudzba-1280):
 *   „petak, 16. travnja 2027. u 9:00 – nedjelja, 18. travnja”,
 *   bez satnice „petak, 16. travnja 2027.” ili raspon dana „16. – 18. travnja 2027.”.
 */
export function terminJednimRetkom(
  startsAt: string | null | undefined,
  endsAt: string | null | undefined,
  timeZone = ZADANA_ZONA,
): string {
  const s = trenutak(startsAt, timeZone);
  if (!s) return TERMIN_NEPOZNAT;
  const e = valjanKraj(s, trenutak(endsAt, timeZone));
  if (imaSatnicu(s)) return `${DANI[s.danUTjednu]}, ${puniDatum(s)} u ${satnicaOd(s, e)}`;
  if (e && !istiDan(s, e)) return rasponDana(s, e);
  return `${DANI[s.danUTjednu]}, ${puniDatum(s)}`;
}

/**
 * Rok rezervacije (`expires_at`): „15:10” ako ističe danas, inače
 * „20. 11. 2026. u 15:10”. Uvijek sa satom, i u ponoć (rok nije „datum bez
 * satnice”). `sada` je za testove.
 */
export function rokRezervacije(iso: string | null | undefined, timeZone = ZADANA_ZONA, sada: Date = new Date()): string | null {
  const t = trenutak(iso, timeZone);
  if (!t) return null;
  const danas = trenutak(sada.toISOString(), timeZone);
  if (danas && istiDan(t, danas)) return sat(t);
  return `${t.dan}. ${t.mjesec}. ${t.godina}. u ${sat(t)}`;
}

/** Kratki datum s vremenom: „1. 3. 2027. u 10:00”; u ponoć samo „1. 3. 2027.”. */
export function kratkiDatum(iso: string | null | undefined, timeZone = ZADANA_ZONA): string | null {
  const t = trenutak(iso, timeZone);
  if (!t) return null;
  const datum = `${t.dan}. ${t.mjesec}. ${t.godina}.`;
  return imaSatnicu(t) ? `${datum} u ${sat(t)}` : datum;
}

// ── Tierovi ──────────────────────────────────────────────────────────────────

export type StanjeTiera = "dostupno" | "malo" | "rasprodano" | "nije-pocelo" | "zavrseno";

/** Od koliko preostalih ulaznica red dobiva oznaku „još N” (isti prag kao SPA). */
export const PRAG_MALO = 10;

/**
 * TierView → stanje reda u cjeniku (RedTiera). Redoslijed kao oznakaTiera u
 * src/pages/Dogadjaj.tsx (bivši SPA, obrisan u S7): rasprodano ima prednost (rasprodan tier je i
 * „završen” ako mu je prošao `sale_end`, a kupcu je važnije prvo).
 */
export function stanjeTiera(t: Pick<TierView, "sold_out" | "not_started" | "ended" | "available">): StanjeTiera {
  if (t.sold_out) return "rasprodano";
  if (t.not_started) return "nije-pocelo";
  if (t.ended) return "zavrseno";
  if (t.available !== null && t.available <= PRAG_MALO) return "malo";
  return "dostupno";
}

/** Najniža cijena tiera koji se mogu kupiti; nijedan → null („od 35,00 €”). */
export function najnizaCijena(tiers: Pick<TierView, "buyable" | "price_cents">[]): number | null {
  const cijene = tiers.filter((t) => t.buyable).map((t) => t.price_cents);
  return cijene.length ? Math.min(...cijene) : null;
}

// ── Ostalo ───────────────────────────────────────────────────────────────────

/** `event_type` → oznaka („konferencija” → „Konferencija”, odluka 17). */
export function vrstaDogadjaja(eventType: string | null | undefined): string | null {
  const v = eventType?.trim().replace(/[_-]+/g, " ");
  return v ? v.charAt(0).toLocaleUpperCase("hr") + v.slice(1) : null;
}

/**
 * Inicijali organizatora za avatar (ukras): zadnje dvije riječi s velikim
 * početnim slovom, jer pravni oblik ide naprijed („Udruga Prilika za Susret” → „PS”).
 */
export function inicijali(ime: string | null | undefined): string {
  const rijeci = (ime ?? "").split(/\s+/).filter((r) => /^\p{Lu}/u.test(r));
  const izbor = rijeci.length > 2 ? rijeci.slice(-2) : rijeci;
  const slova = izbor.map((r) => r.charAt(0)).join("");
  return slova || (ime ?? "").trim().charAt(0).toLocaleUpperCase("hr") || "?";
}

/** Prihvaća samo http(s) URL; organizator_web bez sheme dobiva https://. Ostalo → null. */
export function sigurniUrl(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  const sShemom = /^[a-z][a-z0-9+.-]*:/i.test(u) ? u : `https://${u.replace(/^\/+/, "")}`;
  try {
    const p = new URL(sShemom);
    return p.protocol === "https:" || p.protocol === "http:" ? p.toString() : null;
  } catch {
    return null;
  }
}

/** URL bez sheme i završne kose crte, za prikaz („prilikazasusret.hr”). */
export function prikazUrla(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}
