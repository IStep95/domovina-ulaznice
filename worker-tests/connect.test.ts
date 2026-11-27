// Stripe Connect onboarding (2026-11-27, worker/connect.ts): čiste funkcije.
// Tok s pravim pozivima isproban je lokalno (fake-stripe.mjs) i na stagingu.
import { strict as assert } from "node:assert";
import { test } from "node:test";
import { HttpError } from "../worker/env.ts";
import { adreseOnboardinga, emailIzJwt, stanjeIzRacuna, stripeGreska, tipRacuna } from "../worker/connect.ts";

test("tipRacuna: zadano standard, express samo izričito", () => {
  assert.equal(tipRacuna({}), "standard");
  assert.equal(tipRacuna({ STRIPE_CONNECT_TIP: "express" }), "express");
  assert.equal(tipRacuna({ STRIPE_CONNECT_TIP: "custom" }), "standard");
});

test("stanjeIzRacuna: naplata tek uz charges_enabled i details_submitted (kao account.updated)", () => {
  assert.deepEqual(stanjeIzRacuna({ charges_enabled: true, details_submitted: false, payouts_enabled: false }), {
    charges_enabled: false,
    payouts_enabled: false,
  });
  assert.deepEqual(stanjeIzRacuna({ charges_enabled: true, details_submitted: true, payouts_enabled: true }), {
    charges_enabled: true,
    payouts_enabled: true,
  });
});

test("adreseOnboardinga: povratak i istekli link vode na /organizator/postavke s računom", () => {
  const a = adreseOnboardinga("https://ulaznice-staging.domovina.ai", "00000000-0000-4000-8000-0000000000d2");
  assert.equal(
    a.return_url,
    "https://ulaznice-staging.domovina.ai/organizator/postavke?stripe=povratak&racun=00000000-0000-4000-8000-0000000000d2",
  );
  assert.match(a.refresh_url, /\/organizator\/postavke\?stripe=obnovi&racun=/);
});

test("emailIzJwt: e-mail iz payloada, smeće → null", () => {
  const payload = Buffer.from(JSON.stringify({ sub: "x", email: "org@primjer.hr" })).toString("base64url");
  assert.equal(emailIzJwt(`h.${payload}.s`), "org@primjer.hr");
  assert.equal(emailIzJwt("nije-jwt"), null);
  const bez = Buffer.from(JSON.stringify({ sub: "x" })).toString("base64url");
  assert.equal(emailIzJwt(`h.${bez}.s`), null);
});

test("stripeGreska: dozvola → stripe_bez_dozvole, ostale Stripe greške → stripe_onboarding_neuspio", () => {
  const d = stripeGreska({ type: "StripePermissionError", message: "rak_ nema accounts", statusCode: 403 });
  assert.ok(d instanceof HttpError);
  assert.equal((d as HttpError).code, "stripe_bez_dozvole");
  const o = stripeGreska({ type: "StripeInvalidRequestError", message: "x", statusCode: 400 });
  assert.equal((o as HttpError).code, "stripe_onboarding_neuspio");
  const h = new HttpError(403, "not_authorized");
  assert.equal(stripeGreska(h), h);
  const obicna = new Error("x");
  assert.equal(stripeGreska(obicna), obicna);
});
