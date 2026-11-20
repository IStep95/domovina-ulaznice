// /dogadjaj/:slug.ics: datoteka za Apple Calendar, Outlook i ostale (odluka 20).
// Statični sufiks `.ics` ima prednost pred `[slug].astro`, pa ova ruta ne
// zasjenjuje stranicu događaja. Bez `starts_at` → 404 (gumba ionako nema).
import type { APIRoute } from "astro";
import { ApiError } from "../../lib/api.ts";
import { serverApi } from "../../lib/api-ssr.ts";
import { ZADANA_ZONA } from "../../lib/format.ts";
import { ics } from "../../lib/kalendar.ts";
import { punoMjesto } from "../../lib/karta.ts";
import { opisTekst } from "../../lib/opis.ts";
import { CACHE_GRESKA, CACHE_ICS } from "../../lib/stranica.ts";

export const GET: APIRoute = async ({ params, url }) => {
  const slug = params.slug ?? "";
  try {
    const dogadjaj = await serverApi().dohvatiDogadjaj(slug);
    const d = dogadjaj.event;
    const datoteka = ics({
      uid: `${dogadjaj.campaign_id}@ulaznice.domovina.ai`,
      naslov: dogadjaj.title,
      startsAt: d?.starts_at,
      endsAt: d?.ends_at,
      timeZone: d?.timezone || ZADANA_ZONA,
      mjesto: punoMjesto(d),
      opis: opisTekst(d?.description_hr, 500),
      url: new URL(`/dogadjaj/${encodeURIComponent(dogadjaj.slug)}`, url.origin).toString(),
    });
    if (!datoteka) return new Response("Termin još nije objavljen.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    return new Response(datoteka, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="${dogadjaj.slug.replace(/[^a-z0-9-]/gi, "")}.ics"`,
        "cache-control": CACHE_ICS,
      },
    });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      return new Response("Događaj nije pronađen.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
    console.error("ics", slug, e);
    return new Response("Greška, pokušajte ponovno.\n", { status: 503, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": CACHE_GRESKA } });
  }
};
