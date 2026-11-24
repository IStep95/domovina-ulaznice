// Vrh stranica organizatora (S8): naslov stranice lijevo, prijavljeni e-mail i
// „Odjava” desno. Dijele ga pregled prodaje, skener i editor događaja.
import type { ReactNode } from "react";
import gumb from "./gumb.module.css";
import css from "./traka-sesije.module.css";

export interface TrakaSesijeProps {
  naslov: string;
  email: string;
  odjava: () => void;
  /** Akcija ispod naslova (npr. „+ Novi događaj”). */
  children?: ReactNode;
}

export default function TrakaSesije({ naslov, email, odjava, children }: TrakaSesijeProps) {
  return (
    <header className={css.traka}>
      <div className={css.lijevo}>
        <h1 className={css.naslov}>{naslov}</h1>
        {children}
      </div>
      <div className={css.desno}>
        <span className={css.email} title={email}>
          {email}
        </span>
        <button type="button" className={`${gumb.gumb} ${gumb.sekundarni}`} onClick={odjava}>
          Odjava
        </button>
      </div>
    </header>
  );
}
