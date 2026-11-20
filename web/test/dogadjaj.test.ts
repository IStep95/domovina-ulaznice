// Testovi pomoćnika stranice događaja: Markdown opis (odluka 19), karta
// (odluka 14), kalendar i .ics (odluka 20), JSON-LD.
import { test } from "node:test";
import assert from "node:assert/strict";

import type { EventView } from "../src/lib/api.ts";
import { googleKalendarUrl, ics, icsPreklopi, icsTekst } from "../src/lib/kalendar.ts";
import { adresa, koordinate, linkoviKarte, punoMjesto } from "../src/lib/karta.ts";
import { opisHtml, opisTekst } from "../src/lib/opis.ts";
import { dostupnost, eventJsonLd, jsonLdSkripta } from "../src/lib/seo.ts";

// ── opis ─────────────────────────────────────────────────────────────────────

test("opisHtml: odlomci, popis, naslovi spušteni na h3+", () => {
  const html = opisHtml("Tri dana.\n\nRed\ndrugi\n\n# Program\n\n- petak\n- subota\n\n#### Detalji");
  assert.match(html, /<p>Tri dana\.<\/p>/);
  assert.match(html, /<p>Red<br>\ndrugi<\/p>/);
  assert.match(html, /<h3>Program<\/h3>/);
  assert.match(html, /<ul>\n<li>petak<\/li>/);
  assert.match(html, /<h4>Detalji<\/h4>/);
  assert.doesNotMatch(html, /<h[12]/);
});

test("opisHtml: sirovi HTML se escapea", () => {
  const html = opisHtml('<script>alert(1)</script><img src=x onerror=alert(1)> <a href="x">a</a>');
  assert.doesNotMatch(html, /<script|<img|<a href="x"/);
  assert.match(html, /&lt;script&gt;/);
});

test("opisHtml: opasni linkovi i slike se ne iscrtavaju", () => {
  const html = opisHtml("[klik](javascript:alert(1)) [d](data:text/html,x) ![slika](https://tracker.example/p.png)");
  assert.doesNotMatch(html, /href="javascript|href="data|<img/);
});

test("opisHtml: linkovi dobiju rel=nofollow noopener, i goli URL-ovi", () => {
  const html = opisHtml("Više na [stranici](https://prilikazasusret.hr) i www.prilikazasusret.hr/program");
  assert.match(html, /<a href="https:\/\/prilikazasusret.hr" rel="nofollow noopener">stranici<\/a>/);
  assert.match(html, /<a href="http:\/\/www.prilikazasusret.hr\/program" rel="nofollow noopener">/);
});

test("opisHtml / opisTekst: prazno", () => {
  assert.equal(opisHtml(null), "");
  assert.equal(opisHtml("  \n "), "");
  assert.equal(opisTekst(undefined), "");
});

test("opisTekst: bez oznaka, skraćeno na riječ", () => {
  assert.equal(opisTekst("**Tri** dana &\n\n- susreta"), "Tri dana & susreta");
  const dugo = opisTekst("riječ ".repeat(100), 30);
  assert.ok(dugo.length <= 30, dugo);
  assert.match(dugo, /riječ…$/);
});

// ── karta ────────────────────────────────────────────────────────────────────

test("koordinate: oba ili nijedno, raspon, string iz Postgresa", () => {
  assert.deepEqual(koordinate({ venue_lat: 45.807, venue_lon: 15.9515 }), { lat: 45.807, lon: 15.9515 });
  assert.deepEqual(koordinate({ venue_lat: "45.807000", venue_lon: "15.951500" }), { lat: 45.807, lon: 15.9515 });
  assert.equal(koordinate({ venue_lat: 45.8, venue_lon: null }), null);
  assert.equal(koordinate({ venue_lat: 91, venue_lon: 15 }), null);
  assert.equal(koordinate({ venue_lat: 45, venue_lon: -181 }), null);
  assert.equal(koordinate({ venue_lat: "", venue_lon: "" }), null);
  assert.equal(koordinate({}), null, "jezgra bez migracije iz S2b");
  assert.equal(koordinate(null), null);
});

test("linkoviKarte i adresa", () => {
  const l = linkoviKarte({ lat: 45.807, lon: 15.9515 }, "Dom sportova");
  assert.equal(l.google, "https://www.google.com/maps/search/?api=1&query=45.807%2C15.9515");
  assert.equal(l.apple, "https://maps.apple.com/?ll=45.807%2C15.9515&q=Dom+sportova");
  const d = { venue_name: "Dom sportova", venue_address: "Trg Krešimira Ćosića 11", venue_city: "Zagreb" };
  assert.equal(adresa(d), "Trg Krešimira Ćosića 11, Zagreb");
  assert.equal(adresa({ ...d, venue_address: null }), "Zagreb");
  assert.equal(punoMjesto(d), "Dom sportova, Trg Krešimira Ćosića 11, Zagreb");
});

// ── kalendar ─────────────────────────────────────────────────────────────────

const kal = {
  uid: "00000000-0000-4000-8000-000000000d01@ulaznice.domovina.ai",
  naslov: "Prilika za Susret 2027",
  startsAt: "2027-04-16T07:00:00Z",
  endsAt: "2027-04-18T15:00:00Z",
  timeZone: "Europe/Zagreb",
  mjesto: "Dom sportova, Trg Krešimira Ćosića 11, Zagreb",
  opis: "Tri dana susreta.",
  url: "https://ulaznice.domovina.ai/dogadjaj/prilika-za-susret-2027",
};
const SADA = new Date("2026-11-20T10:00:00Z");

test("googleKalendarUrl: UTC vremena i zona događaja", () => {
  const u = new URL(googleKalendarUrl(kal)!);
  assert.equal(u.origin + u.pathname, "https://calendar.google.com/calendar/render");
  assert.equal(u.searchParams.get("action"), "TEMPLATE");
  assert.equal(u.searchParams.get("dates"), "20270416T070000Z/20270418T150000Z");
  assert.equal(u.searchParams.get("ctz"), "Europe/Zagreb");
  assert.equal(u.searchParams.get("location"), kal.mjesto);
  assert.match(u.searchParams.get("details")!, /Tri dana susreta\.\n\nhttps:/);
  assert.equal(googleKalendarUrl({ ...kal, startsAt: null }), null);
});

test("ics: UTC (bez VTIMEZONE), CRLF, polja", () => {
  const f = ics(kal, SADA)!;
  assert.ok(f.endsWith("\r\n"));
  assert.ok(!/[^\r]\n/.test(f), "svi prijelomi su CRLF");
  const redovi = f.split("\r\n");
  assert.equal(redovi[0], "BEGIN:VCALENDAR");
  assert.ok(redovi.includes("DTSTART:20270416T070000Z"));
  assert.ok(redovi.includes("DTEND:20270418T150000Z"));
  assert.ok(redovi.includes("DTSTAMP:20261120T100000Z"));
  assert.ok(redovi.includes(`UID:${kal.uid}`));
  assert.ok(redovi.includes("SUMMARY:Prilika za Susret 2027"));
  assert.ok(redovi.includes("LOCATION:Dom sportova\\, Trg Krešimira Ćosića 11\\, Zagreb"));
  assert.doesNotMatch(f, /VTIMEZONE|TZID/);
});

test("ics: ljetno i zimsko vrijeme (zona događaja → UTC)", () => {
  // 19:30 u Zagrebu: zimi UTC+1, ljeti UTC+2
  assert.match(ics({ ...kal, startsAt: "2027-01-15T18:30:00Z", endsAt: null }, SADA)!, /DTSTART:20270115T183000Z/);
  assert.match(ics({ ...kal, startsAt: "2027-07-15T17:30:00Z", endsAt: null }, SADA)!, /DTSTART:20270715T173000Z/);
});

test("ics: bez ends_at kraj je početak + 2 h", () => {
  const f = ics({ ...kal, endsAt: null }, SADA)!;
  assert.match(f, /DTSTART:20270416T070000Z\r\nDTEND:20270416T090000Z/);
  // kraj prije početka = kao da ga nema
  assert.match(ics({ ...kal, endsAt: "2027-04-16T06:00:00Z" }, SADA)!, /DTEND:20270416T090000Z/);
});

test("ics: bez satnice je cjelodnevni, kraj isključiv", () => {
  // ponoć u Zagrebu = 23:00 UTC dan prije
  const jedan = ics({ ...kal, startsAt: "2026-11-20T23:00:00Z", endsAt: null }, SADA)!;
  assert.match(jedan, /DTSTART;VALUE=DATE:20261121\r\nDTEND;VALUE=DATE:20261122/);
  const vise = ics({ ...kal, startsAt: "2027-02-11T23:00:00Z", endsAt: "2027-02-13T23:00:00Z" }, SADA)!;
  assert.match(vise, /DTSTART;VALUE=DATE:20270212\r\nDTEND;VALUE=DATE:20270215/);
  const g = new URL(googleKalendarUrl({ ...kal, startsAt: "2027-02-11T23:00:00Z", endsAt: "2027-02-13T23:00:00Z" })!);
  assert.equal(g.searchParams.get("dates"), "20270212/20270215");
});

test("ics: bez starts_at nema datoteke", () => {
  assert.equal(ics({ ...kal, startsAt: null }, SADA), null);
});

test("icsTekst i preklapanje na 75 okteta bez rezanja znaka", () => {
  assert.equal(icsTekst("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  const dug = `DESCRIPTION:${"č".repeat(100)}`;
  const preklopljen = icsPreklopi(dug);
  const enc = new TextEncoder();
  for (const r of preklopljen.split("\r\n")) assert.ok(enc.encode(r).length <= 75, r);
  assert.equal(preklopljen.replace(/\r\n /g, ""), dug);
});

// ── JSON-LD ──────────────────────────────────────────────────────────────────

const dogadjaj: EventView = {
  campaign_id: "00000000-0000-4000-8000-000000000d01",
  slug: "prilika-za-susret-2027",
  title: "Prilika za Susret 2027",
  event: {
    event_type: "konferencija",
    venue_name: "Dom sportova",
    venue_address: "Trg Krešimira Ćosića 11",
    venue_city: "Zagreb",
    starts_at: "2027-04-16T07:00:00Z",
    ends_at: "2027-04-18T15:00:00Z",
    timezone: "Europe/Zagreb",
    description_hr: "Tri dana.",
    cover_image_url: null,
    organizer_name: "Udruga Prilika za Susret",
    organizer_email: null,
    organizer_web: null,
  },
  tiers: [
    { id: "t1", title: "Redovna", description: null, price_cents: 6000, imenska: true, sale_start: null, sale_end: null, sold_out: false, not_started: false, ended: false, available: 103, buyable: true },
    { id: "t2", title: "Rani upis", description: null, price_cents: 5000, imenska: true, sale_start: "2026-10-01T08:00:00Z", sale_end: null, sold_out: true, not_started: false, ended: false, available: 0, buyable: false },
  ],
  stripe_connected: true,
  kupovno: true,
  brand: null,
};
const urlovi = { url: "https://x.hr/dogadjaj/prilika-za-susret-2027", urlKupnje: "https://x.hr/dogadjaj/prilika-za-susret-2027/kupnja" };

test("eventJsonLd: Event s offers po tieru", () => {
  const ld = eventJsonLd({ dogadjaj, ...urlovi, opis: "Tri dana." }) as Record<string, any>;
  assert.equal(ld["@type"], "Event");
  assert.equal(ld.startDate, "2027-04-16T07:00:00Z");
  assert.equal(ld.endDate, "2027-04-18T15:00:00Z");
  assert.equal(ld.location.address.addressLocality, "Zagreb");
  assert.equal(ld.location.geo, undefined, "bez koordinata nema geo");
  assert.deepEqual(
    ld.offers.map((o: any) => [o.name, o.price, o.priceCurrency, o.availability]),
    [
      ["Redovna", "60.00", "EUR", "https://schema.org/InStock"],
      ["Rani upis", "50.00", "EUR", "https://schema.org/SoldOut"],
    ],
  );
  assert.equal(ld.offers[1].validFrom, "2026-10-01T08:00:00Z");
});

test("eventJsonLd: geo kad ima koordinata; bez starts_at nema JSON-LD-a", () => {
  const sGeo = { ...dogadjaj, event: { ...dogadjaj.event!, venue_lat: 45.807, venue_lon: 15.9515 } as EventView["event"] };
  const ld = eventJsonLd({ dogadjaj: sGeo, ...urlovi }) as Record<string, any>;
  assert.deepEqual(ld.location.geo, { "@type": "GeoCoordinates", latitude: 45.807, longitude: 15.9515 });
  assert.equal(eventJsonLd({ dogadjaj: { ...dogadjaj, event: { ...dogadjaj.event!, starts_at: null } }, ...urlovi }), null);
  assert.equal(eventJsonLd({ dogadjaj: { ...dogadjaj, event: null }, ...urlovi }), null);
});

test("dostupnost: sva stanja", () => {
  const t = { sold_out: false, not_started: false, ended: false, available: null };
  assert.equal(dostupnost(t), "https://schema.org/InStock");
  assert.equal(dostupnost({ ...t, available: 4 }), "https://schema.org/LimitedAvailability");
  assert.equal(dostupnost({ ...t, sold_out: true }), "https://schema.org/SoldOut");
  assert.equal(dostupnost({ ...t, not_started: true }), "https://schema.org/PreSale");
  assert.equal(dostupnost({ ...t, ended: true }), "https://schema.org/Discontinued");
});

test("jsonLdSkripta: opis ne može zatvoriti <script>", () => {
  const s = jsonLdSkripta({ description: "</script><script>alert(1)</script>" });
  assert.doesNotMatch(s, /<\/script>/i);
  assert.deepEqual(JSON.parse(s), { description: "</script><script>alert(1)</script>" });
});
