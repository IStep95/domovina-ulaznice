# Dizajn za kupce — export iz Claude Designa

Napravljeno 2026-11-19 po [`../docs/design-brief.md`](../docs/design-brief.md), u stilu
[Luma Discover](https://luma.com/discover): svijetla neutralna podloga, bijele kartice s
tankim rubom, popis grupiran po datumu, datumske pločice, desni panel „Ulaznice”.
Canvas (živi izvornik): https://claude.ai/artifact/DVPp87nGuDb3esHXgNk2Vx — privatan,
Matija ga vidi tek kad se podijeli.

Ovo zatvara vrata dizajna prije S2. S2 iz ovoga gradi `web/src/styles/tokens.css`,
layout i komponente (odluka 9).

## Sadržaj

| Datoteka | Što je |
| --- | --- |
| `tokens.css` | svi tokeni kao CSS varijable; S2 ga kopira u `web/src/styles/` |
| `canvas/canvas.json` | raspored artboarda na canvasu |
| `canvas/*.dc.html` | jedan ekran po datoteci; markup s inline stilovima i `var(--…)` tokenima |

Datoteke `.dc.html` nisu kod za kopiranje: to su Claude Design komponente (`<x-dc>`,
`{{…}}`, `<sc-for>`). Iz njih se čitaju struktura, razmaci i stanja. Otvaraju se na
canvasu; lokalno u pregledniku ne rade bez Design runtimea.

## Ekrani

| Artboard | Širina | Ruta | Stanja na ekranu |
| --- | --- | --- | --- |
| `Main` | 1280 | — | boje, tipografija, razmaci, radijusi, fokus, gumbi (6), oznake, banneri, polja (4 stanja), stepper, svi tierovi, kartica događaja, datumska pločica, naglasna boja na 3 primjera, sažetak, red ulaznice |
| `Popis-1280`, `Popis-390` | 1280 / 390 | `/` | 3 događaja grupirana po datumu; kupovno i nekupovno; prazno; greška učitavanja; učitavanje |
| `Dogadjaj-1280`, `Dogadjaj-390` | 1280 / 390 | `/dogadjaj/:slug` | naslovna bez slike, termin, mjesto, cjenik (dostupno, „još 4”, rasprodano), Markdown opis, karta i Maps linkovi, kalendar, organizator; mobitel: `?otkazano=1` banner i ljepljiva traka „od 35,00 € · Kupi” |
| `Dogadjaj-bez-prodaje-390` | 390 | `/dogadjaj/:slug` | `kupovno: false` (izgled produkcije do prodaje, odluka 24); termin bez satnice; prazan cjenik |
| `Kupnja-1280` | 1280 | `/dogadjaj/:slug/kupnja` | **interaktivno**: izbor tiera, količina 1…max, polje imena po komadu, uvjeti, sažetak i gumb koji se otključa |
| `Kupnja-390` | 390 | isto | greška `holders_incomplete` (banner + inline), slanje u tijeku, 429 s odbrojavanjem, rasprodano u međuvremenu |
| `Narudzba-1280` | 1280 | `/ulaznice/:orderId` | `paid`: ulaznice, ponovna dostava s upozorenjem i ishodom „stari QR ne vrijede”, link u aplikaciju |
| `Narudzba-390` | 390 | isto | `pending` + `?placeno=1` (osvježavanje), nakon 20 s bez potvrde |
| `Narudzba-stanja-1280` | 1280 | isto | zaglavlja za `pending`, `pending+placeno`, `paid`, `expired`, `refunded`, `failed`; ostali ishodi ponovne dostave; 429 |
| `Pravno-1280` | 1280 | `/uvjeti`, `/privatnost` | duga tipografija, sadržaj, banner „Nacrt”, istaknuti placeholderi |
| `Greske-390`, `Nije-pronadeno-1280` | 390 / 1280 | 404, greške | nepostojeća putanja, `event_not_found`, `order_not_found`, 500 s „Pokušaj ponovno”, banneri grešaka forme |

Nedostaje (dovoljno za S2, ali vrijedi znati): mobilna verzija pravnih stranica (isti
stil u jednom stupcu, sadržaj iznad teksta) i tamni način (brief ga ne traži za v1).

## Pravila koja kod mora provesti

1. **Naglasna boja po događaju.** `brand.accent_color` postavlja `--color-accent` na
   stranicama događaja, kupnje i narudžbe. `--color-on-accent` = crna ili bijela, ona s
   većim WCAG kontrastom (`Dogadjaj-1280` ima formulu u `renderVals()`). Kao tekst na
   podlozi naglasna boja mora imati ≥ 4,5:1, inače se potamni (primjer: `#f6e05e` →
   `#6e5a00`). Platformski gumbi (popis, 404, narudžba) ostaju `--color-ink`.
2. **Bez naslovne slike** mjesto slike je ploha u naglasnoj boji s vrstom događaja i
   datumom; u popisu kvadratna datumska pločica (mjesec kraticom: STU, VELJ, TRA).
3. **Stanje nikad samo bojom**: svaka oznaka i banner ima tekst, a banneri i ikonu.
   Prigušeni red tiera mijenja pozadinu i boju teksta, ne `opacity`.
4. **Datumi** su u dizajnu kraći od današnjeg formatera (`pet, 16. 4. u 9:00`,
   `9:00 – nedjelja, 18. travnja`); S3 odlučuje hoće li formater pratiti dizajn.
5. **Dodir ≥ 44 px**, fokus `outline: 2px solid var(--color-focus); outline-offset: 2px`.
6. **Font Figtree** (Google Fonts, latin-ext za č ć đ š ž); zamjena `system-ui`.

## Odstupanja od briefa

- „Prodaja nije počela” prikazuje datum početka u oznaci (`prodaja od 1. 3. 2027. u 10:00`).
- Oznaka „glasi na ime” je u opisu tiera, ne zasebna oznaka, da red ne bude pretrpan.
- Ponovna dostava nakon 429 pokazuje odbrojavanje u gumbu (`Pošalji ponovno · 59:12`).
