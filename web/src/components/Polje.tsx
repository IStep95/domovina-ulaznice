// Polje forme s oznakom, pomoći i greškom (Main.dc.html: 4 stanja).
// React jer živi u formi kupnje (otok u S4); bez client: direktive Astro ga
// renderira kao čisti HTML. Greška: aria-invalid + aria-describedby na poruku.
import type { ChangeEvent, FocusEvent, HTMLAttributes, HTMLInputTypeAttribute } from "react";
import css from "./polje.module.css";

export interface PoljeProps {
  id: string;
  oznaka: string;
  type?: HTMLInputTypeAttribute;
  name?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  /** Pomoćni tekst ispod polja. */
  pomoc?: string;
  /** Poruka greške; kad postoji, polje je aria-invalid. */
  greska?: string;
  disabled?: boolean;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  /** 16/700 oznaka (samostalno polje, npr. e-mail kupca). */
  vecaOznaka?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  /** Kupnja (S4): greška polja se prikazuje tek kad ga kupac napusti. */
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  /** Samo za /_komponente: prikaži izgled fokusa bez fokusa. */
  prikaziFokus?: boolean;
}

export default function Polje({
  id,
  oznaka,
  type = "text",
  pomoc,
  greska,
  vecaOznaka = false,
  prikaziFokus = false,
  disabled,
  ...unos
}: PoljeProps) {
  const pomocId = pomoc ? `${id}-pomoc` : undefined;
  const greskaId = greska ? `${id}-greska` : undefined;
  const opisano = [greskaId, pomocId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={disabled ? `${css.polje} ${css.onemoguceno}` : css.polje}>
      <label htmlFor={id} className={vecaOznaka ? `${css.oznaka} ${css.oznakaVeca}` : css.oznaka}>
        {oznaka}
      </label>
      <input
        id={id}
        type={type}
        className={prikaziFokus ? `${css.unos} ${css.fokus}` : css.unos}
        disabled={disabled}
        aria-invalid={greska ? true : undefined}
        aria-describedby={opisano}
        {...unos}
      />
      {greska && (
        <span id={greskaId} className={css.greska}>
          {greska}
        </span>
      )}
      {pomoc && (
        <span id={pomocId} className={css.pomoc}>
          {pomoc}
        </span>
      )}
    </div>
  );
}
