// Astro frontend za kupce (web/docs/plan.md). SSR na Cloudflare Workersu
// (odluka 2), React otoci (odluka 3). Worker se konfigurira u ./wrangler.jsonc.
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import { unstable_getVarsForDev } from "wrangler";

// Lokalni mock API (mobile/mock-api.mjs, odluka 7). Koristi se samo u `astro dev`.
const MOCK_API = "http://localhost:8797";

// `npm run dev:mock` (scripts/dev-mock.mjs) podmeće vlastiti Wrangler config (uz koji je
// `.dev.vars` s adresom mocka) i zaseban Vite cache. Bez tih varijabli sve je kao prije.
const WRANGLER_CONFIG = process.env.WEB_WRANGLER_CONFIG;
const VITE_CACHE = process.env.WEB_VITE_CACHE;

// Adresa API-ja u devu, ista za SSR i preglednik: API_BASE_URL_DEV iz `.dev.vars` uz
// Wrangler config (pročitan istom funkcijom kojom ga @cloudflare/vite-plugin daje SSR-u,
// src/lib/api-ssr.ts), inače mock. Čita se pri pokretanju `astro dev`.
const API_DEV =
  unstable_getVarsForDev(
    WRANGLER_CONFIG ?? fileURLToPath(new URL("./wrangler.jsonc", import.meta.url)),
    undefined,
    {},
    process.env.CLOUDFLARE_ENV,
    true,
  ).API_BASE_URL_DEV?.value ?? MOCK_API;

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
    ...(WRANGLER_CONFIG && { configPath: WRANGLER_CONFIG }),
  }),
  // Adapter bi inače dodao KV binding SESSION; web/ nema KV (odluka 4).
  session: false,
  // Prerenderirane stranice (/uvjeti, /privatnost) kao uvjeti.html, ne uvjeti/index.html:
  // Cloudflare assets (html_handling „auto-trailing-slash”) bi inače /uvjeti 307 preusmjerio
  // na /uvjeti/, a linkovi i kanonski URL-ovi su bez kose crte.
  //
  // inlineStylesheets „always” (S8, odluka 705): CSS stranice je malen (oko 3 kB po
  // datoteci), pa ide u <style> umjesto <link>; nestaju dva round-tripa prije prvog
  // iscrtavanja (Lighthouse render-blocking-insight).
  build: { format: "file", inlineStylesheets: "always" },
  integrations: [react(), komponenteSamoUDevu],
  server: { port: 4321 },
  vite: {
    ...(VITE_CACHE && { cacheDir: VITE_CACHE }),
    server: {
      // Samo dev server; build i deploy ovo ignoriraju. Preglednik zove
      // relativni /api/..., a mockov lažni Checkout živi na /mock-checkout/...
      proxy: {
        "/api": API_DEV,
        "/mock-checkout": API_DEV,
      },
    },
  },
});
