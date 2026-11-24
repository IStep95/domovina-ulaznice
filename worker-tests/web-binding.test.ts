// S6: ista domena kroz service binding `WEB` (Astro frontend, web/).
//
// Glavni Worker dijeli putanje: sve stranice (kupac, od S8 i organizator i
// skener) idu na Astro, statika stare SPA (`/assets/*`) u ASSETS, a
// API/webhook/.well-known ostaju ovdje. Pogrešna podjela znači ili stranicu na
// staroj SPA ili SPA-in JS na Astrovom 404 — oboje se na stagingu vidi tek kad
// netko klikne, pa se drži ovdje.
import { strict as assert } from "node:assert";
import { readdirSync } from "node:fs";
import { afterEach, test } from "node:test";
import worker from "../worker/index.ts";
import { BASE_URL, testEnv, type TestCtx } from "./harness/env.ts";

let t: TestCtx | null = null;
afterEach(() => { t?.restore(); t = null; });

const ORDER = "44444444-4444-4444-8444-444444444444";

interface Lazni {
  zahtjevi: Request[];
  fetch(req: Request): Promise<Response>;
}

/** Lažni Worker/ASSETS: pamti što je dobio i vraća prepoznatljivo tijelo. */
function lazni(oznaka: string, status = 200): Lazni {
  const zahtjevi: Request[] = [];
  return {
    zahtjevi,
    async fetch(req: Request) {
      zahtjevi.push(req);
      return new Response(oznaka, { status, headers: { "content-type": "text/html; charset=utf-8" } });
    },
  };
}

function okolina(o: { web?: boolean; najava?: boolean; extra?: Record<string, unknown> } = {}) {
  const web = lazni("ASTRO");
  const assets = lazni("SPA");
  t = testEnv({
    ASSETS: assets,
    ...(o.web === false ? {} : { WEB: web }),
    ...(o.najava ? { NAJAVA: "1" } : {}),
    ...(o.extra ?? {}),
  });
  return { web, assets, t };
}

async function posalji(tc: TestCtx, path: string, init: RequestInit = {}) {
  const req = new Request(`${BASE_URL}${path}`, init);
  const res = await worker.fetch(req, tc.env, tc.ctx);
  return { req, res, text: await res.text() };
}

// Sve što vidi kupac. `.ics` i `/kupnja` su zasebne Astrove rute; `/uvjeti/` i
// `/privatnost/` Astro sam preusmjeri (307) na oblik bez kose crte (odluka 517).
const KUPAC = [
  "/",
  "/dogadjaj/susret-2027",
  "/dogadjaj/susret-2027.ics",
  "/dogadjaj/susret-2027/kupnja",
  `/ulaznice/${ORDER}`,
  "/uvjeti",
  "/uvjeti/",
  "/privatnost",
  "/privatnost/",
  // Astrova statika (web/dist/client): build.assets i web/public/
  "/_astro/client.CzWaolnw.js",
  "/_astro/figtree-latin-wght-normal.D_ZTVpCC.woff2",
  "/_astro/_slug_.u4ty5LOy.css",
  "/favicon.svg",
  "/og-zadana.png",
];

// Organizator, editor i skener (S8): Astro stranice s otokom `client:only`.
// Kosa crta na kraju ide Astru kao i bez nje (Astro je sam svede).
const ORGANIZATOR = [
  "/organizator",
  "/organizator/",
  "/organizator/novi",
  "/organizator/novi/",
  "/skener",
  "/skener/",
];

// Nepoznato ide Astru: njegov 404 je pravi 404 (odluka 510), SPA bi dala 200.
// `/organizatori` i `/assets` (bez kose crte) provjeravaju da SPA popis nije prefiks-zamka.
const NEPOZNATO = ["/nesto", "/dogadjaj", "/ulaznice", "/robots.txt", "/index.html", "/organizatori", "/organizator/nesto", "/assets", "/api", "/webhook"];

// Stara SPA: samo njezin Vite build (dist/assets/*), rezerva do S9.
const SPA = [
  "/assets/index-DY6l5GHK.js",
  "/assets/index-DUv2lCy0.css",
  // .well-known bez vlastite rute ide u ASSETS kao i prije S6
  "/.well-known/security.txt",
];

test("WEB: svaka kupačka putanja i Astrova statika idu na Astro", async () => {
  const { web, assets, t } = okolina();
  for (const p of KUPAC) {
    const prije = web.zahtjevi.length;
    const { text } = await posalji(t, p);
    assert.equal(text, "ASTRO", `${p} mora na WEB`);
    assert.equal(web.zahtjevi.length, prije + 1, `${p}: WEB pozvan točno jednom`);
  }
  assert.equal(assets.zahtjevi.length, 0, "SPA ne smije vidjeti nijednu kupačku putanju");
});

test("WEB: nepoznata putanja ide na Astro (pravi 404), ne na SPA index.html", async () => {
  const { web, assets } = okolina();
  web.fetch = lazni("ASTRO 404", 404).fetch;
  for (const p of NEPOZNATO) {
    const { res, text } = await posalji(t!, p);
    assert.equal(res.status, 404, `${p} mora biti 404 iz Astra`);
    assert.equal(text, "ASTRO 404", p);
  }
  assert.equal(assets.zahtjevi.length, 0);
});

test("WEB: organizator, editor i skener (S8) idu na Astro, ne na SPA", async () => {
  const { web, assets, t } = okolina();
  for (const p of ORGANIZATOR) {
    const { text } = await posalji(t, p);
    assert.equal(text, "ASTRO", `${p} mora na WEB`);
  }
  assert.equal(web.zahtjevi.length, ORGANIZATOR.length);
  assert.equal(assets.zahtjevi.length, 0, "SPA ne smije vidjeti stranice organizatora ni skenera");
});

test("WEB: Google prijava vraća na Astro stranicu, a povratak s tokenom ide na WEB", async () => {
  const { web, assets, t } = okolina();
  for (const [povratak, ocekivano] of [
    ["/organizator", "/organizator"],
    ["/organizator/novi", "/organizator/novi"],
    ["/skener", "/skener"],
    // sve ostalo (i kosa crta na kraju, i tuđa domena) svede se na /organizator
    ["/skener/", "/organizator"],
    ["https://zlo.example/organizator", "/organizator"],
    ["", "/organizator"],
  ] as const) {
    const { res } = await posalji(t, `/api/organizator/google?povratak=${encodeURIComponent(povratak)}`);
    assert.equal(res.status, 302, povratak);
    const gotrue = new URL(res.headers.get("location")!);
    assert.equal(gotrue.pathname, "/auth/v1/authorize");
    assert.equal(gotrue.searchParams.get("provider"), "google");
    const nazad = new URL(gotrue.searchParams.get("redirect_to")!);
    assert.equal(nazad.origin, new URL(BASE_URL).origin, `${povratak}: povratak na istu domenu`);
    assert.equal(nazad.pathname, ocekivano, povratak);

    // GoTrue vraća na redirect_to s tokenom u fragmentu; fragment ne ide na
    // server, pa Worker vidi samo putanju i mora je dati Astru (otok preuzme token).
    const { text } = await posalji(t, nazad.pathname);
    assert.equal(text, "ASTRO", `${nazad.pathname} nakon Googlea mora na WEB`);
  }
  assert.equal(assets.zahtjevi.length, 0);
  assert.ok(web.zahtjevi.every((r) => !new URL(r.url).pathname.startsWith("/api/")), "API ne ide na WEB");
});

test("WEB: SPA asseti ostaju u ASSETS (rezerva do S9)", async () => {
  const { web, assets, t } = okolina();
  for (const p of SPA) {
    const { text } = await posalji(t, p);
    assert.equal(text, "SPA", `${p} mora ostati SPA-i`);
  }
  assert.equal(assets.zahtjevi.length, SPA.length);
  assert.equal(web.zahtjevi.length, 0, "WEB ne smije vidjeti putanje SPA-e");
});

test("WEB: /api/*, /webhook/* i .well-known ostaju glavnom Workeru", async () => {
  const { web, assets, t } = okolina({ extra: { APPLE_APP_IDS: "6SCK58757K.ai.domovina.ulaznice", ANDROID_CERT_SHA256: "ab:cd" } });

  const zdravlje = await posalji(t, "/api/zdravlje");
  assert.equal(zdravlje.res.status, 200);
  assert.match(zdravlje.res.headers.get("content-type") ?? "", /json/);

  const dogadjaji = await posalji(t, "/api/dogadjaji");
  assert.equal(dogadjaji.res.status, 200);
  assert.ok(JSON.parse(dogadjaji.text).events, "API odgovara Worker, ne Astro");

  for (const p of ["/api/nepostoji", "/webhook/nepostoji"]) {
    const r = await posalji(t, p);
    assert.equal(r.res.status, 404, p);
    assert.deepEqual(JSON.parse(r.text), { error: "not_found" }, `${p}: JSON 404 Workera`);
  }

  const aasa = await posalji(t, "/.well-known/apple-app-site-association");
  assert.equal(aasa.res.status, 200);
  assert.equal(JSON.parse(aasa.text).applinks.details[0].components[0]["/"], "/ulaznice/*");

  const assetlinks = await posalji(t, "/.well-known/assetlinks.json");
  assert.equal(assetlinks.res.status, 200);
  assert.equal(JSON.parse(assetlinks.text)[0].target.package_name, "ai.domovina.ulaznice");

  // webhook ruta postoji i odgovara sama (bez potpisa → odbijen), ne Astro
  const wh = await posalji(t, "/webhook/stripe", { method: "POST", body: "{}", headers: { "content-type": "application/json" } });
  assert.notEqual(wh.text, "ASTRO");

  assert.equal(web.zahtjevi.length, 0, "WEB ne smije vidjeti API, webhook ni .well-known");
  assert.equal(assets.zahtjevi.length, 0);
});

test("WEB: povratak sa Stripea /ulaznice/:id?placeno=1 stiže s queryjem", async () => {
  const { web, t } = okolina();
  const { req } = await posalji(t, `/ulaznice/${ORDER}?placeno=1`);
  assert.equal(web.zahtjevi.length, 1);
  assert.equal(new URL(web.zahtjevi[0].url).search, "?placeno=1");
  assert.equal(web.zahtjevi[0], req, "prosljeđuje se isti Request objekt");
});

test("WEB: Request se prosljeđuje nepromijenjen (metoda, headeri, Host, tijelo)", async () => {
  const { web, t } = okolina();
  const { req } = await posalji(t, "/dogadjaj/susret-2027?utm_source=x", {
    method: "POST",
    headers: { "accept-language": "hr", cookie: "a=1", "content-type": "text/plain" },
    body: "tijelo",
  });
  const dobio = web.zahtjevi[0];
  assert.equal(dobio, req);
  assert.equal(dobio.method, "POST");
  assert.equal(dobio.url, `${BASE_URL}/dogadjaj/susret-2027?utm_source=x`, "Host i query ostaju domene kupca");
  assert.equal(dobio.headers.get("accept-language"), "hr");
  assert.equal(dobio.headers.get("cookie"), "a=1");
  assert.equal(await dobio.text(), "tijelo", "tijelo nije pročitano usput");

  // HEAD (provjere linkova, preglednici) također ide Astru, s izvornom metodom
  const head = await posalji(t, "/uvjeti", { method: "HEAD" });
  assert.equal(web.zahtjevi.at(-1), head.req);
  assert.equal(web.zahtjevi.at(-1)!.method, "HEAD");
});

test("WEB: NAJAVA i dalje presreće sve, binding se ne zove", async () => {
  const { web, assets, t } = okolina({ najava: true });
  for (const p of ["/", "/dogadjaj/susret-2027", `/ulaznice/${ORDER}?placeno=1`, "/_astro/client.CzWaolnw.js", "/organizator"]) {
    const { res, text } = await posalji(t, p);
    assert.equal(res.status, 200, p);
    assert.match(text, /Prodaja još nije otvorena/, `${p} mora biti najava`);
  }
  assert.equal((await posalji(t, "/api/dogadjaji")).res.status, 404);
  assert.equal(web.zahtjevi.length, 0);
  assert.equal(assets.zahtjevi.length, 0);
});

test("bez WEB bindinga sve kao prije S6: kupac, organizator, skener i nepoznato iz ASSETS", async () => {
  const { assets, t } = okolina({ web: false });
  assert.equal(t.env.WEB, undefined);
  const sve = [...KUPAC, ...ORGANIZATOR, ...NEPOZNATO.filter((p) => p !== "/api" && p !== "/webhook"), ...SPA, "/api", "/webhook"];
  for (const p of sve) {
    const { text } = await posalji(t, p);
    assert.equal(text, "SPA", `${p} bez WEB-a ide u ASSETS`);
  }
  assert.equal(assets.zahtjevi.length, sve.length);
  // /api/* i /webhook/* i dalje JSON 404, ne SPA
  assert.equal((await posalji(t, "/api/nepostoji")).res.status, 404);
  assert.equal((await posalji(t, "/webhook/nepostoji")).res.status, 404);
  assert.equal(assets.zahtjevi.length, sve.length);
});

test("svaka datoteka iz web/public/ ide na Astro (sudar sa SPA-om je pravilo, ne slučaj)", async () => {
  // web/public/ se kopira u korijen Astrova builda; SPA nema public/ i svoju
  // statiku drži samo u /assets/. Nova datoteka u web/public/ ne smije završiti u SPA.
  const javne = readdirSync(new URL("../web/public/", import.meta.url)).filter((f) => !f.startsWith("."));
  assert.ok(javne.length > 0, "web/public/ postoji i nije prazan");
  const { web, assets, t } = okolina();
  for (const f of javne) {
    const { text } = await posalji(t, `/${f}`);
    assert.equal(text, "ASTRO", `/${f} mora na WEB`);
  }
  assert.equal(web.zahtjevi.length, javne.length);
  assert.equal(assets.zahtjevi.length, 0);
});
