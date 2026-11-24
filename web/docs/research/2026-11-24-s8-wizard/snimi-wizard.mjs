// Snimke wizarda /organizator/novi (S8) kroz headless Chrome i CDP: lažna sesija u sessionStorageu,
// nacrt u localStorageu, /api/* presretnut (Fetch.fulfillRequest), ništa ne ide na mrežu.
//   cd web && npx astro build && npx astro preview --port 4335
//   node docs/research/2026-11-24-s8-wizard/snimi-wizard.mjs http://localhost:4335 <izlazni-dir>
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
const [, , base, izlaz] = process.argv;
mkdirSync(izlaz, { recursive: true });
const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const dir = mkdtempSync(join(tmpdir(), "wiz-prof-"));
const p = spawn(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--user-data-dir=${dir}`, "--remote-debugging-port=0", "about:blank"], { stdio: "ignore" });
let port;
for (let i = 0; i < 50 && !port; i++) { await new Promise((r) => setTimeout(r, 200)); try { port = readFileSync(join(dir, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch {} }
const ciljevi = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
const ws = new WebSocket(ciljevi.find((c) => c.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const cekaju = new Map(); const slusaci = []; const konzola = [];
ws.addEventListener("message", (e) => { const m = JSON.parse(e.data); if (m.id && cekaju.has(m.id)) { cekaju.get(m.id)(m); cekaju.delete(m.id); } else slusaci.forEach((f) => f(m)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; cekaju.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const spavaj = (ms) => new Promise((r) => setTimeout(r, ms));
const ev = async (expression) => { const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails)); return r.result.result.value; };

const pregled = { accounts: [{ id: "a1", name: "Udruga Prilika za Susret", allowlisted: true, has_record: true }, { id: "a2", name: "Glazbena udruga Lisinski", allowlisted: false, has_record: false }], events: [] };
const poslano = [];
await send("Fetch.enable", { patterns: [{ urlPattern: "*/api/*" }] });
slusaci.push(async (m) => {
  if (m.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(m.params.type)) konzola.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  if (m.method === "Runtime.exceptionThrown") konzola.push("EXC " + m.params.exceptionDetails.text);
  if (m.method !== "Fetch.requestPaused") return;
  const url = m.params.request.url;
  let tijelo = pregled;
  if (url.includes("/dogadjaj")) { poslano.push(JSON.parse(m.params.request.postData ?? "{}")); tijelo = { id: "c1", slug: "susret-2027-zagreb", existing: false }; }
  await send("Fetch.fulfillRequest", { requestId: m.params.requestId, responseCode: 200, responseHeaders: [{ name: "content-type", value: "application/json" }], body: Buffer.from(JSON.stringify(tijelo)).toString("base64") });
});
await send("Page.enable"); await send("Runtime.enable");

const EMAIL = "ivan.stepanic@primjer.hr";
const unos = {
  accountId: "a1", naslov: "Susret 2027 — Prilika za susret", vrsta: "konferencija",
  pocetak: "2027-04-16T09:00", kraj: "2027-04-18T14:00", mjesto: "Hotel Panorama", adresa: "Trg Krešimira Ćosića 9", grad: "Zagreb",
  opis: "Međunarodni susret osoba otvorenih za katolički brak.\n\nProgram:\n- predavanja i radionice\n- zajednička večera\n- izlet u subotu", slika: "",
  organizator: "", email: "info@prilikazasusret.hr", web: "prilikazasusret.hr",
  tieri: [
    { naziv: "Rani upis", cijena: "45", kolicina: "100", imenska: true },
    { naziv: "Redovna", cijena: "60", kolicina: "300", imenska: true },
    { naziv: "Student", cijena: "35,50", kolicina: "80", imenska: true },
    { naziv: "Samo subota", cijena: "25", kolicina: "", imenska: false },
    { naziv: "Večera (dodatak)", cijena: "18,90", kolicina: "150", imenska: false },
  ],
};
const nacrt = { v: 1, email: EMAIL, eventId: "3f2a9c1e-0000-4000-8000-0000000000aa", unos, posjeceno: 5 };
const sesija = `sessionStorage.setItem("ulaznice.sesija", JSON.stringify({access_token:"t",email:${JSON.stringify(EMAIL)},istek:Date.now()+3600e3}));`;

async function postavi(w, h) { await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 }); }
async function otvori(put, { sNacrtom = true, n = nacrt } = {}) {
  await send("Page.navigate", { url: `${base}/organizator` }); await spavaj(600);
  await ev(`${sesija} ${sNacrtom ? `localStorage.setItem("ulaznice.nacrt-dogadjaja", ${JSON.stringify(JSON.stringify(n))})` : `localStorage.removeItem("ulaznice.nacrt-dogadjaja")`}; 1`);
  await send("Page.navigate", { url: `${base}${put}` }); await spavaj(1300);
}
async function snimi(ime, puna = false) {
  const mj = await ev(`({ sh: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, ih: innerHeight, dnoGumba: Math.ceil(document.querySelector('button[form="nd-forma"]')?.getBoundingClientRect().bottom ?? 0), dnoKartice: Math.ceil(document.querySelector("#nd-forma")?.getBoundingClientRect().bottom ?? 0), korak: new URLSearchParams(location.search).get("korak") })`);
  const s = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: puna });
  writeFileSync(join(izlaz, `${ime}.png`), Buffer.from(s.result.data, "base64"));
  console.log(ime, JSON.stringify(mj));
  return mj;
}

// 1440×900: svih pet koraka s popunjenim nacrtom
await postavi(1440, 900);
for (let k = 1; k <= 5; k++) { await otvori(`/organizator/novi?korak=${k}`); await snimi(`1440-korak-${k}`); }
// korak 4 s 12 tierova (scrolla samo tablica)
const mnogo = { ...nacrt, unos: { ...unos, tieri: Array.from({ length: 12 }, (_, i) => ({ naziv: `Vrsta ${i + 1}`, cijena: String(10 + i * 5), kolicina: "50", imenska: i % 2 === 0 })) } };
await otvori(`/organizator/novi?korak=4`, { n: mnogo }); await snimi(`1440-korak-4-dvanaest`);
// prazan wizard i Dalje bez naziva → greške na koraku 1
await otvori(`/organizator/novi`, { sNacrtom: false });
await ev(`document.querySelector('button[form="nd-forma"]').click(); 1`); await spavaj(300);
await snimi(`1440-korak-1-greske`);
console.log("fokus nakon greške:", await ev(`document.activeElement?.id`));
// ?korak=4 s praznim nacrtom → korak 1 (ne preskače nevaljani)
await otvori(`/organizator/novi?korak=4`, { sNacrtom: false });
console.log("prazno ?korak=4 →", await ev(`location.search + " | " + document.querySelector("h2").textContent`));
// kalendar otvoren (korak 2)
await otvori(`/organizator/novi?korak=2`);
await ev(`document.getElementById("nd-pocetak").click(); 1`); await spavaj(300);
await snimi(`1440-korak-2-kalendar`);
// natrag u pregledniku: 2 → Dalje → 3 → history.back() → 2
await otvori(`/organizator/novi?korak=2`);
await ev(`document.querySelector('button[form="nd-forma"]').click(); 1`); await spavaj(300);
const naprijed = await ev(`location.search`);
await ev(`history.back(); 1`); await spavaj(400);
console.log("Dalje →", naprijed, "| back →", await ev(`location.search + " " + document.querySelector("h2").textContent`));
// spremanje: korak 5 → Spremi kao skicu
await otvori(`/organizator/novi?korak=5`);
await ev(`document.querySelector('button[form="nd-forma"]').click(); 1`); await spavaj(800);
await snimi(`1440-spremljeno`);
console.log("payload:", JSON.stringify(poslano.at(-1)));
console.log("nacrt nakon spremanja:", await ev(`localStorage.getItem("ulaznice.nacrt-dogadjaja")`), await ev(`location.search`));

// 390×844
await postavi(390, 844);
for (const k of [1, 2, 3, 4, 5]) {
  await postavi(390, 844); await otvori(`/organizator/novi?korak=${k}`); const m = await snimi(`390-korak-${k}`);
  if (m.sh > 844) { await postavi(390, m.sh); await spavaj(300); await snimi(`390-korak-${k}-cijela`); }
}
await postavi(390, 844);
await otvori(`/organizator/novi`, { sNacrtom: false });
await ev(`document.querySelector('button[form="nd-forma"]').click(); 1`); await spavaj(300);
await snimi(`390-korak-1-greske`);
// 1024×768 provjera rasporeda
await postavi(1024, 768);
await otvori(`/organizator/novi?korak=4`); await snimi(`1024-korak-4`);
await postavi(1280, 800);
await otvori(`/organizator/novi?korak=5`); await snimi(`1280x800-korak-5`);
console.log("konzola:", konzola);
ws.close(); p.kill(); await spavaj(500); try { rmSync(dir, { recursive: true, force: true }); } catch {}
