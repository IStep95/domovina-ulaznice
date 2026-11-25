// Red za odobrenje (2026-11-25): na /organizator, samo za admina platforme
// (`platform_admin` iz organizer_overview). Skice koje su organizatori poslali;
// „Odobri” ih objavi (active + public, vidljive u feedu), „Vrati na doradu”
// ih vrati organizatoru s napomenom. Ovlasti provjerava jezgra, ne ovaj otok.
import { useEffect, useState } from "react";
import { dohvatiOdobrenja, jeIstekla, odobriDogadjaj, vratiDogadjaj, type SkicaNaOdobrenju } from "../lib/auth.ts";
import { cijena } from "../lib/format.ts";
import { datumDogadjaja } from "../lib/organizator.ts";
import { porukaIzGreske } from "../lib/poruke.ts";
import Banner from "./Banner.tsx";
import Polje from "./Polje.tsx";
import gumb from "./gumb.module.css";
import oznaka from "./oznaka.module.css";
import css from "./pregled-prodaje.module.css";

export default function Odobrenja({
  token,
  istekla,
  odobren,
}: {
  token: string;
  istekla: () => void;
  /** Nakon odobrenja: pregled se osvježi (događaj je možda i u „Događaji”). */
  odobren: () => void;
}) {
  const [skice, postaviSkice] = useState<SkicaNaOdobrenju[] | null>(null);
  const [greska, postaviGresku] = useState<string | null>(null);

  useEffect(() => {
    let vazi = true;
    dohvatiOdobrenja(token)
      .then((r) => vazi && postaviSkice(r.events))
      .catch((e) => {
        if (!vazi) return;
        if (jeIstekla(e)) istekla();
        else postaviGresku(porukaIzGreske(e));
      });
    return () => {
      vazi = false;
    };
  }, [token, istekla]);

  const makni = (id: string) => postaviSkice((s) => s && s.filter((x) => x.campaign_id !== id));

  return (
    <section className={css.odjeljak} aria-labelledby="pregled-odobrenja">
      <h2 id="pregled-odobrenja" className={css.podnaslov}>
        Na odobrenju{skice && skice.length > 0 ? ` (${skice.length})` : ""}
      </h2>
      {greska && <Banner ton="error">{greska}</Banner>}
      {!skice && !greska && (
        <p className={css.mutno} role="status">
          Učitavanje…
        </p>
      )}
      {skice && skice.length === 0 && <p className={css.mutno}>Nijedan događaj ne čeka odobrenje.</p>}
      {skice?.map((s) => (
        <Skica
          key={s.campaign_id}
          s={s}
          token={token}
          istekla={istekla}
          gotovo={(odobreno) => {
            makni(s.campaign_id);
            if (odobreno) odobren();
          }}
        />
      ))}
    </section>
  );
}

function Skica({
  s,
  token,
  istekla,
  gotovo,
}: {
  s: SkicaNaOdobrenju;
  token: string;
  istekla: () => void;
  gotovo: (odobreno: boolean) => void;
}) {
  const [radi, postaviRadi] = useState<"odobri" | "vrati" | null>(null);
  const [vracanje, postaviVracanje] = useState(false);
  const [napomena, postaviNapomenu] = useState("");
  const [greska, postaviGresku] = useState<string | null>(null);
  const meta = [
    s.account_name,
    datumDogadjaja({ event: s.event }),
    s.event?.attendance_mode === "online" ? "online" : [s.event?.venue_name, s.event?.venue_city].filter(Boolean).join(", "),
  ]
    .filter(Boolean)
    .join(" · ");
  const opis = (s.event?.description_hr ?? "").trim();

  async function izvrsi(sto: "odobri" | "vrati") {
    postaviGresku(null);
    postaviRadi(sto);
    try {
      if (sto === "odobri") await odobriDogadjaj(token, s.campaign_id);
      else await vratiDogadjaj(token, s.campaign_id, napomena.trim());
      gotovo(sto === "odobri");
    } catch (e) {
      if (jeIstekla(e)) istekla();
      else postaviGresku(porukaIzGreske(e));
      postaviRadi(null);
    }
  }

  return (
    <article className={css.kartica} aria-labelledby={`odobrenje-${s.campaign_id}`}>
      <div className={css.naslovBlok}>
        <h3 id={`odobrenje-${s.campaign_id}`} className={css.naslov}>
          {s.title}
        </h3>
        <div className={css.meta}>
          <span className={`${oznaka.oznaka} ${oznaka.neutral}`}>čeka odobrenje</span>
          {meta && <span>{meta}</span>}
        </div>
      </div>

      {opis && <p className={css.opis}>{opis.length > 400 ? `${opis.slice(0, 400)}…` : opis}</p>}

      {s.tiers.length > 0 && (
        <ul className={css.tierovi}>
          {s.tiers.map((t) => (
            <li key={t.id} className={css.tier}>
              <span>{t.title}</span>
              <span className={css.brojke}>
                {t.inventory_total !== null ? `${t.inventory_total} kom · ` : ""}
                {cijena(t.price_cents)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!s.rail_ready && (
        <Banner ton="wait">
          Organizator još nema aktivan Stripe račun, pa se događaj s plaćenim ulaznicama ne može objaviti.
        </Banner>
      )}
      {greska && <Banner ton="error">{greska}</Banner>}

      {vracanje && (
        <Polje
          id={`napomena-${s.campaign_id}`}
          oznaka="Napomena organizatoru"
          pomoc="Što treba doraditi. Organizator je vidi uz skicu."
          value={napomena}
          maxLength={1000}
          onChange={(e) => postaviNapomenu(e.target.value)}
        />
      )}

      <div className={css.akcije}>
        {vracanje ? (
          <>
            <button
              type="button"
              className={`${gumb.gumb} ${gumb.primarni}`}
              disabled={radi !== null}
              aria-busy={radi === "vrati" || undefined}
              onClick={() => izvrsi("vrati")}
            >
              {radi === "vrati" ? "Vraćam…" : "Vrati na doradu"}
            </button>
            <button
              type="button"
              className={`${gumb.gumb} ${gumb.sekundarni}`}
              disabled={radi !== null}
              onClick={() => postaviVracanje(false)}
            >
              Odustani
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${gumb.gumb} ${gumb.primarni}`}
              disabled={radi !== null || !s.rail_ready}
              aria-busy={radi === "odobri" || undefined}
              onClick={() => izvrsi("odobri")}
            >
              {radi === "odobri" ? "Odobravam…" : "Odobri i objavi"}
            </button>
            <button
              type="button"
              className={`${gumb.gumb} ${gumb.sekundarni}`}
              disabled={radi !== null}
              onClick={() => postaviVracanje(true)}
            >
              Vrati na doradu…
            </button>
          </>
        )}
      </div>
    </article>
  );
}
