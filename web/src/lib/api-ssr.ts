// API klijent za SSR (frontmatter .astro stranica). Odvojen od ./api.ts jer
// uvozi `cloudflare:workers`, koji postoji samo u workerdu (astro dev, wrangler
// dev, deploy), a ne u node:testu.
//
// API_BASE_URL dolazi iz `vars` u wrangler.jsonc (produkcija / env.staging).
// U `astro dev` uvijek idemo na lokalni mock (odluka 7), da dev nikad ne zove
// pravi Worker; API_BASE_URL_DEV u web/.dev.vars (gitignoran) to nadjačava,
// npr. za lokalnu jezgru iz scripts/lokalno/pokreni.sh (S6).
//
// Binding API (service binding na glavni Worker) ima prednost pred javnim URL-om:
// kad glavni Worker stranicu proslijedi kroz WEB, fetch na njegov vlastiti javni
// URL ne stiže do njega (staging 2026-11-23: `ApiError: neispravan_odgovor`, `/` → 503).
// URL i dalje nosi API_BASE_URL kao host; glavni Worker usmjerava po putanji.
import { env } from "cloudflare:workers";
import { createApiClient, type ApiClient } from "./api.ts";

export const DEV_API_BASE_URL = "http://localhost:8797";

export function apiBaseUrl(): string {
  if (import.meta.env.DEV) return env.API_BASE_URL_DEV ?? DEV_API_BASE_URL;
  if (!env.API_BASE_URL) throw new Error("API_BASE_URL nije postavljen (web/wrangler.jsonc → vars)");
  return env.API_BASE_URL;
}

export function serverApi(): ApiClient {
  const api = import.meta.env.DEV ? undefined : env.API;
  if (api) return createApiClient({ baseUrl: apiBaseUrl(), fetch: (input, init) => api.fetch(input, init) });
  return createApiClient({ baseUrl: apiBaseUrl() });
}
