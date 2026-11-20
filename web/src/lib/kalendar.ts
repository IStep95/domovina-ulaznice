// „Dodaj u kalendar” (odluka 20): link na Google Calendar i .ics datoteka
// (RFC 5545) koju servira /dogadjaj/[slug].ics.
//
// Vremena idu u UTC (`…Z`), pa .ics ne treba VTIMEZONE blok, a kalendar ih
// sam prikaže u zoni korisnika. Događaj bez satnice (ponoć u zoni događaja,
// v. imaSatnicu) je cjelodnevni: DATE bez vremena, kraj isključiv (+1 dan).
// Bez `ends_at` kraj je početak + 2 h; bez `starts_at` kalendara nema.
import { imaSatnicu, trenutak, type Trenutak } from "./format.ts";

const DVA_SATA_MS = 2 * 60 * 60 * 1000;

export interface PodaciKalendara {
  uid: string;
  naslov: string;
  startsAt: string | null | undefined;
  endsAt: string | null | undefined;
  timeZone: string;
  mjesto?: string | null;
  opis?: string | null;
  /** Apsolutni URL stranice događaja. */
  url?: string | null;
}

type Raspon =
  | { cjelodnevni: false; od: Date; do: Date }
  | { cjelodnevni: true; od: string; do: string };

const datumBezCrtica = (t: Trenutak) =>
  `${t.godina}${String(t.mjesec).padStart(2, "0")}${String(t.dan).padStart(2, "0")}`;

/** Datum (YYYYMMDD) + n dana, kalendarski, bez zone. */
function plusDana(t: Trenutak, n: number): string {
  const d = new Date(Date.UTC(t.godina, t.mjesec - 1, t.dan + n));
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

/** 20270416T070000Z */
export function utcOznaka(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function rasponKalendara(p: Pick<PodaciKalendara, "startsAt" | "endsAt" | "timeZone">): Raspon | null {
  const s = trenutak(p.startsAt, p.timeZone);
  if (!s || !p.startsAt) return null;
  const od = new Date(p.startsAt);
  const doRaw = p.endsAt ? new Date(p.endsAt) : null;
  const kraj = doRaw && !Number.isNaN(doRaw.getTime()) && doRaw > od ? doRaw : null;
  if (!imaSatnicu(s)) {
    const e = kraj ? trenutak(kraj.toISOString(), p.timeZone) : null;
    return { cjelodnevni: true, od: datumBezCrtica(s), do: plusDana(e ?? s, 1) };
  }
  return { cjelodnevni: false, od, do: kraj ?? new Date(od.getTime() + DVA_SATA_MS) };
}

/** Link „Dodaj u Google kalendar”; bez početka → null. */
export function googleKalendarUrl(p: PodaciKalendara): string | null {
  const r = rasponKalendara(p);
  if (!r) return null;
  const u = new URL("https://calendar.google.com/calendar/render");
  u.searchParams.set("action", "TEMPLATE");
  u.searchParams.set("text", p.naslov);
  u.searchParams.set("dates", r.cjelodnevni ? `${r.od}/${r.do}` : `${utcOznaka(r.od)}/${utcOznaka(r.do)}`);
  u.searchParams.set("ctz", p.timeZone);
  const detalji = [p.opis?.trim(), p.url].filter(Boolean).join("\n\n");
  if (detalji) u.searchParams.set("details", detalji);
  if (p.mjesto?.trim()) u.searchParams.set("location", p.mjesto.trim());
  return u.toString();
}

/** TEXT vrijednost po RFC 5545 §3.3.11. */
export function icsTekst(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** Preklapanje redaka na 75 okteta (RFC 5545 §3.1), bez rezanja UTF-8 znaka. */
export function icsPreklopi(redak: string): string {
  const enc = new TextEncoder();
  const dijelovi: string[] = [];
  let trenutni = "";
  let duljina = 0;
  for (const znak of redak) {
    const n = enc.encode(znak).length;
    const granica = dijelovi.length === 0 ? 75 : 74; // nastavak počinje razmakom
    if (duljina + n > granica) {
      dijelovi.push(trenutni);
      trenutni = "";
      duljina = 0;
    }
    trenutni += znak;
    duljina += n;
  }
  dijelovi.push(trenutni);
  return dijelovi.join("\r\n ");
}

/** Cijela .ics datoteka; bez početka → null. `sada` = DTSTAMP (za testove). */
export function ics(p: PodaciKalendara, sada: Date = new Date()): string | null {
  const r = rasponKalendara(p);
  if (!r) return null;
  const redovi = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Domovina//Ulaznice//HR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${p.uid}`,
    `DTSTAMP:${utcOznaka(sada)}`,
    ...(r.cjelodnevni
      ? [`DTSTART;VALUE=DATE:${r.od}`, `DTEND;VALUE=DATE:${r.do}`]
      : [`DTSTART:${utcOznaka(r.od)}`, `DTEND:${utcOznaka(r.do)}`]),
    `SUMMARY:${icsTekst(p.naslov)}`,
    ...(p.mjesto?.trim() ? [`LOCATION:${icsTekst(p.mjesto.trim())}`] : []),
    ...(p.opis?.trim() || p.url ? [`DESCRIPTION:${icsTekst([p.opis?.trim(), p.url].filter(Boolean).join("\n\n"))}`] : []),
    ...(p.url ? [`URL:${p.url}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return redovi.map(icsPreklopi).join("\r\n") + "\r\n";
}
