// Astro frontend za kupce (web/docs/plan.md). SSR na Cloudflare Workersu
// (odluka 2), React otoci (odluka 3). Worker se konfigurira u ./wrangler.jsonc.
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";

// Lokalni mock API (mobile/mock-api.mjs, odluka 7). Koristi se samo u `astro dev`.
const MOCK_API = "http://localhost:8797";

// Katalog komponenti /_komponente (S2), samo u `astro dev`. Astro preskače
// datoteke koje počinju s `_`, pa se ruta ubacuje ovdje; u buildu ne postoji.
const komponenteSamoUDevu = {
  name: "komponente-samo-u-devu",
  hooks: {
    "astro:config:setup": ({ command, injectRoute }) => {
      if (command !== "dev") return;
      injectRoute({ pattern: "/_komponente", entrypoint: "./src/dev/komponente.astro" });
    },
  },
};

export default defineConfig({
  output: "server",
  adapter: cloudflare({
    // Bez Cloudflare Images bindinga (IMAGES): slike su vanjski https URL-ovi
    // organizatora i serviraju se nepromijenjene.
    imageService: "passthrough",
    // Nikakvi udaljeni bindingi u devu — web/ ih ionako nema (odluka 4).
    remoteBindings: false,
  }),
  // Adapter bi inače dodao KV binding SESSION; web/ nema KV (odluka 4).
  session: false,
  integrations: [react(), komponenteSamoUDevu],
  server: { port: 4321 },
  vite: {
    server: {
      // Samo dev server; build i deploy ovo ignoriraju. Preglednik zove
      // relativni /api/..., a mockov lažni Checkout živi na /mock-checkout/...
      proxy: {
        "/api": MOCK_API,
        "/mock-checkout": MOCK_API,
      },
    },
  },
});
