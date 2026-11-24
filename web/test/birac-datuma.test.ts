// Birač datuma (web/src/lib/birac-datuma.ts, S8): preneseno iz
// worker-tests/editor.test.ts (SPA kalendar) bez promjene očekivanja.
import { test } from "node:test";
import assert from "node:assert/strict";

import { danasUZagrebu, mrezaMjeseca, nazivMjeseca, opisVremena, predlozeniKraj } from "../src/lib/birac-datuma.ts";

test("kalendar: mreža počinje ponedjeljkom, 42 dana, ispravni rubovi", () => {
  const srpanj = mrezaMjeseca(2027, 6); // 1. 7. 2027. je četvrtak
  assert.equal(srpanj.length, 42);
  assert.deepEqual(srpanj.slice(0, 4).map((d) => d.iso), ["2027-06-28", "2027-06-29", "2027-06-30", "2027-07-01"]);
  assert.equal(srpanj[3].uMjesecu, true);
  assert.equal(srpanj[0].uMjesecu, false);
  assert.equal(srpanj.filter((d) => d.uMjesecu).length, 31);
  // veljača prijestupne godine, prvi je ponedjeljak
  const veljaca = mrezaMjeseca(2028, 1);
  assert.equal(veljaca.filter((d) => d.uMjesecu).length, 29);
  assert.equal(mrezaMjeseca(2027, 2)[0].iso, "2027-03-01");
});

test("kalendar: hrvatski opisi i prijedlog kraja", () => {
  assert.equal(nazivMjeseca(2027, 6), "srpanj 2027.");
  assert.equal(opisVremena("2027-07-10T20:30"), "subota, 10. srpnja 2027. u 20:30");
  assert.equal(opisVremena(""), null);
  assert.equal(predlozeniKraj("2027-07-10T20:30"), "22:30");
  assert.equal(predlozeniKraj("2027-07-10T22:30"), "23:45");
  assert.equal(predlozeniKraj(""), "22:00");
  assert.equal(danasUZagrebu(new Date("2027-01-01T23:30:00Z")), "2027-01-02");
});
