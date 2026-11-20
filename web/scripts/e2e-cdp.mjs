#!/usr/bin/env node
// `npm run e2e`: e2e kroz headless Chrome i CDP, bez ovisnosti (Nodeov WebSocket, Node 22+).
//
//   npm run e2e                                   # digne dev:mock na :4331 (mock :8798) i ugasi ga
//   npm run e2e -- --base http://localhost:4331   # već dignut `WEB_PORT=4331 npm run dev:mock`
//   npm run e2e -- --snimke /neki/dir             # screenshotovi (zadano privremeni direktorij)
//
// Port 4321 je Ivanov `astro dev` na lokalnom stacku (odluka 412): skripta ga ne dira, a
// dev:mock dobiva zaseban port, mock i Vite cache (scripts/dev-mock.mjs).
// Chrome: CHROME_BIN ili /Applications/Google Chrome.app; profil je privremen i briše se.
//
// Na dnu su slučajevi (kupnja → narudžba, pravne stranice, 404); pomoćne funkcije
// (otvori, cekaj*, klik, upisi, snimi, status i headeri glavnog dokumenta) su u `Stranica`.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const WEB_PORT = 4331;
const MOCK_PORT = 8798;
const CHROME = process.env.CHROME_BIN ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const CEKANJE_MS = 15_000;

const { values: arg } = parseArgs({
  options: {
    base: { type: "string" },
    snimke: { type: "string" },
  },
});

// ---------------------------------------------------------------------------
// CDP: jedna WebSocket veza na stranicu (target „page”).

class Cdp {
  #ws;
  #id = 0;
  #cekaju = new Map();
  #slusaci = new Set();

  static async spoji(url) {
    const ws = new WebSocket(url);
    await new Promise((ok, ne) => {
      ws.addEventListener("open", ok, { once: true });
      ws.addEventListener("error", () => ne(new Error(`CDP: ne mogu se spojiti na ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  constructor(ws) {
    this.#ws = ws;
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(e.data);
      if (m.id !== undefined) {
        const c = this.#cekaju.get(m.id);
        this.#cekaju.delete(m.id);
        if (!c) return;
        if (m.error) c.ne(new Error(`${c.metoda}: ${m.error.message}`));
        else c.ok(m.result);
      } else {
        for (const s of this.#slusaci) s(m.method, m.params);
      }
    });
    ws.addEventListener("close", () => {
      for (const c of this.#cekaju.values()) c.ne(new Error(`${c.metoda}: CDP veza zatvorena`));
      this.#cekaju.clear();
    });
  }

  send(metoda, params = {}) {
    const id = ++this.#id;
    return new Promise((ok, ne) => {
      this.#cekaju.set(id, { ok, ne, metoda });
      this.#ws.send(JSON.stringify({ id, method: metoda, params }));
    });
  }

  /** Slušač svih događaja; vraća funkciju za odjavu. */
  on(fn) {
    this.#slusaci.add(fn);
    return () => this.#slusaci.delete(fn);
  }

  /** Prvi događaj `metoda` za koji `uvjet(params)` vrijedi. */
  dogadjaj(metoda, uvjet = () => true, ms = CEKANJE_MS) {
    return new Promise((ok, ne) => {
      const t = setTimeout(() => {
        odjava();
        ne(new Error(`nije stigao ${metoda} u ${ms} ms`));
      }, ms);
      const odjava = this.on((m, p) => {
        if (m !== metoda || !uvjet(p)) return;
        clearTimeout(t);
        odjava();
        ok(p);
      });
    });
  }

  zatvori() {
    this.#ws.close();
  }
}

// ---------------------------------------------------------------------------
// Stranica: pomoćne funkcije nad jednom karticom.

const pauza = (ms) => new Promise((r) => setTimeout(r, ms));

class Stranica {
  /** Zadnji odgovor glavnog dokumenta: { url, status, headers (mala slova) }. */
  dokument = null;
  /** Nepohvaćene iznimke na stranici (npr. `_jsxDEV is not a function` kad otok padne). */
  iznimke = [];
  #snimka = 0;

  constructor(cdp, okvir, snimke) {
    this.cdp = cdp;
    this.okvir = okvir;
    this.snimke = snimke;
    cdp.on((m, p) => {
      if (m === "Network.responseReceived" && p.type === "Document" && p.frameId === this.okvir) {
        const headers = Object.fromEntries(Object.entries(p.response.headers).map(([k, v]) => [k.toLowerCase(), v]));
        this.dokument = { url: p.response.url, status: p.response.status, headers };
      }
      if (m === "Runtime.exceptionThrown") {
        const d = p.exceptionDetails;
        this.iznimke.push(`${d.exception?.description ?? d.text} (${d.url ?? "?"})`);
      }
    });
  }

  static async otvoriKarticu(cdp, snimke) {
    await Promise.all([cdp.send("Page.enable"), cdp.send("Network.enable"), cdp.send("Runtime.enable")]);
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    const { frameTree } = await cdp.send("Page.getFrameTree");
    return new Stranica(cdp, frameTree.frame.id, snimke);
  }

  /** Otvori URL i pričekaj `load`; vraća odgovor glavnog dokumenta. */
  async otvori(url, ms = 60_000) {
    this.dokument = null;
    const ucitano = this.cdp.dogadjaj("Page.loadEventFired", undefined, ms);
    const r = await this.cdp.send("Page.navigate", { url });
    if (r.errorText) throw new Error(`otvori ${url}: ${r.errorText}`);
    await ucitano;
    return this.dokument;
  }

  /** JS izraz u stranici; vrijednost se vraća serijalizirana. */
  async izvrsi(izraz) {
    const r = await this.cdp.send("Runtime.evaluate", { expression: izraz, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(`izvrsi: ${r.exceptionDetails.exception?.description ?? r.exceptionDetails.text}`);
    return r.result.value;
  }

  /** Čekaj dok JS izraz ne postane istinit (preživljava navigaciju). */
  async cekaj(izraz, opis = izraz, ms = CEKANJE_MS) {
    const kraj = Date.now() + ms;
    let zadnja = null;
    while (Date.now() < kraj) {
      try {
        if (await this.izvrsi(`!!(${izraz})`)) return;
      } catch (e) {
        zadnja = e; // kontekst uništen tijekom navigacije i sl.
      }
      await pauza(100);
    }
    throw new Error(`čekao ${ms} ms: ${opis}${zadnja ? ` (${zadnja.message})` : ""} — URL ${await this.url().catch(() => "?")}`);
  }

  cekajSelektor(sel, ms) {
    return this.cekaj(`document.querySelector(${JSON.stringify(sel)})`, `selektor ${sel}`, ms);
  }

  cekajTekst(tekst, ms) {
    return this.cekaj(`document.body && document.body.innerText.includes(${JSON.stringify(tekst)})`, `tekst „${tekst}”`, ms);
  }

  /** Čekaj putanju (string = točno, RegExp = test) i učitan dokument. */
  async cekajPutanju(putanja, ms) {
    const uvjet =
      putanja instanceof RegExp
        ? `${putanja}.test(location.pathname)`
        : `location.pathname === ${JSON.stringify(putanja)}`;
    await this.cekaj(`${uvjet} && document.readyState === "complete"`, `putanja ${putanja}`, ms);
    return new URL(await this.url());
  }

  url() {
    return this.izvrsi("location.href");
  }

  /**
   * Pravi klik mišem (Input.dispatchMouseEvent) na prvi VIDLJIVI element koji odgovara
   * selektoru; `tekst` dodatno traži element čiji innerText sadrži tekst. Čeka da element
   * postoji i nije `disabled`.
   */
  async klik(sel, { tekst } = {}) {
    const nadji = `(() => {
      const t = ${JSON.stringify(tekst ?? null)};
      return [...document.querySelectorAll(${JSON.stringify(sel)})].find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden" &&
          !el.disabled && (t === null || el.innerText.includes(t));
      });
    })()`;
    const opis = tekst ? `${sel} s tekstom „${tekst}”` : sel;
    await this.cekaj(nadji, `klikabilan ${opis}`);
    const tocka = await this.izvrsi(`(() => {
      const el = ${nadji};
      el.scrollIntoView({ block: "center", inline: "center" });
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    const mis = { ...tocka, button: "left", clickCount: 1 };
    await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...tocka });
    await this.cdp.send("Input.dispatchMouseEvent", { type: "mousePressed", ...mis });
    await this.cdp.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...mis });
  }

  /** Klik iz JS-a (`el.click()`), npr. za potvrdni okvir skriven iza vlastitog stila. */
  async klikJs(sel) {
    await this.cekajSelektor(sel);
    await this.izvrsi(`document.querySelector(${JSON.stringify(sel)}).click()`);
  }

  /** Fokus na polje, obriši sadržaj, upiši tekst kao tipkovnica (React onChange radi). */
  async upisi(sel, tekst) {
    await this.cekaj(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); return el && !el.disabled; })()`, `polje ${sel}`);
    await this.izvrsi(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); el.focus(); el.select?.(); })()`);
    await this.cdp.send("Input.insertText", { text: tekst });
    const vrijednost = await this.izvrsi(`document.querySelector(${JSON.stringify(sel)}).value`);
    if (vrijednost !== tekst) throw new Error(`upisi ${sel}: očekivao „${tekst}”, polje ima „${vrijednost}”`);
  }

  /** Screenshot vidljivog dijela u direktorij snimki; vraća putanju. */
  async snimi(ime) {
    const { data } = await this.cdp.send("Page.captureScreenshot", { format: "png" });
    const put = join(this.snimke, `${String(++this.#snimka).padStart(2, "0")}-${ime}.png`);
    writeFileSync(put, Buffer.from(data, "base64"));
    return put;
  }
}

// ---------------------------------------------------------------------------
// Procesi: dev:mock i Chrome.

function slobodan(port) {
  return new Promise((ok) => {
    const s = connect({ host: "localhost", port, autoSelectFamily: true });
    s.once("connect", () => (s.destroy(), ok(false)));
    s.once("error", () => ok(true));
  });
}

async function digniDevMock() {
  for (const p of [WEB_PORT, MOCK_PORT]) {
    if (!(await slobodan(p))) throw new Error(`port ${p} je zauzet; ugasi ga ili pokreni s --base`);
  }
  const zapis = [];
  const dijete = spawn(process.execPath, [fileURLToPath(new URL("./dev-mock.mjs", import.meta.url))], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, WEB_PORT: String(WEB_PORT), MOCK_PORT: String(MOCK_PORT), ASTRO_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const s of [dijete.stdout, dijete.stderr]) s.on("data", (b) => zapis.push(b.toString()));
  const base = `http://localhost:${WEB_PORT}`;
  const kraj = Date.now() + 120_000;
  while (Date.now() < kraj) {
    if (dijete.exitCode !== null) throw new Error(`dev:mock je izašao (${dijete.exitCode}):\n${zapis.join("")}`);
    try {
      if ((await fetch(base + "/")).status === 200) return { base, dijete, zapis };
    } catch {}
    await pauza(500);
  }
  dijete.kill("SIGTERM");
  throw new Error(`dev:mock nije odgovorio na ${base} u 120 s:\n${zapis.join("")}`);
}

async function ugasi(dijete, ms = 10_000) {
  if (!dijete || dijete.exitCode !== null || dijete.signalCode !== null) return;
  const izlaz = new Promise((r) => dijete.once("exit", r));
  dijete.kill("SIGTERM");
  if (await Promise.race([izlaz.then(() => true), pauza(ms).then(() => false)])) return;
  dijete.kill("SIGKILL");
  await izlaz;
}

async function digniChrome() {
  if (!existsSync(CHROME)) throw new Error(`nema Chromea na ${CHROME} (postavi CHROME_BIN)`);
  const profil = mkdtempSync(join(tmpdir(), "web-e2e-chrome-"));
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0", // Chrome sam bira slobodan port i upiše ga u DevToolsActivePort
      `--user-data-dir=${profil}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--disable-background-networking",
      "--window-size=1280,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const datoteka = join(profil, "DevToolsActivePort");
  const kraj = Date.now() + 20_000;
  while (!existsSync(datoteka) || !readFileSync(datoteka, "utf8").includes("\n")) {
    if (chrome.exitCode !== null) throw new Error(`Chrome je izašao (${chrome.exitCode})`);
    if (Date.now() > kraj) throw new Error("Chrome nije otvorio port za CDP u 20 s");
    await pauza(100);
  }
  const port = Number(readFileSync(datoteka, "utf8").split("\n")[0]);
  const kartice = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const kartica = kartice.find((k) => k.type === "page");
  if (!kartica) throw new Error("Chrome nema otvorenu karticu");
  return { chrome, profil, cdp: await Cdp.spoji(kartica.webSocketDebuggerUrl) };
}

// ---------------------------------------------------------------------------
// Slučajevi. Tekstovi su iz web/src/pages/ (S5): ulaznice/[orderId].astro (naslovi stanja kao
// u SPA-u, src/pages/Narudzba.tsx), uvjeti.astro, privatnost.astro, 404.astro. Web namjerno
// ne prikazuje QR i ne zove /preuzmi (to radi samo mobilna aplikacija), pa ih e2e ne traži.

function ocekuj(uvjet, poruka) {
  if (!uvjet) throw new Error(poruka);
}

function ocekujStatus(dokument, status, sto) {
  ocekuj(dokument, `${sto}: nema odgovora glavnog dokumenta`);
  ocekuj(dokument.status === status, `${sto}: status ${dokument.status}, očekivan ${status} (${dokument.url})`);
}

function ocekujBezKesa(dokument, sto) {
  const cc = dokument.headers["cache-control"] ?? "";
  ocekuj(cc.includes("no-store"), `${sto}: cache-control „${cc}”, očekivan no-store`);
}

async function ocekujNoindex(s, dokument, sto) {
  const meta = await s.izvrsi(`document.querySelector('meta[name="robots"]')?.content ?? ""`);
  const header = dokument.headers["x-robots-tag"] ?? "";
  ocekuj(`${meta} ${header}`.includes("noindex"), `${sto}: nema noindex (meta „${meta}”, x-robots-tag „${header}”)`);
}

const SLUG = "prilika-za-susret-2027"; // mobile/mock-api.mjs

const slucajevi = [
  [
    "kupnja → narudžba (pending pa paid)",
    async (s, base) => {
      let d = await s.otvori(`${base}/`);
      ocekujStatus(d, 200, "popis");
      await s.cekajTekst("Prilika za Susret 2027");
      await s.snimi("popis");

      await s.klik(`a[href="/dogadjaj/${SLUG}"]`);
      await s.cekajPutanju(`/dogadjaj/${SLUG}`);
      ocekujStatus(s.dokument, 200, "događaj");
      await s.snimi("dogadjaj");

      await s.klik(`a[href="/dogadjaj/${SLUG}/kupnja"]`);
      await s.cekajPutanju(`/dogadjaj/${SLUG}/kupnja`);
      ocekujStatus(s.dokument, 200, "kupnja");
      // Otok je hidriran kad Astro skine `ssr` s <astro-island>; prije toga React još
      // nije preuzeo polja.
      await s.cekajSelektor("astro-island:not([ssr]) #kupac-email", 30_000);
      // Zadani tier je prvi kupivi (Redovna, imenska) i količina 1.
      await s.upisi("#ime-0", "Ana Anić");
      await s.upisi("#kupac-email", "ana.e2e@primjer.hr");
      await s.klikJs("#uvjeti");
      await s.snimi("kupnja-ispunjena");
      await s.klik('button[type="submit"]', { tekst: "Nastavi na plaćanje" });

      const checkout = await s.cekajPutanju(/^\/mock-checkout\/[^/]+$/);
      const orderId = checkout.pathname.split("/").pop();
      await s.cekajTekst("Plati (lažno)");
      await s.snimi("checkout");

      // Prije plaćanja: pending.
      d = await s.otvori(`${base}/ulaznice/${orderId}`);
      ocekujStatus(d, 200, "narudžba (pending)");
      ocekujBezKesa(d, "narudžba (pending)");
      await ocekujNoindex(s, d, "narudžba (pending)");
      await s.cekajTekst("Čeka plaćanje");
      await s.snimi("narudzba-pending");

      // Lažni Checkout: POST → 303 na /ulaznice/<id>?placeno=1, mock je narudžbu označio paid.
      await s.otvori(`${base}/mock-checkout/${orderId}`);
      await s.klik("button", { tekst: "Plati (lažno)" });
      const povratak = await s.cekajPutanju(`/ulaznice/${orderId}`);
      ocekuj(povratak.searchParams.get("placeno") === "1", `povratak bez ?placeno=1: ${povratak}`);
      ocekujStatus(s.dokument, 200, "narudžba (paid)");
      ocekujBezKesa(s.dokument, "narudžba (paid)");
      await s.cekajTekst("Plaćeno");
      await s.cekajTekst("Pošalji ponovno"); // ponovna dostava postoji samo za paid
      await s.snimi("narudzba-paid");
    },
  ],
  [
    "pravne stranice",
    async (s, base) => {
      for (const [putanja, naslov] of [
        ["/uvjeti", "Uvjeti korištenja"],
        ["/privatnost", "Politika privatnosti"],
      ]) {
        const d = await s.otvori(base + putanja);
        ocekujStatus(d, 200, putanja);
        // Bez preusmjeravanja na /uvjeti/. U devu nema Cloudflare assetsa, pa ovo hvata samo
        // preusmjeravanje iz Astra; 307 iz assetsa sprječava build.format „file” (astro.config.mjs).
        ocekuj(new URL(d.url).pathname === putanja, `${putanja} je preusmjeren na ${d.url}`);
        await s.cekaj(`document.querySelector("h1")?.innerText.includes(${JSON.stringify(naslov)})`, `h1 „${naslov}” na ${putanja}`);
        await s.snimi(putanja.slice(1));
      }
    },
  ],
  [
    "404",
    async (s, base) => {
      const d = await s.otvori(`${base}/nepostoji-e2e-${Date.now()}`);
      ocekujStatus(d, 404, "nepostojeća putanja");
      await s.cekajTekst("Stranica nije pronađena");
      await s.snimi("404");
    },
  ],
];

// ---------------------------------------------------------------------------

let devMock = null;
let chrome = null;
let profil = null;
let cdp = null;

async function pocisti() {
  cdp?.zatvori();
  await ugasi(chrome);
  // Chromeovi pomoćni procesi pišu u profil još trenutak nakon izlaza glavnog.
  if (profil) rmSync(profil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
  await ugasi(devMock?.dijete);
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.once(sig, async () => {
    await pocisti();
    process.exit(130);
  });
}

async function main() {
  const snimke = arg.snimke ?? mkdtempSync(join(tmpdir(), "web-e2e-snimke-"));
  mkdirSync(snimke, { recursive: true });

  let base = arg.base?.replace(/\/$/, "");
  if (!base) {
    console.log(`dižem dev:mock na :${WEB_PORT} (mock :${MOCK_PORT})…`);
    devMock = await digniDevMock();
    base = devMock.base;
  }
  console.log(`e2e na ${base}, snimke u ${snimke}`);

  ({ chrome, profil, cdp } = await digniChrome());
  const s = await Stranica.otvoriKarticu(cdp, snimke);

  let palo = 0;
  for (const [ime, fn] of slucajevi) {
    s.iznimke = [];
    const pocetak = Date.now();
    try {
      await fn(s, base);
      ocekuj(s.iznimke.length === 0, `iznimke na stranici:\n    ${s.iznimke.join("\n    ")}`);
      console.log(`  ok    ${ime} (${Date.now() - pocetak} ms)`);
    } catch (e) {
      palo++;
      const snimka = await s.snimi(`PALO-${ime.replace(/[^a-z0-9]+/gi, "-")}`).catch(() => null);
      console.log(`  PALO  ${ime}\n        ${e.message}${snimka ? `\n        snimka: ${snimka}` : ""}`);
    }
  }
  console.log(palo ? `\n${palo} od ${slucajevi.length} slučajeva palo.` : `\nsvih ${slucajevi.length} slučajeva prošlo.`);
  return palo ? 1 : 0;
}

let kod = 1;
try {
  kod = await main();
} catch (e) {
  console.error(`e2e: ${e.message}`);
} finally {
  await pocisti();
}
process.exit(kod);
