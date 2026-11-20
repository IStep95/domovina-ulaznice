// Testovi poruka grešaka kupnje (web/src/lib/poruke.ts, S4): kod → rečenica,
// ponašanje forme po kodu, 429 s `retry_after` i klasifikacija bačenih grešaka.
// Pokrivenost kodova iz Workera je u kodovi-gresaka.test.ts.
import { test } from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/lib/api.ts";
import {
  GENERICKA_PORUKA,
  KOD_MREZA,
  KOD_NEDOVOLJNO,
  PORUKE_NARUDZBE,
  ZADANO_CEKANJE_S,
  greskaNarudzbe,
  kodIzGreske,
  porukaCekanja,
  porukaGreske,
} from "../src/lib/poruke.ts";

// ── porukaGreske ────────────────────────────────────────────────────────────

test("porukaGreske: poznat kod → njegova poruka", () => {
  assert.equal(porukaGreske("tier_sold_out"), PORUKE_NARUDZBE.tier_sold_out);
  assert.equal(porukaGreske("invalid_buyer_email"), "Upišite ispravnu e-mail adresu.");
});

test("porukaGreske: nepoznat kod → generička poruka", () => {
  for (const kod of ["nepoznata_greska", "", "TIER_SOLD_OUT", "neki_novi_kod_jezgre"]) {
    assert.equal(porukaGreske(kod), GENERICKA_PORUKA, kod);
  }
});

test("porukaGreske: svojstva Object.prototypea nisu kodovi (toString, __proto__, constructor)", () => {
  for (const kod of ["toString", "__proto__", "constructor", "hasOwnProperty"]) {
    assert.equal(porukaGreske(kod), GENERICKA_PORUKA, kod);
  }
});

test("porukaGreske: http_5xx bez koda u tijelu → poruka da poslužitelj ne odgovara", () => {
  const p503 = porukaGreske("http_503");
  assert.notEqual(p503, GENERICKA_PORUKA);
  assert.match(p503, /Poslužitelj trenutačno ne odgovara/);
  assert.equal(porukaGreske("http_500"), p503);
  assert.equal(porukaGreske("http_502"), p503);
  assert.equal(porukaGreske("http_599"), p503);
});

test("porukaGreske: http_4xx i neispravni http_ kodovi → generička poruka", () => {
  for (const kod of ["http_400", "http_404", "http_429", "http_499", "http_5000", "http_50", "http_abc", "xhttp_503"]) {
    assert.equal(porukaGreske(kod), GENERICKA_PORUKA, kod);
  }
});

// ── 429: previse_pokusaja ───────────────────────────────────────────────────

test("porukaCekanja: sekunde ispod minute, minute zaokružene naviše", () => {
  assert.equal(porukaCekanja(45), "Pokušajte ponovno za 45 s.");
  assert.equal(porukaCekanja(12.2), "Pokušajte ponovno za 13 s.");
  assert.equal(porukaCekanja(59.5), "Pokušajte ponovno za 1 min.");
  assert.equal(porukaCekanja(60), "Pokušajte ponovno za 1 min.");
  assert.equal(porukaCekanja(61), "Pokušajte ponovno za 2 min.");
  assert.equal(porukaCekanja(90), "Pokušajte ponovno za 2 min.");
  assert.equal(porukaCekanja(600), "Pokušajte ponovno za 10 min.");
  // Nikad „0 s”.
  assert.equal(porukaCekanja(0), "Pokušajte ponovno za 1 s.");
  assert.equal(porukaCekanja(-5), "Pokušajte ponovno za 1 s.");
});

test("greskaNarudzbe: previse_pokusaja s retry_after → čekanje toliko sekundi, minute naviše", () => {
  const g = greskaNarudzbe("previse_pokusaja", 90);
  assert.equal(g.ton, "wait");
  assert.equal(g.cekajSekundi, 90);
  assert.equal(g.poruka, "Previše pokušaja.");
  assert.equal(g.dopuna, "Pokušajte ponovno za 2 min.");
  assert.equal(g.konacno, false);

  const kratko = greskaNarudzbe("previse_pokusaja", 12.3);
  assert.equal(kratko.cekajSekundi, 13);
  assert.equal(kratko.dopuna, "Pokušajte ponovno za 13 s.");
});

test("greskaNarudzbe: previse_pokusaja bez retry_after → zadano čekanje", () => {
  for (const ra of [undefined, Number.NaN, Number.POSITIVE_INFINITY, -1, 0]) {
    const g = greskaNarudzbe("previse_pokusaja", ra);
    assert.equal(g.ton, "wait", String(ra));
    assert.equal(g.cekajSekundi, ZADANO_CEKANJE_S, String(ra));
    assert.equal(g.dopuna, porukaCekanja(ZADANO_CEKANJE_S), String(ra));
  }
  assert.equal(ZADANO_CEKANJE_S, 60);
});

test("greskaNarudzbe: retry_after se gleda samo uz previse_pokusaja", () => {
  const g = greskaNarudzbe("tier_sold_out", 90);
  assert.equal(g.ton, "error");
  assert.equal(g.cekajSekundi, 0);
  assert.equal(g.dopuna, undefined);
});

// ── ponašanje forme po kodu ─────────────────────────────────────────────────

test("greskaNarudzbe: cilj greške (inline polje)", () => {
  assert.equal(greskaNarudzbe("invalid_buyer_email").cilj, "email");
  assert.equal(greskaNarudzbe("holders_incomplete").cilj, "imena");
  assert.equal(greskaNarudzbe("invalid_holder").cilj, "imena");
  assert.equal(greskaNarudzbe("tier_sold_out").cilj, null);
  assert.ok(greskaNarudzbe("holders_incomplete").dopuna);
});

test("greskaNarudzbe: raspoloživost → osvježi tierove; organizator/kampanja → konačno", () => {
  for (const kod of ["tier_sold_out", "sale_not_started", "sale_ended", "tier_not_found", KOD_NEDOVOLJNO]) {
    const g = greskaNarudzbe(kod);
    assert.equal(g.osvjezi, true, kod);
    assert.equal(g.konacno, false, kod);
  }
  for (const kod of ["organizer_not_connected", "organizer_charges_disabled", "event_not_found", "campaign_not_active"]) {
    const g = greskaNarudzbe(kod);
    assert.equal(g.konacno, true, kod);
    assert.equal(g.osvjezi, false, kod);
  }
  const prolazna = greskaNarudzbe("api_feed_error");
  assert.equal(prolazna.konacno, false);
  assert.equal(prolazna.osvjezi, false);
  assert.equal(prolazna.ton, "error");
});

test("tehnički kod se nikad ne pojavljuje u poruci ni dopuni (svi ključevi mape)", () => {
  const kodovi = [...Object.keys(PORUKE_NARUDZBE), "http_503", "http_400", "nepoznata_greska"];
  for (const kod of kodovi) {
    const g = greskaNarudzbe(kod, 90);
    const tekst = `${g.poruka} ${g.dopuna ?? ""}`;
    assert.ok(!tekst.includes(kod), `${kod}: „${tekst}”`);
    // Ni jedan drugi kod, ni išta nalik strojnom kodu (snake_case, http_…).
    for (const drugi of Object.keys(PORUKE_NARUDZBE)) assert.ok(!tekst.includes(drugi), `${kod} sadrži ${drugi}`);
    assert.doesNotMatch(tekst, /[a-z0-9]+_[a-z0-9_]+/i, kod);
    assert.equal(g.kod, kod);
  }
});

test("svaka poruka je rečenica: neprazna, s velikim početnim slovom i točkom na kraju", () => {
  for (const [kod, poruka] of Object.entries(PORUKE_NARUDZBE)) {
    assert.match(poruka, /^[A-ZČĆŽŠĐ].*\.$/, kod);
  }
  assert.match(GENERICKA_PORUKA, /^[A-Z].*\.$/);
});

// ── kodIzGreske ─────────────────────────────────────────────────────────────

test("kodIzGreske: ApiError → kod s backenda i retry_after", () => {
  const r = kodIzGreske(new ApiError("previse_pokusaja", 429, 90));
  assert.equal(r.kod, "previse_pokusaja");
  assert.equal(r.retryAfter, 90);

  const bez = kodIzGreske(new ApiError("tier_sold_out", 409));
  assert.equal(bez.kod, "tier_sold_out");
  assert.equal(bez.retryAfter, undefined);
});

test("kodIzGreske: TypeError (fetch nije stigao do poslužitelja) → mrezna_greska", () => {
  const r = kodIzGreske(new TypeError("Failed to fetch"));
  assert.equal(r.kod, KOD_MREZA);
  assert.equal(r.retryAfter, undefined);
  assert.notEqual(porukaGreske(r.kod), GENERICKA_PORUKA);
});

test("kodIzGreske: sve ostalo → nepoznat kod s generičkom porukom", () => {
  for (const e of [new Error("x"), new RangeError("y"), "string", null, undefined, { code: "tier_sold_out" }]) {
    const r = kodIzGreske(e);
    assert.equal(r.kod, "nepoznata_greska");
    assert.equal(porukaGreske(r.kod), GENERICKA_PORUKA);
  }
});
