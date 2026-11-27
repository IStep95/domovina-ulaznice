// „Pošalji ponovno · 59:12” (Narudzba-stanja-1280, odstupanje u web/design/README.md):
// nakon 429 gumb je onemogućen i odbrojava do ponovnog pokušaja, zatim postaje
// običan sekundarni gumb. `salje` = „Šaljem…” s vrtnjom (aria-busy).
// Kupnja (S4) ga koristi kao „Nastavi na plaćanje · 1:58” (Kupnja-390):
// varijanta naglasni, velik, blok, type="submit", `disabled` dok forma nije valjana.
//
// `sekundi` je preostalo vrijeme u trenutku rendera (ne apsolutni trenutak), da
// SSR i hidracija prikažu isti tekst; odbrojavanje kreće pri montiranju ili kad
// se `sekundi` promijeni. Nova 429 s istim brojem sekundi ponovno pokreće
// odbrojavanje ako se promijeni `kljuc`.
import { useEffect, useRef, useState } from "react";
import { mmss } from "../lib/prikaz.ts";
import Ikona from "./Ikona.tsx";
import gumb from "./gumb.module.css";

export interface OdbrojavanjeGumbProps {
  tekst?: string;
  /** Preostale sekunde do ponovnog pokušaja; 0 = odmah dostupno. */
  sekundi?: number;
  /** Promjena ponovno pokreće odbrojavanje i kad je `sekundi` isti broj. */
  kljuc?: string | number;
  salje?: boolean;
  /** Tekst za vrijeme slanja; zadano „Šaljem…”. */
  tekstSlanja?: string;
  /** Onemogućen i izvan odbrojavanja (npr. forma nije valjana). */
  disabled?: boolean;
  /**
   * Izgleda onemogućeno (aria-disabled) ali prima klik: kupnja tada pokaže
   * greške obaveznih polja umjesto da klik nestane u prazno.
   */
  izgledaOnemoguceno?: boolean;
  varijanta?: "sekundarni" | "naglasni" | "primarni";
  velik?: boolean;
  blok?: boolean;
  type?: "button" | "submit";
  /** id elementa koji objašnjava zašto je gumb zaključan (aria-describedby). */
  opisano?: string;
  /** Kad odbrojavanje dođe do nule. */
  onIstek?: () => void;
  onClick?: () => void;
}

export default function OdbrojavanjeGumb({
  tekst = "Pošalji ponovno",
  sekundi = 0,
  kljuc,
  salje = false,
  tekstSlanja = "Šaljem…",
  disabled = false,
  izgledaOnemoguceno = false,
  varijanta = "sekundarni",
  velik = false,
  blok = false,
  type = "button",
  opisano,
  onIstek,
  onClick,
}: OdbrojavanjeGumbProps) {
  const [preostalo, postavi] = useState(Math.max(0, Math.ceil(sekundi)));
  // Zadnji onIstek iz rendera: nova funkcija roditelja ne smije ponovno pokrenuti odbrojavanje.
  const istek = useRef(onIstek);
  istek.current = onIstek;

  useEffect(() => {
    postavi(Math.max(0, Math.ceil(sekundi)));
    if (sekundi <= 0) return;
    const kraj = Date.now() + sekundi * 1000;
    const t = setInterval(() => {
      const ostalo = Math.max(0, Math.ceil((kraj - Date.now()) / 1000));
      postavi(ostalo);
      if (ostalo === 0) {
        clearInterval(t);
        istek.current?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [sekundi, kljuc]);

  const ceka = preostalo > 0;
  const onemogucen = ceka || salje || disabled;
  const klase = [gumb.gumb, gumb[varijanta], velik ? gumb.velik : null, blok ? gumb.blok : null].filter(Boolean).join(" ");
  return (
    <button
      type={type}
      className={klase}
      disabled={onemogucen}
      aria-disabled={!onemogucen && izgledaOnemoguceno ? true : undefined}
      aria-busy={salje ? true : undefined}
      aria-describedby={opisano}
      onClick={onClick}
    >
      {salje && <Ikona ime="vrtnja" velicina={16} />}
      {salje ? tekstSlanja : ceka ? `${tekst} · ${mmss(preostalo)}` : tekst}
    </button>
  );
}
