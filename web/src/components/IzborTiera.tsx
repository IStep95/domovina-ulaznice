// Izbor vrste ulaznice u kupnji (Kupnja-1280). Nativni radio gumbi u <fieldset>:
// strelice, Tab i čitači zaslona rade bez dodatnog koda. Nedostupna vrsta je
// disabled i nosi razlog u napomeni (pravilo 3: ne samo boja).
import { useState } from "react";
import { eurPrivremeno } from "../lib/prikaz.ts";
import css from "./izbor-tiera.module.css";

export interface OpcijaTiera {
  id: string;
  naziv: string;
  /** Npr. „Uz predočenje indeksa · još 4” ili „Rasprodano”. */
  napomena?: string;
  cijenaCenti: number;
  dostupno: boolean;
}

export interface IzborTieraProps {
  opcije: OpcijaTiera[];
  name?: string;
  legenda?: string;
  odabrani?: string;
  pocetni?: string;
  onChange?: (id: string) => void;
}

export default function IzborTiera({
  opcije,
  name = "tier_id",
  legenda = "Vrsta ulaznice",
  odabrani,
  pocetni,
  onChange,
}: IzborTieraProps) {
  const [vlastiti, postavi] = useState(pocetni ?? opcije.find((o) => o.dostupno)?.id);
  const trenutni = odabrani ?? vlastiti;
  return (
    <fieldset className={css.skupina}>
      <legend className={css.legenda}>{legenda}</legend>
      {opcije.map((o) => (
        <label key={o.id} className={css.opcija}>
          <span className={css.lijevo}>
            <input
              className={css.radio}
              type="radio"
              name={name}
              value={o.id}
              checked={trenutni === o.id}
              disabled={!o.dostupno}
              onChange={() => {
                if (odabrani === undefined) postavi(o.id);
                onChange?.(o.id);
              }}
            />
            <span className={css.tekst}>
              <span className={css.naziv}>{o.naziv}</span>
              {o.napomena && <span className={css.napomena}>{o.napomena}</span>}
            </span>
          </span>
          {/* PRIVREMENO: formater novca je S3. */}
          <span className={css.cijena}>{eurPrivremeno(o.cijenaCenti)}</span>
        </label>
      ))}
    </fieldset>
  );
}
