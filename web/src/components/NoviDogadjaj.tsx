// /organizator/novi (S8): PRIVREMENA ljuska dok ne stigne wizard (S8, stavka 4
// u web/docs/ui-feedback.md). Prijava radi, a umjesto forme stoji obavijest;
// stari editor je i dalje u SPA-i (src/pages/NoviDogadjaj.tsx), ali do njega
// glavni Worker više ne vodi. Wizard zamjenjuje sadržaj ove datoteke.
import SaPrijavom from "./SaPrijavom.tsx";
import Banner from "./Banner.tsx";
import TrakaSesije from "./TrakaSesije.tsx";
import gumb from "./gumb.module.css";
import css from "./pregled-prodaje.module.css";

export default function NoviDogadjaj() {
  return (
    <SaPrijavom naslov="Novi događaj">
      {({ sesija, odjava }) => (
        <div className={css.pregled}>
          <TrakaSesije naslov="Novi događaj" email={sesija.email} odjava={odjava} />
          <Banner
            ton="neutral"
            akcija={
              <a className={`${gumb.gumb} ${gumb.sekundarni}`} href="/organizator">
                Natrag na pregled prodaje
              </a>
            }
          >
            Editor događaja se upravo seli na novu stranicu. Za novi događaj zasad se javite na podrska@domovina.ai.
          </Banner>
        </div>
      )}
    </SaPrijavom>
  );
}
