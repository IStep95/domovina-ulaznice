// Dodatna polja kupnje (2026-11-26): pitanja iz organizatorova Google obrasca,
// ispod e-maila u KupnjaForma. Vrste: tekst, odlomak, izbor (radio), padajući,
// višestruki (kvačice), skala, datum, vrijeme. Odgovori idu u POST /api/narudzba,
// a Worker ih nakon izdavanja ulaznica pošalje u organizatorov obrazac.
import type { DodatnoPolje, OdgovoriDodatnihPolja } from "../lib/dodatna-polja.ts";
import { ODGOVOR_MAX } from "../lib/dodatna-polja.ts";
import Polje from "./Polje.tsx";
import polje from "./polje.module.css";
import css from "./dodatna-polja.module.css";

export default function DodatnaPolja({
  polja,
  odgovori,
  greske,
  prikaziGreske,
  onChange,
  onBlur,
  disabled,
}: {
  polja: readonly DodatnoPolje[];
  odgovori: OdgovoriDodatnihPolja;
  greske: Record<string, string>;
  /** Id-evi polja kojima se greška smije pokazati (dodirnuta, ili sva nakon pokušaja slanja). */
  prikaziGreske: (id: string) => boolean;
  onChange: (id: string, v: string | string[]) => void;
  onBlur: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <>
      {polja.map((p) => {
        const id = `dodatno-${p.id}`;
        const greska = prikaziGreske(p.id) ? greske[p.id] : undefined;
        const oznaka = p.obavezno ? `${p.naslov} *` : p.naslov;
        const tekst = typeof odgovori[p.id] === "string" ? (odgovori[p.id] as string) : "";

        if (p.vrsta === "tekst" || p.vrsta === "datum" || p.vrsta === "vrijeme") {
          return (
            <Polje
              key={p.id}
              id={id}
              oznaka={oznaka}
              type={p.vrsta === "datum" ? "date" : p.vrsta === "vrijeme" ? "time" : "text"}
              value={tekst}
              maxLength={p.vrsta === "tekst" ? ODGOVOR_MAX : undefined}
              pomoc={p.opis ?? undefined}
              greska={greska}
              required={p.obavezno}
              disabled={disabled}
              onChange={(e) => onChange(p.id, e.target.value)}
              onBlur={() => onBlur(p.id)}
            />
          );
        }

        const pomocId = p.opis ? `${id}-pomoc` : undefined;
        const greskaId = greska ? `${id}-greska` : undefined;
        const opisano = [greskaId, pomocId].filter(Boolean).join(" ") || undefined;
        const dodatak = (
          <>
            {greska && (
              <span id={greskaId} className={polje.greska}>
                {greska}
              </span>
            )}
            {p.opis && (
              <span id={pomocId} className={polje.pomoc}>
                {p.opis}
              </span>
            )}
          </>
        );

        if (p.vrsta === "odlomak" || p.vrsta === "padajuci") {
          return (
            <div key={p.id} className={polje.polje}>
              <label htmlFor={id} className={polje.oznaka}>
                {oznaka}
              </label>
              {p.vrsta === "odlomak" ? (
                <textarea
                  id={id}
                  className={`${polje.unos} ${css.odlomak}`}
                  value={tekst}
                  maxLength={ODGOVOR_MAX}
                  rows={3}
                  required={p.obavezno}
                  disabled={disabled}
                  aria-invalid={greska ? true : undefined}
                  aria-describedby={opisano}
                  onChange={(e) => onChange(p.id, e.target.value)}
                  onBlur={() => onBlur(p.id)}
                />
              ) : (
                <select
                  id={id}
                  className={polje.unos}
                  value={tekst}
                  required={p.obavezno}
                  disabled={disabled}
                  aria-invalid={greska ? true : undefined}
                  aria-describedby={opisano}
                  onChange={(e) => onChange(p.id, e.target.value)}
                  onBlur={() => onBlur(p.id)}
                >
                  <option value="">Odaberite…</option>
                  {p.opcije?.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
              {dodatak}
            </div>
          );
        }

        // izbor | skala (radio) i visestruki (kvačice)
        const visestruki = p.vrsta === "visestruki";
        const odabrano = visestruki ? (Array.isArray(odgovori[p.id]) ? (odgovori[p.id] as string[]) : []) : [tekst];
        return (
          <fieldset
            key={p.id}
            className={`${polje.polje} ${css.skupina}`}
            aria-invalid={greska ? true : undefined}
            aria-describedby={opisano}
            disabled={disabled}
          >
            <legend className={polje.oznaka}>{oznaka}</legend>
            <div className={p.vrsta === "skala" ? css.skala : css.opcije}>
              {p.vrsta === "skala" && p.krajevi?.[0] && <span className={css.kraj}>{p.krajevi[0]}</span>}
              {p.opcije?.map((o, i) => (
                <label key={o} className={css.opcija}>
                  <input
                    type={visestruki ? "checkbox" : "radio"}
                    name={id}
                    id={`${id}-${i}`}
                    value={o}
                    checked={odabrano.includes(o)}
                    onChange={(e) => {
                      if (!visestruki) return onChange(p.id, o);
                      const novo = e.target.checked ? [...odabrano, o] : odabrano.filter((x) => x !== o);
                      onChange(p.id, p.opcije!.filter((x) => novo.includes(x)));
                    }}
                    onBlur={() => onBlur(p.id)}
                  />
                  <span>{o}</span>
                </label>
              ))}
              {p.vrsta === "skala" && p.krajevi?.[1] && <span className={css.kraj}>{p.krajevi[1]}</span>}
            </div>
            {dodatak}
          </fieldset>
        );
      })}
    </>
  );
}
