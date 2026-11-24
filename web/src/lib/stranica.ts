// Zajedničko za SSR stranice: keširanje i zadana slika za pregled linka.

/**
 * Odluka 303: SSR stranice (popis, događaj) smiju se keširati najviše 60 s, i
 * to samo u pregledniku. Raspoloživost tiera („još 4”, „rasprodano”) mora biti
 * svježa, a kupnju ionako presuđuje POST /api/narudzba. Worker odgovore
 * Cloudflare ne kešira sam, pa `public` ovdje ne uvodi CDN keš.
 */
export const CACHE_STRANICA = "public, max-age=60";
/** Greška servera ili API-ja: ne kešira se, sljedeći pokušaj ide na server. */
export const CACHE_GRESKA = "no-store";
/**
 * Kupnja (S4): forma s raspoloživošću u trenutku otvaranja. Ne kešira se ni u
 * pregledniku: povratak sa Stripea („natrag”) mora pokazati svježe stanje, a
 * stranica nije za dijeljenje ni za tražilice.
 */
export const CACHE_KUPNJA = "no-store";
/**
 * Narudžba (S5): stanje se mijenja (pending → paid), a URL je ključ narudžbe
 * (`order_id` je bearer capability). Ne kešira se nigdje, ni greška ni 404.
 */
export const CACHE_NARUDZBA = "no-store";
/** .ics se mijenja samo kad organizator promijeni termin. */
export const CACHE_ICS = "public, max-age=300";

/** Zadana slika za og:image kad događaj nema naslovnu (public/og-zadana.png, 1200×630). */
export function ogZadanaSlika(origin: string): string {
  return new URL("/og-zadana.png", origin).toString();
}

/** Mjere slike za og:image:width/height i MIME za og:image:type. */
export interface OgMjere {
  sirina: number;
  visina: number;
  tip: string;
}

/**
 * Mjere public/og-zadana.png (S8, odluka 705): s njima Facebook prikaže sliku već
 * pri prvom dijeljenju, prije nego što je sam obradi. Promjena slike = promjena ovdje.
 */
export const OG_ZADANA_MJERE: OgMjere = { sirina: 1200, visina: 630, tip: "image/png" };

const TIPOVI_SLIKA: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  avif: "image/avif",
};

/**
 * og:image:type iz nastavka u putanji URL-a (naslovna organizatora); nepoznat
 * nastavak ili neispravan URL → null (meta se tada izostavlja, ne pogađa).
 */
export function ogTipSlike(url: string): string | null {
  try {
    const nastavak = /\.([a-z0-9]+)$/i.exec(new URL(url).pathname)?.[1]?.toLowerCase();
    return (nastavak && TIPOVI_SLIKA[nastavak]) || null;
  } catch {
    return null;
  }
}

/**
 * Organizator, editor i skener (S8): stranica je ljuska s otokom `client:only`,
 * podatke dohvaća preglednik s tokenom iz sessionStorage. Ne kešira se nigdje:
 * nakon odjave „natrag” ne smije pokazati staru stranicu iz keša.
 */
export const CACHE_ORGANIZATOR = "no-store";
