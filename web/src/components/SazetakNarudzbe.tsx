// Sažetak cijene: stavke, „Naknada platforme 0,00 €”, ukupno (Main.dc.html).
// React jer se u kupnji (S4) mijenja s količinom; u Astru bez client: direktive
// je čisti HTML. Iznosi su cijeli centi; ukupno se zbraja ovdje, cjelobrojno.
import { eur } from "../lib/format.ts";
import css from "./sazetak.module.css";

export interface StavkaSazetka {
  /** Npr. „Redovna ulaznica × 2”. */
  opis: string;
  iznosCenti: number;
}

export interface SazetakNarudzbeProps {
  stavke: StavkaSazetka[];
  /** Redak „Naknada platforme 0,00 €” (bez posrednika); zadano prikazan. */
  naknadaPlatforme?: boolean;
  /** Bijela kartica s obrubom; bez nje se uklapa u roditeljsku karticu. */
  kartica?: boolean;
}

export default function SazetakNarudzbe({ stavke, naknadaPlatforme = true, kartica = false }: SazetakNarudzbeProps) {
  const ukupno = stavke.reduce((zbroj, s) => zbroj + s.iznosCenti, 0);
  return (
    <dl className={kartica ? `${css.sazetak} ${css.kartica}` : css.sazetak}>
      {stavke.map((s, i) => (
        <div key={i} className={css.red}>
          <dt>{s.opis}</dt>
          <dd>{eur(s.iznosCenti)}</dd>
        </div>
      ))}
      {naknadaPlatforme && (
        <div className={`${css.red} ${css.prigusen}`}>
          <dt>Naknada platforme</dt>
          <dd>{eur(0)}</dd>
        </div>
      )}
      <div className={`${css.red} ${css.ukupno}`}>
        <dt>Ukupno</dt>
        <dd>{eur(ukupno)}</dd>
      </div>
    </dl>
  );
}
