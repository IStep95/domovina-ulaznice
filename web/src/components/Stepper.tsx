// Stepper količine 1…max (Kupnja-1280). React otok: u /_komponente s client:load,
// u S4 dio forme kupnje. Kontroliran (vrijednost + onChange) ili sam drži stanje
// (pocetna). `name` doda skriveno polje da radi i u običnoj <form>.
import { useId, useState } from "react";
import css from "./stepper.module.css";

export interface StepperProps {
  oznaka?: string;
  /** Npr. „najviše 10 za ovu vrstu”. */
  opis?: string;
  min?: number;
  max: number;
  vrijednost?: number;
  pocetna?: number;
  onChange?: (n: number) => void;
  name?: string;
  disabled?: boolean;
}

export default function Stepper({
  oznaka = "Broj ulaznica",
  opis,
  min = 1,
  max,
  vrijednost,
  pocetna,
  onChange,
  name,
  disabled = false,
}: StepperProps) {
  const id = useId();
  const [vlastita, postavi] = useState(() => ogranici(pocetna ?? min, min, max));
  const n = ogranici(vrijednost ?? vlastita, min, max);

  function promijeni(novo: number) {
    const v = ogranici(novo, min, max);
    if (vrijednost === undefined) postavi(v);
    onChange?.(v);
  }

  return (
    <div className={css.redak} role="group" aria-labelledby={`${id}-oznaka`} aria-describedby={opis ? `${id}-opis` : undefined}>
      <div className={css.tekst}>
        <span id={`${id}-oznaka`} className={css.oznaka}>
          {oznaka}
        </span>
        {opis && (
          <span id={`${id}-opis`} className={css.opis}>
            {opis}
          </span>
        )}
      </div>
      <div className={css.kontrola}>
        <button
          type="button"
          className={css.gumb}
          aria-label="Manje ulaznica"
          disabled={disabled || n <= min}
          onClick={() => promijeni(n - 1)}
        >
          −
        </button>
        <span className={css.vrijednost} aria-live="polite">
          {n}
        </span>
        <button
          type="button"
          className={css.gumb}
          aria-label="Više ulaznica"
          disabled={disabled || n >= max}
          onClick={() => promijeni(n + 1)}
        >
          +
        </button>
      </div>
      {name && <input type="hidden" name={name} value={n} />}
    </div>
  );
}

function ogranici(n: number, min: number, max: number): number {
  return Math.min(Math.max(Math.trunc(n), min), Math.max(min, max));
}
