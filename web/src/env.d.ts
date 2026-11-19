// Worker env (web/wrangler.jsonc). Namjerno ručno umjesto `wrangler types`:
// web/ nema bindinga ni tajni (odluka 4), samo varijable.
declare module "cloudflare:workers" {
  export const env: {
    /** Origin postojećeg Workera, npr. https://ulaznice-staging.domovina.ai */
    readonly API_BASE_URL: string;
    /** Samo `astro dev`, iz web/.dev.vars; zadano http://localhost:8797 (mock). */
    readonly API_BASE_URL_DEV?: string;
  };
}
