// Snimke wizarda /organizator/novi kroz CDP: lažna sesija (sessionStorage), nacrt (localStorage), lažni /api/*.
// node wizard.mjs <base> <izlazDir>
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

// Pravi stack kroz :8788: prijava kodom (Mailpit), pa spremanje skice iz wizarda.
slusaci.push((m) => {
  if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") konzola.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  if (m.method === "Runtime.exceptionThrown") konzola.push("EXC " + m.params.exceptionDetails.text);
});
await send("Page.enable"); await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
const EMAIL = "stepanic.ivan@gmail.com";
const upisi = (sel, v) => ev(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event("input", { bubbles: true })); el.form.requestSubmit(); return 1; })()`);
const snimi = async (ime) => { const s = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(join(izlaz, ime + ".png"), Buffer.from(s.result.data, "base64")); };

const prije = Date.now();
await send("Page.navigate", { url: `${base}/organizator/novi` }); await spavaj(2000);
await upisi("#prijava-email", EMAIL); await spavaj(2500);
let kod;
for (let i = 0; i < 20 && !kod; i++) {
  const l = await (await fetch("http://127.0.0.1:55324/api/v1/messages?limit=1")).json();
  const m = l.messages[0];
  if (m && Date.parse(m.Created) >= prije - 2000) {
    const puna = await (await fetch(`http://127.0.0.1:55324/api/v1/message/${m.ID}`)).json();
    kod = (puna.Text || puna.HTML).match(/\b\d{6}\b/)?.[0];
  }
  if (!kod) await spavaj(500);
}
console.log("kod iz Mailpita:", kod);
await upisi("#prijava-kod", kod); await spavaj(3000);
console.log("sesija:", await ev(`!!sessionStorage.getItem("ulaznice.sesija")`), "stepper:", await ev(`!!document.querySelector("#nd-forma")`));
await snimi("stack-1-nakon-prijave");

const opcije = await ev(`[...document.querySelectorAll("#nd-accountId option")].map(o => o.value).filter(Boolean)`);
console.log("računi:", opcije);
const naslov = `S8 stack provjera ${new Date().toISOString().slice(11, 19)}`;
const unos = { accountId: opcije[0], naslov, vrsta: "koncert", pocetak: "2027-05-20T20:00", kraj: "", mjesto: "Tvornica kulture", adresa: "", grad: "Zagreb", opis: "Provjera wizarda kroz lokalni stack (S8).", slika: "", organizator: "", email: "", web: "", tieri: [{ naziv: "Ulaz", cijena: "12,50", kolicina: "100", imenska: false }] };
await ev(`(() => { localStorage.setItem("ulaznice.nacrt-dogadjaja", JSON.stringify({ v: 1, email: ${JSON.stringify(EMAIL)}, eventId: crypto.randomUUID(), unos: ${JSON.stringify(unos)}, posjeceno: 5 })); return 1; })()`);
await send("Page.navigate", { url: `${base}/organizator/novi?korak=5` }); await spavaj(2500);
await snimi("stack-2-pregled");
await ev(`document.querySelector('button[form="nd-forma"]').click(); 1`); await spavaj(4000);
console.log("nakon spremanja:", await ev(`({ url: location.pathname + location.search, tekst: document.querySelector("main").innerText.slice(0, 300), nacrt: localStorage.getItem("ulaznice.nacrt-dogadjaja") })`));
await snimi("stack-3-spremljeno");
console.log("NASLOV", naslov);
console.log("konzola:", konzola);
ws.close(); p.kill();
