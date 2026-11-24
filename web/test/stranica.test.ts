// Pregled linka (S8, odluka 705): mjere zadane slike i og:image:type iz nastavka
// (web/src/lib/stranica.ts). Mjere se čitaju iz same datoteke (PNG IHDR), da
// zamjena public/og-zadana.png bez promjene OG_ZADANA_MJERE sruši test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { OG_ZADANA_MJERE, ogTipSlike, ogZadanaSlika } from "../src/lib/stranica.ts";

test("OG_ZADANA_MJERE odgovara stvarnoj datoteci public/og-zadana.png", () => {
  const png = readFileSync(new URL("../public/og-zadana.png", import.meta.url));
  assert.equal(png.subarray(1, 4).toString("ascii"), "PNG");
  assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
  assert.deepEqual(
    { sirina: png.readUInt32BE(16), visina: png.readUInt32BE(20), tip: "image/png" },
    OG_ZADANA_MJERE,
  );
  assert.equal(ogZadanaSlika("https://ulaznice.domovina.ai"), "https://ulaznice.domovina.ai/og-zadana.png");
});

test("ogTipSlike: MIME iz nastavka putanje; query, velika slova; nepoznato ili neispravno null", () => {
  assert.equal(ogTipSlike("https://cdn.primjer.hr/a/naslovna.JPG"), "image/jpeg");
  assert.equal(ogTipSlike("https://cdn.primjer.hr/a/naslovna.jpeg?w=1200#x"), "image/jpeg");
  assert.equal(ogTipSlike("https://cdn.primjer.hr/n.webp"), "image/webp");
  assert.equal(ogTipSlike("https://ulaznice.domovina.ai/og-zadana.png"), "image/png");
  assert.equal(ogTipSlike("https://cdn.primjer.hr/slika?format=png"), null, "nastavak u queryju se ne gleda");
  assert.equal(ogTipSlike("https://cdn.primjer.hr/slika.svg"), null);
  assert.equal(ogTipSlike("https://cdn.primjer.hr/slika"), null);
  assert.equal(ogTipSlike("nije url.png"), null);
});
