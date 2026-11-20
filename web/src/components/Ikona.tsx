// React parnjak Ikona.astro, za otoke (kupnja, ponovna dostava). Isti podaci.
import { IKONE, type IkonaIme, type IkonaOblik } from "../lib/ikone.ts";
import css from "./ikona.module.css";

export interface IkonaProps {
  ime: IkonaIme;
  /** px; zadano 20 */
  velicina?: number;
}

export default function Ikona({ ime, velicina = 20 }: IkonaProps) {
  const oblik: IkonaOblik = IKONE[ime];
  return (
    <svg
      className={ime === "vrtnja" ? `${css.ikona} ${css.vrti}` : css.ikona}
      width={velicina}
      height={velicina}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={oblik.crta ?? 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      dangerouslySetInnerHTML={{ __html: oblik.sadrzaj }}
    />
  );
}
