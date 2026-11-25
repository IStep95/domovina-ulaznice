// SKRIVENI_ORGANIZATORI: jezgra je zajednička stagingu i produkciji, pa
// produkcija skriva događaje test organizatora (sandbox Stripe rail). Skriveni
// događaj ne smije postojati ni u popisu, ni na stranici, ni u kupnji.
import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import { CAMPAIGN, TIER, callJson, testEnv, type TestCtx } from "./harness/env.ts";

let t: TestCtx | null = null;
afterEach(() => { t?.restore(); t = null; });

const TEST_ORG = "00000000-0000-4000-8000-0000000000f2";
const DRUGI_ORG = "99999999-9999-4999-8999-999999999999";

/** Okruženje u kojem je događaj iz feeda u vlasništvu `vlasnik`; pamti upite na `ulaznice.events`. */
function okolina(skriveni: string | undefined, vlasnik: string) {
  t = testEnv(skriveni === undefined ? {} : { SKRIVENI_ORGANIZATORI: skriveni });
  const upiti: string[] = [];
  const stub = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/rest/v1/events?") && url.includes("account_id=in.")) {
      upiti.push(decodeURIComponent(url));
      return new Response(JSON.stringify([{ id: CAMPAIGN, account_id: vlasnik }]), {
        headers: { "content-type": "application/json" },
      });
    }
    return stub(input, init);
  }) as typeof fetch;
  const restore = t.restore;
  t.restore = () => { globalThis.fetch = stub; restore(); };
  return { t, upiti };
}

const narudzba = { campaign_id: CAMPAIGN, tier_id: TIER, quantity: 1, buyer_email: "kupac@example.com", holders: [] };

test("događaj skrivenog organizatora nema u popisu, na stranici ni u kupnji", async () => {
  const { t, upiti } = okolina(`${TEST_ORG}`, TEST_ORG);

  const popis = await callJson<{ events: unknown[] }>(t, "/api/dogadjaji");
  assert.equal(popis.status, 200);
  assert.equal(popis.body.events.length, 0);

  const detalj = await callJson(t, "/api/dogadjaj/susret-2027");
  assert.equal(detalj.status, 404);

  const kupnja = await callJson(t, "/api/narudzba", { body: narudzba });
  assert.equal(kupnja.status, 404);
  assert.ok(!t.calls.some((c) => c.url.includes("/functions/v1/events-order")), "narudžba ne smije stići do jezgre");

  assert.ok(upiti[0].includes(`id=in.(${CAMPAIGN})`));
  assert.ok(upiti[0].includes(`account_id=in.(${TEST_ORG})`));
  assert.match(upiti[0], /\/rest\/v1\/events\?select=id,account_id&/, "ulaznice.events, ne campaigns");
});

test("bez varijable (staging) i s drugim organizatorom događaj je vidljiv", async () => {
  let o = okolina(undefined, TEST_ORG);
  let popis = await callJson<{ events: unknown[] }>(o.t, "/api/dogadjaji");
  assert.equal(popis.body.events.length, 1);
  assert.equal(o.upiti.length, 0, "bez varijable nema dodatnog upita");
  o.t.restore();

  // PostgREST bi vratio prazno, ali i da vrati tuđu kampanju, Worker provjerava account_id.
  o = okolina(DRUGI_ORG, TEST_ORG);
  t = o.t;
  popis = await callJson<{ events: unknown[] }>(o.t, "/api/dogadjaji");
  assert.equal(popis.body.events.length, 1);
  assert.equal((await callJson(o.t, "/api/dogadjaj/susret-2027")).status, 200);
});

test("neispravni unosi u varijabli se ignoriraju (nema injekcije u PostgREST upit)", async () => {
  const { t, upiti } = okolina(`  ${TEST_ORG.toUpperCase()} , nije-uuid,),or=(id.neq.0`, TEST_ORG);
  const popis = await callJson<{ events: unknown[] }>(t, "/api/dogadjaji");
  assert.equal(popis.body.events.length, 0);
  assert.equal(upiti.length, 1);
  assert.ok(!upiti[0].includes("nije-uuid") && !upiti[0].includes("or="));
});
