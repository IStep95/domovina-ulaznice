// Prijava organizatora, pregled prodaje, izvoz sudionika i skener ulaza.
//
// Jedan invariant vrijedi za sve u ovoj datoteci i vrijedi ga braniti testom:
// **service ključ ne smije dodirnuti nijedan od ovih puteva.** Autorizacija je
// u bazi (RLS, `has_role_on_account`), a Worker samo nosi korisnikov JWT. Stub
// u harnessu ruši test ako `organizer_overview` stigne bez JWT-a ili ako
// `events-checkin` dobije service ključ.
import { after, afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { ANON_KEY, call, callJson, CAMPAIGN, SERVICE_KEY, testEnv, type TestCtx } from "./harness/env.ts";

let t: TestCtx;
afterEach(() => t?.restore());
after(() => t?.restore());

const auth = (jwt = "jwt-organizatora") => ({ authorization: `Bearer ${jwt}` });

// ------------------------------------------------------------------- prijava

test("prijava vraća token, a refresh token NE izlazi prema browseru", async () => {
  t = testEnv();
  const { status, body, text } = await callJson<{ access_token: string; email: string }>(
    t,
    "/api/organizator/prijava",
    { body: { email: "org@test.hr", lozinka: "lozinka123" } },
  );
  assert.equal(status, 200);
  assert.equal(body.access_token, "jwt-organizatora");
  assert.ok(!text.includes("refresh_token"), "refresh token ne smije izaći iz Workera");
});

test("kriva lozinka → 401 i nijedan token", async () => {
  t = testEnv();
  t.api.prijavaOk = false;
  const { status, body } = await callJson<{ error: string }>(t, "/api/organizator/prijava", {
    body: { email: "org@test.hr", lozinka: "lozinka123" },
  });
  assert.equal(status, 401);
  assert.equal(body.error, "prijava_neuspjela");
});

test("prijava prema GoTrueu ide s ANON ključem, nikad sa service ključem", async () => {
  t = testEnv();
  await call(t, "/api/organizator/prijava", { body: { email: "org@test.hr", lozinka: "lozinka123" } });
  const poziv = t.calls.find((c) => c.url.includes("/auth/v1/token"));
  assert.ok(poziv, "prijava mora zvati GoTrue");
  assert.equal(poziv!.headers.apikey, ANON_KEY);
  assert.notEqual(poziv!.headers.apikey, SERVICE_KEY);
});

test("prekratka lozinka se odbija prije mreže", async () => {
  t = testEnv();
  const { status } = await callJson(t, "/api/organizator/prijava", { body: { email: "org@test.hr", lozinka: "kratk" } });
  assert.equal(status, 401);
  assert.equal(t.calls.filter((c) => c.url.includes("/auth/v1/token")).length, 0);
});

// -------------------------------------------------------------- prijava kodom

test("slanje koda ide na GoTrue /otp s anon ključem i bez otvaranja računa", async () => {
  t = testEnv();
  const { status } = await callJson(t, "/api/organizator/kod", { body: { email: "org@test.hr" } });
  assert.equal(status, 200);
  const poziv = t.calls.find((c) => c.url.includes("/auth/v1/otp"));
  assert.ok(poziv, "slanje koda mora zvati GoTrue");
  assert.equal(poziv!.headers.apikey, ANON_KEY);
  assert.equal(JSON.parse(poziv!.body).create_user, false);
});

test("nepoznat mail daje isti odgovor kao poznat (nema otkrivanja računa)", async () => {
  t = testEnv();
  t.api.otpStatus = 422;
  const { status, body } = await callJson<{ ok: boolean }>(t, "/api/organizator/kod", { body: { email: "nitko@test.hr" } });
  assert.equal(status, 200);
  assert.equal(body.ok, true);
});

test("potvrda koda vraća token, a refresh token NE izlazi prema browseru", async () => {
  t = testEnv();
  const { status, body, text } = await callJson<{ access_token: string }>(t, "/api/organizator/potvrdi", {
    body: { email: "org@test.hr", kod: "123 456" },
  });
  assert.equal(status, 200);
  assert.equal(body.access_token, "jwt-organizatora");
  assert.ok(!text.includes("refresh_token"));
  const poziv = t.calls.find((c) => c.url.includes("/auth/v1/verify"));
  assert.deepEqual(JSON.parse(poziv!.body), { type: "email", email: "org@test.hr", token: "123456" });
});

test("kriv ili istekao kod → 401 kod_neispravan", async () => {
  t = testEnv();
  t.api.kodOk = false;
  const { status, body } = await callJson<{ error: string }>(t, "/api/organizator/potvrdi", {
    body: { email: "org@test.hr", kod: "000000" },
  });
  assert.equal(status, 401);
  assert.equal(body.error, "kod_neispravan");
});

test("kod koji nisu znamenke se odbija prije mreže", async () => {
  t = testEnv();
  const { status } = await callJson(t, "/api/organizator/potvrdi", { body: { email: "org@test.hr", kod: "abcdef" } });
  assert.equal(status, 401);
  assert.equal(t.calls.filter((c) => c.url.includes("/auth/v1/verify")).length, 0);
});

// ------------------------------------------------------------ editor događaja

const noviDogadjaj = {
  event_id: "11111111-1111-4111-8111-111111111111",
  account_id: "22222222-2222-4222-8222-222222222222",
  title: "Koncert",
  venue_name: "Dvorana",
  venue_city: "Zagreb",
  tiers: [{ title: "Ulaz", price_cents: 1500 }],
};

test("kreiranje događaja ide korisnikovim JWT-om na events-organizer create", async () => {
  t = testEnv();
  const { status, body } = await callJson<{ slug: string }>(t, "/api/organizator/dogadjaj", {
    headers: auth(),
    body: { ...noviDogadjaj, action: "publish", visibility: "public", nepoznato: 1 },
  });
  assert.equal(status, 200);
  assert.equal(body.slug, "novi-dogadjaj");
  const poziv = t.calls.find((c) => c.url.includes("/functions/v1/events-organizer"));
  assert.equal(poziv!.headers.authorization, "Bearer jwt-organizatora");
  assert.equal(poziv!.headers.apikey, ANON_KEY);
  const poslano = JSON.parse(poziv!.body);
  assert.equal(poslano.action, "create", "klijent ne smije podmetnuti drugu akciju");
  assert.ok(!("visibility" in poslano) && !("nepoznato" in poslano), "propuštaju se samo poznata polja");
});

test("kreiranje bez prijave → 401, bez mreže", async () => {
  t = testEnv();
  const { status } = await callJson(t, "/api/organizator/dogadjaj", { body: noviDogadjaj });
  assert.equal(status, 401);
  assert.equal(t.calls.filter((c) => c.url.includes("events-organizer")).length, 0);
});

test("kreiranje bez ulaznica ili s lošim id-em se odbija prije mreže", async () => {
  t = testEnv();
  for (const [izmjena, kod] of [
    [{ tiers: [] }, "invalid_tiers"],
    [{ event_id: "x" }, "invalid_event_id"],
    [{ account_id: "x" }, "invalid_account_id"],
  ] as const) {
    const { status, body } = await callJson<{ error: string }>(t, "/api/organizator/dogadjaj", {
      headers: auth(),
      body: { ...noviDogadjaj, ...izmjena },
    });
    assert.equal(status, 400);
    assert.equal(body.error, kod);
  }
  assert.equal(t.calls.filter((c) => c.url.includes("events-organizer")).length, 0);
});

test("RLS odbijanje (nije admin ili nema provjeren identitet) → 403 nema_prava_kreiranja", async () => {
  t = testEnv();
  t.api.kreiranjeStatus = 400;
  t.api.kreiranje = { error: "new" };
  const { status, body } = await callJson<{ error: string }>(t, "/api/organizator/dogadjaj", {
    headers: auth(),
    body: noviDogadjaj,
  });
  assert.equal(status, 403);
  assert.equal(body.error, "nema_prava_kreiranja");
});

test("strojni kod iz baze prolazi, sirova poruka baze ne", async () => {
  t = testEnv();
  t.api.kreiranjeStatus = 400;
  t.api.kreiranje = { error: "invalid_venue_name" };
  const a = await callJson<{ error: string }>(t, "/api/organizator/dogadjaj", { headers: auth(), body: noviDogadjaj });
  assert.equal(a.body.error, "invalid_venue_name");

  t.api.kreiranje = { error: "duplicate key value violates unique constraint \"x\"" };
  const b = await callJson<{ error: string }>(t, "/api/organizator/dogadjaj", { headers: auth(), body: noviDogadjaj });
  assert.equal(b.status, 502);
  assert.ok(!b.text.includes("duplicate key"));
});

test("online način i link prolaze do events-organizer", async () => {
  t = testEnv();
  await callJson(t, "/api/organizator/dogadjaj", {
    headers: auth(),
    body: { ...noviDogadjaj, attendance_mode: "online", online_url: "https://meet.example.com/x" },
  });
  const poslano = JSON.parse(t.calls.find((c) => c.url.includes("events-organizer"))!.body);
  assert.equal(poslano.attendance_mode, "online");
  assert.equal(poslano.online_url, "https://meet.example.com/x");
});

test("galerija prolazi do events-organizer, smeće umjesto galerije ne", async () => {
  t = testEnv();
  const galerija = [{ url: "https://x/1.webp" }];
  await callJson(t, "/api/organizator/dogadjaj", {
    headers: auth(),
    body: { ...noviDogadjaj, gallery: galerija },
  });
  const poslano = JSON.parse(t.calls.find((c) => c.url.includes("events-organizer"))!.body);
  assert.deepEqual(poslano.gallery, galerija);

  for (const gallery of ["https://x/1.webp", Array.from({ length: 21 }, () => ({ url: "https://x" }))]) {
    const { status, body } = await callJson<{ error: string }>(t, "/api/organizator/dogadjaj", {
      headers: auth(),
      body: { ...noviDogadjaj, gallery },
    });
    assert.equal(status, 400);
    assert.equal(body.error, "invalid_gallery");
  }
  assert.equal(t.calls.filter((c) => c.url.includes("events-organizer")).length, 1);
});

// ------------------------------------------------------ uređivanje i brisanje

const SKICA = "44444444-4444-4444-8444-444444444444";

test("skica za uređivanje se čita JWT-om; vrste po redu, nepostojeća → 404", async () => {
  t = testEnv();
  t.api.skica = [
    {
      id: SKICA,
      account_id: "acc-1",
      slug: "skica",
      title: "Skica",
      state: "draft",
      events: { venue_name: "Dvorana", gallery: [] },
      event_access: { online_url: "https://meet.example.com/x" },
      campaign_tiers: [
        { id: "t2", title: "B", sort: 1 },
        { id: "t1", title: "A", sort: 0 },
      ],
    },
  ];
  const { status, body } = await callJson<{ campaign_id: string; event: unknown; tiers: Array<{ id: string }> }>(
    t,
    `/api/organizator/dogadjaj/${SKICA}`,
    { headers: auth() },
  );
  assert.equal(status, 200);
  assert.equal(body.campaign_id, SKICA);
  // link iz event_access (1:1) se spljošti u event
  assert.deepEqual(body.event, { venue_name: "Dvorana", gallery: [], online_url: "https://meet.example.com/x" });
  assert.ok(!("event_access" in body));
  assert.deepEqual(body.tiers.map((x) => x.id), ["t1", "t2"]);
  const poziv = t.calls.find((c) => c.url.includes("/rest/v1/campaigns"))!;
  assert.equal(poziv.headers.authorization, "Bearer jwt-organizatora");
  assert.notEqual(poziv.headers.apikey, SERVICE_KEY);

  t.api.skica = [];
  const nema = await callJson<{ error: string }>(t, `/api/organizator/dogadjaj/${SKICA}`, { headers: auth() });
  assert.equal(nema.status, 404);
  assert.equal(nema.body.error, "event_not_found");
});

test("izmjena skice ide na events-organizer update s id-em iz putanje i samo poznatim poljima", async () => {
  t = testEnv();
  t.api.kreiranje = { campaign_id: SKICA, updated: true };
  const { status } = await callJson(t, `/api/organizator/dogadjaj/${SKICA}`, {
    method: "PUT",
    headers: auth(),
    body: {
      title: "Novo",
      campaign_id: "drugi-id",
      account_id: "podmetnuto",
      tiers: [{ id: "t1", title: "A", price_cents: 100 }],
      remove_tier_ids: ["t2"],
      visibility: "public",
    },
  });
  assert.equal(status, 200);
  const poslano = JSON.parse(t.calls.find((c) => c.url.includes("events-organizer"))!.body);
  assert.equal(poslano.action, "update");
  assert.equal(poslano.campaign_id, SKICA, "id dolazi iz putanje, ne iz tijela");
  assert.deepEqual(poslano.remove_tier_ids, ["t2"]);
  assert.ok(!("account_id" in poslano) && !("visibility" in poslano));
});

test("brisanje skice ide na events-organizer delete; kod jezgre prolazi", async () => {
  t = testEnv();
  t.api.kreiranje = { campaign_id: SKICA, deleted: true };
  const ok = await callJson(t, `/api/organizator/dogadjaj/${SKICA}`, { method: "DELETE", headers: auth() });
  assert.equal(ok.status, 200);
  const poslano = JSON.parse(t.calls.find((c) => c.url.includes("events-organizer"))!.body);
  assert.deepEqual(poslano, { campaign_id: SKICA, action: "delete" });

  t.api.kreiranjeStatus = 400;
  t.api.kreiranje = { error: "event_not_draft" };
  const objavljen = await callJson<{ error: string }>(t, `/api/organizator/dogadjaj/${SKICA}`, {
    method: "DELETE",
    headers: auth(),
  });
  assert.equal(objavljen.status, 400);
  assert.equal(objavljen.body.error, "event_not_draft");
});

test("uređivanje i brisanje bez prijave ili s lošim id-em ne idu na mrežu", async () => {
  t = testEnv();
  for (const method of ["GET", "PUT", "DELETE"]) {
    const bez = await callJson(t, `/api/organizator/dogadjaj/${SKICA}`, { method, body: method === "PUT" ? {} : undefined });
    assert.equal(bez.status, 401, method);
    const los = await callJson<{ error: string }>(t, "/api/organizator/dogadjaj/x", { method, headers: auth() });
    assert.equal(los.body.error, "invalid_campaign_id", method);
  }
  assert.equal(t.calls.filter((c) => c.url.includes("events-organizer") || c.url.includes("/rest/v1/")).length, 0);
});

// --------------------------------------------------------------- upload slike

const UID = "33333333-3333-4333-8333-333333333333";
const jwtS = (sub: string) =>
  `h.${Buffer.from(JSON.stringify({ sub, role: "authenticated" })).toString("base64url")}.potpis`;
const slika = (o: { jwt?: string; vrsta?: string; raw?: string } = {}) =>
  callJson<{ url?: string; error?: string }>(t, "/api/organizator/slika", {
    headers: { ...auth(o.jwt ?? jwtS(UID)), "content-type": o.vrsta ?? "image/webp" },
    raw: o.raw ?? "RIFF....WEBP",
  });

test("upload slike ide JWT-om u korisnikovu mapu u pinka-covers i vraća javni URL", async () => {
  t = testEnv();
  const { status, body } = await slika();
  assert.equal(status, 200);
  const poziv = t.calls.find((c) => c.url.includes("/storage/v1/object/"))!;
  assert.match(poziv.url, new RegExp(`/storage/v1/object/pinka-covers/${UID}/[0-9a-f-]{36}\\.webp$`));
  assert.equal(poziv.headers.authorization, `Bearer ${jwtS(UID)}`);
  assert.equal(poziv.headers.apikey, ANON_KEY);
  assert.equal(body.url, poziv.url.replace("/object/pinka-covers/", "/object/public/pinka-covers/"));
});

test("upload bez prijave, s krivom vrstom ili bez sub-a ne ide u Storage", async () => {
  t = testEnv();
  const bezPrijave = await callJson(t, "/api/organizator/slika", { headers: { "content-type": "image/png" }, raw: "x" });
  assert.equal(bezPrijave.status, 401);
  const svg = await slika({ vrsta: "image/svg+xml" });
  assert.equal(svg.status, 415);
  assert.equal(svg.body.error, "slika_vrsta");
  const prazno = await slika({ raw: "" });
  assert.equal(prazno.body.error, "slika_vrsta");
  const bezSub = await slika({ jwt: "nije.jwt.uopce" });
  assert.equal(bezSub.status, 401);
  assert.equal(t.calls.filter((c) => c.url.includes("/storage/")).length, 0);
});

test("RLS Storagea (identitet nije provjeren) → 403 nema_prava_slike, sirova poruka ne izlazi", async () => {
  t = testEnv();
  t.api.slikaStatus = 400;
  t.api.slikaOdgovor = '{"statusCode":"403","error":"Unauthorized","message":"new row violates row-level security policy"}';
  const a = await slika();
  assert.equal(a.status, 403);
  assert.equal(a.body.error, "nema_prava_slike");

  t.api.slikaOdgovor = '{"statusCode":"403","error":"Unauthorized","message":"JWS Protected Header is invalid"}';
  const istekao = await slika();
  assert.equal(istekao.status, 401, "nevaljan JWT je istek prijave, ne manjak prava");

  t.api.slikaOdgovor = '{"statusCode":"413","error":"Payload too large","message":"The object exceeded the maximum allowed size"}';
  const b = await slika();
  assert.equal(b.body.error, "slika_prevelika");

  t.api.slikaStatus = 500;
  t.api.slikaOdgovor = "interna greška s detaljima";
  const c = await slika();
  assert.equal(c.status, 502);
  assert.ok(!c.text.includes("detaljima"));
});

// -------------------------------------------------------------------- pregled

test("pregled bez tokena → 401", async () => {
  t = testEnv();
  const { status, body } = await callJson<{ error: string }>(t, "/api/organizator/pregled");
  assert.equal(status, 401);
  assert.equal(body.error, "nije_prijavljen");
});

test("pregled ide U IME korisnika (JWT), ne service ključem", async () => {
  t = testEnv();
  const { status } = await callJson(t, "/api/organizator/pregled", { headers: auth() });
  assert.equal(status, 200);
  const poziv = t.calls.find((c) => c.url.includes("rpc/organizer_overview"));
  assert.equal(poziv!.headers.authorization, "Bearer jwt-organizatora");
  assert.equal(poziv!.headers.apikey, ANON_KEY);
});

// --------------------------------------------------------------------- izvoz

test("izvoz sudionika je CSV s BOM-om i ; razdjelnikom", async () => {
  t = testEnv();
  t.api.tickets = [
    { serial: "SUS-000004", holder_name: "Ana Anić", holder_email: "ana@example.com", state: "issued" },
  ];
  const res = await call(t, `/api/organizator/holderi.csv?campaign_id=${CAMPAIGN}`, { headers: auth() });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") ?? "", /text\/csv/);
  assert.match(res.headers.get("content-disposition") ?? "", /attachment/);
  // BOM se provjerava nad BAJTOVIMA: TextDecoder ga pri .text() tiho pojede,
  // pa bi test nad stringom prošao i da ga u odgovoru nema.
  const bajtovi = new Uint8Array(await res.clone().arrayBuffer());
  assert.deepEqual([...bajtovi.slice(0, 3)], [0xef, 0xbb, 0xbf], "bez BOM-a Excel razbije dijakritiku");
  const text = await res.text();
  assert.match(text, /serial;ime;email;stanje;ulazak/);
  assert.match(text, /Ana Anić/);
});

test("izvoz s neispravnim campaign_id ne ide na mrežu", async () => {
  t = testEnv();
  const { status, body } = await callJson<{ error: string }>(t, "/api/organizator/holderi.csv?campaign_id=nije-uuid", {
    headers: auth(),
  });
  assert.equal(status, 400);
  assert.equal(body.error, "invalid_campaign_id");
  assert.equal(t.calls.filter((c) => c.url.includes("/rest/v1/tickets")).length, 0);
});

test("izvoz bez tokena → 401 i nijedan PII ne izlazi", async () => {
  t = testEnv();
  const res = await call(t, `/api/organizator/holderi.csv?campaign_id=${CAMPAIGN}`);
  assert.equal(res.status, 401);
  assert.ok(!(await res.text()).includes("@"));
});

// --------------------------------------------------------------------- skener

test("prvi sken vraća ime holdera", async () => {
  t = testEnv();
  const { status, body } = await callJson<{ status: string; holder_name: string }>(t, "/api/skener/sken", {
    headers: auth(),
    body: { qr_token: "a".repeat(64) },
  });
  assert.equal(status, 200);
  assert.equal(body.status, "checked_in");
  assert.equal(body.holder_name, "Ana Anić");
});

test("skener prihvaća QR s prefiksom i velikim slovima", async () => {
  t = testEnv();
  const { status } = await callJson(t, "/api/skener/sken", {
    headers: auth(),
    body: { qr_token: `dgdj1:${"A".repeat(64)}` },
  });
  assert.equal(status, 200);
  const poslano = JSON.parse(t.calls.find((c) => c.url.includes("events-checkin"))!.body) as { qr_token: string };
  assert.equal(poslano.qr_token, "a".repeat(64));
});

test("drugi sken iste ulaznice je odbijen s vremenom prvog ulaska", async () => {
  t = testEnv();
  t.api.checkin = {
    status: "already_checked_in",
    serial: "SUS-000004",
    holder_name: "Ana Anić",
    checked_in_at: "2026-11-14T09:12:00Z",
    checked_in_by_email: "ulaz@test",
  };
  const { body } = await callJson<{ status: string; checked_in_at: string }>(t, "/api/skener/sken", {
    headers: auth(),
    body: { qr_token: "a".repeat(64) },
  });
  assert.equal(body.status, "already_checked_in");
  assert.equal(body.checked_in_at, "2026-11-14T09:12:00Z");
});

test("sken bez prijave → 401, jezgra se ne dira", async () => {
  t = testEnv();
  const { status } = await callJson(t, "/api/skener/sken", { body: { qr_token: "a".repeat(64) } });
  assert.equal(status, 401);
  assert.equal(t.calls.filter((c) => c.url.includes("events-checkin")).length, 0);
});

test("smeće umjesto QR-a se odbija prije mreže", async () => {
  t = testEnv();
  const { status, body } = await callJson<{ error: string }>(t, "/api/skener/sken", {
    headers: auth(),
    body: { qr_token: "https://example.com/neka-druga-aplikacija" },
  });
  assert.equal(status, 400);
  assert.equal(body.error, "neispravan_qr");
  assert.equal(t.calls.filter((c) => c.url.includes("events-checkin")).length, 0);
});

test("korisnik bez admin role je odbijen SERVER-SIDE, ne skrivanjem UI-ja", async () => {
  t = testEnv();
  t.api.checkin = { error: "not_authorized" };
  t.api.checkinStatus = 403;
  const { status, body } = await callJson<{ error: string }>(t, "/api/skener/sken", {
    headers: auth(),
    body: { qr_token: "a".repeat(64) },
  });
  assert.equal(status, 403);
  assert.equal(body.error, "not_authorized");
});

// ------------------------------------------------------- konfiguracija okoline

test("bez anon ključa prijava jasno pada, a zdravlje to pokazuje", async () => {
  t = testEnv({ DOMOVINA_API_ANON_KEY: undefined });
  const { body: zdravlje } = await callJson<{ prijava: boolean }>(t, "/api/zdravlje");
  assert.equal(zdravlje.prijava, false);
  const { status, body } = await callJson<{ error: string }>(t, "/api/organizator/prijava", {
    body: { email: "org@test.hr", lozinka: "lozinka123" },
  });
  assert.equal(status, 503);
  assert.equal(body.error, "anon_key_missing");
});

test("skica: jezgra bez events_free_online → čita se bez attendance_mode i event_access", async () => {
  t = testEnv();
  t.api.skica = [{ id: SKICA, account_id: "acc-1", slug: "s", title: "S", state: "draft", events: { venue_name: "D" }, campaign_tiers: [] }];
  const izvorni = globalThis.fetch;
  globalThis.fetch = (async (u: RequestInfo | URL, init?: RequestInit) =>
    String(u).includes("event_access(") ? new Response("{}", { status: 400 }) : izvorni(u, init)) as typeof fetch;
  try {
    const { status, body } = await callJson<{ event: { venue_name: string } }>(t, `/api/organizator/dogadjaj/${SKICA}`, {
      headers: auth(),
    });
    assert.equal(status, 200);
    assert.equal(body.event.venue_name, "D");
  } finally {
    globalThis.fetch = izvorni;
  }
});
