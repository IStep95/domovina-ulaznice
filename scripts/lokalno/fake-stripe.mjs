// Lažni Stripe (checkout + webhook potpisan pravim whsec_) i Resend inbox na :8901.
import http from "node:http";
import crypto from "node:crypto";
const WHSEC = process.env.WHSEC, WORKER = process.env.WORKER || "http://127.0.0.1:8788";
const sessions = new Map(), mails = [], accounts = new Map(), linkovi = new Map();
const rid = (p) => p + "_" + crypto.randomBytes(12).toString("hex");
const eur = (c) => (c / 100).toFixed(2).replace(".", ",") + " €";
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function parseForm(body) {
  const out = {};
  for (const [k, v] of new URLSearchParams(body)) {
    const path = k.replace(/\]/g, "").split("[");
    let o = out;
    path.forEach((p, i) => {
      if (i === path.length - 1) o[p] = v;
      else o = o[p] ??= /^\d+$/.test(path[i + 1]) ? [] : {};
    });
  }
  return out;
}
const read = (req) => new Promise((r) => { let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => r(b)); });
const send = (res, code, obj, type = "application/json") => {
  res.writeHead(code, { "content-type": type });
  res.end(type === "application/json" ? JSON.stringify(obj) : obj);
};
async function sendWebhook(type, obj, account) {
  const evt = { id: rid("evt"), object: "event", type, account, created: Math.floor(Date.now() / 1000), livemode: false, data: { object: obj }, api_version: "2025-02-24.acacia" };
  const payload = JSON.stringify(evt), t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac("sha256", WHSEC).update(`${t}.${payload}`).digest("hex");
  const r = await fetch(WORKER + "/webhook/stripe", { method: "POST", headers: { "content-type": "application/json", "stripe-signature": `t=${t},v1=${sig}` }, body: payload });
  const txt = await r.text();
  console.log("[webhook]", type, r.status, txt);
  return txt;
}
const page = (title, body) => `<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{font-family:-apple-system,system-ui,sans-serif;background:#f6f9fc;margin:0;color:#1a1f36}.w{max-width:960px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:48px;padding:64px 24px}
.sb{position:fixed;top:0;left:0;right:0;background:#ffb800;color:#000;text-align:center;font-size:12px;padding:4px;font-weight:600}
h2{font-weight:500;color:#697386;font-size:16px;margin:0}.amt{font-size:36px;font-weight:600;margin:6px 0 24px}.li{display:flex;justify-content:space-between;border-top:1px solid #e3e8ee;padding:12px 0;font-size:14px}
label{display:block;font-size:13px;color:#697386;margin:14px 0 4px}input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d5dbe1;border-radius:6px;font-size:15px}
button{margin-top:24px;width:100%;padding:13px;background:#635bff;color:#fff;border:0;border-radius:6px;font-size:16px;font-weight:600;cursor:pointer}.muted{color:#697386;font-size:13px}
@media(max-width:700px){.w{grid-template-columns:1fr}}</style><div class=sb>TEST MODE · lokalni Stripe za demonstraciju</div>${body}`;

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const body = req.method === "POST" ? await read(req) : "";
  try {
    // ---- Stripe API
    if (req.method === "POST" && u.pathname === "/v1/checkout/sessions") {
      const p = parseForm(body), acct = req.headers["stripe-account"];
      const li = p.line_items[0], qty = Number(li.quantity), unit = Number(li.price_data.unit_amount);
      const id = rid("cs_test"), pi = rid("pi");
      const s = { id, object: "checkout.session", mode: "payment", status: "open", payment_status: "unpaid", currency: "eur",
        amount_total: qty * unit, amount_subtotal: qty * unit, customer_email: p.customer_email ?? null, customer_details: null,
        metadata: p.metadata ?? {}, payment_intent: null, _pi: pi, _acct: acct, _li: li, _p: p,
        success_url: p.success_url, cancel_url: p.cancel_url, url: `http://127.0.0.1:8901/pay/${id}`, expires_at: Number(p.expires_at) };
      sessions.set(id, s);
      console.log("[checkout]", id, "acct", acct, "fee?", "application_fee_amount" in (p.payment_intent_data ?? {}));
      const { _pi, _acct, _li, _p, ...pub } = s;
      return send(res, 200, pub);
    }
    if (req.method === "GET" && u.pathname.startsWith("/v1/payment_intents/")) {
      const id = u.pathname.split("/").pop();
      const s = [...sessions.values()].find((x) => x._pi === id);
      return send(res, 200, { id, object: "payment_intent", status: s?.payment_status === "paid" ? "succeeded" : "requires_payment_method", amount: s?.amount_total, amount_received: s?.amount_total, currency: "eur", metadata: s?.metadata ?? {}, latest_charge: "ch_" + id });
    }
    if (req.method === "POST" && u.pathname === "/v1/refunds") {
      const p = parseForm(body);
      return send(res, 200, { id: rid("re"), object: "refund", status: "succeeded", payment_intent: p.payment_intent, amount: Number(p.amount ?? 0) });
    }
    // ---- Connect onboarding (worker/connect.ts): račun, Account Link, lažni obrazac
    if (req.method === "POST" && u.pathname === "/v1/accounts") {
      const p = parseForm(body), kljuc = req.headers["idempotency-key"];
      const postojeci = kljuc && [...accounts.values()].find((a) => a._kljuc === kljuc);
      if (postojeci) { const { _kljuc, ...pub } = postojeci; return send(res, 200, pub); }
      const a = { id: "acct_" + crypto.randomBytes(8).toString("hex"), object: "account", type: p.type, country: p.country,
        email: p.email ?? null, business_profile: p.business_profile ?? {}, metadata: p.metadata ?? {},
        charges_enabled: false, payouts_enabled: false, details_submitted: false, _kljuc: kljuc };
      accounts.set(a.id, a);
      console.log("[connect] novi račun", a.id, a.type, p.business_profile?.name);
      const { _kljuc, ...pub } = a; return send(res, 200, pub);
    }
    if (req.method === "GET" && u.pathname.startsWith("/v1/accounts/")) {
      const a = accounts.get(u.pathname.split("/").pop());
      if (!a) return send(res, 404, { error: { type: "invalid_request_error", message: "No such account" } });
      const { _kljuc, ...pub } = a; return send(res, 200, pub);
    }
    if (req.method === "POST" && u.pathname === "/v1/account_links") {
      const p = parseForm(body), id = rid("al");
      linkovi.set(id, p);
      return send(res, 200, { object: "account_link", url: `http://127.0.0.1:8901/connect/${id}`, expires_at: Math.floor(Date.now() / 1000) + 300 });
    }
    if (u.pathname.startsWith("/connect/")) {
      const l = linkovi.get(u.pathname.split("/")[2]), a = l && accounts.get(l.account);
      if (!a) return send(res, 404, "Nepoznat link", "text/html");
      if (req.method === "POST") {
        a.charges_enabled = a.payouts_enabled = a.details_submitted = true;
        const { _kljuc, ...obj } = a;
        await sendWebhook("account.updated", obj, a.id);
        res.writeHead(303, { location: l.return_url }); return res.end();
      }
      return send(res, 200, page("Stripe onboarding", `<div class=w><div><h2>Poveži račun s platformom</h2><div class=amt>${esc(a.business_profile?.name ?? a.id)}</div>
<p class=muted>Lažni Stripe ${esc(a.type)} onboarding za ${esc(a.id)}. „Dovrši” označi račun kao spreman za naplatu i pošalje account.updated.</p>
<p><a class=muted href="${esc(l.return_url)}">Vrati se bez dovršavanja</a> · <a class=muted href="${esc(l.refresh_url)}">Simuliraj istekli link</a></p></div>
<form method=post><label>Pravna osoba</label><input value="${esc(a.business_profile?.name ?? "")}" readonly><label>IBAN</label><input value="HR12 1001 0051 8630 0016 0" readonly><button>Dovrši</button></form></div>`), "text/html");
    }
    // ---- checkout stranica
    if (u.pathname.startsWith("/pay/")) {
      const s = sessions.get(u.pathname.split("/")[2]);
      if (!s) return send(res, 404, "Nepoznata sesija", "text/html");
      if (req.method === "POST") {
        const f = new URLSearchParams(body);
        s.status = "complete"; s.payment_status = "paid"; s.payment_intent = s._pi;
        s.customer_details = { email: f.get("email") || s.customer_email, name: f.get("name") || null };
        const { _pi, _acct, _li, _p, ...obj } = s;
        await sendWebhook("checkout.session.completed", obj, s._acct);
        res.writeHead(303, { location: s.success_url }); return res.end();
      }
      const li = s._li, qty = Number(li.quantity), unit = Number(li.price_data.unit_amount);
      return send(res, 200, page("Plaćanje", `<div class=w><div><a class=muted href="${esc(s.cancel_url)}">← Natrag</a><h2 style="margin-top:28px">${esc(li.price_data.product_data.name)}</h2>
<div class=amt>${eur(s.amount_total)}</div><div class=li><span>${esc(li.price_data.product_data.name)}<br><span class=muted>${esc(li.price_data.product_data.description ?? "")} · Kol. ${qty}</span></span><span>${eur(unit * qty)}</span></div>
<div class=li><b>Ukupno</b><b>${eur(s.amount_total)}</b></div><p class=muted>Plaćanje ide izravno na Stripe račun organizatora (${esc(s._acct)}). Bez naknade platforme.</p></div>
<form method=post><label>E-mail</label><input name=email type=email value="${esc(s.customer_email ?? "")}" required><label>Podaci o kartici</label><input value="4242 4242 4242 4242" readonly>
<div style="display:flex;gap:8px"><input value="12 / 34" readonly><input value="123" readonly></div><label>Ime na kartici</label><input name=name value="Ana Kupac">
<button>Plati ${eur(s.amount_total)}</button></form></div>`), "text/html");
    }
    // ---- Resend
    if (req.method === "POST" && u.pathname === "/emails") {
      const m = JSON.parse(body); m.id = rid("mail"); m.at = new Date().toISOString(); mails.unshift(m);
      console.log("[mail]", m.to, m.subject);
      return send(res, 200, { id: m.id });
    }
    if (u.pathname === "/inbox" || u.pathname === "/") {
      const list = mails.map((m) => `<li><a href="/inbox/${m.id}">${esc(m.subject)}</a> <span class=muted>→ ${esc(m.to.join(", "))} · ${m.at.slice(11, 19)}</span></li>`).join("");
      return send(res, 200, page("Inbox", `<div style="max-width:760px;margin:0 auto;padding:48px 24px"><h1>📬 Lokalni inbox</h1><ul>${list || "<p class=muted>Još nema poslanih mailova.</p>"}</ul></div>`), "text/html");
    }
    if (u.pathname.startsWith("/inbox/")) {
      const m = mails.find((x) => x.id === u.pathname.split("/")[2]);
      if (!m) return send(res, 404, "nema", "text/html");
      let html = m.html;
      for (const a of m.attachments ?? []) if (a.content_id) html = html.replaceAll(`cid:${a.content_id}`, `data:image/png;base64,${a.content}`);
      return send(res, 200, `<!doctype html><meta charset=utf-8><div style="font-family:system-ui;padding:12px;background:#eee"><a href="/inbox">← inbox</a> · <b>${esc(m.subject)}</b> · od ${esc(m.from)} za ${esc(m.to.join(", "))}</div>${html}`, "text/html");
    }
    console.log("[?]", req.method, u.pathname);
    send(res, 404, { error: { message: "fake-stripe: nepoznato " + u.pathname } });
  } catch (e) { console.error(e); send(res, 500, { error: { message: String(e) } }); }
}).listen(8901, "127.0.0.1", () => console.log("fake stripe/resend :8901"));
