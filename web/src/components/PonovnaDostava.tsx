// „Pošalji ponovno” (S5; Narudzba-1280, Narudzba-stanja-1280): React otok u
// bloku „Niste dobili e-mail?” na plaćenoj narudžbi. Naslov, tekst i upozorenje
// o poništavanju starog QR-a su SSR (upozorenje stoji PRIJE klika); otok je samo
// gumb i ishod ispod njega.
//
// POST /api/ulaznice/:id/ponovna-dostava → ishodDostave (src/lib/narudzba.ts);
// greška → greskaUlaznica (src/lib/poruke.ts). 429 zaključa gumb s odbrojavanjem
// („Pošalji ponovno · 59:12”) do isteka `retry_after`.
import { useMemo, useRef, useState } from "react";
import { createApiClient } from "../lib/api.ts";
import { ishodDostave, type IshodDostave } from "../lib/narudzba.ts";
import { greskaUlaznica, kodIzGreske, type GreskaUlaznica } from "../lib/poruke.ts";
import Banner from "./Banner.tsx";
import OdbrojavanjeGumb from "./OdbrojavanjeGumb.tsx";
import css from "./ponovna-dostava.module.css";

export interface PonovnaDostavaProps {
  orderId: string;
}

type Ishod = { vrsta: "odgovor"; ishod: IshodDostave } | { vrsta: "greska"; greska: GreskaUlaznica };

export default function PonovnaDostava({ orderId }: PonovnaDostavaProps) {
  const api = useMemo(() => createApiClient(), []);
  const [salje, postaviSalje] = useState(false);
  const [ishod, postaviIshod] = useState<Ishod | null>(null);
  const [cekanje, postaviCekanje] = useState({ sekundi: 0, kljuc: 0 });
  // Ref uz stanje: dvoklik prije novog rendera ne smije poslati dva zahtjeva
  // (svaki troši pokušaj rate limita i može rotirati QR).
  const slanje = useRef(false);

  async function posalji() {
    if (slanje.current) return;
    slanje.current = true;
    postaviSalje(true);
    postaviIshod(null);
    try {
      const r = await api.posaljiPonovno(orderId);
      postaviIshod({ vrsta: "odgovor", ishod: ishodDostave(r) });
    } catch (e) {
      const { kod, retryAfter } = kodIzGreske(e);
      const g = greskaUlaznica(kod, retryAfter);
      if (g.cekajSekundi > 0) postaviCekanje({ sekundi: g.cekajSekundi, kljuc: Date.now() });
      postaviIshod({ vrsta: "greska", greska: g });
    } finally {
      slanje.current = false;
      postaviSalje(false);
    }
  }

  return (
    <div className={css.otok}>
      <OdbrojavanjeGumb
        tekst="Pošalji ponovno"
        salje={salje}
        sekundi={cekanje.sekundi}
        kljuc={cekanje.kljuc}
        onClick={posalji}
        onIstek={() => {
          postaviCekanje({ sekundi: 0, kljuc: 0 });
          postaviIshod((i) => (i?.vrsta === "greska" && i.greska.ton === "wait" ? null : i));
        }}
      />
      {ishod?.vrsta === "odgovor" && (
        <Banner ton={ishod.ishod.ton} uloga={ishod.ishod.ton === "error" ? "alert" : "status"} istaknut={!!ishod.ishod.istaknuto}>
          {ishod.ishod.tekst}
          {ishod.ishod.istaknuto && (
            <>
              {" "}
              <b>{ishod.ishod.istaknuto}</b>
            </>
          )}
        </Banner>
      )}
      {ishod?.vrsta === "greska" && (
        <Banner ton={ishod.greska.ton} uloga="alert">
          {ishod.greska.poruka}
          {ishod.greska.dopuna && ` ${ishod.greska.dopuna}`}
        </Banner>
      )}
    </div>
  );
}
