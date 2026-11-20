// S2b: nova polja događaja (venue_lat, venue_lon, cover_image_alt) prolaze kroz
// Worker nepromijenjena, a `null` ostaje `null` (ugovor /api/* se mijenja samo
// aditivno, web/docs/decisions.md odluka 21).
import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import { callJson, testEnv, type TestCtx } from "./harness/env.ts";

let t: TestCtx | null = null;
afterEach(() => { t?.restore(); t = null; });

type Dogadjaj = { event: Record<string, unknown> };

test("koordinate i alt naslovne slike prolaze u detalju i u popisu", async () => {
  t = testEnv();
  t.api.eventExtra = { venue_lat: 45.807844, venue_lon: 15.9518, cover_image_alt: "Dvorana Doma sportova" };
  const detalj = await callJson<Dogadjaj>(t, "/api/dogadjaj/susret-2027");
  assert.equal(detalj.status, 200);
  assert.equal(detalj.body.event.venue_lat, 45.807844);
  assert.equal(detalj.body.event.venue_lon, 15.9518);
  assert.equal(detalj.body.event.cover_image_alt, "Dvorana Doma sportova");

  const popis = await callJson<{ events: Dogadjaj[] }>(t, "/api/dogadjaji");
  assert.equal(popis.body.events[0].event.venue_lat, 45.807844);
  assert.equal(popis.body.events[0].event.cover_image_alt, "Dvorana Doma sportova");
});

test("null koordinate ostaju null, a jezgra bez migracije ne dobiva izmišljena polja", async () => {
  t = testEnv();
  t.api.eventExtra = { venue_lat: null, venue_lon: null, cover_image_alt: null };
  const { body } = await callJson<Dogadjaj>(t, "/api/dogadjaj/susret-2027");
  assert.ok("venue_lat" in body.event);
  assert.equal(body.event.venue_lat, null);
  assert.equal(body.event.venue_lon, null);
  assert.equal(body.event.cover_image_alt, null);

  t.restore();
  t = testEnv(); // feed bez S2b polja (jezgra prije migracije)
  const stari = await callJson<Dogadjaj>(t, "/api/dogadjaj/susret-2027");
  assert.equal(stari.status, 200);
  assert.ok(!("venue_lat" in stari.body.event));
});
