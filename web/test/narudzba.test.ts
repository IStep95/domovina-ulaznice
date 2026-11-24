// Testovi stranice narudžbe (web/src/lib/narudzba.ts, S5): valjanost order_id,
// osvježavanje nakon povratka sa Stripea, zaglavlje po stanju, oznake ulaznica,
// ishod ponovne dostave i link u aplikaciju. Ponašanje prati src/pages/Narudzba.tsx (bivši SPA, obrisan u S7).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  MAX_OSVJEZAVANJA,
  ORDER_ID_RE,
  OSVJEZAVANJE_MS,
  cekaPotvrdu,
  ishodDostave,
  ispravanOrderId,
  linkAplikacije,
  placenoIzUrla,
  stanjeUlaznice,
  stanjeZaglavlja,
} from "../src/lib/narudzba.ts";

const ID = "3f2b8c1e-9a4d-4e7f-b1c2-0d9e8f7a6b5c";

// ── order_id ────────────────────────────────────────────────────────────────

test("ORDER_ID_RE je isti uzorak kao UUID_RE u worker/index.ts", () => {
  const izvor = readFileSync(new URL("../../worker/index.ts", import.meta.url), "utf8");
  const m = /^const UUID_RE = \/(.+)\/([a-z]*);$/m.exec(izvor);
  assert.ok(m, "nema `const UUID_RE = /…/…;` u worker/index.ts");
  assert.equal(ORDER_ID_RE.source, m[1]);
  assert.equal(ORDER_ID_RE.flags, m[2]);
});

test("ispravanOrderId: UUID (i velikim slovima) da, sve ostalo ne", () => {
  assert.equal(ispravanOrderId(ID), true);
  assert.equal(ispravanOrderId(ID.toUpperCase()), true);
  for (const los of ["", "abc", `${ID}x`, ` ${ID}`, ID.slice(1), ID.replaceAll("-", ""), `${ID}/preuzmi`, "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz"]) {
    assert.equal(ispravanOrderId(los), false, los);
  }
  assert.equal(ispravanOrderId(null), false);
  assert.equal(ispravanOrderId(undefined), false);
});

// ── osvježavanje nakon povratka sa Stripea ──────────────────────────────────

test("osvježavanje kao u SPA-u: svake 2 s, najviše 10 puta", () => {
  assert.equal(OSVJEZAVANJE_MS, 2000);
  assert.equal(MAX_OSVJEZAVANJA, 10);
});

test("placenoIzUrla: samo točno ?placeno=1", () => {
  assert.equal(placenoIzUrla(new URLSearchParams("placeno=1")), true);
  assert.equal(placenoIzUrla(new URLSearchParams("x=2&placeno=1")), true);
  for (const q of ["", "placeno=0", "placeno=true", "placeno=", "placeno", "Placeno=1"]) {
    assert.equal(placenoIzUrla(new URLSearchParams(q)), false, q);
  }
});

test("cekaPotvrdu: samo pending nakon povratka sa Stripea (redirect nije dokaz uplate)", () => {
  assert.equal(cekaPotvrdu("pending", true), true);
  assert.equal(cekaPotvrdu("pending", false), false);
  for (const s of ["paid", "expired", "refunded", "failed"]) assert.equal(cekaPotvrdu(s, true), false, s);
});

// ── zaglavlje i oznake ──────────────────────────────────────────────────────

test("stanjeZaglavlja: poznata stanja, pending-placeno i nepoznato kao pending", () => {
  for (const s of ["pending", "paid", "expired", "refunded", "failed"] as const) {
    assert.equal(stanjeZaglavlja(s, false), s);
  }
  assert.equal(stanjeZaglavlja("pending", true), "pending-placeno");
  // ?placeno=1 ne mijenja konačna stanja
  assert.equal(stanjeZaglavlja("paid", true), "paid");
  assert.equal(stanjeZaglavlja("expired", true), "expired");
  for (const s of ["", "cancelled", "toString", "__proto__"]) assert.equal(stanjeZaglavlja(s, false), "pending", s);
});

test("stanjeUlaznice: issued/checked_in/void, nepoznato bez oznake", () => {
  assert.equal(stanjeUlaznice("issued"), "vrijedi");
  assert.equal(stanjeUlaznice("checked_in"), "uslo");
  assert.equal(stanjeUlaznice("void"), "ponistena");
  for (const s of ["", "reserved", "ISSUED"]) assert.equal(stanjeUlaznice(s), null, s);
});

// ── ponovna dostava ─────────────────────────────────────────────────────────

test("ishodDostave: poslano, s rotacijom se istakne da stari QR više ne vrijedi", () => {
  assert.deepEqual(ishodDostave({ status: "poslano", recipient: "an•••@primjer.hr" }), {
    ton: "ok",
    tekst: "Poslano na an•••@primjer.hr.",
  });
  assert.deepEqual(ishodDostave({ status: "poslano", recipient: "an•••@primjer.hr", stari_qr_ponisten: false }), {
    ton: "ok",
    tekst: "Poslano na an•••@primjer.hr.",
  });
  const r = ishodDostave({ status: "poslano", recipient: "an•••@primjer.hr", stari_qr_ponisten: true });
  assert.equal(r.ton, "ok");
  assert.equal(r.tekst, "Poslano na an•••@primjer.hr.");
  assert.match(r.istaknuto ?? "", /NOVE poruke.*stari više ne rade/);
});

test("ishodDostave: poslano bez adrese → adresa iz narudžbe", () => {
  assert.equal(ishodDostave({ status: "poslano", recipient: null }).tekst, "Poslano na adresu iz narudžbe.");
});

test("ishodDostave: nema važećih ulaznica (neutral) i neuspjelo (error)", () => {
  const nema = ishodDostave({ status: "nema_vazecih_ulaznica", recipient: "an•••@primjer.hr" });
  assert.equal(nema.ton, "neutral");
  assert.match(nema.tekst, /iskorištene ili poništene/);
  assert.equal(nema.istaknuto, undefined);

  const palo = ishodDostave({ status: "neuspjelo", recipient: "an•••@primjer.hr", error: "resend_500" });
  assert.equal(palo.ton, "error");
  assert.match(palo.tekst, /^Slanje nije uspjelo\./);
  // tehnički detalj iz Workera ne ide kupcu
  assert.ok(!palo.tekst.includes("resend_500"));
});

// ── aplikacija ──────────────────────────────────────────────────────────────

test("linkAplikacije: vlastita shema, id kodiran", () => {
  assert.equal(linkAplikacije(ID), `domovina-ulaznice://narudzba/${ID}`);
  assert.equal(linkAplikacije("a/b?c"), "domovina-ulaznice://narudzba/a%2Fb%3Fc");
});
