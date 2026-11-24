// Živi pregled kartice događaja u wizardu (S8): React parnjak
// KarticaDogadjaja.astro + GrupaPoDatumu.astro + DatumskaPlocica.astro
// („boja”, 112 px), iste mjere i tokeni, da organizator vidi točno ono što će
// kupac vidjeti na popisu. Nije link (nema još stranice), pa nema hovera.
import { datumDijelovi, eur } from "../lib/format.ts";
import { ZONA, type PodaciPregleda } from "../lib/editor.ts";
import Ikona from "./Ikona.tsx";
import oznaka from "./oznaka.module.css";
import css from "./pregled-kartice.module.css";

export default function PregledKartice({ p }: { p: PodaciPregleda }) {
  const d = datumDijelovi(p.startsAt, ZONA);
  return (
    <div className={css.grupa}>
      <p className={css.datum}>
        <b>{p.zaglavlje.datum}</b>
        <span className={css.dan}>
          {p.zaglavlje.danUTjednu}
          {p.zaglavlje.godina && ` · ${p.zaglavlje.godina}`}
        </span>
      </p>
      <div className={css.kartica}>
        <div className={css.tekst}>
          <span className={css.termin}>{p.termin}</span>
          <span className={p.bezNaslova ? `${css.naslov} ${css.zamjena}` : css.naslov}>{p.naslov}</span>
          {p.organizator && <span className={css.organizator}>{p.organizator}</span>}
          {p.mjesto && (
            <span className={css.mjesto}>
              <Ikona ime="mjesto" velicina={16} />
              {p.mjesto}
            </span>
          )}
          <span className={css.oznake}>
            {p.cijenaOdCenti !== null ? (
              <span className={`${oznaka.oznaka} ${oznaka.ok}`}>od {eur(p.cijenaOdCenti)}</span>
            ) : (
              <span className={`${oznaka.oznaka} ${oznaka.neutral}`}>cijena još nije upisana</span>
            )}
            {p.vrsta && <span className={`${oznaka.oznaka} ${oznaka.obrub}`}>{p.vrsta}</span>}
          </span>
        </div>
        {p.slika ? (
          <img className={css.slika} src={p.slika} alt="" decoding="async" />
        ) : (
          <span className={css.plocica} aria-hidden="true">
            {d ? (
              <>
                <span className={css.plocicaMjesec}>{d.mjesecKratica}</span>
                <span className={css.plocicaDan}>{d.dan}</span>
                <span className={css.plocicaGodina}>{d.godina}.</span>
              </>
            ) : (
              <Ikona ime="ulaznica" velicina={28} />
            )}
          </span>
        )}
      </div>
    </div>
  );
}
