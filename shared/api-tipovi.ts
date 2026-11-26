// Ugovor javnog /api/* Workera (worker/api.ts) — samo tipovi, bez runtime koda.
// Uvoze ga SPA (src/lib/api.ts) i Astro frontend (web/src/lib/api.ts);
// web/docs/decisions.md, odluka 10. Mobilne aplikacije imaju svoje modele
// (mobile/), pa promjena ovdje = promjena ugovora (odluka 6).

export interface TierView {
  id: string;
  title: string;
  description: string | null;
  price_cents: number;
  imenska: boolean;
  sale_start: string | null;
  sale_end: string | null;
  sold_out: boolean;
  not_started: boolean;
  ended: boolean;
  available: number | null;
  buyable: boolean;
}

export interface EventDetails {
  event_type: string;
  venue_name: string;
  venue_address: string | null;
  venue_city: string;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string;
  description_hr: string | null;
  description_en: string | null;
  cover_image_url: string | null;
  /** Alt tekst naslovne slike, ≤ 300 znakova (S2b, odluka 15). */
  cover_image_alt?: string | null;
  /** Dodatne slike redom prikaza, ≤ 20 (migracija `events_gallery`). Opcionalno dok je jezgra nema. */
  gallery?: GallerySlika[];
  /** WGS84; oba ili nijedno (S2b, odluka 14). Opcionalno dok jezgra nema migraciju. */
  venue_lat?: number | null;
  venue_lon?: number | null;
  /** physical | online (jezgra `events_free_online`, 2026-11-25). Bez polja = physical. */
  attendance_mode?: "physical" | "online";
  organizer_name: string;
  organizer_email: string | null;
  organizer_web: string | null;
}

export interface GallerySlika {
  url: string;
  alt?: string | null;
}

export interface EventView {
  campaign_id: string;
  slug: string;
  title: string;
  event: EventDetails | null;
  tiers: TierView[];
  stripe_connected: boolean;
  kupovno: boolean;
  /** Sve vrste su 0 € (besplatan događaj); izvodi Worker. */
  besplatno?: boolean;
  brand?: { accent_color?: string; logo_url?: string; hero_url?: string; intro_html?: string; terms_url?: string } | null;
}

export interface TicketView {
  serial: string;
  holder_name: string | null;
  state: string;
  checked_in_at: string | null;
}

export interface OrderView {
  order_id: string;
  state: "pending" | "paid" | "expired" | "refunded" | "failed";
  quantity: number;
  amount_cents: number;
  currency: string;
  expires_at: string | null;
  paid_at: string | null;
  buyer_email: string | null;
  event: ({ title: string; slug: string } & Partial<EventDetails>) | null;
  tickets: TicketView[];
  dostava: { status: string; at: string } | null;
  /** Link online događaja; samo uz plaćenu ili besplatno potvrđenu narudžbu. */
  online_url?: string | null;
}

/** GET /api/dogadjaji */
export interface EventListResponse {
  events: EventView[];
}

/** POST /api/narudzba — tijelo zahtjeva. */
export interface CreateOrderRequest {
  campaign_id: string;
  tier_id: string;
  quantity: number;
  buyer_email: string;
  holders: Array<{ full_name: string; email?: string }>;
  /** Odgovori na dodatna polja (ključ = `DodatnoPolje.id`); samo kad ih događaj ima. */
  dodatna_polja?: OdgovoriDodatnihPolja;
}

/**
 * Dodatno polje kupnje (2026-11-26): pitanje iz organizatorova javnog Google
 * obrasca. Worker ga pročita iz obrasca; odgovore šalje u taj obrazac nakon
 * izdavanja ulaznica, pa podaci kupca završe kod organizatora (Google Sheets),
 * ne u ticketing jezgri.
 */
export interface DodatnoPolje {
  /** `entry.<id>` u Google obrascu. */
  id: string;
  naslov: string;
  opis: string | null;
  vrsta: "tekst" | "odlomak" | "izbor" | "padajuci" | "visestruki" | "skala" | "datum" | "vrijeme";
  obavezno: boolean;
  /** izbor | padajuci | visestruki | skala */
  opcije?: string[];
  /** skala: opisi krajeva („Nimalo” … „Jako”) */
  krajevi?: [string | null, string | null];
}

/** Tekst za tekst/odlomak/izbor/padajuci/skala, YYYY-MM-DD za datum, HH:MM za vrijeme, niz za visestruki. */
export type OdgovoriDodatnihPolja = Record<string, string | string[]>;

/** GET /api/dogadjaj/:slug/dodatna-polja */
export interface DodatnaPoljaResponse {
  polja: DodatnoPolje[];
}

/** POST /api/narudzba — odgovor; kupca se šalje na `checkout_url`. */
export interface CreateOrderResponse {
  order_id: string;
  checkout_url: string;
  amount_cents: number;
  /** Besplatna: `checkout_url` vodi ravno na /ulaznice/:id (bez Stripea). */
  besplatno?: boolean;
}

/** POST /api/ulaznice/:id/ponovna-dostava */
export interface ResendResponse {
  status: "poslano" | "neuspjelo" | "nema_vazecih_ulaznica";
  recipient: string | null;
  /** true = izdani su NOVI QR kodovi, stari više ne vrijede */
  stari_qr_ponisten?: boolean;
  error?: string;
}
