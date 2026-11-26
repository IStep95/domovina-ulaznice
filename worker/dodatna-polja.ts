// Dodatna polja kupnje iz organizatorova javnog Google obrasca (2026-11-26).
//
// Organizator uz događaj spremi link na javni Google obrazac (spol, ime i
// prezime, godište…). Worker iz stranice obrasca pročita pitanja
// (`FB_PUBLIC_LOAD_DATA_`), kupnja ih prikaže ispod e-maila, a nakon izdavanja
// ulaznica Worker odgovore pošalje u isti obrazac (`formResponse`). Podaci
// kupca tako završe kod organizatora (njegov Google Sheets), a ne u jezgri.
//
// Granice:
//  * Link je u D1 (`event_forms`), kao i brand stranice: prezentacija i
//    prikupljanje podataka, ne ticketing (CLAUDE.md pravilo 1).
//  * Odgovori su u jezgri (`ulaznice.order_answers`, s tekstom pitanja): izvor
//    istine i CSV sudionika. Upisuju se uz narudžbu, a u Google obrazac idu
//    tek kad su ulaznice izdane; rok čuvanja i ponavljanje radi cron.
//  * Obrazac koji traži Google prijavu (upload datoteke, „jedan odgovor po
//    osobi”) ili je zatvoren ne može se koristiti — javlja se pri spremanju.
//  * Grananje po odjeljcima se ne prati: kupac vidi sva pitanja.
import type { DodatnoPolje, OdgovoriDodatnihPolja } from "../shared/api-tipovi";
import type { Env } from "./env";
import { HttpError } from "./env";
import * as api from "./api";

export interface Obrazac {
  /** https://docs.google.com/forms/d/e/<id>/viewform */
  url: string;
  naslov: string;
  polja: DodatnoPolje[];
  /** Polja koja Worker sam puni e-mailom kupca (ne prikazuju se). */
  emailPolja: string[];
  /** Broj stranica (odjeljaka); `pageHistory` pri slanju. */
  stranica: number;
}

const GOOGLE_ID_RE = /^[A-Za-z0-9_-]{20,200}$/;
const VRSTE: Record<number, DodatnoPolje["vrsta"]> = {
  0: "tekst",
  1: "odlomak",
  2: "izbor",
  3: "padajuci",
  4: "visestruki",
  5: "skala",
  9: "datum",
  10: "vrijeme",
};
/** Stavke bez odgovora: naslov/opis (6), slika (11), video (12). Odjeljak (8) broji stranice. */
const BEZ_ODGOVORA = new Set([6, 8, 11, 12]);
const EMAIL_NASLOV_RE = /^\s*(e-?mail|e-?pošta|email address|adresa e-?pošte|vaš e-?mail|vaša e-?mail adresa)\s*:?\s*$/i;
export const ODGOVOR_MAX = 2000;

/**
 * Link koji je organizator zalijepio → kanonski viewform URL, ili null.
 * Kratki `forms.gle` link vraća {kratki} — razriješi ga `razrijesiLink`.
 */
export function kanonskiLink(unos: string): { url: string } | { kratki: string } | null {
  let u: URL;
  try {
    u = new URL(unos.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (u.hostname === "forms.gle") return /^\/[A-Za-z0-9]+$/.test(u.pathname) ? { kratki: u.toString() } : null;
  if (u.hostname !== "docs.google.com") return null;
  const m = u.pathname.match(/^\/forms(?:\/u\/\d+)?\/d\/e\/([^/]+)\/(?:viewform|formResponse)\/?$/);
  if (!m || !GOOGLE_ID_RE.test(m[1]!)) return null;
  return { url: `https://docs.google.com/forms/d/e/${m[1]}/viewform` };
}

/** `forms.gle/…` → viewform. Google odgovara 302 na docs.google.com. */
async function razrijesiLink(kratki: string): Promise<string> {
  const res = await fetch(kratki, { redirect: "manual" });
  const kamo = res.headers.get("location");
  const k = kamo ? kanonskiLink(kamo) : null;
  if (!k || !("url" in k)) throw new HttpError(422, "obrazac_neispravan_link");
  return k.url;
}

/** Iz HTML-a stranice obrasca izvuci pitanja. Čista funkcija (testovi). */
export function parsirajObrazac(url: string, html: string): Obrazac {
  const m = html.match(/FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);\s*<\/script>/);
  if (!m) throw new HttpError(422, "obrazac_nije_citljiv");
  let d: unknown;
  try {
    d = JSON.parse(m[1]!);
  } catch {
    throw new HttpError(422, "obrazac_nije_citljiv");
  }
  const forma = Array.isArray(d) && Array.isArray(d[1]) ? (d[1] as unknown[]) : null;
  const stavke = forma && Array.isArray(forma[1]) ? (forma[1] as unknown[][]) : [];
  const naslov = String((forma?.[8] as string) || (Array.isArray(d) ? (d as unknown[])[3] : "") || "").trim();

  const polja: DodatnoPolje[] = [];
  const emailPolja: string[] = [];
  let stranica = 1;
  for (const it of stavke) {
    if (!Array.isArray(it)) continue;
    const tip = Number(it[3]);
    if (tip === 8) stranica++;
    if (BEZ_ODGOVORA.has(tip)) continue;
    const ulaz = Array.isArray(it[4]) && Array.isArray(it[4][0]) ? (it[4][0] as unknown[]) : null;
    const vrsta = VRSTE[tip];
    const obavezno = ulaz ? ulaz[2] === 1 || ulaz[2] === true : false;
    if (!vrsta || !ulaz) {
      // Mreža, upload datoteke… Neobavezno se preskoči, obavezno se ne može ispuniti.
      if (obavezno) throw new HttpError(422, "obrazac_nepodrzano_polje");
      continue;
    }
    const id = String(ulaz[0]);
    if (!/^\d{1,20}$/.test(id)) continue;
    const naslovPolja = String(it[1] ?? "").trim() || "Pitanje";
    const opis = typeof it[2] === "string" && it[2].trim() ? it[2].trim() : null;

    if (vrsta === "tekst" && EMAIL_NASLOV_RE.test(naslovPolja)) {
      emailPolja.push(id);
      continue;
    }

    const polje: DodatnoPolje = { id, naslov: naslovPolja, opis, vrsta, obavezno };
    if (vrsta === "izbor" || vrsta === "padajuci" || vrsta === "visestruki" || vrsta === "skala") {
      // [vrijednost, null, idiNaOdjeljak, null, jeLiOstalo]; „Ostalo” (slobodan unos) se ne nudi
      const opcije = (Array.isArray(ulaz[1]) ? (ulaz[1] as unknown[][]) : [])
        .filter((o) => Array.isArray(o) && !o[4] && String(o[0] ?? "") !== "")
        .map((o) => String(o[0]));
      if (opcije.length === 0) {
        if (obavezno) throw new HttpError(422, "obrazac_nepodrzano_polje");
        continue;
      }
      polje.opcije = opcije;
      if (vrsta === "skala" && Array.isArray(ulaz[3])) {
        const [od, doKraja] = ulaz[3] as unknown[];
        polje.krajevi = [typeof od === "string" && od ? od : null, typeof doKraja === "string" && doKraja ? doKraja : null];
      }
    }
    if (vrsta === "datum" && Array.isArray(ulaz[7])) {
      // [uzVrijeme, uzGodinu]: datum s vremenom ili bez godine ne znamo poslati vjerno
      const [uzVrijeme, uzGodinu] = ulaz[7] as unknown[];
      if (uzVrijeme === 1 || uzGodinu === 0) {
        if (obavezno) throw new HttpError(422, "obrazac_nepodrzano_polje");
        continue;
      }
    }
    polja.push(polje);
  }
  return { url, naslov, polja, emailPolja, stranica };
}

/**
 * Dohvati i pročitaj obrazac. Cache 5 min (Cache API), da prikaz kupnje ne
 * zove Google svaki put; `svjeze` ga preskače (spremanje u editoru).
 */
export async function dohvatiObrazac(unos: string, opcije: { svjeze?: boolean } = {}): Promise<Obrazac> {
  const k = kanonskiLink(unos);
  if (!k) throw new HttpError(422, "obrazac_neispravan_link");
  const url = "url" in k ? k.url : await razrijesiLink(k.kratki);

  const cache = typeof caches !== "undefined" ? (caches as unknown as { default?: Cache }).default : undefined;
  const kljuc = new Request(`${url}#ulaznice-dodatna-polja`);
  if (cache && !opcije.svjeze) {
    const spremljeno = await cache.match(kljuc).catch(() => undefined);
    if (spremljeno) return (await spremljeno.json()) as Obrazac;
  }

  const res = await fetch(url, { headers: { "accept-language": "hr,en;q=0.8" }, redirect: "follow" });
  const konacni = res.url || url;
  if (res.status === 401 || res.status === 403 || /accounts\.google\.com|ServiceLogin/.test(konacni)) {
    throw new HttpError(422, "obrazac_trazi_prijavu");
  }
  if (/\/closedform/.test(konacni)) throw new HttpError(422, "obrazac_zatvoren");
  if (res.status === 404) throw new HttpError(422, "obrazac_ne_postoji");
  if (!res.ok) throw new HttpError(502, "obrazac_nedostupan");
  const obrazac = parsirajObrazac(url, await res.text());

  if (cache) {
    await cache
      .put(kljuc, new Response(JSON.stringify(obrazac), { headers: { "cache-control": "max-age=300" } }))
      .catch(() => undefined);
  }
  return obrazac;
}

/**
 * Provjeri odgovore kupca prema poljima obrasca. Vraća očišćene odgovore
 * (samo poznata polja, trim) ili baca 422 `dodatna_polja_neispravna`.
 */
export function provjeriOdgovore(polja: DodatnoPolje[], unos: unknown): OdgovoriDodatnihPolja {
  const sirovi = unos && typeof unos === "object" && !Array.isArray(unos) ? (unos as Record<string, unknown>) : {};
  const out: OdgovoriDodatnihPolja = {};
  for (const p of polja) {
    const v = sirovi[p.id];
    if (p.vrsta === "visestruki") {
      const niz = (Array.isArray(v) ? v : []).map((x) => String(x));
      if (niz.some((x) => !p.opcije?.includes(x))) throw new HttpError(422, "dodatna_polja_neispravna");
      const jedinstveni = [...new Set(niz)];
      if (p.obavezno && jedinstveni.length === 0) throw new HttpError(422, "dodatna_polja_neispravna");
      if (jedinstveni.length) out[p.id] = jedinstveni;
      continue;
    }
    const s = typeof v === "string" ? v.trim() : "";
    if (!s) {
      if (p.obavezno) throw new HttpError(422, "dodatna_polja_neispravna");
      continue;
    }
    if (s.length > ODGOVOR_MAX) throw new HttpError(422, "dodatna_polja_neispravna");
    if (p.opcije && !p.opcije.includes(s)) throw new HttpError(422, "dodatna_polja_neispravna");
    if (p.vrsta === "datum" && !/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new HttpError(422, "dodatna_polja_neispravna");
    if (p.vrsta === "vrijeme" && !/^\d{2}:\d{2}$/.test(s)) throw new HttpError(422, "dodatna_polja_neispravna");
    out[p.id] = s;
  }
  return out;
}

/** Tijelo `formResponse` (x-www-form-urlencoded). Čista funkcija (testovi). */
export function tijeloOdgovora(
  obrazac: Pick<Obrazac, "polja" | "emailPolja" | "stranica">,
  odgovori: OdgovoriDodatnihPolja,
  email: string,
): URLSearchParams {
  const b = new URLSearchParams();
  for (const p of obrazac.polja) {
    const v = odgovori[p.id];
    if (v === undefined) continue;
    if (p.vrsta === "datum" && typeof v === "string") {
      const [g, m, d] = v.split("-");
      b.append(`entry.${p.id}_year`, g!);
      b.append(`entry.${p.id}_month`, String(Number(m)));
      b.append(`entry.${p.id}_day`, String(Number(d)));
    } else if (p.vrsta === "vrijeme" && typeof v === "string") {
      const [h, min] = v.split(":");
      b.append(`entry.${p.id}_hour`, h!);
      b.append(`entry.${p.id}_minute`, min!);
    } else {
      for (const x of Array.isArray(v) ? v : [v]) b.append(`entry.${p.id}`, x);
    }
  }
  for (const id of obrazac.emailPolja) b.append(`entry.${id}`, email);
  // Obrazac koji skuplja e-mail adrese (postavka obrasca) traži i ovo polje.
  b.append("emailAddress", email);
  b.append("fvv", "1");
  b.append("pageHistory", Array.from({ length: obrazac.stranica }, (_, i) => i).join(","));
  return b;
}

/** Pošalji odgovore u Google obrazac. Baca ako Google odbije. */
export async function posaljiUObrazac(formUrl: string, odgovori: OdgovoriDodatnihPolja, email: string): Promise<void> {
  const obrazac = await dohvatiObrazac(formUrl);
  const res = await fetch(obrazac.url.replace(/\/viewform$/, "/formResponse"), {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: tijeloOdgovora(obrazac, odgovori, email).toString(),
    redirect: "follow",
  });
  if (!res.ok) throw new HttpError(502, `obrazac_odbio_${res.status}`);
}

// ── D1 (link obrasca) ─────────────────────────────────────────────────────────

/** Link obrasca uz događaj (ili null). */
export async function linkObrasca(env: Env, campaignId: string): Promise<string | null> {
  const r = await env.DB.prepare("SELECT form_url FROM event_forms WHERE campaign_id = ?")
    .bind(campaignId)
    .first<{ form_url: string | null }>()
    .catch(() => null);
  return r?.form_url ?? null;
}

/** Upiši (ili makni, `null`) link obrasca uz događaj. */
export async function spremiLinkObrasca(env: Env, campaignId: string, url: string | null): Promise<void> {
  if (url === null) {
    await env.DB.prepare("DELETE FROM event_forms WHERE campaign_id = ?").bind(campaignId).run();
    return;
  }
  await env.DB.prepare(
    "INSERT INTO event_forms (campaign_id, form_url) VALUES (?, ?) " +
      "ON CONFLICT(campaign_id) DO UPDATE SET form_url = excluded.form_url, updated_at = datetime('now')",
  )
    .bind(campaignId, url)
    .run();
}

// ── jezgra (ulaznice.order_answers) ────────────────────────────────────────────

/** Odgovori uz tekst pitanja, redom obrasca (snimka: obrazac se kasnije smije mijenjati). */
export function snimkaOdgovora(polja: DodatnoPolje[], odgovori: OdgovoriDodatnihPolja): api.OdgovorKupca[] {
  return polja.filter((p) => odgovori[p.id] !== undefined).map((p) => ({ id: p.id, pitanje: p.naslov, odgovor: odgovori[p.id]! }));
}

/** Spremi odgovore uz narudžbu u jezgru (narudžba mora postojati). */
export async function zapisiOdgovore(
  env: Env,
  orderId: string,
  obrazac: Pick<Obrazac, "url" | "polja">,
  odgovori: OdgovoriDodatnihPolja,
): Promise<void> {
  await api.spremiOdgovore(env, orderId, snimkaOdgovora(obrazac.polja, odgovori), obrazac.url);
}

/** Proslijedi jedan skup odgovora u Google obrazac i zabilježi ishod u jezgri. Ne baca. */
async function proslijedi(
  env: Env,
  orderId: string,
  r: { form_url: string; answers: api.OdgovorKupca[] },
  email: string | null,
): Promise<"poslano" | "greska"> {
  const odgovori: OdgovoriDodatnihPolja = Object.fromEntries(r.answers.map((a) => [a.id, a.odgovor]));
  let greska: string | null = null;
  try {
    await posaljiUObrazac(r.form_url, odgovori, email ?? "");
  } catch (e) {
    greska = e instanceof HttpError ? e.code : String((e as Error)?.message ?? e).slice(0, 200);
    console.error(`[dodatna-polja] ${orderId}: ${greska}`);
  }
  await api.oznaciProslijedeno(env, orderId, greska).catch((e) => console.error(`[dodatna-polja] oznaka ${orderId}: ${String(e)}`));
  return greska ? "greska" : "poslano";
}

/**
 * Odgovore narudžbe pošalji u obrazac organizatora — TEK kad su ulaznice
 * izdane (webhook, besplatna narudžba). Ne baca: neuspjeh ponovi cron.
 */
export async function proslijediOdgovoreNarudzbe(
  env: Env,
  orderId: string,
  email: string | null,
): Promise<"poslano" | "nema" | "greska"> {
  const r = await api.odgovoriZaProslijediti(env, orderId).catch((e) => {
    console.error(`[dodatna-polja] čitanje ${orderId}: ${String(e)}`);
    return null;
  });
  if (!r) return "nema";
  return proslijedi(env, orderId, r, email ?? r.buyer_email);
}

/** Cron: ponovi prosljeđivanje koje nije uspjelo, pa rok čuvanja. Vraća probleme za alarm. */
export async function odrzavajOdgovore(env: Env): Promise<string[]> {
  const problemi: string[] = [];
  try {
    for (const r of await api.odgovoriNaCekanju(env)) {
      if ((await proslijedi(env, r.order_id, r, r.buyer_email)) === "greska" && r.forward_attempts + 1 >= 5) {
        problemi.push(`${r.order_id}: dodatna polja ne stižu u Google obrazac organizatora`);
      }
    }
    await api.ocistiOdgovore(env);
  } catch (e) {
    const poruka = String((e as Error)?.message ?? e);
    // Jezgra bez migracije 20261126120000 (PostgREST 404 na RPC): još nema što održavati.
    if (/: 404\b/.test(poruka)) console.warn(`[dodatna-polja] jezgra još nema order_answers: ${poruka}`);
    else problemi.push(`dodatna polja: ${poruka}`);
  }
  return problemi;
}
