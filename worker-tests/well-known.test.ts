// Universal/App Links datoteke za mobilne aplikacije (mobile/).
import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import { callJson, testEnv, type TestCtx } from "./harness/env.ts";

let t: TestCtx | null = null;
afterEach(() => { t?.restore(); t = null; });

test("AASA: bez konfiguracije 404, s konfiguracijom applinks na /ulaznice/*", async () => {
  t = testEnv();
  assert.equal((await callJson(t, "/.well-known/apple-app-site-association")).status, 404);
  t.restore();
  t = testEnv({ APPLE_APP_IDS: "6SCK58757K.ai.domovina.ulaznice, X.y" });
  const { status, body } = await callJson<{ applinks: { details: Array<{ appIDs: string[]; components: Array<{ "/": string }> }> } }>(
    t, "/.well-known/apple-app-site-association",
  );
  assert.equal(status, 200);
  assert.deepEqual(body.applinks.details[0].appIDs, ["6SCK58757K.ai.domovina.ulaznice", "X.y"]);
  assert.equal(body.applinks.details[0].components[0]["/"], "/ulaznice/*");
});

test("assetlinks: otisci se normaliziraju u velika slova, paket je ai.domovina.ulaznice", async () => {
  t = testEnv({ ANDROID_CERT_SHA256: "ab:cd, ef:01" });
  const { status, body } = await callJson<Array<{ target: { package_name: string; sha256_cert_fingerprints: string[] } }>>(
    t, "/.well-known/assetlinks.json",
  );
  assert.equal(status, 200);
  assert.equal(body[0].target.package_name, "ai.domovina.ulaznice");
  assert.deepEqual(body[0].target.sha256_cert_fingerprints, ["AB:CD", "EF:01"]);
});

test("u okruženju najave ni .well-known ne postoji (sve je najava)", async () => {
  t = testEnv({ NAJAVA: "1", APPLE_APP_IDS: "X.y" });
  const r = await callJson(t, "/.well-known/apple-app-site-association");
  assert.equal(r.status, 200);
  assert.ok(r.text.includes("<!doctype html>"), "najava vraća HTML, ne JSON");
});
