// Forma kupnje (S4; Kupnja-1280, Kupnja-390): React otok na /dogadjaj/:slug/kupnja.
// Logika je prenesena iz src/pages/Kupnja.tsx (bivši SPA, obrisan u S7); pravila validacije su u
// src/lib/kupnja.ts, a poruke grešaka u src/lib/poruke.ts (oba bez Reacta).
//
// Tok: izbor tiera → količina 1…min(10, preostalo) → ime po komadu za imenske →
// e-mail → uvjeti → POST /api/narudzba → location.assign(checkout_url).
// Gumb je zaključan dok forma nije valjana, dok zahtjev traje (i ref, ne samo
// stanje, da dvoklik ne pošalje dvije narudžbe) i dok traje čekanje nakon 429.
import { useEffect, useMemo, useRef, useState, type SubmitEvent } from "react";
import { ApiError, createApiClient, type DodatnoPolje, type TierView } from "../lib/api.ts";
import { ocisceniOdgovori, provjeriDodatnaPolja, type OdgovoriDodatnihPolja } from "../lib/dodatna-polja.ts";
import {
  EMAIL_MAX,
  IME_MAX,
  adresaPlacanja,
  iznosCenti,
  najvecaKolicina,
  ogranicenaKolicina,
  opcijeTiera,
  opisKolicine,
  pocetniTier,
  prilagodiImena,
  provjeriFormu,
  tijeloNarudzbe,
} from "../lib/kupnja.ts";
import { KOD_NEDOVOLJNO, greskaNarudzbe, kodIzGreske, type GreskaNarudzbe } from "../lib/poruke.ts";
import Banner from "./Banner.tsx";
import DodatnaPolja from "./DodatnaPolja.tsx";
import Ikona from "./Ikona.tsx";
import IzborTiera from "./IzborTiera.tsx";
import OdbrojavanjeGumb from "./OdbrojavanjeGumb.tsx";
import Polje from "./Polje.tsx";
import PotvrdniOkvir from "./PotvrdniOkvir.tsx";
import SazetakNarudzbe from "./SazetakNarudzbe.tsx";
import Stepper from "./Stepper.tsx";
import css from "./kupnja-forma.module.css";

export interface KupnjaFormaProps {
  campaignId: string;
  slug: string;
  tiers: TierView[];
  /** Zona događaja, za „prodaja od …” u izboru tiera. */
  zona: string;
  /** `brand.terms_url` (već prošao sigurniUrl); bez njega samo uvjeti korištenja. */
  uvjetiOrganizatora: string | null;
  /** Pitanja iz organizatorova Google obrasca (prazno = nema ih). */
  dodatnaPolja?: DodatnoPolje[];
}

export default function KupnjaForma({
  campaignId,
  slug,
  tiers: pocetniTierovi,
  zona,
  uvjetiOrganizatora,
  dodatnaPolja = [],
}: KupnjaFormaProps) {
  const api = useMemo(() => createApiClient(), []);
  const [tiers, postaviTierove] = useState(pocetniTierovi);
  const [tierId, postaviTierId] = useState<string | null>(() => pocetniTier(pocetniTierovi));
  const [kolicinaUnos, postaviKolicinu] = useState(1);
  // Duži niz od količine čuva imena kad kupac smanji pa poveća broj.
  const [imenaUnos, postaviImena] = useState<string[]>([]);
  const [email, postaviEmail] = useState("");
  const [uvjeti, postaviUvjete] = useState(false);
  const [dodirnutEmail, postaviDodirnutEmail] = useState(false);
  const [dodirnutaImena, postaviDodirnutaImena] = useState<boolean[]>([]);
  const [odgovori, postaviOdgovore] = useState<OdgovoriDodatnihPolja>({});
  const [dodirnutaDodatna, postaviDodirnutaDodatna] = useState<Record<string, boolean>>({});
  const [salje, postaviSalje] = useState(false);
  // Klik na sivi gumb: pokaži greške svih obaveznih polja, i nedodirnutih.
  const [pokusaj, postaviPokusaj] = useState(false);
  // Prije hidracije gumb ostaje pravi `disabled` (inače bi klik poslao formu bez JS-a).
  const [hidrirano, postaviHidrirano] = useState(false);
  const [greska, postaviGresku] = useState<GreskaNarudzbe | null>(null);
  const [cekanje, postaviCekanje] = useState({ sekundi: 0, kljuc: 0 });
  const slanje = useRef(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  const tier = tiers.find((t) => t.id === tierId) ?? null;
  const max = najvecaKolicina(tier);
  const kolicina = ogranicenaKolicina(kolicinaUnos, max);
  const imena = prilagodiImena(imenaUnos, kolicina);
  const provjeraForme = provjeriFormu({ tier, kolicina, imena, email, uvjeti });
  const dodatna = provjeriDodatnaPolja(dodatnaPolja, odgovori);
  const provjera = dodatna.valjano
    ? provjeraForme
    : {
        ...provjeraForme,
        valjano: false,
        // ispred „prihvatite uvjete”, redom kojim su polja na stranici
        nedostaje: [
          ...provjeraForme.nedostaje.filter((n) => n !== "prihvatite uvjete"),
          "popunite obavezna dodatna polja",
          ...provjeraForme.nedostaje.filter((n) => n === "prihvatite uvjete"),
        ],
      };
  const imaKupivih = tiers.some((t) => t.buyable && najvecaKolicina(t) >= 1);
  const konacno = greska?.konacno ?? false;
  const ceka = cekanje.sekundi > 0;
  // Greška s poslužitelja za imena/e-mail: pokaži inline greške i bez dodira.
  const prisilnoImena = pokusaj || greska?.cilj === "imena";
  const prisilnoEmail = pokusaj || greska?.cilj === "email";
  const prisilnoDodatna = pokusaj || greska?.cilj === "dodatna";

  useEffect(() => postaviHidrirano(true), []);

  // Povratak iz Stripea gumbom „natrag” može vratiti stranicu iz bfcachea sa
  // zaključanim gumbom („Otvaram plaćanje…”); otključaj je.
  useEffect(() => {
    const kodPrikaza = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      slanje.current = false;
      postaviSalje(false);
    };
    window.addEventListener("pageshow", kodPrikaza);
    return () => window.removeEventListener("pageshow", kodPrikaza);
  }, []);

  // Nakon greške: fokus na prvo neispravno polje, inače banner u vidno polje.
  useEffect(() => {
    if (!greska) return;
    const prvoImenom = greska.cilj === "imena" ? provjera.imena.findIndex(Boolean) : -1;
    const prvoDodatno = greska.cilj === "dodatna" ? dodatnaPolja.find((p) => dodatna.greske[p.id]) : undefined;
    const cilj =
      prvoImenom >= 0
        ? document.getElementById(`ime-${prvoImenom}`)
        : greska.cilj === "email" && provjera.email
          ? document.getElementById("kupac-email")
          : prvoDodatno
            ? document.getElementById(`dodatno-${prvoDodatno.id}`) ?? document.getElementById(`dodatno-${prvoDodatno.id}-0`)
            : null;
    if (cilj) cilj.focus();
    else bannerRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // Samo kad stigne nova greška, ne pri svakom tipkanju (zato samo [greska]).
  }, [greska]);

  function promijeniTier(id: string) {
    postaviTierId(id);
    if (greska && !greska.konacno && !ceka) postaviGresku(null);
  }

  function promijeniIme(i: number, vrijednost: string) {
    postaviImena((prije) => {
      const novo = prilagodiImena(prije, Math.max(prije.length, kolicina));
      novo[i] = vrijednost;
      return novo;
    });
  }

  function dodirniIme(i: number) {
    postaviDodirnutaImena((prije) => {
      const novo = [...prije];
      novo[i] = true;
      return novo;
    });
  }

  /** Redom kojim su na stranici: imena, e-mail, dodatna polja, uvjeti. */
  function fokusirajPrvoNeispravno() {
    const prvoImenom = provjera.imena.findIndex(Boolean);
    const prvoDodatno = dodatnaPolja.find((p) => dodatna.greske[p.id]);
    const cilj =
      prvoImenom >= 0
        ? document.getElementById(`ime-${prvoImenom}`)
        : provjera.email
          ? document.getElementById("kupac-email")
          : prvoDodatno
            ? document.getElementById(`dodatno-${prvoDodatno.id}`) ?? document.getElementById(`dodatno-${prvoDodatno.id}-0`)
            : !uvjeti
              ? document.getElementById("uvjeti")
              : null;
    cilj?.focus();
  }

  /** Ponovno učitaj tierove nakon što je narudžba odbijena zbog raspoloživosti. */
  async function osvjeziTierove(): Promise<TierView[] | null> {
    try {
      const ev = await api.dohvatiDogadjaj(slug);
      postaviTierove(ev.tiers);
      return ev.tiers;
    } catch {
      return null;
    }
  }

  async function posalji(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (slanje.current || ceka || konacno) return;
    if (!tier || !provjera.valjano) {
      postaviPokusaj(true);
      fokusirajPrvoNeispravno();
      return;
    }
    slanje.current = true;
    postaviSalje(true);
    postaviGresku(null);
    try {
      const tijelo = tijeloNarudzbe(campaignId, { tier, kolicina, imena, email, uvjeti });
      if (dodatnaPolja.length) tijelo.dodatna_polja = ocisceniOdgovori(dodatnaPolja, odgovori);
      const odgovor = await api.kreirajNarudzbu(tijelo);
      const url = adresaPlacanja(odgovor.checkout_url);
      if (!url) throw new ApiError("neispravan_odgovor", 200);
      // Stripe Checkout na računu organizatora (besplatna: ravno na narudžbu). Gumb ostaje zaključan do odlaska.
      window.location.assign(url);
    } catch (err) {
      const { kod, retryAfter } = kodIzGreske(err);
      let g = greskaNarudzbe(kod, retryAfter);
      if (g.osvjezi) {
        const svjezi = await osvjeziTierove();
        const isti = svjezi?.find((t) => t.id === tier.id);
        if (svjezi && (!isti || !isti.buyable || najvecaKolicina(isti) < 1)) {
          // Odabrani tier više nije kupiv: kupac bira ponovno (ne biramo umjesto njega).
          postaviTierId(null);
        } else if (kod === "tier_sold_out" && isti) {
          // Tier je i dalje kupiv: traženo je više nego što je ostalo.
          g = greskaNarudzbe(KOD_NEDOVOLJNO);
        }
      }
      if (g.cekajSekundi > 0) postaviCekanje({ sekundi: g.cekajSekundi, kljuc: Date.now() });
      postaviGresku(g);
      slanje.current = false;
      postaviSalje(false);
    }
  }

  // Besplatna vrsta (2026-11-25): bez Stripea, ulaznice odmah na e-mail.
  const besplatna = tier?.price_cents === 0;
  const stavke = tier ? [{ opis: `${tier.title} × ${kolicina}`, iznosCenti: iznosCenti(tier, kolicina) }] : [];
  const nedostaje = !provjera.valjano && !salje && !ceka && !konacno && provjera.nedostaje.length > 0;
  // „Popunjeno x/y” (tek nakon klika na sivi gumb): sve što traži gumb — imena, e-mail, obavezna dodatna polja, uvjeti.
  const obaveznaDodatna = dodatnaPolja.filter((p) => p.obavezno);
  const ukupnoObaveznih = provjera.imena.length + 1 + obaveznaDodatna.length + 1;
  const popunjenihObaveznih =
    provjera.imena.filter((g) => !g).length +
    (provjera.email ? 0 : 1) +
    obaveznaDodatna.filter((p) => !dodatna.greske[p.id]).length +
    (uvjeti ? 1 : 0);
  // „Popunjeno z/w opcionalnih polja”: neobavezna dodatna polja s odgovorom (prazno se ne broji).
  const opcionalnaDodatna = dodatnaPolja.filter((p) => !p.obavezno);
  const popunjenihOpcionalnih = opcionalnaDodatna.filter((p) => {
    const v = odgovori[p.id];
    return Array.isArray(v) ? v.length > 0 : typeof v === "string" && v.trim() !== "";
  }).length;
  const natrag = `/dogadjaj/${encodeURIComponent(slug)}`;

  return (
    <form className={css.raspored} onSubmit={posalji} noValidate>
      <div className={css.glavni}>
        {greska && (
          <div ref={bannerRef}>
            <Banner
              ton={greska.ton}
              uloga="alert"
              akcija={
                greska.konacno ? (
                  <a className={css.linkBannera} href={natrag}>
                    Natrag na događaj
                  </a>
                ) : undefined
              }
            >
              <b>{greska.poruka}</b>
              {greska.dopuna && <> {greska.dopuna}</>}
            </Banner>
          </div>
        )}
        {!imaKupivih && !konacno && (
          <Banner ton="neutral">Ulaznice za ovaj događaj trenutačno nisu dostupne.</Banner>
        )}

        <div className={css.kartica}>
          <IzborTiera
            opcije={opcijeTiera(tiers, zona)}
            odabrani={tierId ?? ""}
            onChange={promijeniTier}
          />

          {tier && max >= 1 && (
            <div className={css.odjeljak}>
              <Stepper
                max={max}
                vrijednost={kolicina}
                opis={opisKolicine(max)}
                onChange={postaviKolicinu}
                disabled={salje}
              />
            </div>
          )}

          {tier?.imenska && max >= 1 && (
            <div className={css.odjeljak}>
              <div className={css.naslovSkupine}>
                <span className={css.naslov}>Imena posjetitelja</span>
                <span className={css.pomoc}>Ulaznica glasi na ime; na ulazu se može tražiti osobna iskaznica.</span>
              </div>
              {imena.map((ime, i) => (
                <Polje
                  key={i}
                  id={`ime-${i}`}
                  oznaka={`${i + 1}. ulaznica — ime i prezime`}
                  value={ime}
                  placeholder="Ime i prezime"
                  autoComplete={i === 0 ? "name" : "off"}
                  maxLength={IME_MAX}
                  greska={(dodirnutaImena[i] || prisilnoImena) && provjera.imena[i] ? provjera.imena[i]! : undefined}
                  onChange={(e) => promijeniIme(i, e.target.value)}
                  onBlur={() => dodirniIme(i)}
                  disabled={salje}
                />
              ))}
            </div>
          )}

          <div className={css.odjeljak}>
            <Polje
              id="kupac-email"
              oznaka="Vaša e-mail adresa"
              vecaOznaka
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="ime@primjer.hr"
              value={email}
              maxLength={EMAIL_MAX}
              pomoc="Ulaznice s QR kodom šaljemo na ovu adresu."
              greska={(dodirnutEmail || prisilnoEmail) && provjera.email ? provjera.email : undefined}
              onChange={(e) => postaviEmail(e.target.value)}
              onBlur={() => postaviDodirnutEmail(email.trim() !== "")}
              disabled={salje}
            />
          </div>

          {dodatnaPolja.length > 0 && (
            <div className={css.odjeljak}>
              <div className={css.naslovSkupine}>
                <span className={css.naslov}>Dodatna polja</span>
                <span className={css.pomoc}>Podaci koje organizator traži uz prijavu. Polja sa * su obavezna.</span>
              </div>
              <DodatnaPolja
                polja={dodatnaPolja}
                odgovori={odgovori}
                greske={dodatna.greske}
                prikaziGreske={(id) => !!dodirnutaDodatna[id] || prisilnoDodatna}
                onChange={(id, v) => postaviOdgovore((o) => ({ ...o, [id]: v }))}
                onBlur={(id) => postaviDodirnutaDodatna((d) => (d[id] ? d : { ...d, [id]: true }))}
                disabled={salje}
              />
            </div>
          )}

          <PotvrdniOkvir id="uvjeti" checked={uvjeti} onChange={(e) => postaviUvjete(e.target.checked)}>
            Prihvaćam{" "}
            <a href="/uvjeti" target="_blank" rel="noopener">
              uvjete korištenja
            </a>
            {uvjetiOrganizatora ? (
              <>
                {" "}i{" "}
                <a href={uvjetiOrganizatora} target="_blank" rel="noopener">
                  uvjete organizatora
                </a>
              </>
            ) : null}
            .
          </PotvrdniOkvir>
        </div>
      </div>

      <aside className={css.sazetak} aria-label="Sažetak narudžbe">
        <b className={css.naslov}>Sažetak</b>
        <SazetakNarudzbe stavke={stavke} />
        <OdbrojavanjeGumb
          type="submit"
          varijanta="naglasni"
          velik
          blok
          tekst={besplatna ? "Uzmi ulaznice" : "Nastavi na plaćanje"}
          tekstSlanja={besplatna ? "Izdajem ulaznice…" : "Otvaram plaćanje…"}
          salje={salje}
          sekundi={cekanje.sekundi}
          kljuc={cekanje.kljuc}
          disabled={konacno || (!hidrirano && !provjera.valjano)}
          izgledaOnemoguceno={!provjera.valjano}
          opisano={nedostaje ? "kupnja-nedostaje" : undefined}
          onIstek={() => {
            postaviCekanje({ sekundi: 0, kljuc: 0 });
            if (greska?.ton === "wait") postaviGresku(null);
          }}
        />
        {pokusaj && tier && max >= 1 && !konacno && (
          <span className={css.popunjeno} aria-live="polite">
            Popunjeno {popunjenihObaveznih}/{ukupnoObaveznih} obveznih polja
            {opcionalnaDodatna.length > 0 && (
              <>
                <br />
                Popunjeno {popunjenihOpcionalnih}/{opcionalnaDodatna.length} opcionalnih polja
              </>
            )}
          </span>
        )}
        {nedostaje && (
          <span id="kupnja-nedostaje" className={css.nedostaje}>
            Za nastavak: {provjera.nedostaje.join(", ")}.
          </span>
        )}
        <span className={css.sitno}>
          {besplatna
            ? "Ulaznice su besplatne i stižu odmah na e-mail."
            : "Plaćanje karticom obrađuje Stripe za organizatora. Mjesta su rezervirana 20 minuta."}
        </span>
        <span className={css.izravno}>
          <Ikona ime="lokot" velicina={16} />
          Kupujete izravno od organizatora.
        </span>
      </aside>
    </form>
  );
}
