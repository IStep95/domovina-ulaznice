// Testovi formatiranja (web/src/lib/format.ts): novac, datumi u zoni događaja,
// stanje tiera. Primjeri su iz dizajna (web/design/canvas/*.dc.html).
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MJESECI_KRATICE,
  TERMIN_NEPOZNAT,
  cijenaDecimalno,
  datumDijelovi,
  datumPlohe,
  eur,
  inicijali,
  kratkiDatum,
  najnizaCijena,
  prikazUrla,
  rokRezervacije,
  sigurniUrl,
  stanjeTiera,
  terminDogadjaja,
  terminJednimRetkom,
  terminKartice,
  trenutak,
  vrstaDogadjaja,
  zaglavljeGrupe,
} from "../src/lib/format.ts";

test("eur: cijeli centi → hr-HR s točkom za tisućice", () => {
  assert.equal(eur(6000), "60,00 €");
  assert.equal(eur(0), "0,00 €");
  assert.equal(eur(5), "0,05 €");
  assert.equal(eur(3500), "35,00 €");
  assert.equal(eur(123456), "1.234,56 €");
  assert.equal(eur(100000000), "1.000.000,00 €");
  assert.equal(eur(-6000), "−60,00 €");
});

test("cijenaDecimalno: schema.org price", () => {
  assert.equal(cijenaDecimalno(6000), "60.00");
  assert.equal(cijenaDecimalno(5), "0.05");
  assert.equal(cijenaDecimalno(123456), "1234.56");
  assert.equal(cijenaDecimalno(0), "0.00");
});

test("kratice mjeseci kao u dizajnu", () => {
  assert.deepEqual(MJESECI_KRATICE, ["SIJ", "VELJ", "OŽU", "TRA", "SVI", "LIP", "SRP", "KOL", "RUJ", "LIS", "STU", "PRO"]);
});

test("trenutak i datumDijelovi: u zoni događaja, ne u UTC-u", () => {
  assert.deepEqual(trenutak("2027-04-16T07:00:00Z"), { godina: 2027, mjesec: 4, dan: 16, sat: 9, minuta: 0, danUTjednu: 5 });
  assert.deepEqual(datumDijelovi("2027-04-16T07:00:00Z"), { dan: 16, mjesec: 4, godina: 2027, mjesecKratica: "TRA" });
  // 31. 12. 23:30 UTC = 1. 1. 00:30 u Zagrebu (zimsko vrijeme, +1)
  assert.deepEqual(datumDijelovi("2027-12-31T23:30:00Z"), { dan: 1, mjesec: 1, godina: 2028, mjesecKratica: "SIJ" });
  assert.equal(datumDijelovi("2027-12-31T23:30:00Z", "UTC")?.dan, 31);
  assert.equal(trenutak("2027-04-16T07:00:00Z", "America/New_York")?.sat, 3);
  assert.equal(datumDijelovi(null), null);
  assert.equal(datumDijelovi("nije datum"), null);
});

test("terminDogadjaja: višednevni sa satnicom (Dogadjaj-1280)", () => {
  assert.deepEqual(terminDogadjaja("2027-04-16T07:00:00Z", "2027-04-18T15:00:00Z"), {
    datum: "petak, 16. travnja 2027.",
    satnica: "9:00 – nedjelja, 18. travnja",
  });
});

test("terminDogadjaja: isti dan, bez kraja, bez satnice", () => {
  assert.deepEqual(terminDogadjaja("2026-11-21T18:30:00Z", "2026-11-21T21:00:00Z"), {
    datum: "subota, 21. studenoga 2026.",
    satnica: "19:30 – 22:00",
  });
  assert.equal(terminDogadjaja("2026-11-21T18:30:00Z", null)?.satnica, "19:30");
  // ponoć u Zagrebu = satnica nije objavljena (Dogadjaj-bez-prodaje-390)
  assert.deepEqual(terminDogadjaja("2026-11-20T23:00:00Z", null), {
    datum: "subota, 21. studenoga 2026.",
    satnica: "satnica još nije objavljena",
  });
  assert.equal(terminDogadjaja("2027-02-11T23:00:00Z", "2027-02-13T23:00:00Z")?.satnica, "do 14. veljače");
  assert.equal(terminDogadjaja(null, null), null);
});

test("terminDogadjaja: kraj u drugoj godini nosi godinu; kraj prije početka se ignorira", () => {
  assert.equal(terminDogadjaja("2026-12-31T20:00:00Z", "2027-01-01T02:00:00Z")?.satnica, "21:00 – petak, 1. siječnja 2027.");
  assert.equal(terminDogadjaja("2027-04-16T07:00:00Z", "2027-04-15T07:00:00Z")?.satnica, "9:00");
});

test("terminKartice: redak na popisu (Popis-1280)", () => {
  assert.equal(terminKartice("2027-04-16T07:00:00Z", "2027-04-18T15:00:00Z"), "9:00 – nedjelja, 18. travnja");
  assert.equal(terminKartice("2026-11-20T23:00:00Z", null), "satnica još nije objavljena");
  assert.equal(terminKartice("2027-02-11T23:00:00Z", "2027-02-13T23:00:00Z"), "12. – 14. veljače 2027.");
  assert.equal(terminKartice("2027-04-29T22:00:00Z", "2027-05-01T22:00:00Z"), "30. travnja – 2. svibnja 2027.");
  assert.equal(terminKartice("2026-12-30T23:00:00Z", "2027-01-01T23:00:00Z"), "31. prosinca 2026. – 2. siječnja 2027.");
  assert.equal(terminKartice(null, null), TERMIN_NEPOZNAT);
});

test("zaglavljeGrupe: godina samo kad nije tekuća", () => {
  const sada = new Date("2026-11-20T10:00:00Z");
  assert.deepEqual(zaglavljeGrupe("2026-11-20T23:00:00Z", "Europe/Zagreb", sada), {
    kljuc: "2026-11-21",
    datum: "21. studenoga",
    danUTjednu: "subota",
    godina: undefined,
  });
  assert.deepEqual(zaglavljeGrupe("2027-02-12T08:00:00Z", "Europe/Zagreb", sada), {
    kljuc: "2027-02-12",
    datum: "12. veljače",
    danUTjednu: "petak",
    godina: "2027.",
  });
  assert.equal(zaglavljeGrupe(null, "Europe/Zagreb", sada).kljuc, "bez-datuma");
});

test("datumPlohe: naslovna ploha (Dogadjaj-1280, bez-prodaje-390)", () => {
  assert.deepEqual(datumPlohe("2027-04-16T07:00:00Z", "2027-04-18T15:00:00Z"), { veliki: "16.–18.", mali: "travnja 2027." });
  assert.deepEqual(datumPlohe("2026-11-20T23:00:00Z", null), { veliki: "21.", mali: "studenoga 2026." });
  assert.deepEqual(datumPlohe("2027-04-29T22:00:00Z", "2027-05-01T22:00:00Z"), { veliki: "30.–2.", mali: "travnja – svibnja 2027." });
  assert.equal(datumPlohe(null, null), null);
});

test("kratkiDatum: početak prodaje tiera", () => {
  assert.equal(kratkiDatum("2027-03-01T09:00:00Z"), "1. 3. 2027. u 10:00");
  assert.equal(kratkiDatum("2027-02-28T23:00:00Z"), "1. 3. 2027.");
  assert.equal(kratkiDatum(null), null);
});

const tier = { sold_out: false, not_started: false, ended: false, available: null as number | null };

test("stanjeTiera: svih pet stanja RedTiera", () => {
  assert.equal(stanjeTiera(tier), "dostupno");
  assert.equal(stanjeTiera({ ...tier, available: 103 }), "dostupno");
  assert.equal(stanjeTiera({ ...tier, available: 11 }), "dostupno");
  assert.equal(stanjeTiera({ ...tier, available: 10 }), "malo");
  assert.equal(stanjeTiera({ ...tier, available: 4 }), "malo");
  assert.equal(stanjeTiera({ ...tier, sold_out: true, available: 0 }), "rasprodano");
  assert.equal(stanjeTiera({ ...tier, not_started: true }), "nije-pocelo");
  assert.equal(stanjeTiera({ ...tier, ended: true }), "zavrseno");
});

test("stanjeTiera: rasprodano ima prednost pred završenim i nepočetim", () => {
  assert.equal(stanjeTiera({ ...tier, sold_out: true, ended: true }), "rasprodano");
  assert.equal(stanjeTiera({ ...tier, sold_out: true, not_started: true }), "rasprodano");
  assert.equal(stanjeTiera({ ...tier, not_started: true, available: 3 }), "nije-pocelo");
});

test("najnizaCijena: samo tierovi koji se mogu kupiti", () => {
  assert.equal(
    najnizaCijena([
      { buyable: true, price_cents: 6000 },
      { buyable: true, price_cents: 3500 },
      { buyable: false, price_cents: 1000 },
    ]),
    3500,
  );
  assert.equal(najnizaCijena([{ buyable: false, price_cents: 2500 }]), null);
  assert.equal(najnizaCijena([]), null);
});

test("vrstaDogadjaja, inicijali", () => {
  assert.equal(vrstaDogadjaja("konferencija"), "Konferencija");
  assert.equal(vrstaDogadjaja("sportski_dogadjaj"), "Sportski dogadjaj");
  assert.equal(vrstaDogadjaja(""), null);
  assert.equal(inicijali("Udruga Prilika za Susret"), "PS");
  assert.equal(inicijali("Demo organizator"), "D");
  assert.equal(inicijali("ćuk i sova"), "Ć");
  assert.equal(inicijali(""), "?");
});

test("sigurniUrl: samo http(s), dopuna sheme", () => {
  assert.equal(sigurniUrl("https://prilikazasusret.hr/uvjeti"), "https://prilikazasusret.hr/uvjeti");
  assert.equal(sigurniUrl("prilikazasusret.hr"), "https://prilikazasusret.hr/");
  assert.equal(sigurniUrl("javascript:alert(1)"), null);
  assert.equal(sigurniUrl("data:text/html,x"), null);
  assert.equal(sigurniUrl("  "), null);
  assert.equal(sigurniUrl(null), null);
  assert.equal(prikazUrla("https://www.prilikazasusret.hr/"), "prilikazasusret.hr");
});

// ── narudžba (S5) ───────────────────────────────────────────────────────────

const ZG = "Europe/Zagreb";

test("terminJednimRetkom: sažetak narudžbe (Narudzba-1280)", () => {
  assert.equal(
    terminJednimRetkom("2027-04-16T07:00:00+00:00", "2027-04-18T16:00:00+00:00", ZG),
    "petak, 16. travnja 2027. u 9:00 – nedjelja, 18. travnja",
  );
  assert.equal(terminJednimRetkom("2027-04-16T07:00:00+00:00", "2027-04-16T16:00:00+00:00", ZG), "petak, 16. travnja 2027. u 9:00 – 18:00");
  assert.equal(terminJednimRetkom("2027-04-16T07:00:00+00:00", null, ZG), "petak, 16. travnja 2027. u 9:00");
  // kraj u drugoj godini nosi godinu; kraj prije početka se ignorira
  assert.equal(
    terminJednimRetkom("2027-12-31T07:00:00+00:00", "2028-01-02T16:00:00+00:00", ZG),
    "petak, 31. prosinca 2027. u 8:00 – nedjelja, 2. siječnja 2028.",
  );
  assert.equal(terminJednimRetkom("2027-04-16T07:00:00+00:00", "2027-04-15T07:00:00+00:00", ZG), "petak, 16. travnja 2027. u 9:00");
});

test("terminJednimRetkom: bez satnice (ponoć u zoni) → dan ili raspon dana", () => {
  // 22:00 UTC = ponoć u Zagrebu: „datum bez satnice”
  assert.equal(terminJednimRetkom("2027-04-15T22:00:00+00:00", null, ZG), "petak, 16. travnja 2027.");
  assert.equal(terminJednimRetkom("2027-04-15T22:00:00+00:00", "2027-04-17T22:00:00+00:00", ZG), "16. – 18. travnja 2027.");
  assert.equal(terminJednimRetkom("2027-04-15T22:00:00+00:00", "2027-05-01T22:00:00+00:00", ZG), "16. travnja – 2. svibnja 2027.");
});

test("terminJednimRetkom: zona događaja, zadana zona i nepoznat termin", () => {
  assert.equal(terminJednimRetkom("2027-04-16T07:00:00+00:00", null, "America/New_York"), "petak, 16. travnja 2027. u 3:00");
  assert.equal(terminJednimRetkom("2027-04-16T07:00:00+00:00", null), "petak, 16. travnja 2027. u 9:00");
  for (const los of [null, undefined, "", "nije-datum"]) assert.equal(terminJednimRetkom(los, null, ZG), TERMIN_NEPOZNAT);
});

test("rokRezervacije: danas samo sat, inače datum i sat (uvijek sa satom, i u ponoć)", () => {
  const sada = new Date("2026-11-20T13:00:00Z"); // 14:00 u Zagrebu
  assert.equal(rokRezervacije("2026-11-20T14:10:00Z", ZG, sada), "15:10");
  assert.equal(rokRezervacije("2026-11-21T14:10:00Z", ZG, sada), "21. 11. 2026. u 15:10");
  assert.equal(rokRezervacije("2026-11-19T23:00:00Z", ZG, sada), "0:00"); // ponoć 20. 11. je „danas”
  assert.equal(rokRezervacije("2026-11-20T23:00:00Z", ZG, sada), "21. 11. 2026. u 0:00");
  for (const los of [null, undefined, "", "nije-datum"]) assert.equal(rokRezervacije(los, ZG, sada), null);
});

test("rokRezervacije: „danas” je dan u zoni događaja, ne u UTC-u", () => {
  const sada = new Date("2026-11-20T13:00:00Z");
  // 23:30 UTC je u Zagrebu već sutra, u UTC-u još danas
  assert.equal(rokRezervacije("2026-11-20T23:30:00Z", ZG, sada), "21. 11. 2026. u 0:30");
  assert.equal(rokRezervacije("2026-11-20T23:30:00Z", "UTC", sada), "23:30");
  // i obrnuto: kad je u Zagrebu već 21. 11., rok 20. 11. u 23:30 više nije „danas”
  assert.equal(rokRezervacije("2026-11-20T22:30:00Z", ZG, new Date("2026-11-20T23:30:00Z")), "20. 11. 2026. u 23:30");
});
