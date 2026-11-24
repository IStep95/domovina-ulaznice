// /organizator/novi (S8): wizard za novi događaj, otok `client:only`
// (ui-feedback.md stavka 4). Sprema novu PRIVATNU skicu s vrstama ulaznica kroz
// POST /api/organizator/dogadjaj (events-organizer); payload složi `zahtjev` iz
// src/lib/editor.ts, isti kao u staroj SPA formi (src/pages/NoviDogadjaj.tsx).
//
// Pet koraka: Osnovno · Kada i gdje · Opis i slika · Ulaznice · Pregled.
// Računalo (≥ 1024 px): stepper lijevo, polja u sredini, živi pregled kartice
// desno, traka „Natrag · Korak n od 5 · Dalje” na dnu, bez scrolla stranice na
// 1440×900. Mobitel: jedan stupac, „2/5 · Kada i gdje” iznad, Natrag/Dalje
// prilijepljeni na dno, pregled kartice tek u koraku 5.
//
// Stanje: unos i najdalji posjećeni korak u localStorageu (src/lib/nacrt.ts),
// korak u `?korak=N` (pushState; „natrag” u pregledniku vraća korak, a URL ne
// može preskočiti prvi nevaljani korak). `event_id` je dio nacrta, pa ponovno
// slanje nakon greške mreže ili refresha ne pravi duplikat (`create_event` je
// idempotentan po id-u). Tko smije kreirati odlučuje baza (admin računa +
// provjeren identitet); objava, uređivanje i galerija još nisu ovdje.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SubmitEvent } from "react";
import { dohvatiPregled, jeIstekla, kreirajDogadjaj, type OrgPregled } from "../lib/auth.ts";
import { opisVremena, predlozeniKraj } from "../lib/birac-datuma.ts";
import {
  BROJ_KORAKA,
  KORACI,
  NAJVISE_TIEROVA,
  VRSTE,
  centiIzUnosa,
  korakPolja,
  korakZaKod,
  najdaljiDopusteni,
  podaciPregleda,
  prazanTier,
  prazanUnos,
  provjeri,
  validirajKorak,
  zahtjev,
  type Greske,
  type Korak,
  type UnosDogadjaja,
  type UnosTiera,
} from "../lib/editor.ts";
import { eur } from "../lib/format.ts";
import { korakIzUpita, korakIzUrla, obrisiNacrt, spremiNacrt, ucitajNacrt, urlKoraka } from "../lib/nacrt.ts";
import { kodIzGreske, porukaIzGreske } from "../lib/poruke.ts";
import Banner from "./Banner.tsx";
import Ikona from "./Ikona.tsx";
import KalendarPolje from "./KalendarPolje.tsx";
import Polje from "./Polje.tsx";
import PregledKartice from "./PregledKartice.tsx";
import SaPrijavom, { type SesijaOtoka } from "./SaPrijavom.tsx";
import TrakaSesije from "./TrakaSesije.tsx";
import gumb from "./gumb.module.css";
import polje from "./polje.module.css";
import css from "./novi-dogadjaj.module.css";

export default function NoviDogadjaj() {
  return <SaPrijavom naslov="Novi događaj">{(s) => <Wizard {...s} />}</SaPrijavom>;
}

type Racuni = OrgPregled["accounts"];

/** Id elementa za ključ greške (`tier.0.cijena` → `nd-tier-0-cijena`). */
const idPolja = (kljuc: string) => `nd-${kljuc.replace(/\./g, "-")}`;

function Wizard({ sesija, odjava, istekla }: SesijaOtoka) {
  // Nacrt se čita jednom, pri prvom crtanju (otok je client:only, pa nema SSR razlike).
  const [nacrt] = useState(() => ucitajNacrt(sesija.email));
  const [unos, setUnos] = useState<UnosDogadjaja>(() => nacrt?.unos ?? prazanUnos());
  const [eventId] = useState(() => nacrt?.eventId ?? crypto.randomUUID());
  const [korak, setKorak] = useState<Korak>(() => korakIzUrla(location.search, nacrt?.unos ?? prazanUnos()));
  const [posjeceno, setPosjeceno] = useState<Korak>(() => Math.max(nacrt?.posjeceno ?? 1, korak) as Korak);
  /** Koraci na kojima je „Dalje” već pokušan: tek tada se greške pokazuju (i prate tipkanje). */
  const [pokusani, setPokusani] = useState<ReadonlySet<Korak>>(() => new Set());
  const [racuni, setRacuni] = useState<Racuni | null>(null);
  const [greska, setGreska] = useState<string | null>(null);
  const [salje, setSalje] = useState(false);
  const [gotovo, setGotovo] = useState<{ slug: string; naslov: string } | null>(null);
  const naslovKoraka = useRef<HTMLHeadingElement>(null);
  const prviPrikaz = useRef(true);
  const unosRef = useRef(unos);
  unosRef.current = unos;

  // ── organizatori (account_id) ──
  useEffect(() => {
    let vazi = true;
    dohvatiPregled(sesija.access_token)
      .then((p) => {
        if (!vazi) return;
        setRacuni(p.accounts);
        setUnos((u) => {
          if (p.accounts.some((a) => a.id === u.accountId)) return u;
          return { ...u, accountId: p.accounts.length === 1 ? p.accounts[0]!.id : "" };
        });
      })
      .catch((e) => {
        if (!vazi) return;
        if (jeIstekla(e)) istekla();
        else setGreska(porukaIzGreske(e));
      });
    return () => {
      vazi = false;
    };
  }, [sesija.access_token, istekla]);

  // ── nacrt u localStorageu ──
  useEffect(() => {
    if (!gotovo) spremiNacrt({ email: sesija.email, eventId, unos, posjeceno });
  }, [unos, posjeceno, eventId, sesija.email, gotovo]);

  // ── korak u URL-u ──
  useEffect(() => {
    const uUrlu = korakIzUpita(location.search);
    if (uUrlu !== korak && new URLSearchParams(location.search).has("korak")) {
      history.replaceState(null, "", urlKoraka(location.pathname, location.search, korak));
    }
    const natrag = () => {
      const k = korakIzUrla(location.search, unosRef.current);
      if (k !== korakIzUpita(location.search)) history.replaceState(null, "", urlKoraka(location.pathname, location.search, k));
      setKorak(k);
      setPosjeceno((p) => Math.max(p, k) as Korak);
    };
    window.addEventListener("popstate", natrag);
    return () => window.removeEventListener("popstate", natrag);
    // samo pri prvom crtanju; kasnije URL mijenja `idi`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fokus na naslov koraka (čitač zaslona čuje novi korak), na mobitelu i na vrh
  useEffect(() => {
    if (prviPrikaz.current) {
      prviPrikaz.current = false;
      return;
    }
    naslovKoraka.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [korak, gotovo]);

  const idi = useCallback(
    (n: Korak) => {
      const k = Math.min(n, najdaljiDopusteni(unosRef.current)) as Korak;
      if (k === korak) return;
      history.pushState(null, "", urlKoraka(location.pathname, location.search, k));
      setKorak(k);
      setPosjeceno((p) => Math.max(p, k) as Korak);
    },
    [korak],
  );

  const greske: Greske = pokusani.has(korak) ? validirajKorak(korak, unos) : {};

  const postavi = <K extends keyof UnosDogadjaja>(k: K, v: UnosDogadjaja[K]) => setUnos((u) => ({ ...u, [k]: v }));
  const postaviTier = (i: number, izmjena: Partial<UnosTiera>) =>
    setUnos((u) => ({ ...u, tieri: u.tieri.map((t, j) => (j === i ? { ...t, ...izmjena } : t)) }));

  const fokusirajPrvuGresku = (g: Greske) => {
    const prvi = Object.keys(g)[0];
    if (!prvi) return;
    // nakon crtanja: polje greške možda tek nastaje (novi korak)
    requestAnimationFrame(() => {
      const el = document.getElementById(prvi === "tieri" ? "nd-dodaj-tier" : idPolja(prvi));
      el?.focus();
    });
  };

  const posalji = async () => {
    const g = provjeri(unos);
    if (Object.keys(g).length > 0) {
      const k = korakPolja(Object.keys(g)[0]!);
      setPokusani((p) => new Set(p).add(k));
      idi(k);
      fokusirajPrvuGresku(g);
      return;
    }
    setSalje(true);
    setGreska(null);
    try {
      const r = await kreirajDogadjaj(sesija.access_token, zahtjev(unos, eventId));
      obrisiNacrt();
      history.replaceState(null, "", location.pathname);
      setGotovo({ slug: r.slug, naslov: unos.naslov.trim() });
    } catch (e) {
      if (jeIstekla(e)) {
        istekla(); // nacrt ostaje, nakon prijave se nastavlja
        return;
      }
      setGreska(porukaIzGreske(e));
      const k = korakZaKod(kodIzGreske(e).kod);
      if (k) idi(k);
    } finally {
      setSalje(false);
    }
  };

  const dalje = (e?: SubmitEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (salje) return;
    if (korak === BROJ_KORAKA) {
      void posalji();
      return;
    }
    const g = validirajKorak(korak, unos);
    if (Object.keys(g).length > 0) {
      setPokusani((p) => new Set(p).add(korak));
      fokusirajPrvuGresku(g);
      return;
    }
    idi((korak + 1) as Korak);
  };

  const odbaciNacrt = () => {
    if (!window.confirm("Obrisati sve upisano i početi ispočetka?")) return;
    obrisiNacrt();
    // novi event_id: odbačeni nacrt nije isti događaj
    location.replace(location.pathname);
  };

  const imeRacuna = racuni?.find((r) => r.id === unos.accountId)?.name ?? null;
  const pregled = useMemo(() => podaciPregleda(unos), [unos]);

  if (gotovo) {
    return (
      <div className={css.gotovo}>
        <TrakaSesije naslov="Skica je spremljena" email={sesija.email} odjava={odjava} />
        <Banner ton="ok" istaknut>
          „{gotovo.naslov}” je spremljen kao <b>privatna skica</b>. Kupci ga još ne vide; objava dolazi u sljedećem koraku.
        </Banner>
        {gotovo.slug && <p className={css.mutno}>Adresa nakon objave: /dogadjaj/{gotovo.slug}</p>}
        <div className={css.gumbi}>
          <a className={`${gumb.gumb} ${gumb.primarni}`} href="/organizator">
            Na pregled događaja
          </a>
          <a className={`${gumb.gumb} ${gumb.sekundarni}`} href="/organizator/novi">
            Još jedan događaj
          </a>
        </div>
        <h2 ref={naslovKoraka} tabIndex={-1} className="vizualno-skriveno">
          Skica je spremljena
        </h2>
      </div>
    );
  }

  const dopusteni = najdaljiDopusteni(unos);
  const opisKoraka = KORACI[korak - 1]!;
  const korak3Prazan = !unos.opis.trim() && !unos.slika.trim();
  const tekstDalje =
    korak === BROJ_KORAKA ? (salje ? "Spremam…" : "Spremi kao skicu") : korak === 3 && korak3Prazan ? "Preskoči" : "Dalje";

  return (
    <div className={css.wizard}>
      <TrakaSesije naslov="Novi događaj" email={sesija.email} odjava={odjava} />

      <div className={css.tijelo}>
        {/* ── stepper (računalo) ── */}
        <nav className={css.stepper} aria-label="Koraci">
          <ol className={css.koraci}>
            {KORACI.map((k) => {
              const trenutni = k.broj === korak;
              const gotov = k.broj < BROJ_KORAKA && k.broj <= posjeceno && !trenutni && Object.keys(validirajKorak(k.broj, unos)).length === 0;
              const moze = !trenutni && k.broj <= posjeceno && k.broj <= dopusteni;
              const sadrzaj = (
                <>
                  <span className={css.krug} aria-hidden="true">
                    {gotov ? <Ikona ime="kvacica" velicina={16} /> : k.broj}
                  </span>
                  <span className={css.korakTekst}>
                    <span className={css.korakNaziv}>{k.naziv}</span>
                    <span className={css.korakOpis}>{gotov ? "gotovo" : k.opis}</span>
                  </span>
                </>
              );
              const klasa = [css.korak, trenutni && css.trenutni, gotov && css.gotov, !trenutni && !moze && css.zatvoren]
                .filter(Boolean)
                .join(" ");
              return (
                <li key={k.broj}>
                  {moze ? (
                    <button type="button" className={klasa} onClick={() => idi(k.broj)}>
                      {sadrzaj}
                    </button>
                  ) : (
                    <span className={klasa} aria-current={trenutni ? "step" : undefined}>
                      {sadrzaj}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
          <div className={css.stepperDno}>
            <p className={css.napomena}>Nacrt se sprema u ovom pregledniku dok ne spremiš skicu.</p>
            <a href="/organizator" className={css.malaPoveznica}>
              ← Pregled prodaje
            </a>
            <button type="button" className={css.malaPoveznica} onClick={odbaciNacrt}>
              Odbaci nacrt
            </button>
          </div>
        </nav>

        {/* ── polja koraka ── */}
        <form id="nd-forma" className={css.sredina} noValidate onSubmit={dalje}>
          <p className={css.napredak} aria-hidden="true">
            <b>
              {korak}/{BROJ_KORAKA}
            </b>{" "}
            · {opisKoraka.naziv}
            <span className={css.crta}>
              <span style={{ width: `${(korak / BROJ_KORAKA) * 100}%` }} />
            </span>
          </p>
          <div className={css.naslovBlok}>
            <h2 ref={naslovKoraka} tabIndex={-1} className={css.naslovKoraka}>
              <span className="vizualno-skriveno">
                Korak {korak} od {BROJ_KORAKA}:{" "}
              </span>
              {NASLOVI[korak]}
            </h2>
            <p className={css.podnaslov}>{PODNASLOVI[korak]}</p>
          </div>

          {greska && <Banner ton="error">{greska}</Banner>}

          {korak === 1 && <Korak1 unos={unos} greske={greske} racuni={racuni} postavi={postavi} />}
          {korak === 2 && <Korak2 unos={unos} greske={greske} postavi={postavi} />}
          {korak === 3 && <Korak3 unos={unos} greske={greske} postavi={postavi} />}
          {korak === 4 && <Korak4 unos={unos} greske={greske} postavi={postavi} postaviTier={postaviTier} />}
          {korak === 5 && (
            <Korak5 unos={unos} greske={greske} postavi={postavi} imeRacuna={imeRacuna} idi={idi}>
              <div className={css.samoMobitel}>
                <PregledKartice p={pregled} />
              </div>
            </Korak5>
          )}
        </form>

        {/* ── živi pregled (računalo) ── */}
        <aside className={css.pregled} aria-label="Pregled kartice događaja">
          <p className={css.pregledOznaka}>Ovako ga vide kupci</p>
          <PregledKartice p={pregled} />
          <p className={css.napomena}>
            Kartica na popisu događaja. Kupci je vide tek nakon objave; skica je privatna.
          </p>
        </aside>
      </div>

      {/* ── traka koraka ── */}
      <div className={css.traka}>
        <div className={css.trakaLijevo}>
          {korak > 1 ? (
            <button type="button" className={`${gumb.gumb} ${gumb.sekundarni}`} onClick={() => idi((korak - 1) as Korak)}>
              <Ikona ime="natrag" velicina={18} />
              Natrag
            </button>
          ) : (
            <a className={`${gumb.gumb} ${gumb.tanki}`} href="/organizator">
              Odustani
            </a>
          )}
        </div>
        <span className={css.trakaKorak}>
          Korak {korak} od {BROJ_KORAKA}
        </span>
        <div className={css.trakaDesno}>
          <button
            type="submit"
            form="nd-forma"
            className={`${gumb.gumb} ${gumb.primarni}`}
            disabled={salje}
            aria-busy={salje || undefined}
          >
            {tekstDalje}
            {korak < BROJ_KORAKA && <span className={css.strelica} aria-hidden="true">→</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

const NASLOVI: Record<Korak, string> = {
  1: "Osnovno",
  2: "Kada i gdje",
  3: "Opis i slika",
  4: "Ulaznice",
  5: "Pregled",
};

const PODNASLOVI: Record<Korak, string> = {
  1: "Kako se događaj zove i tko ga organizira.",
  2: "Termin je po zagrebačkom vremenu.",
  3: "Neobavezno: možeš preskočiti i dodati kasnije.",
  4: "Jedan red je jedna vrsta ulaznice. Cijena je u eurima, količina prazna = bez ograničenja.",
  5: "Provjeri podatke i dodaj kontakt za kupce. Skica je privatna dok je ne objaviš.",
};

type Postavi = <K extends keyof UnosDogadjaja>(k: K, v: UnosDogadjaja[K]) => void;

interface KorakProps {
  unos: UnosDogadjaja;
  greske: Greske;
  postavi: Postavi;
}

// ── 1. Osnovno ───────────────────────────────────────────────────────────────

function Korak1({ unos, greske, racuni, postavi }: KorakProps & { racuni: Racuni | null }) {
  return (
    <div className={css.polja}>
      {racuni === null && (
        <p className={css.mutno} role="status">
          Učitavanje organizatora…
        </p>
      )}
      {racuni !== null && racuni.length === 0 && (
        <Banner ton="wait">
          Tvoj račun nije administrator nijednog organizatora, pa događaj ne možeš spremiti. Javi se na podrska@domovina.ai.
        </Banner>
      )}
      {racuni !== null && racuni.length > 1 && (
        <div className={polje.polje}>
          <label htmlFor="nd-accountId" className={polje.oznaka}>
            Organizator
          </label>
          <select
            id="nd-accountId"
            className={`${polje.unos} ${css.izbornik}`}
            value={unos.accountId}
            onChange={(e) => postavi("accountId", e.target.value)}
            aria-invalid={greske.accountId ? true : undefined}
            aria-describedby={greske.accountId ? "nd-accountId-greska" : undefined}
          >
            <option value="">Odaberi…</option>
            {racuni.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          {greske.accountId && (
            <span id="nd-accountId-greska" className={polje.greska}>
              {greske.accountId}
            </span>
          )}
        </div>
      )}
      {racuni !== null && racuni.length === 1 && greske.accountId && <Banner ton="error">{greske.accountId}</Banner>}
      <Polje
        id="nd-naslov"
        oznaka="Naziv događaja"
        value={unos.naslov}
        placeholder="npr. Koncert u parku"
        maxLength={160}
        greska={greske.naslov}
        pomoc={greske.naslov ? undefined : "Kupci ga vide na popisu i na stranici događaja."}
        onChange={(e) => postavi("naslov", e.target.value)}
      />
      <fieldset className={css.skupina}>
        <legend className={polje.oznaka}>Vrsta</legend>
        <div className={css.vrste}>
          {VRSTE.map(([v, n]) => (
            <label key={v} className={css.vrsta}>
              <input
                type="radio"
                name="nd-vrsta"
                id={v === VRSTE[0]![0] ? "nd-vrsta" : undefined}
                value={v}
                checked={unos.vrsta === v}
                onChange={() => postavi("vrsta", v)}
              />
              <span>{n}</span>
            </label>
          ))}
        </div>
        {greske.vrsta && <span className={polje.greska}>{greske.vrsta}</span>}
      </fieldset>
    </div>
  );
}

// ── 2. Kada i gdje ───────────────────────────────────────────────────────────

function Korak2({ unos, greske, postavi }: KorakProps) {
  const danPocetka = unos.pocetak.slice(0, 10) || undefined;
  return (
    <div className={css.polja}>
      {/* jedan ispod drugog: „subota, 16. travnja 2027. u 09:00” ne stane u pola stupca */}
      <div className={css.polja}>
        <KalendarPolje
          id="nd-pocetak"
          oznaka="Početak"
          vrijednost={unos.pocetak}
          onChange={(v) => postavi("pocetak", v)}
          greska={greske.pocetak}
        />
        <KalendarPolje
          id="nd-kraj"
          oznaka="Kraj (neobavezno)"
          vrijednost={unos.kraj}
          onChange={(v) => postavi("kraj", v)}
          od={danPocetka}
          oznaceno={danPocetka}
          otvoriNa={danPocetka}
          zadaniSat={predlozeniKraj(unos.pocetak)}
          greska={greske.kraj}
          neobavezno
        />
      </div>
      <Polje
        id="nd-mjesto"
        oznaka="Naziv mjesta"
        value={unos.mjesto}
        placeholder="npr. Dom sportova"
        maxLength={160}
        greska={greske.mjesto}
        onChange={(e) => postavi("mjesto", e.target.value)}
      />
      <div className={css.red}>
        <Polje
          id="nd-adresa"
          oznaka="Adresa (neobavezno)"
          value={unos.adresa}
          placeholder="Trg Krešimira Ćosića 11"
          maxLength={200}
          onChange={(e) => postavi("adresa", e.target.value)}
        />
        <Polje
          id="nd-grad"
          oznaka="Grad"
          value={unos.grad}
          placeholder="Zagreb"
          maxLength={80}
          greska={greske.grad}
          onChange={(e) => postavi("grad", e.target.value)}
        />
      </div>
    </div>
  );
}

// ── 3. Opis i slika ──────────────────────────────────────────────────────────

function Korak3({ unos, greske, postavi }: KorakProps) {
  return (
    <div className={css.polja}>
      <div className={polje.polje}>
        <label htmlFor="nd-opis" className={polje.oznaka}>
          Opis (neobavezno)
        </label>
        <textarea
          id="nd-opis"
          className={`${polje.unos} ${css.opis}`}
          value={unos.opis}
          placeholder="Što, za koga, program…"
          aria-describedby="nd-opis-pomoc"
          onChange={(e) => postavi("opis", e.target.value)}
        />
        <span id="nd-opis-pomoc" className={polje.pomoc}>
          Prazan red odvaja odlomke; „- ” na početku retka je stavka popisa.
        </span>
      </div>
      <Polje
        id="nd-slika"
        oznaka="Naslovna slika: link (neobavezno)"
        type="url"
        value={unos.slika}
        placeholder="https://…"
        greska={greske.slika}
        pomoc={greske.slika ? undefined : "Kvadratna ili vodoravna slika, barem 1200 px. Vidi se u pregledu kartice."}
        onChange={(e) => postavi("slika", e.target.value)}
      />
    </div>
  );
}

// ── 4. Ulaznice ──────────────────────────────────────────────────────────────

function Korak4({
  unos,
  greske,
  postavi,
  postaviTier,
}: KorakProps & { postaviTier: (i: number, izmjena: Partial<UnosTiera>) => void }) {
  const dodaj = () => {
    postavi("tieri", [...unos.tieri, prazanTier()]);
    // novi red: fokus na njegov naziv, tablica se odscrolla do njega
    requestAnimationFrame(() => document.getElementById(`nd-tier-${unos.tieri.length}-naziv`)?.focus());
  };
  const celija = (i: number, kljuc: "naziv" | "cijena" | "kolicina", oznaka: string, dodatno: Record<string, unknown>) => {
    const g = greske[`tier.${i}.${kljuc}`];
    const id = idPolja(`tier.${i}.${kljuc}`);
    return (
      <div className={`${css.celija} ${css[`c_${kljuc}`]}`}>
        <label htmlFor={id} className={css.oznakaCelije}>
          {oznaka}
        </label>
        <input
          id={id}
          className={`${polje.unos} ${css.unosCelije}`}
          value={unos.tieri[i]![kljuc]}
          aria-invalid={g ? true : undefined}
          aria-describedby={g ? `${id}-greska` : undefined}
          onChange={(e) => postaviTier(i, { [kljuc]: e.target.value })}
          {...dodatno}
        />
        {g && (
          <span id={`${id}-greska`} className={polje.greska}>
            {g}
          </span>
        )}
      </div>
    );
  };
  return (
    <div className={css.polja}>
      {greske.tieri && <Banner ton="error">{greske.tieri}</Banner>}
      <div className={css.tierovi}>
        <div className={css.zaglavljeTablice} aria-hidden="true">
          <span>Naziv</span>
          <span>Cijena (€)</span>
          <span>Količina</span>
          <span>Imenska</span>
          <span />
        </div>
        <div className={css.tijeloTablice}>
          {unos.tieri.map((t, i) => {
            const c = centiIzUnosa(t.cijena);
            return (
              <div key={i} className={css.redTiera} role="group" aria-label={`Vrsta ulaznice ${i + 1}`}>
                {celija(i, "naziv", "Naziv", { placeholder: "npr. Parter", maxLength: 160 })}
                {celija(i, "cijena", "Cijena (€)", {
                  inputMode: "decimal",
                  placeholder: "25,00",
                  title: c !== null ? eur(c) : undefined,
                })}
                {celija(i, "kolicina", "Količina", { inputMode: "numeric", placeholder: "∞" })}
                <label className={`${css.celija} ${css.c_imenska}`} title="Kupac upisuje ime za svaku ulaznicu">
                  <input
                    type="checkbox"
                    checked={t.imenska}
                    aria-label={`Imenska (vrsta ${i + 1}): kupac upisuje ime za svaku ulaznicu`}
                    onChange={(e) => postaviTier(i, { imenska: e.target.checked })}
                  />
                  <span className={css.oznakaImenska}>Imenska</span>
                </label>
                <div className={`${css.celija} ${css.c_ukloni}`}>
                  {unos.tieri.length > 1 && (
                    <button
                      type="button"
                      className={css.ukloni}
                      aria-label={`Ukloni vrstu ulaznice ${i + 1}`}
                      title="Ukloni"
                      onClick={() => postavi("tieri", unos.tieri.filter((_, j) => j !== i))}
                    >
                      <Ikona ime="x-krug" velicina={20} />
                      <span className={css.ukloniTekst}>Ukloni</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className={css.dodajRed}>
        <button
          id="nd-dodaj-tier"
          type="button"
          className={`${gumb.gumb} ${gumb.sekundarni}`}
          disabled={unos.tieri.length >= NAJVISE_TIEROVA}
          onClick={dodaj}
        >
          + Dodaj vrstu ulaznice
        </button>
        <span className={css.mutno}>Imenska: kupac upisuje ime za svaku ulaznicu.</span>
      </div>
    </div>
  );
}

// ── 5. Pregled ───────────────────────────────────────────────────────────────

function Korak5({
  unos,
  greske,
  postavi,
  imeRacuna,
  idi,
  children,
}: KorakProps & { imeRacuna: string | null; idi: (k: Korak) => void; children: ReactNode }) {
  const pocetak = opisVremena(unos.pocetak);
  const kraj = opisVremena(unos.kraj);
  const vrsta = VRSTE.find(([v]) => v === unos.vrsta)?.[1] ?? unos.vrsta;
  const tieri = unos.tieri
    .map((t) => {
      const c = centiIzUnosa(t.cijena);
      return `${t.naziv.trim() || "bez naziva"} ${c !== null ? eur(c) : "?"}${t.kolicina.trim() ? ` × ${t.kolicina.trim()}` : ""}`;
    })
    .join(" · ");
  const redovi: Array<[Korak, string, string]> = [
    [1, "Događaj", [unos.naslov.trim() || "—", vrsta, imeRacuna].filter(Boolean).join(" · ")],
    [2, "Termin", pocetak ? (kraj ? `${pocetak} – ${kraj}` : pocetak) : "—"],
    [2, "Mjesto", [unos.mjesto.trim(), unos.adresa.trim(), unos.grad.trim()].filter(Boolean).join(", ") || "—"],
    [
      3,
      "Opis i slika",
      [unos.opis.trim() ? `opis (${unos.opis.trim().length} znakova)` : "bez opisa", unos.slika.trim() ? "sa slikom" : "bez slike"].join(
        " · ",
      ),
    ],
    [4, `Ulaznice (${unos.tieri.length})`, tieri || "—"],
  ];
  return (
    <div className={css.polja}>
      {children}
      <dl className={css.sazetak}>
        {redovi.map(([k, oznaka, vrijednost]) => (
          <div key={oznaka} className={css.sazetakRed}>
            <dt>{oznaka}</dt>
            <dd title={vrijednost}>{vrijednost}</dd>
            <button type="button" className={css.uredi} onClick={() => idi(k)} aria-label={`Uredi: ${oznaka}`}>
              Uredi
            </button>
          </div>
        ))}
      </dl>
      <fieldset className={css.skupina}>
        <legend className={css.legenda}>Kontakt za kupce (neobavezno)</legend>
        <div className={css.polja}>
          <Polje
            id="nd-organizator"
            oznaka="Ime organizatora koje kupci vide (prazno = naziv događaja)"
            value={unos.organizator}
            placeholder="npr. Udruga Prilika za Susret"
            maxLength={160}
            onChange={(e) => postavi("organizator", e.target.value)}
          />
          <div className={css.red}>
            <Polje
              id="nd-email"
              oznaka="E-mail za kupce"
              type="email"
              value={unos.email}
              autoComplete="email"
              greska={greske.email}
              onChange={(e) => postavi("email", e.target.value)}
            />
            <Polje
              id="nd-web"
              oznaka="Web"
              value={unos.web}
              placeholder="primjer.hr"
              onChange={(e) => postavi("web", e.target.value)}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
