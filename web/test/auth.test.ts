// Testovi prijave organizatora (web/src/lib/auth.ts, S8): Googleov fragment,
// JWT, istek sesije, sessionStorage i pozivi /api/organizator/* — sve uz lažni
// storage, location, history i fetch na globalThisu. Bez mreže.
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import {
  ApiError,
  KLJUC_SESIJE,
  adresaGooglePrijave,
  dohvatiPregled,
  emailIzJwt,
  jeIstekla,
  kreirajDogadjaj,
  odjavi,
  potvrdiKod,
  preuzmiGoogleGresku,
  preuzmiHoldere,
  procitajSesiju,
  sesijaIzTokena,
  skenirajToken,
  spremiSesiju,
  tokenIzFragmenta,
  type Sesija,
} from "../src/lib/auth.ts";

// ── lažni preglednik ────────────────────────────────────────────────────────

class LazniStorage {
  podaci = new Map<string, string>();
  getItem(k: string) {
    return this.podaci.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.podaci.set(k, String(v));
  }
  removeItem(k: string) {
    this.podaci.delete(k);
  }
}

const izvorni = new Map<string, PropertyDescriptor | undefined>();
function postavi(ime: string, vrijednost: unknown) {
  if (!izvorni.has(ime)) izvorni.set(ime, Object.getOwnPropertyDescriptor(globalThis, ime));
  Object.defineProperty(globalThis, ime, { value: vrijednost, configurable: true, writable: true });
}
afterEach(() => {
  for (const [ime, opis] of izvorni) {
    if (opis) Object.defineProperty(globalThis, ime, opis);
    else delete (globalThis as unknown as Record<string, unknown>)[ime];
  }
  izvorni.clear();
  preuzmiGoogleGresku(); // modulna greška ne smije prijeći u sljedeći test
});

function storage(): LazniStorage {
  const s = new LazniStorage();
  postavi("sessionStorage", s);
  return s;
}

/** location + history; replaceState mijenja lažnu adresu kao pravi preglednik. */
function adresa(pathname: string, search: string, hash: string) {
  const loc = { pathname, search, hash };
  const zamjene: string[] = [];
  postavi("location", loc);
  postavi("history", {
    replaceState(_s: unknown, _t: string, url: string) {
      zamjene.push(url);
      const u = new URL(url, "https://ulaznice.test");
      loc.pathname = u.pathname;
      loc.search = u.search;
      loc.hash = u.hash;
    },
  });
  return { loc, zamjene };
}

interface Poziv {
  url: string;
  init: RequestInit;
}
function lazniFetch(status: number, tijelo: string) {
  const pozivi: Poziv[] = [];
  postavi("fetch", async (url: string, init: RequestInit = {}) => {
    pozivi.push({ url, init });
    return new Response(tijelo, { status, headers: { "content-type": "application/json" } });
  });
  return pozivi;
}

/** JWT bez potpisa (provjerava ga Worker, ne klijent). */
function jwt(tijelo: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${b64({ alg: "HS256", typ: "JWT" })}.${b64(tijelo)}.potpis`;
}

const SADA = Date.UTC(2026, 10, 24, 12, 0, 0);

// ── čisti dijelovi ──────────────────────────────────────────────────────────

test("sesijaIzTokena: 60 s rezerve, a i kratak token vrijedi barem minutu", () => {
  assert.deepEqual(sesijaIzTokena({ access_token: "t", expires_in: 3600, email: "a@b.hr" }, SADA), {
    access_token: "t",
    email: "a@b.hr",
    istek: SADA + 3540_000,
  });
  assert.equal(sesijaIzTokena({ access_token: "t", expires_in: 30, email: "" }, SADA).istek, SADA + 60_000);
});

test("emailIzJwt: base64url bez paddinga, dijakritika; neispravan JWT → null, bez e-maila → ''", () => {
  // ime s ?/~ daje '-' i '_' u base64url, a dijakritika višebajtni UTF-8
  assert.equal(emailIzJwt(jwt({ email: "šćž~?@primjer.hr", sub: "1" })), "šćž~?@primjer.hr");
  assert.equal(emailIzJwt(jwt({ sub: "1" })), "");
  assert.equal(emailIzJwt("nije-jwt"), null);
  assert.equal(emailIzJwt("a.%%%.c"), null);
  assert.equal(emailIzJwt(`a.${Buffer.from("[1,2").toString("base64url")}.c`), null);
});

test("tokenIzFragmenta: samo GoTrueov fragment; greška; token s istekom i e-mailom", () => {
  assert.equal(tokenIzFragmenta(""), null);
  assert.equal(tokenIzFragmenta("#"), null);
  assert.equal(tokenIzFragmenta("#sadrzaj"), null, "sidro na stranici nije povratak iz Googlea");
  assert.deepEqual(tokenIzFragmenta("#error=access_denied&error_description=x"), { greska: "google_neuspjelo" });
  assert.deepEqual(tokenIzFragmenta("#access_token=&expires_in=3600"), { greska: "google_neuspjelo" });
  assert.deepEqual(tokenIzFragmenta("#access_token=smece&expires_in=3600"), { greska: "google_neuspjelo" });

  const t = jwt({ email: "ivan@primjer.hr" });
  assert.deepEqual(tokenIzFragmenta(`#access_token=${t}&expires_in=1800&refresh_token=tajna&token_type=bearer`), {
    token: { access_token: t, expires_in: 1800, email: "ivan@primjer.hr" },
  });
  // bez expires_in (ili smeće) → sat vremena, kao u SPA-i
  assert.equal((tokenIzFragmenta(`#access_token=${t}`) as { token: { expires_in: number } }).token.expires_in, 3600);
  assert.equal(
    (tokenIzFragmenta(`access_token=${t}&expires_in=x`) as { token: { expires_in: number } }).token.expires_in,
    3600,
    "radi i bez vodećeg #",
  );
});

test("adresaGooglePrijave: povratak je putanja bez kose crte na kraju (Workerov regex je strog)", () => {
  assert.equal(adresaGooglePrijave("/organizator"), "/api/organizator/google?povratak=%2Forganizator");
  assert.equal(adresaGooglePrijave("/organizator/novi/"), "/api/organizator/google?povratak=%2Forganizator%2Fnovi");
  assert.equal(adresaGooglePrijave("/skener"), "/api/organizator/google?povratak=%2Fskener");
  assert.equal(adresaGooglePrijave("/"), "/api/organizator/google?povratak=%2F");
});

test("Google povratak: svaka putanja koju Worker prihvaća ima Astro stranicu s prijavom", () => {
  const worker = readFileSync(new URL("../../worker/index.ts", import.meta.url), "utf8");
  const m = /const put = \/\^\\\/\(([^)]+)\)\$\/\.test\(povratak\)/.exec(worker);
  assert.ok(m, "regex povratka u worker/index.ts (/api/organizator/google) nije pronađen");
  const putanje = m[1]!.split("|").map((p) => p.replace(/\\\//g, "/"));
  assert.deepEqual(putanje, ["organizator", "organizator/novi", "organizator/arhivirano", "skener"]);
  for (const p of putanje) {
    const stranica = [`../src/pages/${p}.astro`, `../src/pages/${p}/index.astro`].find((f) =>
      existsSync(new URL(f, import.meta.url)),
    );
    assert.ok(stranica, `/${p} nema stranicu u web/src/pages`);
    assert.match(readFileSync(new URL(stranica, import.meta.url), "utf8"), /client:only="react"/, `/${p}: otok client:only`);
  }
});

// ── sesija u sessionStorageu ────────────────────────────────────────────────

test("procitajSesiju: bez preglednika (SSR, node) null, bez bacanja", () => {
  assert.equal(procitajSesiju(SADA), null);
  spremiSesiju({ access_token: "t", email: "", istek: SADA });
  odjavi();
});

test("procitajSesiju: spremljena sesija vrijedi do isteka, istekla i neispravna se brišu", () => {
  const s = storage();
  const sesija: Sesija = { access_token: "t", email: "a@b.hr", istek: SADA + 1000 };
  spremiSesiju(sesija);
  assert.deepEqual(JSON.parse(s.getItem(KLJUC_SESIJE)!), sesija);
  assert.deepEqual(procitajSesiju(SADA), sesija);

  assert.equal(procitajSesiju(SADA + 1001), null);
  assert.equal(s.getItem(KLJUC_SESIJE), null, "istekla sesija se briše");

  s.setItem(KLJUC_SESIJE, JSON.stringify({ email: "a@b.hr", istek: SADA + 1000 }));
  assert.equal(procitajSesiju(SADA), null);
  assert.equal(s.getItem(KLJUC_SESIJE), null, "sesija bez tokena se briše");

  s.setItem(KLJUC_SESIJE, "{nije json");
  assert.equal(procitajSesiju(SADA), null);

  spremiSesiju(sesija);
  odjavi();
  assert.equal(s.getItem(KLJUC_SESIJE), null);
});

test("procitajSesiju: pohrana koja baca (blokirani kolačići) → null, spremanje se tiho preskače", () => {
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    get() {
      throw new DOMException("blokirano", "SecurityError");
    },
  });
  izvorni.set("sessionStorage", undefined);
  assert.equal(procitajSesiju(SADA), null);
  spremiSesiju({ access_token: "t", email: "", istek: SADA });
  odjavi();
});

test("Google povratak: token iz fragmenta → sesija spremljena, fragment obrisan, refresh token nigdje", () => {
  const s = storage();
  const t = jwt({ email: "ivan@primjer.hr" });
  const { loc, zamjene } = adresa("/organizator/novi", "?x=1", `#access_token=${t}&expires_in=3600&refresh_token=tajna`);

  const sesija = procitajSesiju();
  assert.equal(sesija?.access_token, t);
  assert.equal(sesija?.email, "ivan@primjer.hr");
  assert.deepEqual(zamjene, ["/organizator/novi?x=1"], "fragment se briše replaceStateom, query ostaje");
  assert.equal(loc.hash, "");
  assert.deepEqual(JSON.parse(s.getItem(KLJUC_SESIJE)!), sesija);
  assert.doesNotMatch(s.getItem(KLJUC_SESIJE)!, /tajna/);
  assert.equal(preuzmiGoogleGresku(), null);

  // drugo čitanje ide iz sessionStoragea (fragmenta više nema)
  assert.deepEqual(procitajSesiju(), sesija);
  assert.equal(zamjene.length, 1);
});

test("Google povratak s greškom: nema sesije, greška se pročita jednom, fragment obrisan", () => {
  storage();
  const { zamjene } = adresa("/skener", "", "#error=access_denied&error_description=Korisnik+odustao");
  assert.equal(procitajSesiju(), null);
  assert.deepEqual(zamjene, ["/skener"]);
  assert.equal(preuzmiGoogleGresku(), "google_neuspjelo");
  assert.equal(preuzmiGoogleGresku(), null);
});

test("sidro u adresi (#sadrzaj) nije povratak iz Googlea: adresa se ne dira", () => {
  storage();
  const { zamjene } = adresa("/organizator", "", "#sadrzaj");
  assert.equal(procitajSesiju(), null);
  assert.deepEqual(zamjene, []);
});

// ── pozivi ──────────────────────────────────────────────────────────────────

test("potvrdiKod: POST /api/organizator/potvrdi, sesija spremljena", async () => {
  const s = storage();
  const pozivi = lazniFetch(200, JSON.stringify({ access_token: "tok", expires_in: 3600, email: "a@b.hr" }));
  const sesija = await potvrdiKod("a@b.hr", "123456");
  assert.equal(pozivi[0]!.url, "/api/organizator/potvrdi");
  assert.equal(pozivi[0]!.init.method, "POST");
  assert.deepEqual(JSON.parse(String(pozivi[0]!.init.body)), { email: "a@b.hr", kod: "123456" });
  assert.equal(sesija.access_token, "tok");
  assert.deepEqual(JSON.parse(s.getItem(KLJUC_SESIJE)!), sesija);
});

test("kreirajDogadjaj: POST s Bearer tokenom i tijelom kakvo je dano", async () => {
  storage();
  const pozivi = lazniFetch(200, JSON.stringify({ id: "e1", slug: "susret", existing: false }));
  const tijelo = { event_id: "e1", account_id: "a1", title: "Susret", tiers: [{ title: "Redovna", price_cents: 6000 }] };
  assert.deepEqual(await kreirajDogadjaj("tok", tijelo), { id: "e1", slug: "susret", existing: false });
  const { url, init } = pozivi[0]!;
  assert.equal(url, "/api/organizator/dogadjaj");
  assert.equal(init.method, "POST");
  assert.equal((init.headers as Record<string, string>).authorization, "Bearer tok");
  assert.equal((init.headers as Record<string, string>)["content-type"], "application/json");
  assert.deepEqual(JSON.parse(String(init.body)), tijelo);
});

test("401 nije_prijavljen: sesija se briše i jeIstekla je true", async () => {
  const s = storage();
  spremiSesiju({ access_token: "tok", email: "a@b.hr", istek: Date.now() + 60_000 });
  lazniFetch(401, JSON.stringify({ error: "nije_prijavljen" }));
  const e = await dohvatiPregled("tok").catch((x: unknown) => x);
  assert.ok(e instanceof ApiError);
  assert.equal(e.code, "nije_prijavljen");
  assert.equal(e.status, 401);
  assert.ok(jeIstekla(e));
  assert.equal(s.getItem(KLJUC_SESIJE), null);
});

test("jeIstekla: krivi podaci u obrascu (401 prijava_neuspjela, kod_neispravan) nisu istek", () => {
  assert.equal(jeIstekla(new ApiError("prijava_neuspjela", 401)), false);
  assert.equal(jeIstekla(new ApiError("kod_neispravan", 401)), false);
  assert.equal(jeIstekla(new ApiError("not_authenticated", 401)), true, "kod jezgre kroz skener");
  assert.equal(jeIstekla(new TypeError("fetch failed")), false);
});

test("skenirajToken: šalje qr_token; 400 neispravan_qr je ApiError s kodom", async () => {
  storage();
  const pozivi = lazniFetch(400, JSON.stringify({ error: "neispravan_qr" }));
  const e = await skenirajToken("tok", "abc").catch((x: unknown) => x);
  assert.ok(e instanceof ApiError && e.code === "neispravan_qr");
  assert.deepEqual(JSON.parse(String(pozivi[0]!.init.body)), { qr_token: "abc" });
  assert.equal(pozivi[0]!.url, "/api/skener/sken");
});

test("preuzmiHoldere: 200 → Blob; greška nosi kod iz JSON-a, 401 briše sesiju", async () => {
  const s = storage();
  const pozivi = lazniFetch(200, "﻿serial;ime\r\nSUS-1;Ana");
  const blob = await preuzmiHoldere("tok", "c/1");
  assert.match(await blob.text(), /SUS-1;Ana/);
  assert.equal(pozivi[0]!.url, "/api/organizator/holderi.csv?campaign_id=c%2F1");
  assert.equal((pozivi[0]!.init.headers as Record<string, string>).authorization, "Bearer tok");

  lazniFetch(400, JSON.stringify({ error: "invalid_campaign_id" }));
  const e400 = await preuzmiHoldere("tok", "x").catch((x: unknown) => x);
  assert.ok(e400 instanceof ApiError && e400.code === "invalid_campaign_id");

  spremiSesiju({ access_token: "tok", email: "", istek: Date.now() + 60_000 });
  lazniFetch(401, JSON.stringify({ error: "nije_prijavljen" }));
  const e401 = await preuzmiHoldere("tok", "x").catch((x: unknown) => x);
  assert.ok(jeIstekla(e401));
  assert.equal(s.getItem(KLJUC_SESIJE), null);
});
