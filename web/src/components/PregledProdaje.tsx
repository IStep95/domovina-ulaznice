// Pregled prodaje za organizatora (S8): otok `client:only` na /organizator.
// Prenesen iz src/pages/Organizator.tsx (SPA, rezerva do S9). Novi događaj je
// zasebna stranica (/organizator/novi); uređivanje postojećeg još ne postoji.
//
// Namjerno uzak opseg: organizator mora moći vidjeti koliko je prodano i
// izvesti popis sudionika bez da nas zove. Uređivanje događaja, Stripe
// onboarding i DAC7 obrazac su U3 i traže puno više.
//
// Brojevi dolaze iz `organizer_overview` RPC-a, pozvanog S KORISNIKOVIM JWT-om
// — RLS odlučuje što ovaj korisnik smije vidjeti. Ovdje nema filtriranja po
// accountu u kodu, i to je namjerno: filter u klijentu je ukras, ne zaštita.
// „Zauzeto” (ne „prodano”) uključuje i rezervacije: v. zbrojDogadjaja.
import { useEffect, useState } from "react";
import {
  dohvatiPregled,
  jeIstekla,
  obrisiSkicu,
  posaljiNaOdobrenje,
  preuzmiHoldere,
  type OrgEvent,
  type OrgPregled,
} from "../lib/auth.ts";
import { cijena, eur } from "../lib/format.ts";
import { datumDogadjaja, imeCsvDatoteke, stanjeDogadjaja, zbrojDogadjaja } from "../lib/organizator.ts";
import { porukaIzGreske } from "../lib/poruke.ts";
import Banner from "./Banner.tsx";
import Odobrenja from "./Odobrenja.tsx";
import SaPrijavom, { type SesijaOtoka } from "./SaPrijavom.tsx";
import TrakaSesije from "./TrakaSesije.tsx";
import gumb from "./gumb.module.css";
import oznaka from "./oznaka.module.css";
import css from "./pregled-prodaje.module.css";

export default function PregledProdaje() {
  return <SaPrijavom naslov="Pregled prodaje">{(s) => <Pregled {...s} />}</SaPrijavom>;
}

function Pregled({ sesija, odjava, istekla }: SesijaOtoka) {
  const [pregled, postaviPregled] = useState<OrgPregled | null>(null);
  const [greska, postaviGresku] = useState<string | null>(null);
  // Povećava se nakon odobrenja: adminov vlastiti događaj u „Događaji” postaje objavljen.
  const [osvjezi, postaviOsvjezi] = useState(0);

  useEffect(() => {
    let vazi = true;
    dohvatiPregled(sesija.access_token)
      .then((p) => vazi && postaviPregled(p))
      .catch((e) => {
        if (!vazi) return;
        if (jeIstekla(e)) istekla();
        else postaviGresku(porukaIzGreske(e));
      });
    return () => {
      vazi = false;
    };
  }, [sesija.access_token, istekla, osvjezi]);

  return (
    <div className={css.pregled}>
      <TrakaSesije naslov="Pregled prodaje" email={sesija.email} odjava={odjava}>
        <a className={`${gumb.gumb} ${gumb.primarni}`} href="/organizator/novi">
          + Novi događaj
        </a>
      </TrakaSesije>

      {greska && <Banner ton="error">{greska}</Banner>}
      {!pregled && !greska && (
        <p className={css.mutno} role="status">
          Učitavanje…
        </p>
      )}

      {pregled?.platform_admin && (
        <Odobrenja token={sesija.access_token} istekla={istekla} odobren={() => postaviOsvjezi((n) => n + 1)} />
      )}

      {pregled && pregled.accounts.length > 0 && (
        <section className={css.odjeljak} aria-labelledby="pregled-organizatori">
          <h2 id="pregled-organizatori" className={css.podnaslov}>
            Organizatori
          </h2>
          {pregled.accounts.map((a) => (
            <div key={a.id} className={css.racun}>
              <strong>{a.name}</strong>
              <div className={css.oznake}>
                <span className={`${oznaka.oznaka} ${a.allowlisted ? oznaka.ok : oznaka.neutral}`}>
                  {a.allowlisted ? "samostalna objava dopuštena" : "događaji idu na odobrenje"}
                </span>
                <span className={`${oznaka.oznaka} ${a.has_record ? oznaka.ok : oznaka.wait}`}>
                  {a.has_record ? "podaci izdavatelja upisani" : "nedostaju podaci izdavatelja (DAC7)"}
                </span>
              </div>
            </div>
          ))}
        </section>
      )}

      {pregled && (
        <section className={css.odjeljak} aria-labelledby="pregled-dogadjaji">
          <h2 id="pregled-dogadjaji" className={css.podnaslov}>
            Događaji
          </h2>
          {pregled.events.length === 0 && <p className={css.mutno}>Nemate nijedan događaj.</p>}
          {pregled.events.map((d) => (
            <Dogadjaj
              key={d.campaign_id}
              d={d}
              token={sesija.access_token}
              istekla={istekla}
              obrisan={() =>
                postaviPregled((p) => p && { ...p, events: p.events.filter((x) => x.campaign_id !== d.campaign_id) })
              }
              promijenjen={(izmjena) =>
                postaviPregled(
                  (p) =>
                    p && {
                      ...p,
                      events: p.events.map((x) => (x.campaign_id === d.campaign_id ? { ...x, ...izmjena } : x)),
                    },
                )
              }
            />
          ))}
        </section>
      )}

      <p className={css.napomena}>
        Isplate i računi kartičnih uplata su na vašem Stripe računu — platforma ne drži vaš novac i ne naplaćuje
        naknadu na prodaju.
      </p>
    </div>
  );
}

function Dogadjaj({
  d,
  token,
  istekla,
  obrisan,
  promijenjen,
}: {
  d: OrgEvent;
  token: string;
  istekla: () => void;
  obrisan: () => void;
  promijenjen: (izmjena: Partial<OrgEvent>) => void;
}) {
  const [radi, postaviRadi] = useState(false);
  const [brise, postaviBrise] = useState(false);
  const [salje, postaviSalje] = useState(false);
  const skica = d.state === "draft";
  const poslana = skica && !!d.submitted_at;
  const vracena = skica && !d.submitted_at && !!d.review_note;
  const [greska, postaviGresku] = useState<string | null>(null);
  const { zauzeto, prihod, imenskih } = zbrojDogadjaja(d);
  // Besplatan događaj nema što prikupiti — iznos bi bio samo „0,00 €”.
  // Popis sudionika: imenske ulaznice, a od 26. 11. i e-mail kupca i odgovori na
  // dodatna polja — dakle za svaki događaj koji prodaje (ne za skicu).
  const izvoz = imenskih || !skica;
  const besplatan = d.tiers.length > 0 && d.tiers.every((t) => t.price_cents === 0);
  const stanje = stanjeDogadjaja(d);
  const meta = [datumDogadjaja(d), d.event?.venue_city].filter(Boolean).join(" · ");

  async function preuzmi() {
    postaviGresku(null);
    postaviRadi(true);
    try {
      const blob = await preuzmiHoldere(token, d.campaign_id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = imeCsvDatoteke(d);
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      if (jeIstekla(e)) istekla();
      else postaviGresku(porukaIzGreske(e));
    } finally {
      postaviRadi(false);
    }
  }

  async function obrisi() {
    if (!window.confirm(`Obrisati skicu „${d.title}”? Ovo se ne može vratiti.`)) return;
    postaviGresku(null);
    postaviBrise(true);
    try {
      await obrisiSkicu(token, d.campaign_id);
      obrisan();
    } catch (e) {
      if (jeIstekla(e)) istekla();
      else postaviGresku(porukaIzGreske(e));
      postaviBrise(false);
    }
  }

  async function posalji() {
    postaviGresku(null);
    postaviSalje(true);
    try {
      await posaljiNaOdobrenje(token, d.campaign_id);
      promijenjen({ submitted_at: new Date().toISOString() });
    } catch (e) {
      if (jeIstekla(e)) istekla();
      else postaviGresku(porukaIzGreske(e));
    } finally {
      postaviSalje(false);
    }
  }

  return (
    <article className={css.kartica} aria-labelledby={`dogadjaj-${d.campaign_id}`}>
      <div className={css.vrh}>
        <div className={css.naslovBlok}>
          <h3 id={`dogadjaj-${d.campaign_id}`} className={css.naslov}>
            {d.title}
          </h3>
          <div className={css.meta}>
            <span className={`${oznaka.oznaka} ${oznaka[stanje.ton]}`}>{stanje.tekst}</span>
            {meta && <span>{meta}</span>}
          </div>
        </div>
        <div className={css.zbroj}>
          {!besplatan && (
            <>
              <span className={css.mutno}>Prikupljeno</span>
              <strong className={css.iznos}>{eur(prihod)}</strong>
            </>
          )}
          <span className={css.mutno}>zauzeto: {zauzeto}</span>
        </div>
      </div>

      {d.tiers.length === 0 ? (
        <p className={css.mutno}>Cjenik još nije objavljen.</p>
      ) : (
        <ul className={css.tierovi}>
          {d.tiers.map((t) => (
            <li key={t.id} className={css.tier}>
              <span>{t.title}</span>
              <span className={css.brojke}>
                {t.inventory_claimed}
                {t.inventory_total !== null ? ` / ${t.inventory_total}` : ""} · {cijena(t.price_cents)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {vracena && (
        <Banner ton="wait">
          Vraćeno na doradu: {d.review_note} Kad doradiš skicu, pošalji je ponovno.
        </Banner>
      )}
      {poslana && (
        <p className={css.mutno}>
          Čeka odobrenje administratora; nakon odobrenja događaj postaje javan. Skicu i dalje možeš urediti.
        </p>
      )}

      {greska && <Banner ton="error">{greska}</Banner>}

      {(izvoz || skica) && (
        <div className={css.akcije}>
          {skica && !poslana && (
            <button
              type="button"
              className={`${gumb.gumb} ${gumb.primarni}`}
              disabled={salje}
              aria-busy={salje || undefined}
              onClick={posalji}
            >
              {salje ? "Šaljem…" : "Pošalji na odobrenje"}
            </button>
          )}
          {skica && (
            <>
              <a className={`${gumb.gumb} ${gumb.sekundarni}`} href={`/organizator/novi?uredi=${d.campaign_id}`}>
                Uredi skicu
              </a>
              <button
                type="button"
                className={`${gumb.gumb} ${gumb.sekundarni}`}
                disabled={brise}
                aria-busy={brise || undefined}
                onClick={obrisi}
              >
                {brise ? "Brišem…" : "Obriši skicu"}
              </button>
            </>
          )}
          {izvoz && (
            <button
              type="button"
              className={`${gumb.gumb} ${gumb.sekundarni}`}
              disabled={radi}
              aria-busy={radi || undefined}
              onClick={preuzmi}
            >
              {radi ? "Pripremam…" : "Preuzmi popis sudionika (CSV)"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
