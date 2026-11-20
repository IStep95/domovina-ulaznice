// Testovi pomoćnika za prikaz u otocima (web/src/lib/prikaz.ts).
import { test } from "node:test";
import assert from "node:assert/strict";

import { mmss } from "../src/lib/prikaz.ts";

test("mmss: odbrojavanje u gumbu", () => {
  assert.equal(mmss(3552), "59:12");
  assert.equal(mmss(3600), "60:00");
  assert.equal(mmss(5), "0:05");
  assert.equal(mmss(0.2), "0:01");
  assert.equal(mmss(-3), "0:00");
});
