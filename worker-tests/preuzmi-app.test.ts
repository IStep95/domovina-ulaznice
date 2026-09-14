// Prijenos ulaznica u mobilnu aplikaciju (`/api/ulaznice/:id/preuzmi`).
//
// Jedini put kojim QR token izlazi mimo e-maila — zato su testovi strogi oko
// autorizacije (order_id + e-mail kupca) i oko toga da se e-mail NE šalje.
import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import { callJson, testEnv, type TestCtx } from "./harness/env.ts";
import { one } from "./harness/d1.ts";

let t: TestCtx | null = null;
afterEach(() => { t?.restore(); t = null; });

const ORDER = "66666666-6666-4666-8666-666666666666";
const TICKETS = [
  { serial: "SUS-000001", holder_name: "Ana Anić", state: "issued", qr_token: "a".repeat(64) },
  { serial: "SUS-000002", holder_name: "Ivo Ivić", state: "issued", qr_token: "c".repeat(64) },
];
const preuzmi = (email = "kupac@example.com") =>
  callJson<{
    status: string; stari_qr_ponisten: boolean; qr_prefix: string; error?: string;
    tickets: Array<{ serial: string; qr_token: string | null }>;
  }>(t!, `/api/ulaznice/${ORDER}/preuzmi`, { method: "POST", body: { buyer_email: email } });

test("preuzimanje: tokeni idu u aplikaciju, e-mail se ne šalje, trag ostaje", async () => {
  t = testEnv();
  t.api.orderState = "paid";
  t.api.tickets = TICKETS;
  const { status, body } = await preuzmi();
  assert.equal(status, 200);
  assert.equal(body.status, "preuzeto");
  assert.equal(body.stari_qr_ponisten, false);
  assert.equal(body.qr_prefix, "dgdj1:");
  assert.deepEqual(body.tickets.map((x) => x.qr_token), ["a".repeat(64), "c".repeat(64)]);
  assert.equal(t.api.rotacije, 0);
  assert.equal(t.api.emails.length, 0, "u aplikaciju se isporučuje JSON, ne e-mail");
  const log = one<{ template: string; status: string }>(t.db, "SELECT template, status FROM sent_emails ORDER BY id DESC");
  assert.equal(log.template, "preuzimanje_app");
  assert.equal(log.status, "sent");
});

test("preuzimanje nakon potrošenih tokena ROTIRA i to kaže kupcu", async () => {
  t = testEnv();
  t.api.orderState = "paid";
  t.api.tickets = TICKETS;
  t.api.deliverTokens = false;
  const { body } = await preuzmi("  Kupac@Example.com "); // e-mail se normalizira
  assert.equal(body.status, "preuzeto");
  assert.equal(body.stari_qr_ponisten, true);
  assert.equal(t.api.rotacije, 1);
  assert.ok(body.tickets.every((x) => x.qr_token === "b".repeat(64)));
});

test("krivi e-mail → 403 i NIŠTA se ne izdaje ni ne rotira", async () => {
  t = testEnv();
  t.api.orderState = "paid";
  t.api.tickets = TICKETS;
  t.api.deliverTokens = false;
  const { status, body } = await preuzmi("netko@drugi.hr");
  assert.equal(status, 403);
  assert.equal(body.error, "email_ne_odgovara");
  assert.equal(t.api.rotacije, 0);
  assert.equal(t.calls.filter((c) => c.url.includes("events-tickets")).length, 0);
});

test("neplaćena narudžba → 409; bez e-maila u tijelu → 400", async () => {
  t = testEnv();
  t.api.orderState = "pending";
  assert.equal((await preuzmi()).status, 409);
  const r = await callJson<{ error: string }>(t, `/api/ulaznice/${ORDER}/preuzmi`, { method: "POST", body: {} });
  assert.equal(r.status, 400);
  assert.equal(r.body.error, "invalid_buyer_email");
});

test("sve iskorišteno → nema_vazecih_ulaznica; tvrdi limit rotacija → 429", async () => {
  t = testEnv();
  t.api.orderState = "paid";
  t.api.tickets = TICKETS;
  t.api.deliverTokens = false;
  t.api.rotateStatus = "nothing_to_rotate";
  assert.equal((await preuzmi()).body.status, "nema_vazecih_ulaznica");
  t.api.rotateStatus = "rate_limited";
  const r = await preuzmi();
  assert.equal(r.status, 429);
  assert.equal(r.body.error, "previse_pokusaja");
});
