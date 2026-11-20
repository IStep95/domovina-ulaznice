// Testovi naglasne boje (web/src/lib/naglasak.ts), node:test, bez mreže.
// Pravilo 1 u web/design/README.md: on-accent = crna/bijela s većim kontrastom,
// naglasak kao tekst ≥ 4,5:1 na podlozi, inače potamnjen.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ZADANA_PODLOGA,
  ZADANI_NAGLASAK,
  izracunajNaglasak,
  kontrast,
  luminancija,
  naglasakKaoTekst,
  naglasakStil,
  normalizirajHex,
} from "../src/lib/naglasak.ts";

test("normalizirajHex: #rgb, velika slova, razmaci; sve ostalo null", () => {
  assert.equal(normalizirajHex("#2F855A"), "#2f855a");
  assert.equal(normalizirajHex("  2f855a "), "#2f855a");
  assert.equal(normalizirajHex("#abc"), "#aabbcc");
  for (const los of [null, undefined, "", "zelena", "#12345", "#1234567", "rgb(0,0,0)", "#2f855a80", 42, "#fff;color:red"]) {
    assert.equal(normalizirajHex(los), null, String(los));
  }
});

test("kontrast: WCAG krajnosti i poznate vrijednosti iz dizajna", () => {
  assert.equal(luminancija("#000000"), 0);
  assert.equal(luminancija("#ffffff"), 1);
  assert.equal(kontrast("#000000", "#ffffff"), 21);
  assert.equal(kontrast("#ffffff", "#000000"), 21);
  // Main.dc.html: #2f855a · bijelo 4,5:1; #1a365d · bijelo 12,3:1 (zaokruženo)
  assert.ok(Math.abs(kontrast("#2f855a", "#ffffff") - 4.54) < 0.01);
  assert.ok(Math.abs(kontrast("#1a365d", "#ffffff") - 12.14) < 0.01);
  // tokens.css: --color-text-muted 6,2:1 na bijelom
  assert.ok(Math.abs(kontrast("#5b635d", "#ffffff") - 6.2) < 0.05);
});

test("neispravan ili prazan accent_color → zadana zelena", () => {
  for (const ulaz of [null, undefined, "", "nije-boja", "#zzzzzz"]) {
    assert.equal(izracunajNaglasak(ulaz).accent, ZADANI_NAGLASAK);
  }
});

test("onAccent: bijela na tamnom, tamna (#131714) na svijetlom; zadana zelena je bijela kao u tokenu", () => {
  assert.equal(izracunajNaglasak("#2f855a").onAccent, "#ffffff");
  assert.equal(izracunajNaglasak("#1a365d").onAccent, "#ffffff");
  assert.equal(izracunajNaglasak("#7b2d43").onAccent, "#ffffff");
  assert.equal(izracunajNaglasak("#f6e05e").onAccent, "#131714");
  assert.equal(izracunajNaglasak("#ffffff").onAccent, "#131714");
});

test("onAccent je uvijek ona od dviju s većim kontrastom", () => {
  for (const hex of ["#2f855a", "#38a169", "#e53e3e", "#3182ce", "#805ad5", "#dd6b20", "#808080", "#000000"]) {
    const n = izracunajNaglasak(hex);
    const druga = n.onAccent === "#ffffff" ? "#131714" : "#ffffff";
    assert.ok(kontrast(hex, n.onAccent) >= kontrast(hex, druga), hex);
  }
});

test("accentText: tamna boja ostaje ista, svijetla se potamni do ≥ 4,5:1", () => {
  assert.equal(izracunajNaglasak("#1a365d").accentText, "#1a365d");
  assert.equal(izracunajNaglasak("#7b2d43").accentText, "#7b2d43");

  const zuta = izracunajNaglasak("#f6e05e").accentText;
  assert.notEqual(zuta, "#f6e05e");
  assert.ok(kontrast(zuta, ZADANA_PODLOGA) >= 4.5);
  assert.ok(kontrast(zuta, "#ffffff") >= 4.5);
  // potamnjena, ali ne do crne: ostaje žuto-maslinasta (crveni kanal > plavi)
  assert.ok(luminancija(zuta) < luminancija("#f6e05e"));
  const [r, , b] = [1, 3, 5].map((i) => parseInt(zuta.slice(i, i + 2), 16));
  assert.ok(r > b + 60, zuta);
  // najmanje potamnjenje: svjetlija od primjera iz dizajna (#6e5a00, 6,7:1)
  assert.ok(luminancija(zuta) > luminancija("#6e5a00"));
});

test("accentText prolazi za cijeli raspon boja, i na bijeloj podlozi", () => {
  for (let i = 0; i < 4096; i += 7) {
    const hex = "#" + [i >> 8, (i >> 4) & 15, i & 15].map((v) => (v * 17).toString(16).padStart(2, "0")).join("");
    assert.ok(kontrast(naglasakKaoTekst(hex), ZADANA_PODLOGA) >= 4.5, hex);
    assert.ok(kontrast(naglasakKaoTekst(hex, "#ffffff"), "#ffffff") >= 4.5, hex);
  }
});

test("zadana zelena kao tekst: 4,1:1 na --color-bg pa se potamni (token --color-accent-text)", () => {
  assert.ok(kontrast("#2f855a", ZADANA_PODLOGA) < 4.5);
  assert.equal(izracunajNaglasak(null).accentText, "#2c7d55");
  // na bijeloj prolazi kakva jest
  assert.equal(naglasakKaoTekst("#2f855a", "#ffffff"), "#2f855a");
});

test("naglasakStil: tri varijable, samo heks (bez ubacivanja CSS-a)", () => {
  assert.equal(
    naglasakStil("#1a365d"),
    "--color-accent:#1a365d;--color-on-accent:#ffffff;--color-accent-text:#1a365d",
  );
  assert.equal(naglasakStil("red;background:url(x)"), naglasakStil(null));
});
