# Upload slika i galerija u editoru događaja (2026-11-24)

Ivanov zahtjev: u `/organizator/novi` naslovna slika **upload ili URL**, i **galerija**
(upload ili URL). Paket izvan lanca `web/`; odluke 819–822 u `web/docs/decisions.md`,
`ui-feedback.md` stavka 8, `deploy-dug.md` #15.

## Tok

```mermaid
sequenceDiagram
  participant B as Preglednik (korak 3)
  participant W as Glavni Worker
  participant S as Storage (pinka-covers)
  participant F as events-organizer
  participant DB as pinka_finance.events
  B->>B: smanji na 1600 px, WebP (lib/slika.ts)
  B->>W: POST /api/organizator/slika (JWT, tijelo = slika)
  W->>S: POST /storage/v1/object/pinka-covers/{uid}/{uuid}.webp (isti JWT)
  S-->>W: RLS: vlastita mapa + provjeren identitet
  W-->>B: { url: …/object/public/pinka-covers/… }
  B->>W: POST /api/organizator/dogadjaj (+ cover_image_alt, gallery)
  W->>F: action: create (JWT)
  F->>F: provjera oblika galerije PRIJE RPC-a
  F->>DB: create_event (RPC, INVOKER)
  F->>DB: update events set cover_image_alt, gallery (RLS events_write)
```

## Što je gdje

| Dio | Mjesto |
| --- | --- |
| Smanjivanje u pregledniku | `web/src/lib/slika.ts` (+ `web/test/slika.test.ts`) |
| Upload ruta | `worker/index.ts` `POST /api/organizator/slika`, `worker/api.ts` `ucitajSliku` |
| Polja forme, validacija, payload | `web/src/lib/editor.ts` (`slikaAlt`, `galerija`), `web/src/lib/nacrt.ts` |
| UI | `web/src/components/NoviDogadjaj.tsx` `Korak3`, `GumbZaDatoteke` |
| Jezgra | `domovina-api` grana `events-media`: `events-organizer` + migracija `20261120170000_events_gallery` |

## Kodovi grešaka

Worker: `nema_prava_slike` (403, RLS Storagea: nema provjeren identitet), `slika_vrsta`
(415), `slika_prevelika` (413), `slika_nije_spremljena` (502), `invalid_gallery` (400,
prije mreže). Jezgra: `invalid_cover_alt`, `invalid_gallery`, `invalid_gallery_url`. Svi
vode na korak 3.

## Lokalna provjera

Stack kao u `docs/2026-08-04-…` §9, ali shim funkcija s granom jezgre:
`FN_ROOT=../domovina-api-media/supabase/functions` (worktree grane `events-media`).

- Upload s provjerenim računom → 200, objekt u `storage.objects`; bez provjerenog
  identiteta → 403 `nema_prava_slike`; nevaljan JWT → 401.
- 6016 px JPEG od 10 MB kroz `DOM.setFileInputFiles` → WebP od 203 kB.
- `events-organizer` create s galerijom i altom upiše oba; update zamjenjuje galeriju;
  update bez tih ključeva ih ne dira; `http://` i 21 slika → 400.

**Zamka:** lokalno Storage vraća `http://127.0.0.1:55390/…`, a korak 3 i jezgra traže
`https://`, pa se lokalno učitana slika ne može spremiti u skicu. Na stagingu je URL
`https://api.domovina.ai/…`.

## Otvoreno

- Matija: merge `events-media`, migracija prije `events-feed` i `events-organizer`.
  Bez nove funkcije skica se sprema, ali bez galerije i alta.
- Provjeriti da `pinka-covers` postoji na produkcijskoj jezgri.
- Učitane slike koje organizator ukloni ostaju u bucketu (nema brisanja ni čišćenja).
- Stavka 9: filtar osobnih računa (`is_personal`) u izboru organizatora čeka Ivana.
