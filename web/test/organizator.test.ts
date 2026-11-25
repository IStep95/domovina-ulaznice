// Testovi čistih dijelova pregleda prodaje i skenera (web/src/lib/organizator.ts,
// S8): zbroj po događaju, oznaka stanja, ime CSV datoteke, QR token i vrijeme
// ulaska. Poruke organizatora su na dnu (web/src/lib/poruke.ts).
import { test } from "node:test";
import assert from "node:assert/strict";

import { ApiError } from "../src/lib/api.ts";
import type { OrgEvent } from "../src/lib/auth.ts";
import {
  PONOVNI_SKEN_MS,
  QR_PREFIX,
  datumDogadjaja,
  imeCsvDatoteke,
  ponovljenoCitanje,
  stanjeDogadjaja,
  tokenIzQr,
  vrijemeUlaska,
  zbrojDogadjaja,
} from "../src/lib/organizator.ts";
import {
  GENERICKA_PORUKA,
  KOD_MREZA,
  PORUKE_ORGANIZATORA,
  porukaIzGreske,
  porukaOrganizatora,
} from "../src/lib/poruke.ts";

const dogadjaj: OrgEvent = {
  campaign_id: "3f2a9c1e-0000-4000-8000-000000000001",
  account_id: "a1",
  slug: "susret-2027",
  title: "Susret 2027",
  state: "active",
  visibility: "public",
  event: { venue_city: "Zagreb", starts_at: "2027-04-16T07:00:00Z", timezone: "Europe/Zagreb" },
  tiers: [
    { id: "t1", title: "Redovna", price_cents: 6000, inventory_total: 100, inventory_claimed: 3, imenska: false },
    { id: "t2", title: "Rani upis", price_cents: 4999, inventory_total: null, inventory_claimed: 2, imenska: true },
  ],
};

// ── pregled prodaje ─────────────────────────────────────────────────────────

test("zbrojDogadjaja: zauzeto i prihod u cijelim centima; imenski tier otvara izvoz", () => {
  assert.deepEqual(zbrojDogadjaja(dogadjaj), { zauzeto: 5, prihod: 3 * 6000 + 2 * 4999, imenskih: true });
  assert.deepEqual(zbrojDogadjaja({ tiers: [] }), { zauzeto: 0, prihod: 0, imenskih: false });
  assert.equal(zbrojDogadjaja({ tiers: [dogadjaj.tiers[0]!] }).imenskih, false);
});

test("stanjeDogadjaja: active → objavljen (ok), draft → skica, ostalo kako je stiglo", () => {
  assert.deepEqual(stanjeDogadjaja({ state: "active" }), { tekst: "objavljen", ton: "ok" });
  assert.deepEqual(stanjeDogadjaja({ state: "draft" }), { tekst: "skica", ton: "wait" });
  assert.deepEqual(stanjeDogadjaja({ state: "closed" }), { tekst: "closed", ton: "neutral" });
});

test("stanjeDogadjaja: skica poslana na odobrenje i vraćena na doradu", () => {
  const poslana = { state: "draft", submitted_at: "2026-11-25T17:00:00Z" };
  assert.deepEqual(stanjeDogadjaja(poslana), { tekst: "čeka odobrenje", ton: "neutral" });
  assert.deepEqual(stanjeDogadjaja({ state: "draft", submitted_at: null, review_note: "Dodaj opis" }), {
    tekst: "vraćeno na doradu",
    ton: "wait",
  });
  // ponovno poslana: stara napomena ostaje u bazi, ali stanje je opet „čeka odobrenje”
  assert.equal(stanjeDogadjaja({ ...poslana, review_note: "Dodaj opis" }).tekst, "čeka odobrenje");
  // odobren događaj ostaje „objavljen” bez obzira na submitted_at
  assert.equal(stanjeDogadjaja({ ...poslana, state: "active" }).tekst, "objavljen");
});

test("imeCsvDatoteke: slug, bez sluga prvih 8 znakova campaign_id, bez opasnih znakova", () => {
  assert.equal(imeCsvDatoteke(dogadjaj), "sudionici-susret-2027.csv");
  assert.equal(imeCsvDatoteke({ ...dogadjaj, slug: "" }), "sudionici-3f2a9c1e.csv");
  assert.equal(imeCsvDatoteke({ ...dogadjaj, slug: "../a b/č" }), "sudionici-a-b.csv");
  assert.equal(imeCsvDatoteke({ slug: "///", campaign_id: "x" }), "sudionici-dogadjaj.csv");
});

test("datumDogadjaja: dan, mjesec i godina u zoni događaja; bez početka prazno", () => {
  assert.equal(datumDogadjaja(dogadjaj), "16. 4. 2027.");
  // 23:30 UTC je već sljedeći dan u Zagrebu
  assert.equal(datumDogadjaja({ event: { starts_at: "2026-12-31T23:30:00Z" } }), "1. 1. 2027.");
  assert.equal(datumDogadjaja({ event: { starts_at: null } }), "");
  assert.equal(datumDogadjaja({ event: null }), "");
});

// ── skener ──────────────────────────────────────────────────────────────────

const TOKEN = "ab".repeat(32);

test("tokenIzQr: s prefiksom i bez, velika slova i razmaci; sve ostalo null", () => {
  assert.equal(tokenIzQr(`${QR_PREFIX}${TOKEN}`), TOKEN);
  assert.equal(tokenIzQr(`  ${TOKEN.toUpperCase()}\n`), TOKEN);
  assert.equal(tokenIzQr(`${QR_PREFIX} ${TOKEN}`), TOKEN);
  assert.equal(tokenIzQr("SUS-000004"), null, "serial nije token");
  assert.equal(tokenIzQr(TOKEN.slice(1)), null);
  assert.equal(tokenIzQr(`${TOKEN}0`), null);
  assert.equal(tokenIzQr("https://ulaznice.domovina.ai/ulaznice/x"), null);
  assert.equal(tokenIzQr(""), null);
});

test("ponovljenoCitanje: isti kod unutar 3 s se preskače, drugi kod ili kasnije ne", () => {
  const zadnji = { token: TOKEN, kad: 1000 };
  assert.equal(ponovljenoCitanje(zadnji, TOKEN, 1000 + PONOVNI_SKEN_MS - 1), true);
  assert.equal(ponovljenoCitanje(zadnji, TOKEN, 1000 + PONOVNI_SKEN_MS), false);
  assert.equal(ponovljenoCitanje(zadnji, "cd".repeat(32), 1001), false);
  assert.equal(ponovljenoCitanje({ token: "", kad: 0 }, TOKEN, 1), false);
});

test("vrijemeUlaska: „16. 4. u 9:05” u zoni Zagreba; neispravno prazno", () => {
  assert.equal(vrijemeUlaska("2027-04-16T07:05:00Z"), "16. 4. u 9:05");
  assert.equal(vrijemeUlaska("2027-01-16T07:05:00Z"), "16. 1. u 8:05", "zimsko vrijeme");
  assert.equal(vrijemeUlaska(null), "");
  assert.equal(vrijemeUlaska("nije datum"), "");
});

// ── poruke organizatora ─────────────────────────────────────────────────────

test("porukaOrganizatora: kodovi prijave, editora i skenera; http_5xx i nepoznato", () => {
  assert.equal(porukaOrganizatora("kod_neispravan"), "Kod nije ispravan ili je istekao. Zatraži novi.");
  assert.equal(porukaOrganizatora("nije_prijavljen"), "Prijava je istekla. Prijavite se ponovno.");
  assert.match(porukaOrganizatora("nema_prava_kreiranja"), /eOsobna/);
  assert.equal(porukaOrganizatora("neispravan_qr"), "To nije ulaznica ovog sustava.");
  assert.match(porukaOrganizatora("http_502"), /ne odgovara/);
  assert.equal(porukaOrganizatora("http_418"), GENERICKA_PORUKA);
  assert.equal(porukaOrganizatora("izmisljeno"), GENERICKA_PORUKA);
  assert.equal(porukaOrganizatora("toString"), GENERICKA_PORUKA, "samo vlastiti ključevi");
});

test("porukaIzGreske: ApiError po kodu, TypeError je mreža, ostalo generički", () => {
  assert.equal(porukaIzGreske(new ApiError("prijava_neuspjela", 401)), PORUKE_ORGANIZATORA.prijava_neuspjela);
  assert.equal(porukaIzGreske(new TypeError("Failed to fetch")), PORUKE_ORGANIZATORA[KOD_MREZA]);
  assert.equal(porukaIzGreske(new Error("x")), GENERICKA_PORUKA);
});
