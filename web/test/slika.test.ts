// Upload slike u editoru: čisti dio lib/slika.ts (smanjivanje i kad se slika
// šalje kakva jest). Crtanje u canvas treba preglednik i provjerava se ručno.
import { test } from "node:test";
import assert from "node:assert/strict";

import { NAJVECA_STRANICA, saljeSeKakvaJest, smanjeneDimenzije } from "../src/lib/slika.ts";

test("smanjivanje: dulja stranica na 1600 px, omjer ostaje, mala slika se ne povećava", () => {
  assert.deepEqual(smanjeneDimenzije(4032, 3024), { sirina: NAJVECA_STRANICA, visina: 1200 });
  assert.deepEqual(smanjeneDimenzije(3024, 4032), { sirina: 1200, visina: NAJVECA_STRANICA });
  assert.deepEqual(smanjeneDimenzije(800, 600), { sirina: 800, visina: 600 });
  assert.deepEqual(smanjeneDimenzije(10000, 3), { sirina: 1600, visina: 1 });
  assert.deepEqual(smanjeneDimenzije(0, 600), { sirina: 0, visina: 0 });
});

test("kakva jest ide samo mala slika u vrsti koju bucket prima", () => {
  assert.equal(saljeSeKakvaJest("image/webp", 300_000, 1200, 800), true);
  assert.equal(saljeSeKakvaJest("image/jpeg", 3_000_000, 1200, 800), false, "prevelika datoteka");
  assert.equal(saljeSeKakvaJest("image/jpeg", 300_000, 4000, 3000), false, "prevelike dimenzije");
  assert.equal(saljeSeKakvaJest("image/gif", 100_000, 400, 300), false, "bucket ne prima GIF");
  assert.equal(saljeSeKakvaJest("image/heic", 100_000, 400, 300), false);
});
