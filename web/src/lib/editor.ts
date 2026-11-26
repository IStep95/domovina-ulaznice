// Editor događaja (/organizator/novi, wizard iz S8): pretvorbe forme u zahtjev
// za POST /api/organizator/dogadjaj i validacija po koraku. Čiste funkcije,
// testovi u web/test/editor.test.ts.
//
// Prenesen iz src/lib/editor.ts (SPA, rezerva do S9) bez promjene pretvorbi:
// `zahtjev` šalje ISTI payload kao SPA (ugovor s events-organizer se ne mijenja).
// Novo je razbijanje `provjeri` na `validirajKorak(n, unos)` za pet koraka
// wizarda; `provjeri` je unija svih koraka, pa se dvije provjere ne mogu razići.
import { terminKartice, zaglavljeGrupe, type ZaglavljeGrupe } from "./format.ts";

export const ZONA = "Europe/Zagreb";

/** Ponuđene vrste; jezgra traži `^[a-z0-9_]{1,40}$`, stranica kupaca ispisuje s velikim slovom. */
export const VRSTE: ReadonlyArray<[string, string]> = [
  ["koncert", "Koncert"],
  ["konferencija", "Konferencija"],
  ["predstava", "Predstava"],
  ["radionica", "Radionica"],
  ["seminar", "Seminar"],
  ["festival", "Festival"],
  ["sport", "Sport"],
  ["ostalo", "Ostalo"],
];

/** Najviše vrsta ulaznica u jednom događaju (Worker: `invalid_tiers` iznad 50). */
export const NAJVISE_TIEROVA = 50;

/**
 * „25”, „25,5”, „25,50”, „1.250,00” → cijeli centi. Nikad float: dijelovi se
 * čitaju kao znamenke. Neispravan unos → null.
 */
export function centiIzUnosa(unos: string): number | null {
  const s = unos.trim().replace(/\s|€/g, "");
  const m = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const eura = Number(m[1]!.replace(/\./g, ""));
  const centi = Number((m[2] ?? "0").padEnd(2, "0"));
  const ukupno = eura * 100 + centi;
  return Number.isSafeInteger(ukupno) && ukupno <= 999_999_999 ? ukupno : null;
}

/**
 * Zidno vrijeme iz birača („2027-05-10T20:00”) u zoni događaja → ISO u UTC.
 * Ne ovisi o zoni preglednika: organizator iz inozemstva i dalje upisuje sat
 * po Zagrebu.
 */
export function zidnoVrijemeUUtc(vrijednost: string, zona = ZONA): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(vrijednost);
  if (!m) return null;
  const [g, mj, d, h, min] = m.slice(1).map(Number) as [number, number, number, number, number];
  const kaoUtc = Date.UTC(g, mj - 1, d, h, min);
  // pomak zone u tom trenutku; dvaput, da prelazak na ljetno računanje sjedne
  let t = kaoUtc - pomak(kaoUtc, zona);
  t = kaoUtc - pomak(t, zona);
  return new Date(t).toISOString();
}

function pomak(t: number, zona: string): number {
  const dijelovi = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zona,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(t))
      .map((p) => [p.type, p.value]),
  );
  const lokalno = Date.UTC(+dijelovi.year!, +dijelovi.month! - 1, +dijelovi.day!, +dijelovi.hour!, +dijelovi.minute!);
  return lokalno - Math.floor(t / 60_000) * 60_000;
}

export interface UnosTiera {
  naziv: string;
  cijena: string;
  kolicina: string;
  imenska: boolean;
  /** Postojeća vrsta u jezgri (uređivanje skice); nova vrsta ga nema. */
  id?: string;
}

/** Najviše slika u galeriji (jezgra: check `events_gallery_shape`); naslovna nije među njima. */
export const NAJVISE_U_GALERIJI = 20;

export interface UnosDogadjaja {
  accountId: string;
  naslov: string;
  vrsta: string;
  pocetak: string;
  kraj: string;
  mjesto: string;
  adresa: string;
  grad: string;
  opis: string;
  slika: string;
  /** Linkovi slika galerije, redom prikaza (bez alt teksta, Ivan 24. 11.). */
  galerija: string[];
  /** Online (virtualni) događaj: mjesto i grad nisu obavezni, link vide samo vlasnici ulaznica. */
  online: boolean;
  /** Link za pristup online događaju (jezgra `event_access`); neobavezan dok ga organizator nema. */
  onlineLink: string;
  /** Besplatan događaj: sve vrste ulaznica idu po 0 €, bez Stripea. */
  besplatan: boolean;
  /**
   * Link na javni Google obrazac čija se pitanja (spol, godište…) prikažu u
   * kupnji kao „Dodatna polja”; odgovori idu u taj obrazac. Prazno = bez njih.
   */
  obrazac: string;
  organizator: string;
  email: string;
  web: string;
  tieri: UnosTiera[];
}

export const prazanTier = (): UnosTiera => ({ naziv: "", cijena: "", kolicina: "", imenska: false });

export const prazanUnos = (): UnosDogadjaja => ({
  accountId: "",
  naslov: "",
  vrsta: "koncert",
  pocetak: "",
  kraj: "",
  mjesto: "",
  adresa: "",
  grad: "",
  opis: "",
  slika: "",
  galerija: [],
  online: false,
  onlineLink: "",
  besplatan: false,
  obrazac: "",
  organizator: "",
  email: "",
  web: "",
  tieri: [prazanTier()],
});

/** Greške po polju (ključ = ime polja ili `tier.<i>.<polje>`), poruke na hrvatskom. */
export type Greske = Record<string, string>;

// ── Koraci wizarda ───────────────────────────────────────────────────────────

export type Korak = 1 | 2 | 3 | 4 | 5;
export const BROJ_KORAKA = 5;

export interface OpisKoraka {
  broj: Korak;
  naziv: string;
  /** Kratki opis ispod naziva u stepperu. */
  opis: string;
}

/** Pet koraka iz ui-feedback.md (stavka 4). Kontakt je u pregledu jer je neobavezan. */
export const KORACI: ReadonlyArray<OpisKoraka> = [
  { broj: 1, naziv: "Osnovno", opis: "naziv i vrsta" },
  { broj: 2, naziv: "Kada i gdje", opis: "termin i mjesto" },
  { broj: 3, naziv: "Opis i slika", opis: "neobavezno" },
  { broj: 4, naziv: "Ulaznice", opis: "cijene i količine" },
  { broj: 5, naziv: "Pregled", opis: "kontakt i spremanje" },
];

export const jeKorak = (n: number): n is Korak => Number.isInteger(n) && n >= 1 && n <= BROJ_KORAKA;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HTTPS = /^https:\/\/\S+$/i;
/** Javni Google obrazac: docs.google.com/forms/…/d/e/… ili forms.gle/… (pravu provjeru radi Worker). */
const GOOGLE_OBRAZAC = /^https:\/\/(docs\.google\.com\/forms\/(u\/\d+\/)?d\/e\/[\w-]+|forms\.gle\/\w+)/i;

/** Greške jednog koraka. Koraci 3 i 5 su prazni valjani (sve neobavezno). */
export function validirajKorak(n: Korak, u: UnosDogadjaja): Greske {
  const g: Greske = {};
  switch (n) {
    case 1:
      if (!u.accountId) g.accountId = "Odaberi organizatora.";
      if (!u.naslov.trim()) g.naslov = "Upiši naziv događaja.";
      else if (u.naslov.trim().length > 160) g.naslov = "Naziv je predug (najviše 160 znakova).";
      if (!VRSTE.some(([v]) => v === u.vrsta)) g.vrsta = "Odaberi vrstu događaja.";
      break;
    case 2:
      if (!u.pocetak) g.pocetak = "Upiši početak.";
      else if (!zidnoVrijemeUUtc(u.pocetak)) g.pocetak = "Neispravan datum.";
      if (u.kraj && !zidnoVrijemeUUtc(u.kraj)) g.kraj = "Neispravan datum.";
      else if (u.kraj && u.pocetak && u.kraj <= u.pocetak) g.kraj = "Kraj mora biti nakon početka.";
      if (u.online) {
        const link = u.onlineLink.trim();
        if (link && !HTTPS.test(link)) g.onlineLink = "Link mora počinjati s https://.";
        else if (link.length > 1000) g.onlineLink = "Link je predug (najviše 1000 znakova).";
      } else {
        if (!u.mjesto.trim()) g.mjesto = "Upiši mjesto (npr. dvoranu).";
        if (!u.grad.trim()) g.grad = "Upiši grad.";
      }
      if (u.mjesto.trim().length > 160) g.mjesto = "Naziv mjesta je predug (najviše 160 znakova).";
      if (u.grad.trim().length > 80) g.grad = "Naziv grada je predug (najviše 80 znakova).";
      break;
    case 3:
      if (u.slika.trim() && !HTTPS.test(u.slika.trim())) g.slika = "Link slike mora počinjati s https://.";
      if (u.galerija.length > NAJVISE_U_GALERIJI) g.galerija = `Najviše ${NAJVISE_U_GALERIJI} slika u galeriji.`;
      u.galerija.forEach((url, i) => {
        if (!HTTPS.test(url.trim())) g[`galerija.${i}`] = "Link slike mora počinjati s https://.";
      });
      break;
    case 4:
      if (u.tieri.length === 0) g.tieri = "Dodaj barem jednu vrstu ulaznice.";
      else if (u.tieri.length > NAJVISE_TIEROVA) g.tieri = `Najviše ${NAJVISE_TIEROVA} vrsta ulaznica.`;
      u.tieri.forEach((t, i) => {
        if (!t.naziv.trim()) g[`tier.${i}.naziv`] = "Upiši naziv ulaznice.";
        if (!u.besplatan) {
          const centi = centiIzUnosa(t.cijena);
          if (centi === null) g[`tier.${i}.cijena`] = "Upiši cijenu, npr. 25 ili 25,50.";
          else if (centi === 0) g[`tier.${i}.cijena`] = "Cijena mora biti veća od 0. Za besplatan događaj odaberi „Besplatan”.";
        }
        if (t.kolicina.trim() && !/^\d{1,7}$/.test(t.kolicina.trim())) g[`tier.${i}.kolicina`] = "Količina je cijeli broj.";
      });
      if (u.obrazac.trim()) {
        if (u.obrazac.trim().length > 500) g.obrazac = "Link je predug.";
        else if (!GOOGLE_OBRAZAC.test(u.obrazac.trim())) {
          g.obrazac = "Zalijepi link za ispunjavanje obrasca (docs.google.com/forms/d/e/… ili forms.gle/…), ne link za uređivanje.";
        }
      }
      break;
    case 5:
      if (u.email.trim() && !EMAIL.test(u.email.trim())) g.email = "Neispravna e-mail adresa.";
      break;
  }
  return g;
}

/** Cijeli unos: unija svih koraka (isti ključevi kao validirajKorak). */
export function provjeri(u: UnosDogadjaja): Greske {
  return Object.assign({}, ...KORACI.map((k) => validirajKorak(k.broj, u))) as Greske;
}

/** Prvi korak s greškom; null kad je sve valjano. */
export function prviNevaljaniKorak(u: UnosDogadjaja): Korak | null {
  return KORACI.find((k) => Object.keys(validirajKorak(k.broj, u)).length > 0)?.broj ?? null;
}

/** Najdalji korak na koji se smije otići: ne preko prvog nevaljanog (ni URL-om ni stepperom). */
export function najdaljiDopusteni(u: UnosDogadjaja): Korak {
  return prviNevaljaniKorak(u) ?? 5;
}

/** Korak kojem pripada ključ greške (`tier.2.cijena` → 4). */
export function korakPolja(kljuc: string): Korak {
  const polje = kljuc.split(".")[0]!;
  if (polje === "tier" || polje === "tieri" || polje === "obrazac") return 4;
  if (["pocetak", "kraj", "mjesto", "adresa", "grad", "onlineLink"].includes(polje)) return 2;
  if (["opis", "slika", "galerija"].includes(polje)) return 3;
  if (["organizator", "email", "web"].includes(polje)) return 5;
  return 1;
}

/**
 * Korak na koji vodi greška jezgre nakon „Spremi kao skicu” (kodovi iz
 * PORUKE_ORGANIZATORA, events-organizer). Nepoznat kod → null (ostaje pregled).
 */
export function korakZaKod(kod: string): Korak | null {
  if (["invalid_title", "slug_collision", "invalid_account_id", "invalid_event_type"].includes(kod)) return 1;
  if (
    ["invalid_venue_name", "invalid_venue_city", "invalid_dates", "invalid_attendance_mode", "invalid_online_url"]
      .includes(kod)
  ) return 2;
  if (["invalid_cover_url", "invalid_description", "invalid_gallery", "invalid_gallery_url"].includes(kod)) return 3;
  if (kod === "invalid_tiers" || kod.startsWith("invalid_tier_") || kod.startsWith("obrazac_")) return 4;
  return null;
}

/** Tijelo za POST /api/organizator/dogadjaj. Zove se tek kad `provjeri` nema grešaka. */
export function zahtjev(u: UnosDogadjaja, eventId: string): Record<string, unknown> {
  const prazno = (s: string) => s.trim() || null;
  return {
    event_id: eventId,
    account_id: u.accountId,
    title: u.naslov.trim(),
    event_type: u.vrsta,
    starts_at: zidnoVrijemeUUtc(u.pocetak),
    ends_at: u.kraj ? zidnoVrijemeUUtc(u.kraj) : null,
    timezone: ZONA,
    // online bez mjesta: jezgra (events-organizer) upiše „Online”
    venue_name: u.mjesto.trim(),
    venue_address: prazno(u.adresa),
    venue_city: u.grad.trim(),
    attendance_mode: u.online ? "online" : "physical",
    online_url: u.online ? prazno(u.onlineLink) : null,
    description_hr: prazno(u.opis),
    cover_image_url: prazno(u.slika),
    gallery: u.galerija.map((url) => ({ url: url.trim() })),
    organizer_name: prazno(u.organizator),
    organizer_email: prazno(u.email),
    organizer_web: prazno(u.web),
    ...(u.obrazac.trim() ? { form_url: u.obrazac.trim() } : {}),
    tiers: u.tieri.map((t) => ({
      title: t.naziv.trim(),
      price_cents: u.besplatan ? 0 : centiIzUnosa(t.cijena),
      inventory_total: t.kolicina.trim() ? Number(t.kolicina.trim()) : null,
      imenska: t.imenska,
    })),
  };
}

// ── Uređivanje skice ─────────────────────────────────────────────────────────

/** Skica kako je vraća `GET /api/organizator/dogadjaj/:id` (Worker, PostgREST embed). */
export interface Skica {
  campaign_id: string;
  account_id: string;
  slug: string;
  title: string;
  state: string;
  event: {
    event_type?: string | null;
    venue_name?: string | null;
    venue_address?: string | null;
    venue_city?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    timezone?: string | null;
    description_hr?: string | null;
    cover_image_url?: string | null;
    gallery?: Array<{ url?: unknown }> | null;
    attendance_mode?: string | null;
    /** Iz `event_access` (Worker ga spljošti u event). */
    online_url?: string | null;
    /** Google obrazac dodatnih polja (Worker, D1 `event_forms`). */
    form_url?: string | null;
    organizer_name?: string | null;
    organizer_email?: string | null;
    organizer_web?: string | null;
  } | null;
  tiers: Array<{ id: string; title: string; price_cents: number; inventory_total: number | null; imenska: boolean }>;
}

/** ISO trenutak → zidno vrijeme za birač („2027-05-10T20:00”) u zoni događaja; obrat `zidnoVrijemeUUtc`. */
export function utcUZidnoVrijeme(iso: string | null | undefined, zona = ZONA): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  const d = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zona,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
      .formatToParts(new Date(t))
      .map((p) => [p.type, p.value]),
  );
  return `${d.year}-${d.month}-${d.day}T${d.hour}:${d.minute}`;
}

/** Cijeli centi → unos cijene kakav organizator piše (2550 → „25,50”, 1500 → „15”); obrat `centiIzUnosa`. */
export function unosIzCenti(centi: number): string {
  if (!Number.isSafeInteger(centi) || centi < 0) return "";
  const eura = Math.floor(centi / 100);
  const ostatak = centi % 100;
  return ostatak ? `${eura},${String(ostatak).padStart(2, "0")}` : String(eura);
}

/** Skica iz jezgre → unos forme; vrste nose svoj `id`, pa ih izmjena mijenja umjesto da doda nove. */
export function unosIzSkice(s: Skica): UnosDogadjaja {
  const e = s.event ?? {};
  const zona = e.timezone || ZONA;
  const tekst = (x: string | null | undefined) => x ?? "";
  const online = e.attendance_mode === "online";
  // „Online” je zamjena jezgre za mjesto koje online događaj nema; u formi je prazno
  const bezZamjene = (x: string | null | undefined) => (online && x === "Online" ? "" : tekst(x));
  const besplatan = s.tiers.length > 0 && s.tiers.every((t) => t.price_cents === 0);
  return {
    accountId: s.account_id,
    naslov: s.title,
    vrsta: e.event_type || "ostalo",
    pocetak: utcUZidnoVrijeme(e.starts_at, zona),
    kraj: utcUZidnoVrijeme(e.ends_at, zona),
    mjesto: bezZamjene(e.venue_name),
    adresa: tekst(e.venue_address),
    grad: bezZamjene(e.venue_city),
    opis: tekst(e.description_hr),
    slika: tekst(e.cover_image_url),
    galerija: (Array.isArray(e.gallery) ? e.gallery : [])
      .map((g) => (typeof g?.url === "string" ? g.url : ""))
      .filter(Boolean),
    online,
    onlineLink: tekst(e.online_url),
    besplatan,
    obrazac: tekst(e.form_url),
    organizator: e.organizer_name && e.organizer_name !== s.title ? e.organizer_name : "",
    email: tekst(e.organizer_email),
    web: tekst(e.organizer_web),
    tieri: s.tiers.length
      ? s.tiers.map((t) => ({
          id: t.id,
          naziv: t.title,
          cijena: besplatan ? "" : unosIzCenti(t.price_cents),
          kolicina: t.inventory_total === null ? "" : String(t.inventory_total),
          imenska: t.imenska,
        }))
      : [prazanTier()],
  };
}

/**
 * Tijelo za PUT /api/organizator/dogadjaj/:id (`update_event`). Razlike od
 * `zahtjev`: u izmjeni `null` znači „ne diraj”, pa se ispražnjeno neobavezno
 * polje šalje kao "" (jezgra ga briše); vrste nose `id` i `sort`, a maknute
 * idu u `remove_tier_ids`. Kraj događaja i ime organizatora jezgra ne zna
 * obrisati (`coalesce`), pa prazno polje tamo ostavlja staru vrijednost.
 */
export function zahtjevIzmjene(u: UnosDogadjaja, izvorniTierIds: readonly string[]): Record<string, unknown> {
  const { event_id: _e, account_id: _a, tiers, ...z } = zahtjev(u, "");
  const ostaju = new Set(u.tieri.map((t) => t.id).filter(Boolean));
  return {
    ...z,
    venue_address: u.adresa.trim(),
    description_hr: u.opis.trim(),
    cover_image_url: u.slika.trim(),
    organizer_email: u.email.trim(),
    organizer_web: u.web.trim(),
    online_url: u.online ? u.onlineLink.trim() : "",
    // prazno = makni obrazac (Worker briše link iz event_forms)
    form_url: u.obrazac.trim(),
    tiers: (tiers as Array<Record<string, unknown>>).map((t, i) => ({
      ...(u.tieri[i]!.id ? { id: u.tieri[i]!.id } : {}),
      ...t,
      sort: i,
    })),
    remove_tier_ids: izvorniTierIds.filter((id) => !ostaju.has(id)),
  };
}

// ── Živi pregled kartice ─────────────────────────────────────────────────────

export interface PodaciPregleda {
  /** Upisani naziv ili zamjenski tekst (tada je `bezNaslova`). */
  naslov: string;
  bezNaslova: boolean;
  /** ISO početak (UTC) ili null dok nije upisan. */
  startsAt: string | null;
  /** Redak termina na kartici („20:00 – 22:30”). */
  termin: string;
  /** Datum iznad kartice, kao na popisu događaja. */
  zaglavlje: ZaglavljeGrupe;
  /** „Dom sportova, Zagreb”; online događaj „Online” */
  mjesto: string | null;
  vrsta: string | null;
  organizator: string | null;
  /** Najniža valjana cijena u centima; nijedna → null. */
  cijenaOdCenti: number | null;
  /** Samo https link (isto pravilo kao validacija koraka 3). */
  slika: string | null;
}

/**
 * Podaci za živi pregled kartice događaja (desni stupac, korak 5 na mobitelu).
 * Organizator bez imena je naziv događaja: tako ga sprema i jezgra
 * (`create_event`: coalesce(organizer_name, title)).
 */
export function podaciPregleda(u: UnosDogadjaja, sada: Date = new Date()): PodaciPregleda {
  const startsAt = zidnoVrijemeUUtc(u.pocetak);
  const endsAt = u.kraj ? zidnoVrijemeUUtc(u.kraj) : null;
  const cijene = u.tieri.map((t) => centiIzUnosa(t.cijena)).filter((c): c is number => c !== null);
  const slika = u.slika.trim();
  return {
    naslov: u.naslov.trim() || "Naziv događaja",
    bezNaslova: !u.naslov.trim(),
    startsAt,
    termin: terminKartice(startsAt, endsAt, ZONA),
    zaglavlje: zaglavljeGrupe(startsAt, ZONA, sada),
    mjesto: u.online ? "Online" : [u.mjesto.trim(), u.grad.trim()].filter(Boolean).join(", ") || null,
    vrsta: VRSTE.find(([v]) => v === u.vrsta)?.[1] ?? null,
    organizator: u.organizator.trim() || u.naslov.trim() || null,
    cijenaOdCenti: u.besplatan ? 0 : cijene.length ? Math.min(...cijene) : null,
    slika: HTTPS.test(slika) ? slika : null,
  };
}
