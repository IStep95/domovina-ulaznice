// Naglasna boja događaja (web/design/README.md, „Pravila koja kod mora provesti” 1).
//
// `brand.accent_color` organizatora postaje --color-accent na stranicama događaja,
// kupnje i narudžbe. Iz nje se izvode:
// - --color-on-accent: crna (--color-ink) ili bijela, ona s većim WCAG kontrastom
//   (ista formula kao `renderVals()` u web/design/canvas/Dogadjaj-1280.dc.html);
// - --color-accent-text: naglasna boja kao tekst na podlozi; ako nema ≥ 4,5:1,
//   potamni se (HSL svjetlina, nijansa i zasićenje ostaju) dok ne prođe.
//
// Čiste funkcije bez DOM-a: rade u SSR-u na Workersu, u pregledniku i u node:testu.

/** Zadana naglasna boja (web/src/styles/tokens.css). */
export const ZADANI_NAGLASAK = "#2f855a";
/** Tekst na svijetlom naglasku = --color-ink. */
export const TAMNI_TEKST = "#131714";
export const SVIJETLI_TEKST = "#ffffff";
/**
 * --color-bg: najtamnija svijetla podloga na kojoj naglasak može biti tekst (opis
 * događaja stoji izravno na njoj). Tko prođe ovdje, prolazi i na --color-surface
 * i --color-surface-2. Pravilo 2 u web/design/canvas/Main.dc.html („prema --color-bg”).
 */
export const ZADANA_PODLOGA = "#f3f4f2";
/** WCAG AA za normalan tekst. */
export const MIN_KONTRAST_TEKSTA = 4.5;

export interface Naglasak {
  /** --color-accent: pozadina gumba „Kupi”, naslovne plohe, pločica. */
  accent: string;
  /** --color-on-accent: tekst na naglasnoj pozadini. */
  onAccent: string;
  /** --color-accent-text: naglasna boja kao tekst (linkovi, hover) na podlozi. */
  accentText: string;
}

/**
 * `#rrggbb` (mala slova) ili null. Prima `#rgb`, `#rrggbb`, s razmacima i bez `#`.
 * Sve ostalo (imena boja, rgb(), alfa) je null: vrijednost ide u inline `style`,
 * pa propuštamo samo ono što je sigurno heks.
 */
export function normalizirajHex(ulaz: unknown): string | null {
  if (typeof ulaz !== "string") return null;
  let h = ulaz.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.replace(/./g, (c) => c + c);
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return "#" + h.toLowerCase();
}

function rgb(hex: string): [number, number, number] {
  const h = hex.slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function hexIzRgb(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
}

/** WCAG 2.x relativna luminancija (0 = crno, 1 = bijelo). Ulaz: normalizirani `#rrggbb`. */
export function luminancija(hex: string): number {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG omjer kontrasta dviju boja, 1…21. */
export function kontrast(a: string, b: string): number {
  const la = luminancija(a);
  const lb = luminancija(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Tamna (--color-ink) ili bijela: ona s većim WCAG kontrastom, izjednačenje → bijela.
 *
 * Namjerno se mjeri prema stvarnim bojama teksta (#131714 i #ffffff), a ne prema
 * čistoj crnoj kao `renderVals()` u Dogadjaj-1280.dc.html: ta formula za zadanu
 * #2f855a bira tamni tekst (3,98:1 s #131714), a token i Main.dc.html traže bijeli
 * (4,54:1). Za sve ostale primjere iz dizajna ishod je isti.
 */
export function bojaNaNaglasku(accent: string): string {
  return kontrast(accent, SVIJETLI_TEKST) >= kontrast(accent, TAMNI_TEKST) ? SVIJETLI_TEKST : TAMNI_TEKST;
}

function uHsl([r, g, b]: [number, number, number]): [number, number, number] {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === R) h = (G - B) / d + (G < B ? 6 : 0);
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  return [h / 6, s, l];
}

function izHsl(h: number, s: number, l: number): string {
  if (s === 0) return hexIzRgb(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const kanal = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return hexIzRgb(kanal(h + 1 / 3) * 255, kanal(h) * 255, kanal(h - 1 / 3) * 255);
}

/**
 * Naglasna boja kao tekst na `podloga`: ista boja ako ima ≥ 4,5:1, inače se HSL
 * svjetlina spušta u koracima od 0,5 % dok ne prođe (najmanje potamnjenje, da boja
 * ostane prepoznatljiva). Na kraju je u najgorem slučaju crna, koja uvijek prolazi
 * na svijetloj podlozi.
 */
export function naglasakKaoTekst(accent: string, podloga: string = ZADANA_PODLOGA): string {
  if (kontrast(accent, podloga) >= MIN_KONTRAST_TEKSTA) return accent;
  const [h, s, l] = uHsl(rgb(accent));
  for (let svjetlina = l - 0.005; svjetlina > 0; svjetlina -= 0.005) {
    const kandidat = izHsl(h, s, svjetlina);
    if (kontrast(kandidat, podloga) >= MIN_KONTRAST_TEKSTA) return kandidat;
  }
  return "#000000";
}

/**
 * Sve tri vrijednosti za događaj. Neispravan ili prazan `accent_color` → zadana
 * zelena (#2f855a). `podloga` je zadano --color-bg (v. ZADANA_PODLOGA).
 */
export function izracunajNaglasak(accentColor: unknown, podloga: string = ZADANA_PODLOGA): Naglasak {
  const accent = normalizirajHex(accentColor) ?? ZADANI_NAGLASAK;
  return {
    accent,
    onAccent: bojaNaNaglasku(accent),
    accentText: naglasakKaoTekst(accent, normalizirajHex(podloga) ?? ZADANA_PODLOGA),
  };
}

/** Inline `style` za element koji nadjačava tokene: `--color-accent:…;--color-on-accent:…;--color-accent-text:…`. */
export function naglasakStil(accentColor: unknown, podloga?: string): string {
  const n = izracunajNaglasak(accentColor, podloga);
  return `--color-accent:${n.accent};--color-on-accent:${n.onAccent};--color-accent-text:${n.accentText}`;
}
