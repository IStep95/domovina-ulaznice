#!/usr/bin/env node
// Lažni Worker za razvoj mobilnih aplikacija BEZ jezgre i Stripea.
//
//   node mobile/mock-api.mjs            → http://localhost:8797
//   ANDROID emulator: http://10.0.2.2:8797   iOS simulator: http://localhost:8797
//
// Oponaša SAMO javne rute koje aplikacije zovu (`/api/dogadjaji`, `/api/dogadjaj/:slug`,
// `/api/narudzba`, `/api/ulaznice/:id`, `/api/ulaznice/:id/preuzmi`, `/ponovna-dostava`)
// i umjesto Stripe Checkouta servira stranicu s gumbom „Plati". Podaci su iz
// seeds/prilika-za-susret-2026.sql. Nikad se ne deploya; nema tajni.
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8797); // 8787 drži wrangler dev
const BASE = process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`;

const tiers = [
  { id: "00000000-0000-4000-8000-000000000t01", title: "Redovna ulaznica", description: "Sva tri dana, uključen ručak", price_cents: 6000, imenska: true, sale_start: null, sale_end: null, inventory_total: 120, inventory_claimed: 17 },
  { id: "00000000-0000-4000-8000-000000000t02", title: "Studentska", description: "Uz predočenje indeksa na ulazu", price_cents: 3500, imenska: true, sale_start: null, sale_end: null, inventory_total: 40, inventory_claimed: 36 },
  { id: "00000000-0000-4000-8000-000000000t03", title: "Rani upis", description: "Prodaja završila 1. veljače", price_cents: 5000, imenska: true, sale_start: null, sale_end: "2027-02-01T00:00:00Z", inventory_total: 50, inventory_claimed: 50 },
].map((t) => ({ ...t, id: t.id.replace(/t0(\d)$/, "d0$1") }));

const events = [
  {
    campaign_id: "00000000-0000-4000-8000-000000000d01",
    slug: "prilika-za-susret-2027",
    title: "Prilika za Susret 2027",
    event: {
      event_type: "konferencija", venue_name: "Dom sportova", venue_address: "Trg Krešimira Ćosića 11", venue_city: "Zagreb",
      starts_at: "2027-04-16T07:00:00+00:00", ends_at: "2027-04-18T16:00:00+00:00", timezone: "Europe/Zagreb",
      description_hr: "Tri dana susreta, predavanja i radionica.\n\nUlaznica vrijedi za sva tri dana i uključuje ručak. Ulaznice glase na ime — na ulazu se provjerava QR kod.",
      description_en: null, cover_image_url: null, cover_image_alt: null,
      venue_lat: 45.807844, venue_lon: 15.9518, // Dom sportova, OSM way 30632510 (seeds/koordinate-mjesta.sql)
      organizer_name: "Udruga Prilika za Susret", organizer_email: "prijave@prilikazasusret.hr", organizer_web: null,
    },
    tiers,
    stripe_connected: true,
    brand: { accent_color: "#2f855a", hero_url: null, intro_html: null, terms_url: "https://prilikazasusret.hr/uvjeti" },
  },
  {
    campaign_id: "00000000-0000-4000-8000-000000000d02",
    slug: "koncert-bez-satnice",
    title: "Koncert u Lisinskom (satnica uskoro)",
    event: {
      event_type: "koncert", venue_name: "KD Vatroslav Lisinski", venue_address: null, venue_city: "Zagreb",
      starts_at: "2026-11-20T23:00:00+00:00", ends_at: null, timezone: "Europe/Zagreb",
      description_hr: "Termin objavljen, satnica još nije.", description_en: null, cover_image_url: null, cover_image_alt: null,
      venue_lat: null, venue_lon: null, organizer_name: "Demo organizator", organizer_email: null, organizer_web: null,
    },
    tiers: [{ id: "00000000-0000-4000-8000-000000000d21", title: "Parter", description: null, price_cents: 2500, imenska: false, sale_start: "2026-10-01T08:00:00Z", sale_end: null, inventory_total: 300, inventory_claimed: 0 }],
    stripe_connected: false,
    brand: null,
  },
];

const orders = new Map(); // order_id → { ..., tickets: [{serial, holder_name, state, token|null}] }
let serial = 0;

function avail(t, now = Date.now()) {
  const start = t.sale_start ? Date.parse(t.sale_start) : null;
  const end = t.sale_end ? Date.parse(t.sale_end) : null;
  const not_started = start !== null && now < start;
  const ended = end !== null && now > end;
  const available = t.inventory_total === null ? null : Math.max(t.inventory_total - t.inventory_claimed, 0);
  const sold_out = available !== null && available <= 0;
  return { sold_out, not_started, ended, available, buyable: !sold_out && !not_started && !ended };
}
const pub = (ev) => {
  const ts = ev.tiers.map((t) => ({ id: t.id, title: t.title, description: t.description, price_cents: t.price_cents, imenska: t.imenska, sale_start: t.sale_start, sale_end: t.sale_end, ...avail(t) }));
  return { campaign_id: ev.campaign_id, slug: ev.slug, title: ev.title, event: ev.event, tiers: ts, stripe_connected: ev.stripe_connected, kupovno: ev.stripe_connected && ts.some((t) => t.buyable), brand: ev.brand };
};
const hex = () => Array.from({ length: 64 }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");
const json = (res, body, status = 200) => { res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((r) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => { try { r(JSON.parse(s || "{}")); } catch { r({}); } }); });
const mask = (e) => (e ? `${e.slice(0, 2)}${"•".repeat(Math.max(1, e.split("@")[0].length - 2))}@${e.split("@")[1]}` : null);

createServer(async (req, res) => {
  const u = new URL(req.url, BASE);
  const p = u.pathname;
  console.log(req.method, p);
  let m;
  if (p === "/api/zdravlje") return json(res, { ok: true, mock: true });
  if (p === "/api/dogadjaji") return json(res, { events: events.map(pub) });
  if ((m = p.match(/^\/api\/dogadjaj\/([^/]+)$/))) {
    const ev = events.find((e) => e.slug === decodeURIComponent(m[1]));
    return ev ? json(res, pub(ev)) : json(res, { error: "event_not_found" }, 404);
  }
  if (p === "/api/narudzba" && req.method === "POST") {
    const b = await readBody(req);
    const ev = events.find((e) => e.campaign_id === b.campaign_id);
    if (!ev) return json(res, { error: "event_not_found" }, 404);
    const t = ev.tiers.find((x) => x.id === b.tier_id);
    if (!t) return json(res, { error: "tier_not_found" }, 404);
    if (!avail(t).buyable) return json(res, { error: "tier_sold_out" }, 409);
    if (!ev.stripe_connected) return json(res, { error: "organizer_not_connected" }, 409);
    const q = Number(b.quantity);
    if (!(q >= 1 && q <= 10)) return json(res, { error: "invalid_quantity" }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(b.buyer_email ?? "")) return json(res, { error: "invalid_buyer_email" }, 400);
    const holders = (b.holders ?? []).slice(0, q);
    if (t.imenska && (holders.length < q || holders.some((h) => (h.full_name ?? "").trim().length < 2))) return json(res, { error: "holders_incomplete" }, 422);
    const id = randomUUID();
    t.inventory_claimed += q;
    orders.set(id, { id, campaign_id: ev.campaign_id, tier: t, state: "pending", quantity: q, amount_cents: t.price_cents * q, currency: "eur",
      expires_at: new Date(Date.now() + 20 * 60_000).toISOString(), paid_at: null, buyer_email: b.buyer_email, holders, tickets: [], rotacije: 0 });
    return json(res, { order_id: id, checkout_url: `${BASE}/mock-checkout/${id}`, amount_cents: t.price_cents * q });
  }
  if ((m = p.match(/^\/mock-checkout\/([^/]+)$/))) {
    const o = orders.get(m[1]);
    if (!o) { res.writeHead(404); return res.end("nema narudžbe"); }
    if (req.method === "POST") {
      if (o.state === "pending") {
        o.state = "paid"; o.paid_at = new Date().toISOString();
        o.tickets = Array.from({ length: o.quantity }, (_, i) => ({ serial: `MOCK-${String(++serial).padStart(6, "0")}`, holder_name: o.holders[i]?.full_name ?? null, state: "issued", token: hex() }));
      }
      res.writeHead(303, { location: `${BASE}/ulaznice/${o.id}?placeno=1` }); return res.end();
    }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:24px">
      <h2>MOCK Stripe Checkout</h2><p>${o.tier.title} × ${o.quantity} = <b>${(o.amount_cents / 100).toFixed(2)} €</b></p>
      <form method=post><button style="font-size:18px;padding:12px 24px">Plati (lažno)</button></form>
      <p><a href="${BASE}/dogadjaj/x?otkazano=1">Odustani</a></p></body>`);
  }
  if ((m = p.match(/^\/ulaznice\/([^/]+)$/))) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:24px"><h2>Plaćeno ✔</h2><p>Zatvorite ovaj prozor — aplikacija prati narudžbu ${m[1]}.</p></body>`);
  }
  if ((m = p.match(/^\/api\/ulaznice\/([^/]+)$/))) {
    const o = orders.get(m[1]);
    if (!o) return json(res, { error: "order_not_found" }, 404);
    const ev = events.find((e) => e.campaign_id === o.campaign_id);
    return json(res, { order_id: o.id, state: o.state, quantity: o.quantity, amount_cents: o.amount_cents, currency: o.currency, expires_at: o.expires_at, paid_at: o.paid_at,
      buyer_email: mask(o.buyer_email), event: { title: ev.title, slug: ev.slug, ...ev.event },
      tickets: o.tickets.map(({ token, ...t }) => ({ ...t, checked_in_at: null })), dostava: o.state === "paid" ? { status: "sent", at: o.paid_at } : null });
  }
  if ((m = p.match(/^\/api\/ulaznice\/([^/]+)\/(preuzmi|ponovna-dostava)$/)) && req.method === "POST") {
    const o = orders.get(m[1]);
    if (!o) return json(res, { error: "order_not_found" }, 404);
    if (o.state !== "paid") return json(res, { error: "narudzba_nije_placena", state: o.state }, 409);
    const b = await readBody(req);
    if (m[2] === "preuzmi" && (b.buyer_email ?? "").trim().toLowerCase() !== o.buyer_email.toLowerCase()) return json(res, { error: "email_ne_odgovara" }, 403);
    const zivi = o.tickets.filter((t) => t.state === "issued");
    if (!zivi.length) return json(res, { status: "nema_vazecih_ulaznica", recipient: mask(o.buyer_email) });
    const rotirano = zivi.some((t) => t.token === null);
    if (rotirano) { if (++o.rotacije > 5) return json(res, { error: "previse_pokusaja", retry_after: 3600 }, 429); zivi.forEach((t) => (t.token = hex())); }
    const out = zivi.map((t) => ({ serial: t.serial, holder_name: t.holder_name, state: t.state, qr_token: t.token }));
    zivi.forEach((t) => (t.token = null)); // jednokratno: sljedeći poziv mora rotirati
    if (m[2] === "ponovna-dostava") return json(res, { status: "poslano", recipient: mask(o.buyer_email), stari_qr_ponisten: rotirano });
    const ev = events.find((e) => e.campaign_id === o.campaign_id);
    return json(res, { status: "preuzeto", stari_qr_ponisten: rotirano, qr_prefix: "dgdj1:", event: { title: ev.title, slug: ev.slug, ...ev.event }, tickets: out });
  }
  json(res, { error: "not_found" }, 404);
}).listen(PORT, () => console.log(`mock-api na ${BASE}`));
