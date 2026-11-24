// Prijava organizatora i osoblja na ulazu (S8): zajednički obrazac za
// /organizator, /organizator/novi i /skener. Prenesena iz src/pages/Prijava.tsx
// (SPA, rezerva do S9); tekstovi i tok su isti, izgled je iz dizajnerskog
// sustava (Polje, Banner, gumb.module.css).
//
// Glavni put je kod na e-mail (isti domovina.ai račun), lozinka je sporedni:
// osoblje na ulazu s tuđeg mobitela ne može čekati mail (REVIEW(fable) u
// `worker/api.ts`). „Nastavi s Googleom” ide kroz GoTrue `/authorize`
// (`/api/organizator/google`); token se vraća u fragmentu, v. src/lib/auth.ts.
//
// Namjerno bez „zapamti me”: token živi u sessionStorageu i umire sa
// zatvaranjem taba. Na ulazu se često koristi tuđi mobitel.
import { useState } from "react";
import { posaljiKod, potvrdiKod, preuzmiGoogleGresku, prijavi, prijaviGoogleom, type Sesija } from "../lib/auth.ts";
import { porukaIzGreske, porukaOrganizatora } from "../lib/poruke.ts";
import Banner from "./Banner.tsx";
import Polje from "./Polje.tsx";
import gumb from "./gumb.module.css";
import polje from "./polje.module.css";
import css from "./prijava.module.css";

export interface PrijavaProps {
  /** Nadnaslov iznad kartice: „Pregled prodaje”, „Skener ulaza”, „Novi događaj”. */
  naslov: string;
  onPrijava: (s: Sesija) => void;
  /** Poruka s kojom obrazac počinje, npr. kad je sesija istekla usred rada. */
  pocetnaGreska?: string | null;
}

type Korak = "email" | "kod" | "lozinka";

const GLAVNI = `${gumb.gumb} ${gumb.primarni} ${gumb.velik} ${gumb.blok}`;
const VEZA = `${gumb.gumb} ${gumb.tanki}`;

export default function Prijava({ naslov, onPrijava, pocetnaGreska = null }: PrijavaProps) {
  const [korak, postaviKorak] = useState<Korak>("email");
  const [email, postaviEmail] = useState("");
  const [kod, postaviKod] = useState("");
  const [lozinka, postaviLozinku] = useState("");
  const [greska, postaviGresku] = useState<string | null>(() => {
    const g = preuzmiGoogleGresku();
    return g ? porukaOrganizatora(g) : pocetnaGreska;
  });
  const [obavijest, postaviObavijest] = useState<string | null>(null);
  const [salje, postaviSalje] = useState(false);

  const posalji = (posao: () => Promise<void>) => async (e?: { preventDefault(): void }) => {
    e?.preventDefault();
    postaviGresku(null);
    postaviObavijest(null);
    postaviSalje(true);
    try {
      await posao();
    } catch (err) {
      postaviGresku(porukaIzGreske(err));
    } finally {
      postaviSalje(false);
    }
  };

  const zatraziKod = posalji(async () => {
    await posaljiKod(email.trim());
    postaviKod("");
    postaviKorak("kod");
  });

  const promijeniKorak = (k: Korak) => {
    postaviGresku(null);
    postaviObavijest(null);
    postaviKorak(k);
  };

  return (
    <div className={css.prijava}>
      <p className={css.nadnaslov}>{naslov}</p>
      <section className={css.kartica} aria-labelledby="prijava-naslov">
        <h1 id="prijava-naslov" className={css.naslov}>
          Prijava
        </h1>

        {korak === "kod" ? (
          <p className={css.uvod}>
            Poslali smo kod za prijavu na <strong>{email.trim()}</strong>. Upiši ga ispod.
          </p>
        ) : (
          <p className={css.uvod}>
            Prijavi se svojim Domovina računom — isti račun vrijedi na domovina.ai i pinka.io (jedan identitet za
            cijeli ekosustav).
          </p>
        )}

        {greska && <Banner ton="error">{greska}</Banner>}
        {obavijest && <Banner ton="ok">{obavijest}</Banner>}

        {korak === "email" && (
          <>
            <button type="button" className={`${gumb.gumb} ${gumb.sekundarni} ${gumb.velik} ${gumb.blok}`} onClick={prijaviGoogleom}>
              <GoogleLogo />
              Nastavi s Googleom
            </button>
            <div className={css.ili} aria-hidden="true">
              ili
            </div>
            <form className={css.forma} onSubmit={zatraziKod}>
              <Polje
                id="prijava-email"
                oznaka="E-mail"
                type="email"
                autoComplete="username"
                placeholder="tvoja@adresa.hr"
                value={email}
                onChange={(e) => postaviEmail(e.target.value)}
                required
              />
              <button className={GLAVNI} type="submit" disabled={salje} aria-busy={salje || undefined}>
                {salje ? "Šaljem…" : "Pošalji kod za prijavu"}
              </button>
            </form>
            <button type="button" className={VEZA} onClick={() => promijeniKorak("lozinka")}>
              Prijava lozinkom
            </button>
          </>
        )}

        {korak === "kod" && (
          <>
            <form className={css.forma} onSubmit={posalji(async () => onPrijava(await potvrdiKod(email.trim(), kod)))}>
              <div className={polje.polje}>
                <label htmlFor="prijava-kod" className={polje.oznaka}>
                  Kod iz e-maila
                </label>
                <input
                  id="prijava-kod"
                  className={`${polje.unos} ${css.kod}`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={kod}
                  onChange={(e) => postaviKod(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <button
                className={GLAVNI}
                type="submit"
                disabled={salje || kod.replace(/\s/g, "").length < 6}
                aria-busy={salje || undefined}
              >
                {salje ? "Prijava…" : "Prijavi se"}
              </button>
            </form>
            <div className={css.veze}>
              <button
                type="button"
                className={VEZA}
                disabled={salje}
                onClick={posalji(async () => {
                  await posaljiKod(email.trim());
                  postaviObavijest("Poslali smo novi kod.");
                })}
              >
                Pošalji novi kod
              </button>
              <button type="button" className={VEZA} onClick={() => promijeniKorak("email")}>
                Promijeni e-mail
              </button>
            </div>
          </>
        )}

        {korak === "lozinka" && (
          <>
            <form className={css.forma} onSubmit={posalji(async () => onPrijava(await prijavi(email.trim(), lozinka)))}>
              <Polje
                id="prijava-email"
                oznaka="E-mail"
                type="email"
                autoComplete="username"
                placeholder="tvoja@adresa.hr"
                value={email}
                onChange={(e) => postaviEmail(e.target.value)}
                required
              />
              <Polje
                id="prijava-lozinka"
                oznaka="Lozinka"
                type="password"
                autoComplete="current-password"
                value={lozinka}
                onChange={(e) => postaviLozinku(e.target.value)}
                required
              />
              <button
                className={GLAVNI}
                type="submit"
                disabled={salje || !email || lozinka.length < 6}
                aria-busy={salje || undefined}
              >
                {salje ? "Prijava…" : "Prijavi se"}
              </button>
            </form>
            <button type="button" className={VEZA} onClick={() => promijeniKorak("email")}>
              Prijava kodom na e-mail
            </button>
          </>
        )}
      </section>
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
