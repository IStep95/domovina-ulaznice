// Omot otoka organizatora (S8): bez sesije prikazuje Prijavu, sa sesijom
// sadržaj. Dijele ga pregled prodaje, skener i editor događaja, pa je sesija
// na jednom mjestu: čitanje (sessionStorage ili Googleov fragment), odjava i
// istek usred rada (API vrati `nije_prijavljen` → natrag na prijavu s porukom).
//
// Otoci su `client:only="react"`: SSR ne zna za sesiju (token je samo u
// pregledniku, odluka 4), pa nema ni hidracijske razlike između servera i klijenta.
import { useCallback, useState, type ReactNode } from "react";
import { odjavi, procitajSesiju, type Sesija } from "../lib/auth.ts";
import { PORUKE_ORGANIZATORA } from "../lib/poruke.ts";
import Prijava from "./Prijava.tsx";

export interface SesijaOtoka {
  sesija: Sesija;
  /** Gumb „Odjava”: briše sesiju i vraća prijavu. */
  odjava: () => void;
  /** API je rekao da sesija više ne vrijedi: prijava s porukom o isteku. */
  istekla: () => void;
}

export interface SaPrijavomProps {
  /** Nadnaslov obrasca prijave („Pregled prodaje”, „Skener ulaza”…). */
  naslov: string;
  children: (s: SesijaOtoka) => ReactNode;
}

export default function SaPrijavom({ naslov, children }: SaPrijavomProps) {
  // Inicijalizator, ne efekt: fragment iz Googlea treba pročitati (i obrisati)
  // prije prvog crtanja, da se obrazac prijave ne pokaže ni na trenutak.
  const [sesija, postaviSesiju] = useState<Sesija | null>(() => procitajSesiju());
  const [razlog, postaviRazlog] = useState<string | null>(null);

  const odjava = useCallback(() => {
    odjavi();
    postaviRazlog(null);
    postaviSesiju(null);
  }, []);
  const istekla = useCallback(() => {
    odjavi();
    postaviRazlog(PORUKE_ORGANIZATORA.nije_prijavljen!);
    postaviSesiju(null);
  }, []);

  if (!sesija) {
    return (
      <Prijava
        naslov={naslov}
        pocetnaGreska={razlog}
        onPrijava={(s) => {
          postaviRazlog(null);
          postaviSesiju(s);
        }}
      />
    );
  }
  return <>{children({ sesija, odjava, istekla })}</>;
}
