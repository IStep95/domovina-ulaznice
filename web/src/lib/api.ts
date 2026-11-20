// Klijent prema javnom /api/* postojećeg Workera (odluka 5): web/ nikad ne
// razgovara s domovina-api izravno i nema vlastitih tajni (odluka 4).
//
// Na serveru (SSR) treba apsolutni URL: createApiClient({ baseUrl }) zove
// fetch(new URL(path, baseUrl)); baseUrl daje src/lib/api-ssr.ts iz Worker env-a.
// U pregledniku createApiClient() bez baseUrl zove relativni /api/... (ista domena
// kroz service binding, odluka 8; u devu Vite proxy na mock).
//
// Ovaj modul nema ovisnosti o Astru ni o `cloudflare:workers`, pa se testira
// s node:test bez mreže (fetch se ubacuje kroz opcije).

import type {
  CreateOrderRequest,
  CreateOrderResponse,
  EventDetails,
  EventListResponse,
  EventView,
  OrderView,
  ResendResponse,
  TicketView,
  TierView,
} from "../../../shared/api-tipovi.ts";

export type {
  CreateOrderRequest,
  CreateOrderResponse,
  EventDetails,
  EventListResponse,
  EventView,
  OrderView,
  ResendResponse,
  TicketView,
  TierView,
};

/**
 * Isti oblik kao ApiError u src/lib/api.ts: `code` je strojni kod s backenda.
 * `retryAfter` (sekunde) nosi `retry_after` iz tijela uz 429 `previse_pokusaja`.
 */
export class ApiError extends Error {
  code: string;
  status: number;
  retryAfter?: number;
  constructor(code: string, status: number, retryAfter?: number) {
    super(code);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    if (retryAfter !== undefined) this.retryAfter = retryAfter;
  }
}

/**
 * Pretvori sirovi HTTP odgovor u podatke ili ApiError — ista pravila kao `req`
 * u src/lib/api.ts:
 * - tijelo koje nije JSON → `neispravan_odgovor` (i kad je status 2xx);
 * - status izvan 2xx → `body.error`, a bez njega `http_<status>`;
 * - prazno tijelo je `{}`.
 */
export function parseApiResponse<T>(status: number, text: string): T {
  let body: unknown = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("neispravan_odgovor", status);
  }
  if (status < 200 || status > 299) throw apiErrorFromBody(status, body);
  return body as T;
}

/**
 * ApiError iz statusa i već parsiranog tijela (`{error: "tier_sold_out"}` + 409 → code
 * tier_sold_out). `retry_after` se prenosi samo kao konačan nenegativan broj.
 */
export function apiErrorFromBody(status: number, body: unknown): ApiError {
  const obj = body !== null && typeof body === "object" ? (body as { error?: unknown; retry_after?: unknown }) : {};
  const error = typeof obj.error === "string" ? obj.error : undefined;
  const ra = obj.retry_after;
  const retryAfter = typeof ra === "number" && Number.isFinite(ra) && ra >= 0 ? ra : undefined;
  return new ApiError(error ?? `http_${status}`, status, retryAfter);
}

/** Puni URL za SSR, relativni za preglednik. */
export function apiUrl(path: string, baseUrl?: string): string {
  return baseUrl ? new URL(path, baseUrl).toString() : path;
}

export interface ApiClientOptions {
  /** Apsolutni origin Workera (SSR). Bez njega se zovu relativne putanje (preglednik). */
  baseUrl?: string;
  /** Za testove; zadano globalni fetch. */
  fetch?: typeof fetch;
}

export function createApiClient(options: ApiClientOptions = {}) {
  const { baseUrl } = options;
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));

  async function req<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await doFetch(apiUrl(path, baseUrl), {
      ...init,
      headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    });
    return parseApiResponse<T>(res.status, await res.text());
  }

  return {
    dohvatiDogadjaj: (slug: string) => req<EventView>(`/api/dogadjaj/${encodeURIComponent(slug)}`),
    dohvatiDogadjaje: () => req<EventListResponse>("/api/dogadjaji"),
    dohvatiNarudzbu: (orderId: string) => req<OrderView>(`/api/ulaznice/${encodeURIComponent(orderId)}`),
    posaljiPonovno: (orderId: string) =>
      req<ResendResponse>(`/api/ulaznice/${encodeURIComponent(orderId)}/ponovna-dostava`, { method: "POST" }),
    kreirajNarudzbu: (p: CreateOrderRequest) =>
      req<CreateOrderResponse>("/api/narudzba", { method: "POST", body: JSON.stringify(p) }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
