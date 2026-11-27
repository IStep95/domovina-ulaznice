// Postavke organizatora (2026-11-27): /organizator/postavke. Za sada samo
// plaćanja — Stripe Connect po računu organizatora (worker/connect.ts).
//
// „Poveži Stripe” → Worker stvori connected account i Account Link → Stripeov
// hostani onboarding → povratak ovamo s `?stripe=povratak&racun=…`. Istekli
// link Stripe šalje na `?stripe=obnovi&racun=…`: tada odmah tražimo novi link
// (token je u sessionStorageu, pa to ne može Worker sam preusmjeriti).
// `acct_…` ovaj otok nikad ne vidi, samo booleane.
import { useEffect, useRef, useState } from "react";
import { dohvatiPostavke, jeIstekla, poveziStripe, type RacunPostavki } from "../lib/auth.ts";
import { porukaIzGreske } from "../lib/poruke.ts";
import Banner from "./Banner.tsx";
import Ikona from "./Ikona.tsx";
import SaPrijavom, { type SesijaOtoka } from "./SaPrijavom.tsx";
import TrakaSesije from "./TrakaSesije.tsx";
import gumb from "./gumb.module.css";
import oznaka from "./oznaka.module.css";
import css from "./pregled-prodaje.module.css";

export default function Postavke() {
  return <SaPrijavom naslov="Postavke">{(s) => <Sadrzaj {...s} />}</SaPrijavom>;
}

/** `?stripe=povratak|obnovi&racun=<uuid>` s povratka sa Stripea; čita se jednom. */
function povratakSaStripea(): { sto: "povratak" | "obnovi"; racun: string } | null {
  const q = new URLSearchParams(location.search);
  const sto = q.get("stripe");
  const racun = q.get("racun") ?? "";
  if ((sto !== "povratak" && sto !== "obnovi") || !racun) return null;
  history.replaceState(null, "", location.pathname);
  return { sto, racun };
}

/** Oznaka stanja Stripea za karticu računa. */
export function stanjeStripea(s: RacunPostavki["stripe"]): { tekst: string; ton: "ok" | "wait" | "neutral" } {
  if (!s.povezan) return { tekst: "Stripe nije povezan", ton: "wait" };
  if (!s.naplata) return { tekst: "povezivanje nije dovršeno", ton: "wait" };
  return { tekst: s.isplate ? "prima uplate i isplate" : "prima uplate", ton: "ok" };
}

function Sadrzaj({ sesija, odjava, istekla }: SesijaOtoka) {
  const [podaci, postaviPodatke] = useState<{ stripe_dostupan: boolean; racuni: RacunPostavki[] } | null>(null);
  const [greska, postaviGresku] = useState<string | null>(null);
  const [radi, postaviRadi] = useState<string | null>(null);
  const povratak = useRef(typeof location !== "undefined" ? povratakSaStripea() : null);

  async function povezi(accountId: string) {
    postaviGresku(null);
    postaviRadi(accountId);
    try {
      const { url } = await poveziStripe(sesija.access_token, accountId);
      location.assign(url);
    } catch (e) {
      if (jeIstekla(e)) istekla();
      else postaviGresku(porukaIzGreske(e));
      postaviRadi(null);
    }
  }

  useEffect(() => {
    let vazi = true;
    // Istekli onboarding link: odmah novi, bez dodatnog klika.
    if (povratak.current?.sto === "obnovi") {
      void povezi(povratak.current.racun);
      return;
    }
    dohvatiPostavke(sesija.access_token)
      .then((p) => vazi && postaviPodatke(p))
      .catch((e) => {
        if (!vazi) return;
        if (jeIstekla(e)) istekla();
        else postaviGresku(porukaIzGreske(e));
      });
    return () => {
      vazi = false;
    };
    // povezi je stabilan za ovu sesiju; namjerno samo token
  }, [sesija.access_token, istekla]);

  const vraceni = povratak.current?.sto === "povratak" ? podaci?.racuni.find((r) => r.id === povratak.current!.racun) : undefined;

  return (
    <div className={css.pregled}>
      <TrakaSesije naslov="Postavke" email={sesija.email} odjava={odjava}>
        <a className={css.natrag} href="/organizator">
          <Ikona ime="natrag" velicina={16} />
          Pregled prodaje
        </a>
      </TrakaSesije>

      {greska && <Banner ton="error">{greska}</Banner>}
      {vraceni &&
        (vraceni.stripe.naplata ? (
          <Banner ton="ok">Stripe je povezan: „{vraceni.name}” sada prima uplate za plaćene ulaznice.</Banner>
        ) : (
          <Banner ton="wait">
            Stripe još nije dovršio provjeru računa „{vraceni.name}”. Ako si ispunio sve podatke, stanje se osvježi
            samo za koju minutu; inače nastavi postavljanje.
          </Banner>
        ))}

      <section className={css.odjeljak} aria-labelledby="postavke-placanja">
        <h2 id="postavke-placanja" className={css.podnaslov}>
          Plaćanja (Stripe)
        </h2>
        <p className={css.mutno}>
          Uplate kupaca idu izravno na Stripe račun organizatora; platforma ne drži novac i ne uzima proviziju.
          Stripe je potreban samo za plaćene ulaznice — besplatni događaji rade i bez njega.
        </p>

        {!podaci && !greska && (
          <p className={css.mutno} role="status">
            {radi ? "Otvaram Stripe…" : "Učitavanje…"}
          </p>
        )}
        {podaci && !podaci.stripe_dostupan && (
          <Banner ton="neutral">Stripe na ovom okruženju još nije postavljen, pa se račun ne može povezati.</Banner>
        )}
        {podaci && podaci.racuni.length === 0 && (
          <p className={css.mutno}>Nisi administrator nijednog organizatora.</p>
        )}

        {podaci?.racuni.map((r) => {
          const stanje = stanjeStripea(r.stripe);
          return (
            <article key={r.id} className={css.kartica} aria-labelledby={`racun-${r.id}`}>
              <div className={css.naslovBlok}>
                <h3 id={`racun-${r.id}`} className={css.naslov}>
                  {r.name}
                </h3>
                <div className={css.meta}>
                  <span className={`${oznaka.oznaka} ${oznaka[stanje.ton]}`}>{stanje.tekst}</span>
                </div>
              </div>
              <div className={css.akcije}>
                {r.stripe.naplata ? (
                  <a
                    className={`${gumb.gumb} ${gumb.sekundarni}`}
                    href="https://dashboard.stripe.com/"
                    target="_blank"
                    rel="noopener"
                  >
                    Otvori Stripe
                  </a>
                ) : (
                  <button
                    type="button"
                    className={`${gumb.gumb} ${gumb.primarni}`}
                    disabled={!podaci.stripe_dostupan || radi !== null}
                    aria-busy={radi === r.id || undefined}
                    onClick={() => povezi(r.id)}
                  >
                    {radi === r.id ? "Otvaram Stripe…" : r.stripe.povezan ? "Nastavi povezivanje" : "Poveži Stripe"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
