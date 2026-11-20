// React parnjak Banner.astro, za otoke (greške kupnje S4, ponovna dostava S5).
// Isti CSS modul i iste uloge: error → role="alert", ostalo → role="status".
import type { ReactNode } from "react";
import { IKONA_TONA, type IkonaIme, type Ton } from "../lib/ikone.ts";
import Ikona from "./Ikona.tsx";
import css from "./banner.module.css";

export interface BannerProps {
  ton?: Ton;
  uloga?: "alert" | "status" | "note";
  ikona?: IkonaIme;
  istaknut?: boolean;
  className?: string;
  /** Gumb ili link ispod teksta. */
  akcija?: ReactNode;
  children: ReactNode;
}

export default function Banner({ ton = "neutral", uloga, ikona, istaknut = false, className, akcija, children }: BannerProps) {
  const role = uloga ?? (ton === "error" ? "alert" : "status");
  const klase = [css.banner, css[ton], istaknut ? css.istaknut : null, className].filter(Boolean).join(" ");
  return (
    <div role={role} className={klase}>
      <div className={css.redak}>
        <Ikona ime={ikona ?? IKONA_TONA[ton]} velicina={20} />
        <span className={css.tekst}>{children}</span>
      </div>
      {akcija && <div className={css.akcija}>{akcija}</div>}
    </div>
  );
}
