// Testovi privremenih pomoćnika za prikaz (web/src/lib/prikaz.ts). Pravi
// formateri novca i datuma s potpunim testovima dolaze u S3.
import { test } from "node:test";
import assert from "node:assert/strict";

import { MJESECI_KRATICE, datumDijelovi, eurPrivremeno, mmss } from "../src/lib/prikaz.ts";

test("eurPrivremeno: cijeli centi → hr-HR s točkom za tisućice", () => {
  assert.equal(eurPrivremeno(0), "0,00 €");
  assert.equal(eurPrivremeno(5), "0,05 €");
  assert.equal(eurPrivremeno(3500), "35,00 €");
  assert.equal(eurPrivremeno(123456), "1.234,56 €");
  assert.equal(eurPrivremeno(100000000), "1.000.000,00 €");
  assert.equal(eurPrivremeno(-6000), "−60,00 €");
});

test("kratice mjeseci kao u dizajnu", () => {
  assert.deepEqual(MJESECI_KRATICE, ["SIJ", "VELJ", "OŽU", "TRA", "SVI", "LIP", "SRP", "KOL", "RUJ", "LIS", "STU", "PRO"]);
});

test("datumDijelovi: u zoni događaja, ne u UTC-u", () => {
  assert.deepEqual(datumDijelovi("2027-04-16T07:00:00Z"), { dan: 16, mjesec: 4, godina: 2027, mjesecKratica: "TRA" });
  // 31. 12. 23:30 UTC = 1. 1. 00:30 u Zagrebu
  assert.deepEqual(datumDijelovi("2027-12-31T23:30:00Z"), { dan: 1, mjesec: 1, godina: 2028, mjesecKratica: "SIJ" });
  assert.equal(datumDijelovi("2027-12-31T23:30:00Z", "UTC")?.dan, 31);
  assert.equal(datumDijelovi(null), null);
  assert.equal(datumDijelovi("nije datum"), null);
});

test("mmss: odbrojavanje u gumbu", () => {
  assert.equal(mmss(3552), "59:12");
  assert.equal(mmss(3600), "60:00");
  assert.equal(mmss(5), "0:05");
  assert.equal(mmss(0.2), "0:01");
  assert.equal(mmss(-3), "0:00");
});
