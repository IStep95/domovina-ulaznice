// Testovi API klijenta (web/src/lib/api.ts), node:test, bez mreže (odluka 11):
// fetch se ubacuje kroz createApiClient({ fetch }), a za usporedbu sa SPA
// klijentom (src/lib/api.ts) privremeno se zamjenjuje globalThis.fetch.
//
// Pokreće se Node 22 ugrađenim uklanjanjem tipova (type stripping, bez flaga od
// 22.18): `node --test test/` — vidi web/package.json `test`.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ApiError,
  apiErrorFromBody,
  apiUrl,
  createApiClient,
  parseApiResponse,
} from "../src/lib/api.ts";
import * as spa from "../../src/lib/api.ts";

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** Lažni fetch: bilježi pozive i vraća zadani status i tijelo. */
function fakeFetch(status: number, body: string): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Response(body, { status });
  }) as typeof fetch;
  return { fetch: f, calls };
}

// ------------------------------------------------------------------ ApiError

test("ApiError iz {error: 'tier_sold_out'} sa statusom 409", () => {
  const err = apiErrorFromBody(409, { error: "tier_sold_out" });
  assert.ok(err instanceof ApiError);
  assert.ok(err instanceof Error);
  assert.equal(err.code, "tier_sold_out");
  assert.equal(err.status, 409);
  assert.equal(err.message, "tier_sold_out");
  assert.equal(err.name, "ApiError");
});

test("parseApiResponse: 409 s JSON greškom baca ApiError(tier_sold_out, 409)", () => {
  assert.throws(
    () => parseApiResponse(409, JSON.stringify({ error: "tier_sold_out" })),
    (e: unknown) => e instanceof ApiError && e.code === "tier_sold_out" && e.status === 409,
  );
});

test("parseApiResponse: tijelo koje nije JSON → neispravan_odgovor (i za 2xx i za 5xx)", () => {
  for (const status of [200, 502]) {
    assert.throws(
      () => parseApiResponse(status, "<html>Bad gateway</html>"),
      (e: unknown) => e instanceof ApiError && e.code === "neispravan_odgovor" && e.status === status,
    );
  }
});

test("parseApiResponse: non-2xx bez polja error → http_<status>", () => {
  for (const [status, text] of [
    [500, ""],
    [404, "{}"],
    [503, JSON.stringify({ poruka: "x" })],
    [400, "[]"],
  ] as const) {
    assert.throws(
      () => parseApiResponse(status, text),
      (e: unknown) => e instanceof ApiError && e.code === `http_${status}` && e.status === status,
    );
  }
});

test("parseApiResponse: 2xx vraća parsirani JSON, prazno tijelo je {}", () => {
  assert.deepEqual(parseApiResponse(200, JSON.stringify({ a: 1 })), { a: 1 });
  assert.deepEqual(parseApiResponse(204, ""), {});
});

// ------------------------------------------------------------------ apiUrl

test("apiUrl bez baseUrl vraća relativnu putanju (preglednik)", () => {
  assert.equal(apiUrl("/api/dogadjaji"), "/api/dogadjaji");
});

test("apiUrl s baseUrl vraća apsolutni URL (SSR)", () => {
  assert.equal(apiUrl("/api/dogadjaji", "http://localhost:8797"), "http://localhost:8797/api/dogadjaji");
  // Putanja s / na početku uvijek ide od korijena origina.
  assert.equal(
    apiUrl("/api/dogadjaj/x", "https://ulaznice-staging.domovina.ai/nesto/"),
    "https://ulaznice-staging.domovina.ai/api/dogadjaj/x",
  );
});

// ------------------------------------------------------------------ createApiClient

test("dohvatiDogadjaj zove pravi URL (encodeURIComponent sluga) i vraća JSON", async () => {
  const ev = { slug: "a b/č", title: "Naslov" };
  const { fetch, calls } = fakeFetch(200, JSON.stringify(ev));
  const api = createApiClient({ baseUrl: "http://localhost:8797", fetch });
  const out = await api.dohvatiDogadjaj("a b/č");
  assert.deepEqual(out, ev);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]!.url, "http://localhost:8797/api/dogadjaj/a%20b%2F%C4%8D");
  assert.equal(new Headers(calls[0]!.init?.headers).get("content-type"), "application/json");
});

test("bez baseUrl klijent zove relativni /api/...", async () => {
  const { fetch, calls } = fakeFetch(200, JSON.stringify({ events: [] }));
  const api = createApiClient({ fetch });
  assert.deepEqual(await api.dohvatiDogadjaje(), { events: [] });
  assert.equal(calls[0]!.url, "/api/dogadjaji");
});

test("dohvatiDogadjaj: 404 {error: event_not_found} → ApiError", async () => {
  const { fetch } = fakeFetch(404, JSON.stringify({ error: "event_not_found" }));
  const api = createApiClient({ baseUrl: "http://localhost:8797", fetch });
  await assert.rejects(api.dohvatiDogadjaj("ne-postoji"), (e: unknown) =>
    e instanceof ApiError && e.code === "event_not_found" && e.status === 404,
  );
});

test("kreirajNarudzbu šalje POST s JSON tijelom", async () => {
  const req: spa.CreateOrderRequest = {
    campaign_id: "c1",
    tier_id: "t1",
    quantity: 2,
    buyer_email: "kupac@example.com",
    holders: [{ full_name: "Ana Anić" }, { full_name: "Ivo Ivić", email: "ivo@example.com" }],
  };
  const res = { order_id: "o1", checkout_url: "http://localhost:8797/mock-checkout/o1", amount_cents: 10000 };
  const { fetch, calls } = fakeFetch(201, JSON.stringify(res));
  const api = createApiClient({ baseUrl: "http://localhost:8797", fetch });
  assert.deepEqual(await api.kreirajNarudzbu(req), res);
  assert.equal(calls[0]!.url, "http://localhost:8797/api/narudzba");
  assert.equal(calls[0]!.init?.method, "POST");
  assert.equal(new Headers(calls[0]!.init?.headers).get("content-type"), "application/json");
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), req);
});

test("dohvatiNarudzbu i posaljiPonovno: putanje i metode", async () => {
  const { fetch, calls } = fakeFetch(200, "{}");
  const api = createApiClient({ fetch });
  await api.dohvatiNarudzbu("o/1");
  await api.posaljiPonovno("o/1");
  assert.equal(calls[0]!.url, "/api/ulaznice/o%2F1");
  assert.equal(calls[0]!.init?.method, undefined);
  assert.equal(calls[1]!.url, "/api/ulaznice/o%2F1/ponovna-dostava");
  assert.equal(calls[1]!.init?.method, "POST");
});

// ------------------------------------------------------------------ paritet sa SPA-om

// Isti odgovori kroz oba klijenta moraju dati isti rezultat ili isti (code, status).
// Namjerno izostavljeno: tijelo `null` i `{error: <ne-string>}` — SPA tu baca
// TypeError odnosno prenosi ne-string kao code, web/ daje http_<status>.
const PARITET: Array<[number, string]> = [
  [200, JSON.stringify({ slug: "x", title: "X" })],
  [200, ""],
  [200, "nije json"],
  [409, JSON.stringify({ error: "tier_sold_out" })],
  [404, JSON.stringify({ error: "event_not_found" })],
  [500, ""],
  [502, "<html>Bad gateway</html>"],
  [503, "{}"],
];

async function ishod(p: Promise<unknown>): Promise<unknown> {
  try {
    return { ok: await p };
  } catch (e) {
    if (e instanceof Error && "code" in e && "status" in e) return { code: e.code, status: e.status };
    throw e;
  }
}

test("paritet sa src/lib/api.ts: isti URL i isti ishod za iste odgovore", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  for (const [status, text] of PARITET) {
    const web = fakeFetch(status, text);
    const root = fakeFetch(status, text);
    globalThis.fetch = root.fetch;
    const a = await ishod(createApiClient({ fetch: web.fetch }).dohvatiDogadjaj("a b"));
    const b = await ishod(spa.dohvatiDogadjaj("a b"));
    assert.deepEqual(a, b, `status ${status}, tijelo ${JSON.stringify(text)}`);
    assert.equal(web.calls[0]!.url, root.calls[0]!.url);
  }
});

// ------------------------------------------------------------- retry_after (S4)

test("retry_after: konačan broj ≥ 0 prenosi se u ApiError.retryAfter", () => {
  for (const ra of [90, 0, 1.5, 3600]) {
    const err = apiErrorFromBody(429, { error: "previse_pokusaja", retry_after: ra });
    assert.equal(err.code, "previse_pokusaja");
    assert.equal(err.retryAfter, ra);
  }
  const krozParse = (() => {
    try {
      parseApiResponse(429, JSON.stringify({ error: "previse_pokusaja", retry_after: 90 }));
    } catch (e) {
      return e;
    }
  })();
  assert.ok(krozParse instanceof ApiError);
  assert.equal(krozParse.retryAfter, 90);
});

test("retry_after: sve što nije konačan broj ≥ 0 se ignorira", () => {
  // JSON nema NaN/Infinity, ali tijelo može doći i iz drugog izvora; provjera je ista.
  for (const ra of ["90", -1, Number.NaN, Number.POSITIVE_INFINITY, null, true, { s: 90 }, [90]]) {
    const err = apiErrorFromBody(429, { error: "previse_pokusaja", retry_after: ra });
    assert.equal(err.retryAfter, undefined, JSON.stringify(ra) ?? String(ra));
  }
  assert.equal(apiErrorFromBody(429, { error: "previse_pokusaja" }).retryAfter, undefined);
  // Bez koda u tijelu: http_<status>, retry_after se i dalje čita.
  const bezKoda = apiErrorFromBody(429, { retry_after: 30 });
  assert.equal(bezKoda.code, "http_429");
  assert.equal(bezKoda.retryAfter, 30);
});

test("kreirajNarudzbu: 429 s retry_after → ApiError s retryAfter; tijelo i metoda kao SPA", async () => {
  const { fetch: f, calls } = fakeFetch(429, JSON.stringify({ error: "previse_pokusaja", retry_after: 120 }));
  const api = createApiClient({ fetch: f });
  const zahtjev = { campaign_id: "c", tier_id: "t", quantity: 2, buyer_email: "a@b.hr", holders: [] };
  await assert.rejects(
    api.kreirajNarudzbu(zahtjev),
    (e: unknown) => e instanceof ApiError && e.code === "previse_pokusaja" && e.status === 429 && e.retryAfter === 120,
  );
  assert.equal(calls[0]!.url, "/api/narudzba");
  assert.equal(calls[0]!.init?.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0]!.init?.body)), zahtjev);
});
