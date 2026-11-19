# Odluke — web/

Svaka odluka ima broj, datum, razlog i uvjet revizije. Odluka se ne briše: kad se
promijeni, nova odluka je zamjenjuje i navodi koju. Blokovi brojeva po sesiji: S1 od 100,
S2 od 200 … S7 od 700.

## S0 (2026-11-19)

**1. Opseg: samo stranice za kupce.** U `web/` idu `/`, `/dogadjaj/:slug`,
`/dogadjaj/:slug/kupnja`, `/ulaznice/:orderId`, `/uvjeti`, `/privatnost` i 404.
Organizator, skener i prijava ostaju u React SPA-u u `src/`.
Razlog: kupačke stranice dobivaju SSR i pregled linka; organizatorske ne dobivaju ništa.
Revizija: kad se radi editor događaja ili kad SPA postane teret.

**2. Astro s `@astrojs/cloudflare`, `output: "server"`.** Popis, događaj i narudžba se
iscrtavaju na zahtjev; `/uvjeti` i `/privatnost` imaju `export const prerender = true`.
Razlog: podaci o raspoloživosti se mijenjaju, pravni tekst ne.
Revizija: ako S1 izmjeri da SSR na Workersu ne radi ili je prespor.

**3. Interaktivni dijelovi su React otoci (`@astrojs/react`).** Forma za kupnju i
stranica narudžbe prenose se iz `src/pages/*.tsx`.
Razlog: logika već postoji u Reactu i testirana je u stvarnoj kupnji.
Revizija: nema.

**4. `web/` nema D1, KV ni tajne.** `wrangler.jsonc` u `web/` ima samo `API_BASE_URL`.
Razlog: pravilo 1 u korijenskom `CLAUDE.md`; operativni podaci već su u D1 postojećeg
Workera, treća baza samo bi se razilazila.
Revizija: samo uz novu odluku koja kaže što bi baza držala i zašto to ne može Worker.

**5. `web/` zove samo `/api/*` postojećeg Workera, nikad `api.domovina.ai`.**
Razlog: pravila 3 i 4 (HMAC, Stripe, service ključ u jednom Workeru) i isti ugovor kao
mobilne aplikacije.
Revizija: nema.

**6. Ugovor `/api/*` se u ovom lancu ne mijenja.** Potreba za promjenom = zaseban commit
na `worker/` s testom, `mobile/mock-api.mjs` u istom commitu, i odluka u bloku sesije.
Revizija: nema.

**7. Razvoj protiv `mobile/mock-api.mjs`.** Pokreće se s
`PUBLIC_BASE_URL=http://localhost:4321 node mobile/mock-api.mjs`, pa njegov lažni
„Plati” vraća na Astro. Cijela kupnja s jezgrom i lažnim Stripeom ide tek u S6 kroz
`scripts/lokalno/pokreni.sh`.
Razlog: Ivanu ne trebaju tajne ni pristup jezgri za izradu UI-ja.
Revizija: nema.

**8. Ista domena kroz service binding.** Postojeći Worker ostaje ulaz za
`ulaznice-staging.domovina.ai` i kupačke putanje prosljeđuje Astro Workeru kroz binding
`WEB`. `/api/*`, `/webhook/*`, `/.well-known/*`, `/organizator`, `/skener` ostaju
njegovi. Astro do API-ja dolazi preko `API_BASE_URL` (S6 odlučuje treba li i obrnuti
binding).
Razlog: bez CORS-a, prijava organizatora i povratak sa Stripea ostaju na istoj domeni,
a `NAJAVA` i webhook ne mijenjaju mjesto.
Revizija: S6, ako lokalno mjerenje pokaže problem.

**9. Dizajn dolazi iz Claude Designa.** Export ide u `web/design/`, boje i razmaci u
`web/src/styles/tokens.css` kao CSS varijable. `brand.accent_color` iz API-ja nadjačava
naglasnu boju po događaju.
Razlog: dizajn se radi odvojeno od koda i ponovno uvozi kad se mijenja.
Revizija: nema.

**10. Tipovi API-ja su zajednički u `shared/api-tipovi.ts`.** I `src/lib/api.ts` i `web/`
ih uvoze.
Razlog: jedan ugovor, jedan izvor tipova.
Revizija: ako mobilne aplikacije zatraže generirani ugovor (OpenAPI).

**11. Testovi u `web/` su `node:test`, bez mreže.** Isto kao korijenski `npm test`.
`npm --prefix web run check` = `astro check` + testovi + `astro build`.
Revizija: ako Astro komponente trebaju test koji `node:test` ne može (onda Vitest, uz odluku).

**12. Rad u forku `IStep95/domovina-ulaznice`, PR po sesiji.** Matija merga i deploya.
Sljedeća sesija kreće s mergeanog `upstream/main`.
Revizija: kad Ivan dobije pravo pisanja u upstream.

**13. Jezik.** UI, dokumentacija i commit poruke na hrvatskom; kod engleski. Commit:
`feat(web): …`, `fix(web): …`, `docs(web): …`.
