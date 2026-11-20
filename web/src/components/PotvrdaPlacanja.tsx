// Čekanje potvrde plaćanja (S5; Narudzba-390): React otok na /ulaznice/:id
// samo kad je narudžba `pending` i URL ima `?placeno=1` (povratak sa Stripea).
//
// Ponašanje iz src/pages/Narudzba.tsx: GET /api/ulaznice/:id svake 2 s, najviše
// 10 puta. Čim stanje više nije `pending`, stranica se ponovno učita, pa SSR
// iscrta paid (ili expired/failed) s istim komponentama kao pri prvom otvaranju.
// Nakon 20 s bez potvrde otok pokaže „Potvrda još nije stigla” i „Osvježi”.
// Dok provjerava, ne iscrtava ništa: zaglavlje „Potvrđujemo plaćanje…” je SSR.
// Greška pojedine provjere (mreža, 5xx) samo troši pokušaj.
import { useEffect, useMemo, useState } from "react";
import { createApiClient } from "../lib/api.ts";
import { MAX_OSVJEZAVANJA, OSVJEZAVANJE_MS } from "../lib/narudzba.ts";
import Banner from "./Banner.tsx";
import gumb from "./gumb.module.css";

export interface PotvrdaPlacanjaProps {
  orderId: string;
}

export default function PotvrdaPlacanja({ orderId }: PotvrdaPlacanjaProps) {
  const api = useMemo(() => createApiClient(), []);
  const [isteklo, postaviIsteklo] = useState(false);

  useEffect(() => {
    let pokusaji = 0;
    let gotovo = false;
    let t: ReturnType<typeof setTimeout> | undefined;

    const provjeri = async () => {
      pokusaji += 1;
      try {
        const o = await api.dohvatiNarudzbu(orderId);
        if (gotovo) return;
        if (o.state !== "pending") {
          gotovo = true;
          window.location.reload();
          return;
        }
      } catch {
        if (gotovo) return;
      }
      if (pokusaji >= MAX_OSVJEZAVANJA) postaviIsteklo(true);
      else t = setTimeout(provjeri, OSVJEZAVANJE_MS);
    };

    t = setTimeout(provjeri, OSVJEZAVANJE_MS);
    return () => {
      gotovo = true;
      clearTimeout(t);
    };
  }, [api, orderId]);

  if (!isteklo) return null;
  return (
    <Banner
      ton="neutral"
      akcija={
        <button type="button" className={`${gumb.gumb} ${gumb.sekundarni}`} onClick={() => window.location.reload()}>
          Osvježi
        </button>
      }
    >
      Potvrda još nije stigla. Ulaznice će svejedno stići e-mailom čim se plaćanje potvrdi.
    </Banner>
  );
}
