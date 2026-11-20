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
/** .ics se mijenja samo kad organizator promijeni termin. */
export const CACHE_ICS = "public, max-age=300";

/** Zadana slika za og:image kad događaj nema naslovnu (public/og-zadana.png, 1200×630). */
export function ogZadanaSlika(origin: string): string {
  return new URL("/og-zadana.png", origin).toString();
}
