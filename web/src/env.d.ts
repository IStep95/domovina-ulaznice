// Worker env (web/wrangler.jsonc). Namjerno ručno umjesto `wrangler types`:
// web/ nema tajni (odluka 4); jedini binding je API, service binding natrag na glavni Worker.
declare module "cloudflare:workers" {
  export const env: {
    /** Origin postojećeg Workera, npr. https://ulaznice-staging.domovina.ai */
    readonly API_BASE_URL: string;
    /** Samo `astro dev`, iz web/.dev.vars; zadano http://localhost:8797 (mock). */
    readonly API_BASE_URL_DEV?: string;
    /** Service binding na glavni Worker (staging/produkcija); bez njega SSR ide javnim URL-om. */
    readonly API?: { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
  };
}
