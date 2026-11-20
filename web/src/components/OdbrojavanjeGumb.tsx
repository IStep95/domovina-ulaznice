// „Pošalji ponovno · 59:12” (Narudzba-stanja-1280, odstupanje u web/design/README.md):
// nakon 429 gumb je onemogućen i odbrojava do ponovnog pokušaja, zatim postaje
// običan sekundarni gumb. `salje` = „Šaljem…” s vrtnjom (aria-busy).
//
// `sekundi` je preostalo vrijeme u trenutku rendera (ne apsolutni trenutak), da
// SSR i hidracija prikažu isti tekst; odbrojavanje kreće pri montiranju.
import { useEffect, useState } from "react";
import { mmss } from "../lib/prikaz.ts";
import Ikona from "./Ikona.tsx";
import gumb from "./gumb.module.css";

export interface OdbrojavanjeGumbProps {
  tekst?: string;
  /** Preostale sekunde do ponovnog pokušaja; 0 = odmah dostupno. */
  sekundi?: number;
  salje?: boolean;
  onClick?: () => void;
}

export default function OdbrojavanjeGumb({ tekst = "Pošalji ponovno", sekundi = 0, salje = false, onClick }: OdbrojavanjeGumbProps) {
  const [preostalo, postavi] = useState(Math.max(0, Math.ceil(sekundi)));

  useEffect(() => {
    postavi(Math.max(0, Math.ceil(sekundi)));
    if (sekundi <= 0) return;
    const kraj = Date.now() + sekundi * 1000;
    const t = setInterval(() => {
      const ostalo = Math.max(0, Math.ceil((kraj - Date.now()) / 1000));
      postavi(ostalo);
      if (ostalo === 0) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [sekundi]);

  const ceka = preostalo > 0;
  return (
    <button
      type="button"
      className={`${gumb.gumb} ${gumb.sekundarni}`}
      disabled={ceka || salje}
      aria-busy={salje ? true : undefined}
      onClick={onClick}
    >
      {salje && <Ikona ime="vrtnja" velicina={16} />}
      {salje ? "Šaljem…" : ceka ? `${tekst} · ${mmss(preostalo)}` : tekst}
    </button>
  );
}
