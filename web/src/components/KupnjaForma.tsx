// Forma kupnje (S4; Kupnja-1280, Kupnja-390): React otok na /dogadjaj/:slug/kupnja.
// Logika je prenesena iz src/pages/Kupnja.tsx; pravila validacije su u
// src/lib/kupnja.ts, a poruke grešaka u src/lib/poruke.ts (oba bez Reacta).
//
// Tok: izbor tiera → količina 1…min(10, preostalo) → ime po komadu za imenske →
// e-mail → uvjeti → POST /api/narudzba → location.assign(checkout_url).
// Gumb je zaključan dok forma nije valjana, dok zahtjev traje (i ref, ne samo
// stanje, da dvoklik ne pošalje dvije narudžbe) i dok traje čekanje nakon 429.
import { useEffect, useMemo, useRef, useState, type SubmitEvent } from "react";
import { ApiError, createApiClient, type TierView } from "../lib/api.ts";
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
}

export default function KupnjaForma({ campaignId, slug, tiers: pocetniTierovi, zona, uvjetiOrganizatora }: KupnjaFormaProps) {
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
  const [salje, postaviSalje] = useState(false);
  const [greska, postaviGresku] = useState<GreskaNarudzbe | null>(null);
  const [cekanje, postaviCekanje] = useState({ sekundi: 0, kljuc: 0 });
  const slanje = useRef(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  const tier = tiers.find((t) => t.id === tierId) ?? null;
  const max = najvecaKolicina(tier);
  const kolicina = ogranicenaKolicina(kolicinaUnos, max);
  const imena = prilagodiImena(imenaUnos, kolicina);
  const provjera = provjeriFormu({ tier, kolicina, imena, email, uvjeti });
  const imaKupivih = tiers.some((t) => t.buyable && najvecaKolicina(t) >= 1);
  const konacno = greska?.konacno ?? false;
  const ceka = cekanje.sekundi > 0;
  // Greška s poslužitelja za imena/e-mail: pokaži inline greške i bez dodira.
  const prisilnoImena = greska?.cilj === "imena";
  const prisilnoEmail = greska?.cilj === "email";

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
    const cilj =
      prvoImenom >= 0
        ? document.getElementById(`ime-${prvoImenom}`)
        : greska.cilj === "email" && provjera.email
          ? document.getElementById("kupac-email")
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
    if (slanje.current || !tier || !provjera.valjano || ceka || konacno) return;
    slanje.current = true;
    postaviSalje(true);
    postaviGresku(null);
    try {
      const odgovor = await api.kreirajNarudzbu(tijeloNarudzbe(campaignId, { tier, kolicina, imena, email, uvjeti }));
      const url = adresaPlacanja(odgovor.checkout_url);
      if (!url) throw new ApiError("neispravan_odgovor", 200);
      // Stripe Checkout na računu organizatora. Gumb ostaje zaključan do odlaska.
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

  const stavke = tier ? [{ opis: `${tier.title} × ${kolicina}`, iznosCenti: iznosCenti(tier, kolicina) }] : [];
  const nedostaje = !provjera.valjano && !salje && !ceka && !konacno && provjera.nedostaje.length > 0;
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
          tekst="Nastavi na plaćanje"
          tekstSlanja="Otvaram plaćanje…"
          salje={salje}
          sekundi={cekanje.sekundi}
          kljuc={cekanje.kljuc}
          disabled={!provjera.valjano || konacno}
          opisano={nedostaje ? "kupnja-nedostaje" : undefined}
          onIstek={() => {
            postaviCekanje({ sekundi: 0, kljuc: 0 });
            if (greska?.ton === "wait") postaviGresku(null);
          }}
        />
        {nedostaje && (
          <span id="kupnja-nedostaje" className={css.nedostaje}>
            Za nastavak: {provjera.nedostaje.join(", ")}.
          </span>
        )}
        <span className={css.sitno}>Plaćanje karticom obrađuje Stripe za organizatora. Mjesta su rezervirana 20 minuta.</span>
        <span className={css.izravno}>
          <Ikona ime="lokot" velicina={16} />
          Kupujete izravno od organizatora.
        </span>
      </aside>
    </form>
  );
}
