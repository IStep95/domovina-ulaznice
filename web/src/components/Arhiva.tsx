// Arhiviranje događaja (2026-11-27). Objavljeni događaj se arhivira (skriven s
// popisa i stranice, prodaja stoji, prodane ulaznice vrijede) i na stranici
// /organizator/arhivirano vraća u stanje prije arhiviranja. Smije admin računa
// događaja ili admin platforme; ovlasti provjerava jezgra (archive_event /
// unarchive_event), ne ovaj otok.
//
// Ovdje su: gumb „Arhiviraj” / „Vrati iz arhive” (AkcijaArhive), ikona kante
// koja vodi na arhivu (LinkArhive), odjeljak s popisom (OdjeljakArhive) i otok
// stranice /organizator/arhivirano (default export).
import { useEffect, useState } from "react";
import {
  arhivirajDogadjaj,
  dohvatiDogadjajePlatforme,
  dohvatiPregled,
  jeIstekla,
  vratiIzArhive,
  type DogadjajPlatforme,
  type OrgEvent,
} from "../lib/auth.ts";
import { datumDogadjaja } from "../lib/organizator.ts";
import { porukaIzGreske } from "../lib/poruke.ts";
import Banner from "./Banner.tsx";
import Ikona from "./Ikona.tsx";
import SaPrijavom, { type SesijaOtoka } from "./SaPrijavom.tsx";
import TrakaSesije from "./TrakaSesije.tsx";
import gumb from "./gumb.module.css";
import oznaka from "./oznaka.module.css";
import css from "./pregled-prodaje.module.css";

export const PUTANJA_ARHIVE = "/organizator/arhivirano";

/** Događaj u popisu, iz `organizer_overview` ili `platform_events`. */
export interface StavkaArhive {
  campaign_id: string;
  title: string;
  /** „Račun · datum · grad”, već složeno. */
  meta: string;
  archived_at: string | null;
}

/** „27. 11. 2026.” za trenutak arhiviranja. */
export function datumArhive(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}.`;
}

export function stavkaIzPregleda(d: OrgEvent): StavkaArhive {
  return {
    campaign_id: d.campaign_id,
    title: d.title,
    meta: [datumDogadjaja(d), d.event?.venue_city].filter(Boolean).join(" · "),
    archived_at: d.archived_at ?? null,
  };
}

export function stavkaIzPlatforme(d: DogadjajPlatforme): StavkaArhive {
  return {
    campaign_id: d.campaign_id,
    title: d.title,
    meta: [
      d.account_name,
      datumDogadjaja({ event: { starts_at: d.starts_at } }),
      d.venue_city,
      d.claimed > 0 ? `zauzeto: ${d.claimed}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
    archived_at: d.archived_at,
  };
}

/** Gumb „Arhiviraj” (s potvrdom) ili „Vrati iz arhive”; grešku prikazuje roditelj. */
export function AkcijaArhive({
  id,
  naslov,
  vrati,
  token,
  istekla,
  gotovo,
  naGresku,
}: {
  id: string;
  naslov: string;
  /** true = „Vrati iz arhive”, inače „Arhiviraj”. */
  vrati: boolean;
  token: string;
  istekla: () => void;
  gotovo: () => void;
  naGresku: (poruka: string | null) => void;
}) {
  const [radi, postaviRadi] = useState(false);

  async function izvrsi() {
    if (
      !vrati &&
      !window.confirm(
        `Arhivirati „${naslov}”? Događaj nestaje s popisa i prodaja staje; prodane ulaznice i dalje vrijede. Vratiti ga možeš na stranici „Arhivirano”.`,
      )
    )
      return;
    naGresku(null);
    postaviRadi(true);
    try {
      if (vrati) await vratiIzArhive(token, id);
      else await arhivirajDogadjaj(token, id);
      gotovo();
    } catch (e) {
      if (jeIstekla(e)) istekla();
      else naGresku(porukaIzGreske(e));
      postaviRadi(false);
    }
  }

  return (
    <button
      type="button"
      className={`${gumb.gumb} ${vrati ? gumb.primarni : gumb.sekundarni}`}
      disabled={radi}
      aria-busy={radi || undefined}
      onClick={izvrsi}
    >
      {vrati ? (radi ? "Vraćam…" : "Vrati iz arhive") : radi ? "Arhiviram…" : "Arhiviraj"}
    </button>
  );
}

/** Ikona kante uz „+ Novi događaj”: vodi na /organizator/arhivirano. */
export function LinkArhive({ broj }: { broj: number }) {
  const opis = broj > 0 ? `Arhivirano (${broj})` : "Arhivirano";
  return (
    <a className={`${gumb.gumb} ${gumb.sekundarni} ${css.ikonaArhive}`} href={PUTANJA_ARHIVE} aria-label={opis} title={opis}>
      <Ikona ime="kanta" velicina={18} />
      {broj > 0 && <span className={css.brojArhive}>{broj}</span>}
    </a>
  );
}

function RedakArhive({
  s,
  token,
  istekla,
  gotovo,
}: {
  s: StavkaArhive;
  token: string;
  istekla: () => void;
  gotovo: () => void;
}) {
  const arhiviran = !!s.archived_at;
  const [greska, postaviGresku] = useState<string | null>(null);
  return (
    <article className={css.kartica} aria-labelledby={`arhiva-${s.campaign_id}`}>
      <div className={css.naslovBlok}>
        <h3 id={`arhiva-${s.campaign_id}`} className={css.naslov}>
          {s.title}
        </h3>
        <div className={css.meta}>
          {arhiviran ? (
            <span className={`${oznaka.oznaka} ${oznaka.neutral}`}>arhivirano {datumArhive(s.archived_at!)}</span>
          ) : (
            <span className={`${oznaka.oznaka} ${oznaka.ok}`}>objavljen</span>
          )}
          {s.meta && <span>{s.meta}</span>}
        </div>
      </div>
      {greska && <Banner ton="error">{greska}</Banner>}
      <div className={css.akcije}>
        <AkcijaArhive
          id={s.campaign_id}
          naslov={s.title}
          vrati={arhiviran}
          token={token}
          istekla={istekla}
          gotovo={gotovo}
          naGresku={postaviGresku}
        />
      </div>
    </article>
  );
}

/** Odjeljak s popisom; bez stavki se ne prikazuje, osim ako je zadan `prazno`. */
export function OdjeljakArhive({
  id,
  naslov,
  opis,
  prazno,
  stavke,
  token,
  istekla,
  gotovo,
}: {
  id: string;
  naslov: string;
  opis?: string;
  prazno?: string;
  stavke: StavkaArhive[];
  token: string;
  istekla: () => void;
  gotovo: () => void;
}) {
  if (stavke.length === 0 && !prazno) return null;
  return (
    <section className={css.odjeljak} aria-labelledby={id}>
      <h2 id={id} className={css.podnaslov}>
        {naslov}
        {stavke.length > 0 ? ` (${stavke.length})` : ""}
      </h2>
      {opis && <p className={css.mutno}>{opis}</p>}
      {stavke.length === 0 && <p className={css.mutno}>{prazno}</p>}
      {stavke.map((s) => (
        <RedakArhive key={s.campaign_id} s={s} token={token} istekla={istekla} gotovo={gotovo} />
      ))}
    </section>
  );
}

/** Otok stranice /organizator/arhivirano. */
export default function Arhivirano() {
  return <SaPrijavom naslov="Arhivirano">{(s) => <Popis {...s} />}</SaPrijavom>;
}

function Popis({ sesija, odjava, istekla }: SesijaOtoka) {
  const [stavke, postaviStavke] = useState<StavkaArhive[] | null>(null);
  const [greska, postaviGresku] = useState<string | null>(null);
  const [osvjezi, postaviOsvjezi] = useState(0);

  useEffect(() => {
    let vazi = true;
    (async () => {
      const pregled = await dohvatiPregled(sesija.access_token);
      const vlastiti = pregled.events.filter((d) => d.archived_at).map(stavkaIzPregleda);
      // Admin platforme vidi i tuđe arhivirane događaje.
      let tudji: StavkaArhive[] = [];
      if (pregled.platform_admin) {
        const ids = new Set(pregled.events.map((d) => d.campaign_id));
        const { events } = await dohvatiDogadjajePlatforme(sesija.access_token);
        tudji = events.filter((d) => d.archived_at && !ids.has(d.campaign_id)).map(stavkaIzPlatforme);
      }
      const sve = [...vlastiti, ...tudji].sort((a, b) => (b.archived_at ?? "").localeCompare(a.archived_at ?? ""));
      if (vazi) postaviStavke(sve);
    })().catch((e) => {
      if (!vazi) return;
      if (jeIstekla(e)) istekla();
      else postaviGresku(porukaIzGreske(e));
    });
    return () => {
      vazi = false;
    };
  }, [sesija.access_token, istekla, osvjezi]);

  return (
    <div className={css.pregled}>
      <TrakaSesije naslov="Arhivirano" email={sesija.email} odjava={odjava}>
        <a className={css.natrag} href="/organizator">
          <Ikona ime="natrag" velicina={16} />
          Pregled prodaje
        </a>
      </TrakaSesije>

      {greska && <Banner ton="error">{greska}</Banner>}
      {!stavke && !greska && (
        <p className={css.mutno} role="status">
          Učitavanje…
        </p>
      )}
      {stavke && (
        <OdjeljakArhive
          id="arhivirano-popis"
          naslov="Arhivirani događaji"
          opis="Skriveni s popisa događaja i bez prodaje; prodane ulaznice i dalje vrijede. „Vrati iz arhive” vraća događaj kakav je bio."
          prazno="Nema arhiviranih događaja."
          stavke={stavke}
          token={sesija.access_token}
          istekla={istekla}
          gotovo={() => postaviOsvjezi((n) => n + 1)}
        />
      )}
    </div>
  );
}
