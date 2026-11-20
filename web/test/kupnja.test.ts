// Testovi logike forme kupnje (web/src/lib/kupnja.ts, S4): validacija polja,
// granice količine, imena po komadu i tijelo POST /api/narudzba. Pravila
// zrcale Worker (worker/index.ts), pa se konstante uspoređuju s njegovim izvorom.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import type { TierView } from "../src/lib/api.ts";
import {
  EMAIL_MAX,
  EMAIL_RE,
  IME_MAX,
  IME_MIN,
  MAX_KOLICINA,
  adresaPlacanja,
  iznosCenti,
  najvecaKolicina,
  ogranicenaKolicina,
  pocetniTier,
  prilagodiImena,
  provjeriEmail,
  provjeriFormu,
  provjeriIme,
  tijeloNarudzbe,
  type StanjeForme,
} from "../src/lib/kupnja.ts";
import { PORUKE_POLJA } from "../src/lib/poruke.ts";

const CAMPAIGN = "00000000-0000-4000-8000-000000000d01";

function tier(p: Partial<TierView> = {}): TierView {
  return {
    id: "00000000-0000-4000-8000-0000000000a1",
    title: "Redovna",
    description: null,
    price_cents: 6000,
    imenska: false,
    sale_start: null,
    sale_end: null,
    sold_out: false,
    not_started: false,
    ended: false,
    available: 100,
    buyable: true,
    ...p,
  };
}

function stanje(p: Partial<StanjeForme> = {}): StanjeForme {
  return { tier: tier(), kolicina: 1, imena: [], email: "ana@primjer.hr", uvjeti: true, ...p };
}

// ── zrcaljenje Workera ──────────────────────────────────────────────────────

const worker = readFileSync(new URL("../../worker/index.ts", import.meta.url), "utf8");

test("EMAIL_RE je isti kao EMAIL_RE u worker/index.ts", () => {
  const m = /^const EMAIL_RE = \/(.+)\/([a-z]*);$/m.exec(worker);
  assert.ok(m, "nema `const EMAIL_RE = /…/;` u worker/index.ts");
  assert.equal(EMAIL_RE.source, m[1]);
  assert.equal(EMAIL_RE.flags, m[2]);
});

test("MAX_KOLICINA je isti kao MAX_QTY u worker/index.ts", () => {
  const m = /^const MAX_QTY = (\d+);$/m.exec(worker);
  assert.ok(m, "nema `const MAX_QTY = N;` u worker/index.ts");
  assert.equal(MAX_KOLICINA, Number(m[1]));
});

test("EMAIL_MAX i IME_MIN/IME_MAX su iste granice kao u POST /api/narudzba", () => {
  assert.match(worker, new RegExp(`buyerEmail\\.length > ${EMAIL_MAX}\\b`));
  assert.match(worker, new RegExp(`full_name\\.length < ${IME_MIN} \\|\\| h\\.full_name\\.length > ${IME_MAX}\\b`));
});

// ── e-mail ──────────────────────────────────────────────────────────────────

test("provjeriEmail: prazno (i samo razmaci) → emailPrazan", () => {
  assert.equal(provjeriEmail(""), PORUKE_POLJA.emailPrazan);
  assert.equal(provjeriEmail("   "), PORUKE_POLJA.emailPrazan);
});

test("provjeriEmail: bez @, bez domene, s razmakom → emailNeispravan", () => {
  for (const e of ["ana.primjer.hr", "ana@", "@primjer.hr", "ana@primjer", "ana@primjer.h", "a na@primjer.hr", "ana@@primjer.hr"]) {
    assert.equal(provjeriEmail(e), PORUKE_POLJA.emailNeispravan, e);
  }
});

test("provjeriEmail: dulje od 200 znakova → emailPredug; točno 200 prolazi", () => {
  const domena = "@primjer.hr"; // 11
  const tocno200 = "a".repeat(200 - domena.length) + domena;
  assert.equal(tocno200.length, 200);
  assert.equal(provjeriEmail(tocno200), null);
  assert.equal(provjeriEmail("a" + tocno200), PORUKE_POLJA.emailPredug);
  // Razmaci oko adrese se ne broje (Worker radi trim prije provjere).
  assert.equal(provjeriEmail(`  ${tocno200}  `), null);
});

test("provjeriEmail: valjane adrese (trim)", () => {
  for (const e of ["ana@primjer.hr", " ana.horvat+ulaznice@mail.primjer.com ", "a@b.co"]) {
    assert.equal(provjeriEmail(e), null, e);
  }
});

// ── imena ───────────────────────────────────────────────────────────────────

test("provjeriIme: trim, najmanje 2 i najviše 120 znakova", () => {
  assert.equal(provjeriIme(""), PORUKE_POLJA.imeKratko);
  assert.equal(provjeriIme("   "), PORUKE_POLJA.imeKratko);
  assert.equal(provjeriIme(" A "), PORUKE_POLJA.imeKratko);
  assert.equal(provjeriIme(" Al "), null);
  assert.equal(provjeriIme("Ana Horvat"), null);
  assert.equal(provjeriIme("x".repeat(120)), null);
  assert.equal(provjeriIme(`  ${"x".repeat(120)}  `), null);
  assert.equal(provjeriIme("x".repeat(121)), PORUKE_POLJA.imeDugo);
});

test("provjeriFormu: imenski tier traži valjano ime za svaki komad", () => {
  const t = tier({ imenska: true });
  const r = provjeriFormu(stanje({ tier: t, kolicina: 3, imena: ["Ana Horvat", " I ", ""] }));
  assert.equal(r.valjano, false);
  assert.deepEqual(r.imena, [null, PORUKE_POLJA.imeKratko, PORUKE_POLJA.imeKratko]);
  assert.ok(r.nedostaje.includes("upišite ime i prezime za svaku ulaznicu"));

  // Kraći niz imena od količine: nedostajući komadi su prazni → greška.
  const kraci = provjeriFormu(stanje({ tier: t, kolicina: 2, imena: ["Ana Horvat"] }));
  assert.equal(kraci.valjano, false);
  assert.equal(kraci.imena.length, 2);

  const ok = provjeriFormu(stanje({ tier: t, kolicina: 2, imena: ["Ana Horvat", "Ivo Ivić"] }));
  assert.equal(ok.valjano, true);
  assert.deepEqual(ok.nedostaje, []);
});

test("provjeriFormu: neimenski tier ne gleda imena", () => {
  const r = provjeriFormu(stanje({ kolicina: 3, imena: ["", "x"] }));
  assert.equal(r.valjano, true);
  assert.deepEqual(r.imena, []);
});

// ── količina ────────────────────────────────────────────────────────────────

test("najvecaKolicina: min(10, available); null = neograničeno do 10; rasprodano = 0", () => {
  assert.equal(najvecaKolicina(tier({ available: null })), 10);
  assert.equal(najvecaKolicina(tier({ available: 100 })), 10);
  assert.equal(najvecaKolicina(tier({ available: 10 })), 10);
  assert.equal(najvecaKolicina(tier({ available: 4 })), 4);
  assert.equal(najvecaKolicina(tier({ available: 1 })), 1);
  assert.equal(najvecaKolicina(tier({ available: 0 })), 0);
  assert.equal(najvecaKolicina(tier({ available: -3 })), 0);
  assert.equal(najvecaKolicina(null), 0);
  assert.equal(najvecaKolicina(undefined), 0);
});

test("ogranicenaKolicina: cijeli broj u 1…max", () => {
  assert.equal(ogranicenaKolicina(5, 10), 5);
  assert.equal(ogranicenaKolicina(11, 10), 10);
  assert.equal(ogranicenaKolicina(0, 10), 1);
  assert.equal(ogranicenaKolicina(-2, 4), 1);
  assert.equal(ogranicenaKolicina(3.9, 10), 3);
  assert.equal(ogranicenaKolicina(Number.NaN, 10), 1);
  assert.equal(ogranicenaKolicina(5, 0), 1);
});

test("provjeriFormu: količina 1…10 i ne više od preostalog", () => {
  assert.equal(provjeriFormu(stanje({ kolicina: 10, tier: tier({ available: null }) })).valjano, true);
  assert.equal(provjeriFormu(stanje({ kolicina: 11, tier: tier({ available: null }) })).valjano, false);
  assert.equal(provjeriFormu(stanje({ kolicina: 0 })).valjano, false);
  assert.equal(provjeriFormu(stanje({ kolicina: 1.5 })).valjano, false);

  const ogr = tier({ available: 4 });
  assert.equal(provjeriFormu(stanje({ tier: ogr, kolicina: 4 })).valjano, true);
  const previse = provjeriFormu(stanje({ tier: ogr, kolicina: 5 }));
  assert.equal(previse.valjano, false);
  assert.ok(previse.nedostaje.includes("odaberite između 1 i 4 ulaznica"));
});

test("provjeriFormu: bez tiera, nekupiv ili rasprodan tier → nevaljano", () => {
  for (const t of [null, tier({ buyable: false, ended: true }), tier({ available: 0, sold_out: true, buyable: false }), tier({ available: 0 })]) {
    const r = provjeriFormu(stanje({ tier: t }));
    assert.equal(r.valjano, false);
    assert.ok(r.nedostaje.includes("odaberite vrstu ulaznice"));
  }
});

test("prilagodiImena: pri promjeni količine čuva postojeća, nova su prazna", () => {
  assert.deepEqual(prilagodiImena([], 2), ["", ""]);
  assert.deepEqual(prilagodiImena(["Ana", "Ivo"], 3), ["Ana", "Ivo", ""]);
  assert.deepEqual(prilagodiImena(["Ana", "Ivo", "Eva"], 1), ["Ana"]);
  assert.deepEqual(prilagodiImena(["Ana"], 0), []);
  assert.deepEqual(prilagodiImena(["Ana"], -1), []);
  // Smanji pa povećaj: forma čuva dulji niz (imenaUnos), pa se ime vraća.
  const unos = ["Ana", "Ivo", "Eva"];
  assert.deepEqual(prilagodiImena(prilagodiImena(unos, 1), 3), ["Ana", "", ""]);
  assert.deepEqual(prilagodiImena(unos, 3), unos);
  // Ne mijenja ulazni niz.
  assert.deepEqual(unos, ["Ana", "Ivo", "Eva"]);
});

test("pocetniTier: prvi kupivi, inače null", () => {
  assert.equal(pocetniTier([{ id: "a", buyable: false }, { id: "b", buyable: true }, { id: "c", buyable: true }]), "b");
  assert.equal(pocetniTier([{ id: "a", buyable: false }]), null);
  assert.equal(pocetniTier([]), null);
});

// ── uvjeti ──────────────────────────────────────────────────────────────────

test("provjeriFormu: neprihvaćeni uvjeti → nevaljano", () => {
  const r = provjeriFormu(stanje({ uvjeti: false }));
  assert.equal(r.valjano, false);
  assert.deepEqual(r.nedostaje, ["prihvatite uvjete"]);
  assert.equal(provjeriFormu(stanje({ uvjeti: true })).valjano, true);
});

test("provjeriFormu: neispravan e-mail → nevaljano, s greškom polja", () => {
  const r = provjeriFormu(stanje({ email: "ana@" }));
  assert.equal(r.valjano, false);
  assert.equal(r.email, PORUKE_POLJA.emailNeispravan);
  assert.ok(r.nedostaje.includes("upišite ispravnu e-mail adresu"));
});

// ── tijelo zahtjeva i iznos ─────────────────────────────────────────────────

test("tijeloNarudzbe: imenski tier šalje holders (trim), duljine količine", () => {
  const t = tier({ imenska: true });
  const b = tijeloNarudzbe(CAMPAIGN, { ...stanje({ kolicina: 2, imena: [" Ana Horvat ", "Ivo Ivić", "višak"], email: " ana@primjer.hr " }), tier: t });
  assert.deepEqual(b, {
    campaign_id: CAMPAIGN,
    tier_id: t.id,
    quantity: 2,
    buyer_email: "ana@primjer.hr",
    holders: [{ full_name: "Ana Horvat" }, { full_name: "Ivo Ivić" }],
  });
});

test("tijeloNarudzbe: neimenski tier šalje prazan holders i kad imena postoje", () => {
  const t = tier({ imenska: false });
  const b = tijeloNarudzbe(CAMPAIGN, { ...stanje({ kolicina: 3, imena: ["Ana", "Ivo", "Eva"] }), tier: t });
  assert.deepEqual(b.holders, []);
  assert.equal(b.quantity, 3);
  assert.ok(Number.isInteger(b.quantity));
  // Tijelo ne nosi cijenu: iznos određuje jezgra, ne klijent.
  assert.deepEqual(Object.keys(b).sort(), ["buyer_email", "campaign_id", "holders", "quantity", "tier_id"]);
});

test("iznosCenti: cijena × količina u cijelim centima", () => {
  assert.equal(iznosCenti(tier({ price_cents: 6000 }), 3), 18000);
  assert.equal(iznosCenti(tier({ price_cents: 3500 }), 1), 3500);
  assert.equal(iznosCenti(tier({ price_cents: 1999 }), 7), 13993);
  assert.equal(iznosCenti(tier({ price_cents: 0 }), 4), 0);
  assert.equal(iznosCenti(null, 3), 0);
  // Centi su integer za sve količine 1…10 (nema float aritmetike s eurima).
  for (let q = 1; q <= MAX_KOLICINA; q++) assert.ok(Number.isInteger(iznosCenti(tier({ price_cents: 1999 }), q)));
});

// ── adresa plaćanja ─────────────────────────────────────────────────────────

test("adresaPlacanja: samo apsolutni http(s) URL", () => {
  assert.equal(adresaPlacanja("https://checkout.stripe.com/c/pay/cs_test_1"), "https://checkout.stripe.com/c/pay/cs_test_1");
  assert.equal(adresaPlacanja("http://localhost:4321/mock-checkout/x"), "http://localhost:4321/mock-checkout/x");
  for (const u of ["javascript:alert(1)", "/relativno", "", null, undefined, 42, "data:text/html,x", "ftp://x.hr/"]) {
    assert.equal(adresaPlacanja(u), null, String(u));
  }
});
