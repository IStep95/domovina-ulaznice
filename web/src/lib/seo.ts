// JSON-LD schema.org/Event za stranicu događaja (S3). Google traži `startDate`,
// pa bez `starts_at` JSON-LD-a nema. Cijene su EUR (ugovor nema valutu tiera;
// OrderView.currency je uvijek „eur”).
import type { EventView, TierView } from "../../../shared/api-tipovi.ts";
import { cijenaDecimalno, stanjeTiera } from "./format.ts";
import { koordinate } from "./karta.ts";

const SCHEMA = "https://schema.org/";

/** Stanje tiera → schema.org ItemAvailability. */
export function dostupnost(t: Pick<TierView, "sold_out" | "not_started" | "ended" | "available">): string {
  switch (stanjeTiera(t)) {
    case "rasprodano":
      return `${SCHEMA}SoldOut`;
    case "nije-pocelo":
      return `${SCHEMA}PreSale`;
    case "zavrseno":
      return `${SCHEMA}Discontinued`;
    case "malo":
      return `${SCHEMA}LimitedAvailability`;
    default:
      return `${SCHEMA}InStock`;
  }
}

export interface UlazJsonLd {
  dogadjaj: EventView;
  /** Apsolutni kanonski URL stranice događaja. */
  url: string;
  /** Apsolutni URL stranice kupnje (offers.url). */
  urlKupnje: string;
  opis?: string | null;
  slika?: string | null;
  organizatorWeb?: string | null;
}

export function eventJsonLd({ dogadjaj, url, urlKupnje, opis, slika, organizatorWeb }: UlazJsonLd): Record<string, unknown> | null {
  const d = dogadjaj.event;
  if (!d?.starts_at) return null;
  const k = koordinate(d);
  return {
    "@context": "https://schema.org",
    "@type": "Event",
    name: dogadjaj.title,
    url,
    startDate: d.starts_at,
    ...(d.ends_at ? { endDate: d.ends_at } : {}),
    eventStatus: `${SCHEMA}EventScheduled`,
    eventAttendanceMode: `${SCHEMA}OfflineEventAttendanceMode`,
    ...(opis ? { description: opis } : {}),
    ...(slika ? { image: [slika] } : {}),
    location: {
      "@type": "Place",
      name: d.venue_name,
      address: {
        "@type": "PostalAddress",
        ...(d.venue_address ? { streetAddress: d.venue_address } : {}),
        addressLocality: d.venue_city,
        addressCountry: "HR",
      },
      ...(k ? { geo: { "@type": "GeoCoordinates", latitude: k.lat, longitude: k.lon } } : {}),
    },
    organizer: {
      "@type": "Organization",
      name: d.organizer_name,
      ...(organizatorWeb ? { url: organizatorWeb } : {}),
    },
    ...(dogadjaj.tiers.length
      ? {
          offers: dogadjaj.tiers.map((t) => ({
            "@type": "Offer",
            name: t.title,
            price: cijenaDecimalno(t.price_cents),
            priceCurrency: "EUR",
            availability: dostupnost(t),
            url: urlKupnje,
            ...(t.sale_start ? { validFrom: t.sale_start } : {}),
          })),
        }
      : {}),
  };
}

/** JSON za <script type="application/ld+json">: `<` escapean da opis ne zatvori skriptu. */
export function jsonLdSkripta(podaci: unknown): string {
  return JSON.stringify(podaci).replace(/</g, "\\u003c");
}
