// Dodatna polja kupnje iz organizatorova Google obrasca (2026-11-26).
// Obrazac je sintetski HTML s istim oblikom `FB_PUBLIC_LOAD_DATA_` kao pravi
// javni obrazac (provjereno na tri javna obrasca 26. 11.); ništa ne ide na mrežu.
import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import { CAMPAIGN, TIER, TIER_BESPLATNA, call, callJson, checkoutCompleted, stripeSignature, testEnv, type TestCtx } from "./harness/env.ts";
import { one } from "./harness/d1.ts";
import { reconcile } from "../worker/reconcile.ts";
import { kanonskiLink, parsirajObrazac, provjeriOdgovore, tijeloOdgovora } from "../worker/dodatna-polja.ts";

let t: TestCtx | null = null;
afterEach(() => { t?.restore(); t = null; });

const FORM_ID = "1FAIpQLSe" + "x".repeat(47);
const LINK = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;

const opcije = (...v: string[]) => v.map((x) => [x, null, null, null, 0]);
const STAVKE = [
  [1, "Ime i prezime", null, 0, [[101, null, 1]]],
  [2, "E-mail", null, 0, [[102, null, 1]]],
  [3, "Spol", "Kako se izjašnjavate", 2, [[103, [...opcije("Muško", "Žensko"), ["", null, null, null, 1]], 1]]],
  [4, "Odjeljak 2", null, 8, null],
  [5, "Godište", null, 3, [[105, opcije("1990", "1991", "1992"), 0]]],
  [6, "Interesi", null, 4, [[106, opcije("Glazba", "Sport"), 0]]],
  [7, "Datum rođenja", null, 9, [[107, null, 0, null, null, null, null, [0, 1]]]],
  [8, "Ocjena", null, 5, [[108, opcije("1", "2", "3"), 0, ["Loše", "Odlično"]]]],
  [9, "Životopis", null, 13, [[109, null, 0]]],
];
const html = (stavke: unknown[] = STAVKE) =>
  `<html><script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify([
    null,
    ["Opis", stavke, null, null, null, null, null, null, "Prijava na radionicu"],
    "/forms",
    "Prijava",
  ])};</script></html>`;

// --------------------------------------------------------------- čitanje obrasca

test("parsirajObrazac: vrste, obavezna, e-mail polje skriveno, „Ostalo” i upload preskočeni", () => {
  const o = parsirajObrazac(LINK, html());
  assert.equal(o.naslov, "Prijava na radionicu");
  assert.deepEqual(o.emailPolja, ["102"]);
  assert.equal(o.stranica, 2);
  assert.deepEqual(
    o.polja.map((p) => [p.id, p.vrsta, p.obavezno]),
    [
      ["101", "tekst", true],
      ["103", "izbor", true],
      ["105", "padajuci", false],
      ["106", "visestruki", false],
      ["107", "datum", false],
      ["108", "skala", false],
    ],
  );
  assert.deepEqual(o.polja[1]!.opcije, ["Muško", "Žensko"]);
  assert.equal(o.polja[1]!.opis, "Kako se izjašnjavate");
  assert.deepEqual(o.polja[5]!.krajevi, ["Loše", "Odlično"]);
});

test("parsirajObrazac: obavezan upload datoteke → obrazac se ne može koristiti", () => {
  assert.throws(() => parsirajObrazac(LINK, html([[9, "CV", null, 13, [[109, null, 1]]]])), { code: "obrazac_nepodrzano_polje" });
  assert.throws(() => parsirajObrazac(LINK, "<html>nema podataka</html>"), { code: "obrazac_nije_citljiv" });
});

test("kanonskiLink: viewform, formResponse i /u/0/ → viewform; ostalo odbijeno", () => {
  assert.deepEqual(kanonskiLink(`${LINK}?usp=sf_link`), { url: LINK });
  assert.deepEqual(kanonskiLink(`https://docs.google.com/forms/u/0/d/e/${FORM_ID}/formResponse`), { url: LINK });
  assert.deepEqual(kanonskiLink("https://forms.gle/AbC123"), { kratki: "https://forms.gle/AbC123" });
  assert.equal(kanonskiLink(`http://docs.google.com/forms/d/e/${FORM_ID}/viewform`), null);
  assert.equal(kanonskiLink(`https://docs.google.com/forms/d/${FORM_ID}/edit`), null, "link za uređivanje nije javan");
  assert.equal(kanonskiLink("https://evil.example/forms/d/e/x/viewform"), null);
});

test("provjeriOdgovore: obavezno, opcije, nepoznata polja se odbacuju", () => {
  const { polja } = parsirajObrazac(LINK, html());
  assert.deepEqual(
    provjeriOdgovore(polja, { "101": "  Ana Anić ", "103": "Žensko", "106": ["Sport", "Sport"], "999": "x" }),
    { "101": "Ana Anić", "103": "Žensko", "106": ["Sport"] },
  );
  assert.throws(() => provjeriOdgovore(polja, { "101": "Ana" }), { code: "dodatna_polja_neispravna" });
  assert.throws(() => provjeriOdgovore(polja, { "101": "Ana", "103": "Treće" }), { code: "dodatna_polja_neispravna" });
  assert.throws(() => provjeriOdgovore(polja, { "101": "Ana", "103": "Muško", "107": "1.1.1990" }), {
    code: "dodatna_polja_neispravna",
  });
});

test("tijeloOdgovora: datum u tri polja, višestruki ponovljen, e-mail kupca, sve stranice", () => {
  const o = parsirajObrazac(LINK, html());
  const b = tijeloOdgovora(o, { "101": "Ana", "106": ["Glazba", "Sport"], "107": "1990-03-07" }, "kupac@example.com");
  assert.equal(b.get("entry.101"), "Ana");
  assert.deepEqual(b.getAll("entry.106"), ["Glazba", "Sport"]);
  assert.equal(b.get("entry.107_year"), "1990");
  assert.equal(b.get("entry.107_month"), "3");
  assert.equal(b.get("entry.107_day"), "7");
  assert.equal(b.get("entry.102"), "kupac@example.com");
  assert.equal(b.get("emailAddress"), "kupac@example.com");
  assert.equal(b.get("pageHistory"), "0,1");
});

// --------------------------------------------------------------------- kupnja

function sObrascem(): TestCtx {
  const ctx = testEnv();
  ctx.api.googleForma = html();
  ctx.db.prepare("INSERT INTO event_forms (campaign_id, form_url) VALUES (?, ?)").run(CAMPAIGN, LINK);
  return ctx;
}

test("GET dodatna-polja: bez obrasca prazno, s obrascem pitanja bez e-mail polja", async () => {
  t = testEnv();
  const prazno = await callJson<{ polja: unknown[] }>(t, "/api/dogadjaj/susret-2027/dodatna-polja");
  assert.deepEqual(prazno.body, { polja: [] });
  t.restore();

  t = sObrascem();
  const { status, body } = await callJson<{ polja: Array<{ id: string }> }>(t, "/api/dogadjaj/susret-2027/dodatna-polja");
  assert.equal(status, 200);
  assert.deepEqual(body.polja.map((p) => p.id), ["101", "103", "105", "106", "107", "108"]);
});

test("zatvoren ili privatan obrazac → jasna greška", async () => {
  t = sObrascem();
  t.api.googleStatus = 401;
  const { status, body } = await callJson<{ error: string }>(t, "/api/dogadjaj/susret-2027/dodatna-polja");
  assert.equal(status, 422);
  assert.equal(body.error, "obrazac_trazi_prijavu");
});

const narudzba = (over: Record<string, unknown> = {}) => ({
  campaign_id: CAMPAIGN,
  tier_id: TIER,
  quantity: 1,
  buyer_email: "kupac@example.com",
  holders: [],
  ...over,
});

test("narudžba bez obaveznog dodatnog polja → 422 PRIJE rezervacije", async () => {
  t = sObrascem();
  const { status, body } = await callJson<{ error: string }>(t, "/api/narudzba", {
    body: narudzba({ dodatna_polja: { "101": "Ana" } }),
  });
  assert.equal(status, 422);
  assert.equal(body.error, "dodatna_polja_neispravna");
  assert.ok(!t.calls.some((c) => c.url.includes("events-order")), "mjesto se ne smije rezervirati");
});

test("plaćena: odgovori u jezgru PRIJE Stripea, u obrazac tek nakon uplate", async () => {
  t = sObrascem();
  const { status, body } = await callJson<{ order_id: string }>(t, "/api/narudzba", {
    body: narudzba({ dodatna_polja: { "101": "Ana Anić", "103": "Žensko" } }),
  });
  assert.equal(status, 200);
  const spremanje = t.calls.findIndex((c) => c.url.includes("rpc/save_order_answers"));
  const stripe = t.calls.findIndex((c) => c.url.includes("/v1/checkout/sessions"));
  assert.ok(spremanje >= 0 && spremanje < stripe, "odgovori se spremaju prije Stripea");
  // snimka s tekstom pitanja, redom obrasca
  assert.deepEqual(t.api.odgovori[body.order_id]!.answers, [
    { id: "101", pitanje: "Ime i prezime", odgovor: "Ana Anić" },
    { id: "103", pitanje: "Spol", odgovor: "Žensko" },
  ]);
  assert.equal(t.api.odgovori[body.order_id]!.form_url, LINK);
  assert.equal(t.api.googleOdgovori.length, 0, "prije uplate ništa ne ide organizatoru");

  t.api.confirm = { status: "paid", order_id: body.order_id, tickets: [] };
  const payload = checkoutCompleted({ orderId: body.order_id });
  await call(t, "/webhook/stripe", { raw: payload, headers: { "stripe-signature": stripeSignature(payload) } });

  assert.equal(t.api.googleOdgovori.length, 1);
  const poslano = new URLSearchParams(t.api.googleOdgovori[0]);
  assert.equal(poslano.get("entry.101"), "Ana Anić");
  assert.equal(poslano.get("entry.103"), "Žensko");
  assert.ok(poslano.get("entry.102"), "e-mail polje obrasca dobije e-mail kupca");
  assert.ok(t.api.odgovori[body.order_id]!.forwarded_at, "jezgra zna da su odgovori stigli");
});

test("plaćena: jezgra bez order_answers → kupac ne ide na plaćanje", async () => {
  t = sObrascem();
  t.api.odgovoriStatus = 404;
  const { status } = await callJson(t, "/api/narudzba", { body: narudzba({ dodatna_polja: { "101": "Ana", "103": "Muško" } }) });
  assert.equal(status, 502);
  assert.equal(t.api.createdSessions.length, 0);
});

test("besplatna: odgovori u jezgru i odmah u obrazac; Google greška ostaje za cron", async () => {
  t = sObrascem();
  t.api.besplatnaVrsta = true;
  t.api.orderState = "paid";
  t.api.googleOdgovorStatus = 500;
  const { status, body } = await callJson<{ order_id: string }>(t, "/api/narudzba", {
    body: narudzba({ tier_id: TIER_BESPLATNA, dodatna_polja: { "101": "Ana", "103": "Muško" } }),
  });
  assert.equal(status, 200, "pad Googlea ne ruši izdavanje ulaznica");
  await Promise.all(t.pozadina);
  assert.equal(t.api.googleOdgovori.length, 1);
  const r = t.api.odgovori[body.order_id]!;
  assert.equal(r.forwarded_at, null);
  assert.equal(r.forward_error, "obrazac_odbio_500");
  assert.equal(r.forward_attempts, 1);

  // cron ponovi kad Google proradi
  t.api.googleOdgovorStatus = 200;
  await reconcile(t.env);
  assert.equal(t.api.googleOdgovori.length, 2);
  assert.ok(t.api.odgovori[body.order_id]!.forwarded_at);
  assert.ok(t.calls.some((c) => c.url.includes("rpc/purge_order_answers")), "cron pokreće i rok čuvanja");
});

test("bez obrasca nema poziva prema order_answers ni Googleu", async () => {
  t = testEnv();
  const { status } = await callJson(t, "/api/narudzba", { body: narudzba() });
  assert.equal(status, 200);
  assert.ok(!t.calls.some((c) => c.url.includes("order_answers") || c.url.includes("docs.google.com")));
});

test("izvoz sudionika: e-mail kupca i stupac po pitanju; jezgra bez tablice → bez stupaca", async () => {
  t = testEnv();
  t.api.tickets = [
    { serial: "SUS-000001", order_id: "o1", buyer_email: "ana@example.com", state: "issued" },
    { serial: "SUS-000002", order_id: "o2", buyer_email: "ivo@example.com", state: "issued" },
  ];
  t.api.odgovori = {
    o1: { answers: [{ id: "103", pitanje: "Spol", odgovor: "Žensko" }, { id: "106", pitanje: "Interesi", odgovor: ["Glazba", "Sport"] }], form_url: LINK, forwarded_at: null, forward_attempts: 0, forward_error: null },
    o2: { answers: [{ id: "103", pitanje: "Spol", odgovor: "Muško" }], form_url: LINK, forwarded_at: null, forward_attempts: 0, forward_error: null },
  };
  const res = await call(t, `/api/organizator/holderi.csv?campaign_id=${CAMPAIGN}`, { headers: auth() });
  const redci = (await res.text()).split("\r\n");
  assert.equal(redci[0], "serial;ime;email;stanje;ulazak;kupac;Spol;Interesi");
  assert.equal(redci[1], "SUS-000001;;;issued;;ana@example.com;Žensko;Glazba, Sport");
  assert.equal(redci[2], "SUS-000002;;;issued;;ivo@example.com;Muško;");

  t.api.odgovoriStatus = 404;
  const bez = await call(t, `/api/organizator/holderi.csv?campaign_id=${CAMPAIGN}`, { headers: auth() });
  assert.equal(bez.status, 200);
  assert.equal((await bez.text()).split("\r\n")[0], "serial;ime;email;stanje;ulazak;kupac");
});

// --------------------------------------------------------------------- editor

const auth = () => ({ authorization: "Bearer jwt-organizatora" });
const SKICA = "44444444-4444-4444-8444-444444444444";

test("editor: link se provjeri i spremi tek nakon jezgre; prazan ga makne", async () => {
  t = testEnv();
  t.api.googleForma = html();
  const tijelo = { tiers: [{ title: "A", price_cents: 0 }], form_url: `${LINK}?usp=sharing` };
  const { status } = await callJson(t, `/api/organizator/dogadjaj/${SKICA}`, { method: "PUT", headers: auth(), body: tijelo });
  assert.equal(status, 200);
  assert.equal(one(t.db, "SELECT form_url FROM event_forms WHERE campaign_id = ?", SKICA)!.form_url, LINK);

  await callJson(t, `/api/organizator/dogadjaj/${SKICA}`, { method: "PUT", headers: auth(), body: { ...tijelo, form_url: "" } });
  assert.ok(!one(t.db, "SELECT form_url FROM event_forms WHERE campaign_id = ?", SKICA), "prazan link briše redak");
});

test("editor: neispravan link → 422 i jezgra se ne zove", async () => {
  t = testEnv();
  const { status, body } = await callJson<{ error: string }>(t, `/api/organizator/dogadjaj/${SKICA}`, {
    method: "PUT",
    headers: auth(),
    body: { tiers: [{ title: "A" }], form_url: "https://docs.google.com/forms/d/abc/edit" },
  });
  assert.equal(status, 422);
  assert.equal(body.error, "obrazac_neispravan_link");
  assert.ok(!t.calls.some((c) => c.url.includes("events-organizer")));
});

test("pregled obrasca u editoru: samo prijavljenom", async () => {
  t = testEnv();
  t.api.googleForma = html();
  assert.equal((await call(t, "/api/organizator/obrazac", { body: { url: LINK } })).status, 401);
  const { status, body } = await callJson<{ naslov: string; polja: unknown[]; email_polja: number }>(t, "/api/organizator/obrazac", {
    headers: auth(),
    body: { url: LINK },
  });
  assert.equal(status, 200);
  assert.equal(body.naslov, "Prijava na radionicu");
  assert.equal(body.polja.length, 6);
  assert.equal(body.email_polja, 1);
});
