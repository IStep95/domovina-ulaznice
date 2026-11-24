// Skener ulaza (U4; S8 otok `client:only` na /skener). Prenesen iz
// src/pages/Skener.tsx (SPA, rezerva do S9); normalizacija koda i vrijeme su
// u src/lib/organizator.ts.
//
// Tri stvari koje su na vratima važnije od svega ostalog:
//   1. **Odbijanje mora biti glasno.** Buka na ulazu je stvarna; ⛔ je crven,
//      preko cijele širine, uz zvuk i vibraciju. Tiho odbijanje = propušten ulaz.
//   2. **Autorizacija je server-side pri SVAKOM skenu.** Ukraden mobitel s
//      otvorenom aplikacijom bez valjanog tokena ne može ništa — `redeem_ticket`
//      traži `auth.uid()` i admin rolu organizatora.
//   3. **Anti-double-entry je u bazi.** Dva uređaja koja skeniraju istu ulaznicu
//      rješava row lock u jezgri; prvi pobjeđuje, drugi dobije vrijeme prvog
//      ulaska. Klijent ne pokušava biti pametan.
//
// Offline: opcija A iz handoffa U4 — online-only uz jasnu poruku. Predučitani
// vaučeri (opcija B) donose rizik duplog ulaza kad dva uređaja rade bez mreže,
// a to je na ulazu nepopravljiva šteta.
//
// ⚠️ REVIEW(fable): `BarcodeDetector` ne postoji u Safariju. Na iPhoneu skener
// zato nudi samo ručni unos, što je za pravi ulaz nedovoljno. Ispravno rješenje
// je bundlati `zxing-wasm` kao fallback (~250 kB, lazy import samo kad detektora
// nema) — svjesno nije napravljeno jer je jedina staza kojom to možemo dokazati
// stvarni uređaj, ne test. Do tada: Android/Chrome na ulazu.
import { useCallback, useEffect, useRef, useState } from "react";
import { dohvatiPregled, jeIstekla, skenirajToken, type OrgEvent, type Sesija, type SkenRezultat } from "../lib/auth.ts";
import { ponovljenoCitanje, stanjeDogadjaja, tokenIzQr, vrijemeUlaska } from "../lib/organizator.ts";
import { porukaIzGreske } from "../lib/poruke.ts";
import Banner from "./Banner.tsx";
import Ikona from "./Ikona.tsx";
import SaPrijavom, { type SesijaOtoka } from "./SaPrijavom.tsx";
import TrakaSesije from "./TrakaSesije.tsx";
import gumb from "./gumb.module.css";
import polje from "./polje.module.css";
import css from "./skener.module.css";

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}

/** Zvuk bez datoteke: kratki ton iz WebAudija (uspjeh visok, odbijanje nisko). */
function zvuk(ok: boolean): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = ok ? 880 : 220;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.4));
    osc.onended = () => void ctx.close();
  } catch {
    /* bez zvuka se i dalje vidi rezultat */
  }
}

const vibriraj = (ok: boolean): void => {
  try {
    navigator.vibrate?.(ok ? 60 : [80, 60, 80]);
  } catch {
    /* nema haptike */
  }
};

export default function Skener() {
  return <SaPrijavom naslov="Skener ulaza">{(s) => <IzborDogadjaja {...s} />}</SaPrijavom>;
}

function IzborDogadjaja({ sesija, odjava, istekla }: SesijaOtoka) {
  const [dogadjaji, postaviDogadjaje] = useState<OrgEvent[] | null>(null);
  const [odabrani, postaviOdabrani] = useState<OrgEvent | null>(null);
  const [greska, postaviGresku] = useState<string | null>(null);

  useEffect(() => {
    let vazi = true;
    dohvatiPregled(sesija.access_token)
      .then((p) => vazi && postaviDogadjaje(p.events))
      .catch((e) => {
        if (!vazi) return;
        if (jeIstekla(e)) istekla();
        else postaviGresku(porukaIzGreske(e));
      });
    return () => {
      vazi = false;
    };
  }, [sesija.access_token, istekla]);

  if (odabrani) {
    return <SkenerKamera sesija={sesija} dogadjaj={odabrani} natrag={() => postaviOdabrani(null)} istekla={istekla} />;
  }

  return (
    <div className={css.skener}>
      <TrakaSesije naslov="Skener ulaza" email={sesija.email} odjava={odjava} />
      {greska && <Banner ton="error">{greska}</Banner>}
      {!dogadjaji && !greska && (
        <p className={css.mutno} role="status">
          Učitavanje događaja…
        </p>
      )}
      {dogadjaji?.length === 0 && <p className={css.mutno}>Nemate nijedan događaj.</p>}
      {dogadjaji && dogadjaji.length > 0 && (
        <ul className={css.popis} aria-label="Odaberite događaj">
          {dogadjaji.map((d) => (
            <li key={d.campaign_id}>
              <button type="button" className={css.izbor} onClick={() => postaviOdabrani(d)}>
                <span className={css.izborTekst}>
                  <strong>{d.title}</strong>
                  <span className={css.mutno}>
                    {[d.event?.venue_city, stanjeDogadjaja(d.state).tekst].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <span aria-hidden="true">→</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SkenerKamera({
  sesija,
  dogadjaj,
  natrag,
  istekla,
}: {
  sesija: Sesija;
  dogadjaj: OrgEvent;
  natrag: () => void;
  istekla: () => void;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const platno = useRef<HTMLCanvasElement | null>(null);
  const zadnji = useRef<{ token: string; kad: number }>({ token: "", kad: 0 });
  const zauzet = useRef(false);
  const [rezultat, postaviRezultat] = useState<SkenRezultat | null>(null);
  const [poruka, postaviPoruku] = useState<string | null>(null);
  const [kameraRadi, postaviKameraRadi] = useState(false);
  const [rucni, postaviRucni] = useState("");

  const imaDetektor = typeof (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector === "function";

  const posalji = useCallback(
    async (sirovo: string) => {
      const token = tokenIzQr(sirovo);
      if (!token) {
        postaviPoruku("Pročitani kod nije ulaznica ovog sustava.");
        zvuk(false);
        return;
      }
      // Isti kod pred kamerom ne šalje se svakih 150 ms.
      if (ponovljenoCitanje(zadnji.current, token, Date.now())) return;
      zadnji.current = { token, kad: Date.now() };

      postaviPoruku(null);
      try {
        const r = await skenirajToken(sesija.access_token, token);
        postaviRezultat(r);
        const ok = r.status === "checked_in";
        zvuk(ok);
        vibriraj(ok);
      } catch (e) {
        if (jeIstekla(e)) {
          istekla();
          return;
        }
        postaviPoruku(porukaIzGreske(e));
        zvuk(false);
      }
    },
    [sesija.access_token, istekla],
  );

  // Petlja skeniranja: jedan frame svakih 150 ms, bez paralelnih detekcija.
  useEffect(() => {
    if (!imaDetektor) return;
    let stani = false;
    let stream: MediaStream | null = null;
    let timer: number | undefined;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (stani) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
          postaviKameraRadi(true);
        }
        const Detector = (window as unknown as { BarcodeDetector: new (o: { formats: string[] }) => BarcodeDetectorLike })
          .BarcodeDetector;
        const detektor = new Detector({ formats: ["qr_code"] });

        const tik = async () => {
          if (stani || zauzet.current || !video.current || !platno.current) return;
          zauzet.current = true;
          try {
            const v = video.current;
            const c = platno.current;
            if (v.videoWidth > 0) {
              c.width = v.videoWidth;
              c.height = v.videoHeight;
              c.getContext("2d")?.drawImage(v, 0, 0);
              const nalazi = await detektor.detect(c);
              if (nalazi[0]?.rawValue) await posalji(nalazi[0].rawValue);
            }
          } catch {
            /* pojedinačni frame smije pasti */
          } finally {
            zauzet.current = false;
          }
        };
        timer = window.setInterval(() => void tik(), 150);
      } catch {
        postaviPoruku("Kamera nije dostupna. Provjerite dopuštenje u pregledniku.");
      }
    })();

    return () => {
      stani = true;
      if (timer) window.clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [imaDetektor, posalji]);

  const ok = rezultat?.status === "checked_in";

  return (
    <div className={css.skener}>
      <div className={css.vrhKamere}>
        <button type="button" className={`${gumb.gumb} ${gumb.sekundarni}`} onClick={natrag}>
          <Ikona ime="natrag" velicina={18} />
          Događaji
        </button>
        <span className={css.naslovDogadjaja}>{dogadjaj.title}</span>
      </div>

      {rezultat && (
        <div className={`${css.sken} ${ok ? css.skenOk : css.skenLose}`} role="status" aria-live="assertive">
          <div className={css.znak} aria-hidden="true">
            <Ikona ime={ok ? "kvacica" : "x-krug"} velicina={44} />
          </div>
          <div className={css.skenTekst}>
            {rezultat.status === "checked_in" && (
              <>
                <strong>{rezultat.holder_name ?? "Ulaznica vrijedi"}</strong>
                <span>
                  {rezultat.tier_title ?? ""} · {rezultat.serial}
                </span>
                <span>ušlo: {rezultat.checked_in_count ?? "?"}</span>
              </>
            )}
            {rezultat.status === "already_checked_in" && (
              <>
                <strong>VEĆ UŠAO</strong>
                <span>
                  {rezultat.holder_name ?? ""} · {rezultat.serial}
                </span>
                <span>prvi ulazak: {vrijemeUlaska(rezultat.checked_in_at)}</span>
                {rezultat.checked_in_by_email && <span>skenirao: {rezultat.checked_in_by_email}</span>}
              </>
            )}
            {rezultat.status === "void" && (
              <>
                <strong>PONIŠTENA</strong>
                <span>{rezultat.serial}</span>
              </>
            )}
            {rezultat.status === "not_found" && <strong>NEPOZNATA ULAZNICA</strong>}
          </div>
        </div>
      )}

      {poruka && <Banner ton="error">{poruka}</Banner>}

      {imaDetektor ? (
        <div className={css.kartica}>
          <video ref={video} className={css.video} playsInline muted />
          <canvas ref={platno} hidden />
          <p className={css.mutno}>{kameraRadi ? "Usmjerite kameru na QR kod." : "Pokrećem kameru…"}</p>
        </div>
      ) : (
        <Banner ton="wait">
          Ovaj preglednik ne može čitati QR kod (nema <code>BarcodeDetector</code> — tipično Safari na iPhoneu). Za
          ulaz koristite Chrome na Androidu ili upišite kod ručno.
        </Banner>
      )}

      <form
        className={css.kartica}
        onSubmit={(e) => {
          e.preventDefault();
          void posalji(rucni);
          postaviRucni("");
        }}
      >
        <div className={polje.polje}>
          <label htmlFor="skener-rucni" className={polje.oznaka}>
            Ručni unos koda s ulaznice
          </label>
          <input
            id="skener-rucni"
            className={polje.unos}
            value={rucni}
            onChange={(e) => postaviRucni(e.target.value)}
            placeholder="dgdj1:… ili 64 znaka"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-describedby="skener-rucni-pomoc"
          />
          {/* Serial (npr. SUS-000004) ovdje NE radi: jezgra prima samo QR token.
              Ručni ulaz po serialu traži novi RPC. */}
          <span id="skener-rucni-pomoc" className={polje.pomoc}>
            Serial ulaznice nije dovoljan — potreban je kod iz QR-a.
          </span>
        </div>
        <button className={`${gumb.gumb} ${gumb.primarni}`} type="submit" disabled={!rucni.trim()}>
          Provjeri
        </button>
      </form>
    </div>
  );
}
