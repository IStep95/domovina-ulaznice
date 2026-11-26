// Editor događaja (wizard /organizator/novi, S8): pretvorbe forme u zahtjev,
// validacija po koraku, korak za grešku jezgre i podaci živog pregleda kartice.
// Prvih pet testova su preneseni iz worker-tests/editor.test.ts (SPA) i moraju
// ostati isti: payload prema events-organizer se ne mijenja.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  KORACI,
  centiIzUnosa,
  korakPolja,
  korakZaKod,
  najdaljiDopusteni,
  podaciPregleda,
  prazanTier,
  prazanUnos,
  provjeri,
  prviNevaljaniKorak,
  validirajKorak,
  unosIzCenti,
  unosIzSkice,
  utcUZidnoVrijeme,
  zahtjev,
  zahtjevIzmjene,
  type Skica,
  zidnoVrijemeUUtc,
  type UnosDogadjaja,
} from "../src/lib/editor.ts";
import { PORUKE_ORGANIZATORA } from "../src/lib/poruke.ts";

test("cijena: hrvatski zapis u cijele cente, bez floata", () => {
  assert.equal(centiIzUnosa("25"), 2500);
  assert.equal(centiIzUnosa("25,5"), 2550);
  assert.equal(centiIzUnosa("25,50 €"), 2550);
  assert.equal(centiIzUnosa("0,10"), 10);
  assert.equal(centiIzUnosa("1.250,00"), 125000);
  assert.equal(centiIzUnosa("0"), 0);
  // 0,29 i 1.234,57 su klasične float zamke (0.29 * 100 = 28.999…)
  assert.equal(centiIzUnosa("0,29"), 29);
  assert.equal(centiIzUnosa("1.234,57"), 123457);
  assert.equal(centiIzUnosa("9.999.999,99"), 999_999_999);
  for (const los of ["", "abc", "25.5", "25,555", "-5", "1,2,3", "10.000.000,00"]) assert.equal(centiIzUnosa(los), null, los);
});

test("vrijeme: zidni sat u Zagrebu → UTC, i zimi i ljeti", () => {
  assert.equal(zidnoVrijemeUUtc("2027-01-15T20:00"), "2027-01-15T19:00:00.000Z");
  assert.equal(zidnoVrijemeUUtc("2027-07-15T20:00"), "2027-07-15T18:00:00.000Z");
  // dan prelaska na ljetno (28. 3. 2027.)
  assert.equal(zidnoVrijemeUUtc("2027-03-28T12:00"), "2027-03-28T10:00:00.000Z");
  assert.equal(zidnoVrijemeUUtc("nije datum"), null);
});

const unos = (izmjene: Partial<UnosDogadjaja> = {}): UnosDogadjaja => ({
  accountId: "00000000-0000-4000-8000-0000000000d2",
  naslov: "Koncert u parku",
  vrsta: "koncert",
  pocetak: "2027-06-01T20:00",
  kraj: "2027-06-01T22:30",
  mjesto: "Park Maksimir",
  adresa: "",
  grad: "Zagreb",
  opis: "",
  slika: "",
  galerija: [],
  online: false,
  onlineLink: "",
  besplatan: false,
  obrazac: "",
  organizator: "",
  email: "",
  web: "",
  tieri: [{ naziv: "Ulaz", cijena: "15", kolicina: "200", imenska: false }],
  ...izmjene,
});

test("dodatna polja: link obrasca se provjeri na koraku 4 i ide u tijelo samo kad postoji", () => {
  assert.equal(validirajKorak(4, unos({ obrazac: "https://forms.gle/AbC123" })).obrazac, undefined);
  assert.equal(validirajKorak(4, unos({ obrazac: "https://docs.google.com/forms/d/e/1FAIpQLSe_x-y/viewform" })).obrazac, undefined);
  assert.ok(validirajKorak(4, unos({ obrazac: "https://docs.google.com/forms/d/1abc/edit" })).obrazac, "link za uređivanje");
  assert.ok(validirajKorak(4, unos({ obrazac: "https://example.com/forma" })).obrazac);
  assert.equal(korakPolja("obrazac"), 4);
  assert.equal(korakZaKod("obrazac_trazi_prijavu"), 4);

  assert.ok(!("form_url" in zahtjev(unos(), "e")), "bez obrasca novi događaj ne šalje form_url");
  assert.equal(zahtjev(unos({ obrazac: " https://forms.gle/AbC123 " }), "e").form_url, "https://forms.gle/AbC123");
  // u izmjeni prazno znači „makni obrazac”
  assert.equal(zahtjevIzmjene(unos(), []).form_url, "");
});

test("provjera: ispravan unos nema grešaka, prazan ima sve obavezne", () => {
  assert.deepEqual(provjeri(unos()), {});
  const g = provjeri(unos({ accountId: "", naslov: " ", pocetak: "", mjesto: "", grad: "", tieri: [] }));
  for (const k of ["accountId", "naslov", "pocetak", "mjesto", "grad", "tieri"]) assert.ok(g[k], k);
});

test("provjera: kraj prije početka, loša slika i loša cijena ulaznice", () => {
  const g = provjeri(
    unos({ kraj: "2027-06-01T19:00", slika: "http://nesigurno.hr/a.jpg", tieri: [{ ...prazanTier(), naziv: "A", cijena: "x" }] }),
  );
  assert.ok(g.kraj);
  assert.ok(g.slika);
  assert.ok(g["tier.0.cijena"]);
});

test("zahtjev: centi, UTC, prazna polja kao null, količina prazna = neograničeno", () => {
  const z = zahtjev(unos({ tieri: [{ naziv: " Parter ", cijena: "25,50", kolicina: "", imenska: true }] }), "id-1");
  assert.equal(z.event_id, "id-1");
  assert.equal(z.starts_at, "2027-06-01T18:00:00.000Z");
  assert.equal(z.timezone, "Europe/Zagreb");
  assert.equal(z.venue_address, null);
  assert.deepEqual(z.tiers, [{ title: "Parter", price_cents: 2550, inventory_total: null, imenska: true }]);
});

test("zahtjev: polja SPA-e + galerija (ugovor s events-organizer)", () => {
  const z = zahtjev(unos({ adresa: " Maksimirska 1 ", opis: "Opis", slika: "https://x.hr/a.jpg", web: "primjer.hr" }), "id-2");
  assert.deepEqual(Object.keys(z).sort(), [
    "account_id",
    "attendance_mode",
    "cover_image_url",
    "description_hr",
    "ends_at",
    "event_id",
    "event_type",
    "gallery",
    "online_url",
    "organizer_email",
    "organizer_name",
    "organizer_web",
    "starts_at",
    "tiers",
    "timezone",
    "title",
    "venue_address",
    "venue_city",
    "venue_name",
  ]);
  assert.equal(z.venue_address, "Maksimirska 1");
  assert.equal(z.ends_at, "2027-06-01T20:30:00.000Z");
  assert.equal(z.organizer_name, null);
  assert.deepEqual(z.tiers, [{ title: "Ulaz", price_cents: 1500, inventory_total: 200, imenska: false }]);
  assert.equal(zahtjev(unos({ kraj: "" }), "id-3").ends_at, null);
});

test("zahtjev: galerija redom kao lista {url}, bez alt teksta", () => {
  const z = zahtjev(unos({ galerija: [" https://x.hr/1.webp ", "https://x.hr/2.webp"] }), "id-4");
  assert.deepEqual(z.gallery, [{ url: "https://x.hr/1.webp" }, { url: "https://x.hr/2.webp" }]);
  assert.ok(!("cover_image_alt" in z));
  assert.deepEqual(zahtjev(unos(), "id-6").gallery, []);
});

test("provjera galerije: samo https, najviše 20; sve je korak 3", () => {
  const g = provjeri(unos({ galerija: ["http://x.hr/1.jpg", "https://x.hr/2.jpg"] }));
  assert.deepEqual(Object.keys(g), ["galerija.0"]);
  assert.equal(korakPolja("galerija.0"), 3);
  assert.ok(provjeri(unos({ galerija: Array.from({ length: 21 }, (_, i) => `https://x.hr/${i}.jpg`) })).galerija);
  for (const kod of ["invalid_gallery", "invalid_gallery_url"]) assert.equal(korakZaKod(kod), 3, kod);
});

// ── validacija po koraku ────────────────────────────────────────────────────

test("validirajKorak: svaki korak vidi samo svoja polja", () => {
  const sve = unos({
    accountId: "",
    naslov: "",
    pocetak: "",
    mjesto: "",
    grad: "",
    slika: "ftp://x",
    tieri: [{ naziv: "", cijena: "", kolicina: "x", imenska: false }],
    email: "nije-mail",
  });
  assert.deepEqual(Object.keys(validirajKorak(1, sve)).sort(), ["accountId", "naslov"]);
  assert.deepEqual(Object.keys(validirajKorak(2, sve)).sort(), ["grad", "mjesto", "pocetak"]);
  assert.deepEqual(Object.keys(validirajKorak(3, sve)), ["slika"]);
  assert.deepEqual(Object.keys(validirajKorak(4, sve)).sort(), ["tier.0.cijena", "tier.0.kolicina", "tier.0.naziv"]);
  assert.deepEqual(Object.keys(validirajKorak(5, sve)), ["email"]);
  // provjeri = unija koraka; svaki ključ pripada koraku koji ga je dao
  const g = provjeri(sve);
  assert.equal(Object.keys(g).length, 2 + 3 + 1 + 3 + 1);
  for (const k of KORACI) for (const kljuc of Object.keys(validirajKorak(k.broj, sve))) assert.equal(korakPolja(kljuc), k.broj, kljuc);
});

test("validirajKorak: neobavezni koraci 3 i 5 su prazni valjani", () => {
  const u = unos();
  assert.deepEqual(validirajKorak(3, u), {});
  assert.deepEqual(validirajKorak(5, u), {});
  assert.deepEqual(validirajKorak(5, unos({ email: "info@primjer.hr" })), {});
});

test("validirajKorak 1: naziv do 160 znakova, vrsta iz popisa", () => {
  assert.ok(validirajKorak(1, unos({ naslov: "a".repeat(161) })).naslov);
  assert.deepEqual(validirajKorak(1, unos({ naslov: "a".repeat(160) })), {});
  assert.ok(validirajKorak(1, unos({ vrsta: "rave" })).vrsta);
});

test("validirajKorak 2: kraj nakon početka, kraj neobavezan, duljine mjesta i grada", () => {
  assert.deepEqual(validirajKorak(2, unos({ kraj: "" })), {});
  assert.ok(validirajKorak(2, unos({ kraj: "2027-06-01T20:00" })).kraj, "kraj = početak");
  assert.ok(validirajKorak(2, unos({ kraj: "nije" })).kraj);
  assert.equal(validirajKorak(2, unos({ pocetak: "2027-06-01", kraj: "" })).pocetak, "Neispravan datum.");
  assert.ok(validirajKorak(2, unos({ mjesto: "m".repeat(161) })).mjesto);
  assert.ok(validirajKorak(2, unos({ grad: "g".repeat(81) })).grad);
});

test("validirajKorak 4: bez tierova, previše tierova, količina cijeli broj", () => {
  assert.ok(validirajKorak(4, unos({ tieri: [] })).tieri);
  const tier = { naziv: "A", cijena: "1", kolicina: "", imenska: false };
  assert.ok(validirajKorak(4, unos({ tieri: Array.from({ length: 51 }, () => tier) })).tieri);
  assert.deepEqual(validirajKorak(4, unos({ tieri: Array.from({ length: 50 }, () => tier) })), {});
  assert.ok(validirajKorak(4, unos({ tieri: [{ ...tier, kolicina: "1,5" }] }))["tier.0.kolicina"]);
  assert.ok(validirajKorak(4, unos({ tieri: [tier, { ...tier, cijena: "" }] }))["tier.1.cijena"]);
});

test("prvi nevaljani korak i najdalji dopušteni", () => {
  assert.equal(prviNevaljaniKorak(unos()), null);
  assert.equal(najdaljiDopusteni(unos()), 5);
  assert.equal(prviNevaljaniKorak(prazanUnos()), 1);
  assert.equal(najdaljiDopusteni(prazanUnos()), 1);
  assert.equal(prviNevaljaniKorak(unos({ grad: "" })), 2);
  assert.equal(prviNevaljaniKorak(unos({ slika: "http://x" })), 3);
  assert.equal(prviNevaljaniKorak(unos({ tieri: [prazanTier()] })), 4);
  assert.equal(prviNevaljaniKorak(unos({ email: "x" })), 5);
  assert.equal(najdaljiDopusteni(unos({ email: "x" })), 5);
});

test("korakZaKod: greške jezgre vode na svoj korak, ostale ostaju na pregledu", () => {
  assert.equal(korakZaKod("slug_collision"), 1);
  assert.equal(korakZaKod("invalid_title"), 1);
  assert.equal(korakZaKod("invalid_dates"), 2);
  assert.equal(korakZaKod("invalid_venue_city"), 2);
  assert.equal(korakZaKod("invalid_cover_url"), 3);
  assert.equal(korakZaKod("invalid_tier_price"), 4);
  assert.equal(korakZaKod("invalid_tiers"), 4);
  assert.equal(korakZaKod("nema_prava_kreiranja"), null);
  assert.equal(korakZaKod("mrezna_greska"), null);
  // svaki kod s korakom ima i poruku (inače bi organizator vidio generičku)
  for (const kod of ["slug_collision", "invalid_title", "invalid_account_id", "invalid_event_type", "invalid_venue_name",
    "invalid_venue_city", "invalid_dates", "invalid_cover_url", "invalid_description", "invalid_tiers",
    "invalid_tier_title", "invalid_tier_price", "invalid_tier_inventory"]) {
    assert.ok(korakZaKod(kod), kod);
    assert.ok(Object.hasOwn(PORUKE_ORGANIZATORA, kod), kod);
  }
});

// ── živi pregled kartice ────────────────────────────────────────────────────

test("podaciPregleda: prazan unos ima zamjenski naslov i bez cijene", () => {
  const p = podaciPregleda(prazanUnos(), new Date("2026-11-24T12:00:00Z"));
  assert.equal(p.bezNaslova, true);
  assert.equal(p.naslov, "Naziv događaja");
  assert.equal(p.startsAt, null);
  assert.equal(p.termin, "termin još nije objavljen");
  assert.equal(p.cijenaOdCenti, null);
  assert.equal(p.mjesto, null);
  assert.equal(p.organizator, null);
  assert.equal(p.vrsta, "Koncert");
  assert.equal(p.slika, null);
});

test("podaciPregleda: najniža valjana cijena u centima, termin, mjesto i organizator", () => {
  const p = podaciPregleda(
    unos({
      tieri: [
        { naziv: "Parter", cijena: "25,50", kolicina: "", imenska: false },
        { naziv: "Rani", cijena: "19,90", kolicina: "", imenska: false },
        { naziv: "Loša", cijena: "x", kolicina: "", imenska: false },
      ],
      slika: "https://x.hr/a.jpg",
    }),
    new Date("2026-11-24T12:00:00Z"),
  );
  assert.equal(p.cijenaOdCenti, 1990);
  assert.equal(p.startsAt, "2027-06-01T18:00:00.000Z");
  assert.equal(p.termin, "20:00 – 22:30");
  assert.equal(p.zaglavlje.datum, "1. lipnja");
  assert.equal(p.zaglavlje.godina, "2027.");
  assert.equal(p.mjesto, "Park Maksimir, Zagreb");
  // bez imena organizatora jezgra sprema naziv događaja (coalesce u create_event)
  assert.equal(p.organizator, "Koncert u parku");
  assert.equal(p.slika, "https://x.hr/a.jpg");
  assert.equal(podaciPregleda(unos({ organizator: " PzS " })).organizator, "PzS");
  assert.equal(podaciPregleda(unos({ slika: "http://x.hr/a.jpg" })).slika, null);
});

// ── uređivanje skice ────────────────────────────────────────────────────────

test("utcUZidnoVrijeme je obrat zidnoVrijemeUUtc, i zimi i ljeti", () => {
  for (const z of ["2027-01-15T20:00", "2027-07-15T20:00", "2027-03-28T12:00"]) {
    assert.equal(utcUZidnoVrijeme(zidnoVrijemeUUtc(z)), z);
  }
  assert.equal(utcUZidnoVrijeme("2027-05-10T18:00:00+00:00"), "2027-05-10T20:00");
  assert.equal(utcUZidnoVrijeme(null), "");
  assert.equal(utcUZidnoVrijeme("nije datum"), "");
});

test("unosIzCenti je obrat centiIzUnosa", () => {
  for (const c of [0, 5, 1500, 2550, 2505, 123457]) assert.equal(centiIzUnosa(unosIzCenti(c)), c, String(c));
  assert.equal(unosIzCenti(2550), "25,50");
  assert.equal(unosIzCenti(1500), "15");
});

const skica = (izmjene: Partial<Skica> = {}): Skica => ({
  campaign_id: "c1",
  account_id: "a1",
  slug: "koncert",
  title: "Koncert",
  state: "draft",
  event: {
    event_type: "koncert",
    venue_name: "Dvorana",
    venue_address: null,
    venue_city: "Zagreb",
    starts_at: "2027-06-01T18:00:00+00:00",
    ends_at: null,
    timezone: "Europe/Zagreb",
    description_hr: "Opis",
    cover_image_url: "https://x.hr/a.webp",
    gallery: [{ url: "https://x.hr/1.webp" }, { url: 5 }],
    organizer_name: "Koncert",
    organizer_email: null,
    organizer_web: null,
  },
  tiers: [
    { id: "t1", title: "Parter", price_cents: 2550, inventory_total: null, imenska: true },
    { id: "t2", title: "VIP", price_cents: 5000, inventory_total: 20, imenska: false },
  ],
  ...izmjene,
});

test("unosIzSkice: forma kakvu bi organizator upisao, vrste s id-em", () => {
  const u = unosIzSkice(skica());
  assert.equal(u.pocetak, "2027-06-01T20:00");
  assert.equal(u.kraj, "");
  assert.equal(u.adresa, "");
  assert.equal(u.organizator, "", "ime jednako naslovu je zamjena jezgre, ne upis");
  assert.deepEqual(u.galerija, ["https://x.hr/1.webp"]);
  assert.deepEqual(u.tieri, [
    { id: "t1", naziv: "Parter", cijena: "25,50", kolicina: "", imenska: true },
    { id: "t2", naziv: "VIP", cijena: "50", kolicina: "20", imenska: false },
  ]);
  assert.deepEqual(provjeri(u), {});
  assert.equal(unosIzSkice(skica({ tiers: [] })).tieri.length, 1);
});

test("zahtjevIzmjene: id-evi i redoslijed vrsta, maknute u remove_tier_ids, prazna polja kao ''", () => {
  const u = unosIzSkice(skica());
  const z = zahtjevIzmjene(
    { ...u, opis: "", slika: "", tieri: [u.tieri[1]!, { naziv: "Novi", cijena: "10", kolicina: "", imenska: false }] },
    ["t1", "t2"],
  );
  assert.ok(!("event_id" in z) && !("account_id" in z));
  assert.equal(z.description_hr, "");
  assert.equal(z.cover_image_url, "");
  assert.equal(z.venue_address, "");
  assert.deepEqual(z.tiers, [
    { id: "t2", title: "VIP", price_cents: 5000, inventory_total: 20, imenska: false, sort: 0 },
    { title: "Novi", price_cents: 1000, inventory_total: null, imenska: false, sort: 1 },
  ]);
  assert.deepEqual(z.remove_tier_ids, ["t1"]);
  assert.deepEqual(z.gallery, [{ url: "https://x.hr/1.webp" }]);
});

// ── Besplatni i online (2026-11-25) ─────────────────────────────────────────

test("online: mjesto i grad nisu obavezni, link samo https", () => {
  assert.deepEqual(validirajKorak(2, unos({ online: true, mjesto: "", grad: "" })), {});
  assert.ok(validirajKorak(2, unos({ online: true, onlineLink: "http://meet.example.com" })).onlineLink);
  assert.deepEqual(validirajKorak(2, unos({ online: true, onlineLink: "https://meet.example.com/x" })), {});
  // fizički i dalje traži mjesto i grad
  const g = validirajKorak(2, unos({ mjesto: "", grad: "" }));
  assert.ok(g.mjesto && g.grad);
  assert.equal(korakPolja("onlineLink"), 2);
  assert.equal(korakZaKod("invalid_online_url"), 2);
  assert.equal(korakZaKod("invalid_attendance_mode"), 2);
});

test("online: zahtjev nosi način i link; fizički ne šalje link", () => {
  const z = zahtjev(unos({ online: true, mjesto: "", grad: "", onlineLink: " https://meet.example.com/x " }), "e");
  assert.equal(z.attendance_mode, "online");
  assert.equal(z.online_url, "https://meet.example.com/x");
  assert.equal(z.venue_name, "");
  const f = zahtjev(unos({ onlineLink: "https://zaostalo.example.com" }), "e");
  assert.equal(f.attendance_mode, "physical");
  assert.equal(f.online_url, null);
  assert.equal(podaciPregleda(unos({ online: true })).mjesto, "Online");
});

test("besplatan: cijena se ne traži, sve vrste idu po 0 centi", () => {
  const u = unos({ besplatan: true, tieri: [{ naziv: "Ulaz", cijena: "", kolicina: "", imenska: false }] });
  assert.deepEqual(validirajKorak(4, u), {});
  const tiers = zahtjev(u, "e").tiers as Array<{ price_cents: number }>;
  assert.deepEqual(tiers.map((t) => t.price_cents), [0]);
  assert.equal(podaciPregleda(u).cijenaOdCenti, 0);
});

test("komercijalni: cijena 0 je greška koja upućuje na „Besplatan”", () => {
  const g = validirajKorak(4, unos({ tieri: [{ naziv: "Ulaz", cijena: "0", kolicina: "", imenska: false }] }));
  assert.match(g["tier.0.cijena"]!, /Besplatan/);
});

test("skica: online i besplatna se vraćaju u formu bez zamjenskog „Online”", () => {
  const u = unosIzSkice({
    campaign_id: "c",
    account_id: "a",
    slug: "s",
    title: "Webinar",
    state: "draft",
    event: {
      venue_name: "Online",
      venue_city: "Online",
      attendance_mode: "online",
      online_url: "https://meet.example.com/x",
    },
    tiers: [{ id: "t1", title: "Ulaz", price_cents: 0, inventory_total: null, imenska: false }],
  });
  assert.equal(u.online, true);
  assert.equal(u.mjesto, "");
  assert.equal(u.grad, "");
  assert.equal(u.onlineLink, "https://meet.example.com/x");
  assert.equal(u.besplatan, true);
  assert.equal(u.tieri[0]!.cijena, "");
  // izmjena: prelazak na fizički briše link
  const z = zahtjevIzmjene({ ...u, online: false, mjesto: "Dvorana", grad: "Split" }, ["t1"]);
  assert.equal(z.online_url, "");
  assert.equal(z.attendance_mode, "physical");
});
