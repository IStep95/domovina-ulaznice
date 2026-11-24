// Nacrt wizarda (web/src/lib/nacrt.ts, S8): serijalizacija i učitavanje iz
// localStoragea (i kad storage baca), te korak iz `?korak=N` ograničen prvim
// nevaljanim korakom. Bez mreže i bez preglednika: storage je običan objekt.
import { test } from "node:test";
import assert from "node:assert/strict";

import { prazanUnos, type UnosDogadjaja } from "../src/lib/editor.ts";
import {
  KLJUC_NACRTA,
  korakIzUpita,
  korakIzUrla,
  nacrtIzTeksta,
  nacrtUTekst,
  obrisiNacrt,
  spremiNacrt,
  ucitajNacrt,
  urlKoraka,
  type Nacrt,
  type Spremiste,
} from "../src/lib/nacrt.ts";

const EMAIL = "ivan@primjer.hr";
const ID = "3f2a9c1e-0000-4000-8000-000000000001";

const valjan = (): UnosDogadjaja => ({
  ...prazanUnos(),
  accountId: "a1",
  naslov: "Susret 2027",
  pocetak: "2027-04-16T09:00",
  mjesto: "Dvorana",
  grad: "Zagreb",
  tieri: [{ naziv: "Redovna", cijena: "60", kolicina: "300", imenska: true }],
});

const nacrt = (izmjene: Partial<Nacrt> = {}): Nacrt => ({ email: EMAIL, eventId: ID, unos: valjan(), posjeceno: 4, ...izmjene });

function memorija(): Spremiste & { podaci: Map<string, string> } {
  const podaci = new Map<string, string>();
  return {
    podaci,
    getItem: (k) => podaci.get(k) ?? null,
    setItem: (k, v) => void podaci.set(k, v),
    removeItem: (k) => void podaci.delete(k),
  };
}

const bacajuci: Spremiste = {
  getItem: () => {
    throw new Error("SecurityError");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
  removeItem: () => {
    throw new Error("SecurityError");
  },
};

test("nacrt: tekst i natrag daju isti nacrt", () => {
  const n = nacrt();
  assert.deepEqual(nacrtIzTeksta(nacrtUTekst(n), EMAIL), n);
  // e-mail se uspoređuje bez obzira na velika slova
  assert.deepEqual(nacrtIzTeksta(nacrtUTekst(n), "IVAN@primjer.hr"), n);
});

test("nacrt: prazno, neispravan JSON, druga verzija, tuđi e-mail i loš id → null", () => {
  assert.equal(nacrtIzTeksta(null, EMAIL), null);
  assert.equal(nacrtIzTeksta("", EMAIL), null);
  assert.equal(nacrtIzTeksta("{", EMAIL), null);
  assert.equal(nacrtIzTeksta("[]", EMAIL), null);
  assert.equal(nacrtIzTeksta(JSON.stringify({ ...JSON.parse(nacrtUTekst(nacrt())), v: 2 }), EMAIL), null);
  assert.equal(nacrtIzTeksta(nacrtUTekst(nacrt()), "drugi@primjer.hr"), null);
  assert.equal(nacrtIzTeksta(nacrtUTekst(nacrt({ eventId: "nije-uuid" })), EMAIL), null);
});

test("nacrt: ručno pokvaren unos se svodi na očekivane tipove", () => {
  const sirovo = JSON.stringify({
    v: 1,
    email: EMAIL,
    eventId: ID,
    posjeceno: 9,
    unos: { naslov: 42, vrsta: "", tieri: [{ naziv: "A", cijena: 5, imenska: "da" }, null], opis: "x".repeat(30_000) },
  });
  const n = nacrtIzTeksta(sirovo, EMAIL)!;
  assert.equal(n.posjeceno, 1);
  assert.equal(n.unos.naslov, "");
  assert.equal(n.unos.vrsta, "koncert");
  assert.equal(n.unos.accountId, "");
  assert.equal(n.unos.opis.length, 20_000);
  assert.deepEqual(n.unos.tieri, [
    { naziv: "A", cijena: "", kolicina: "", imenska: false },
    { naziv: "", cijena: "", kolicina: "", imenska: false },
  ]);
  // bez tierova u zapisu → jedan prazan, kao nova forma
  const bez = nacrtIzTeksta(JSON.stringify({ v: 1, email: EMAIL, eventId: ID, unos: {} }), EMAIL)!;
  assert.equal(bez.unos.tieri.length, 1);
});

test("nacrt: najviše 50 tierova iz storagea", () => {
  const n = nacrt({ unos: { ...valjan(), tieri: Array.from({ length: 80 }, () => ({ naziv: "A", cijena: "1", kolicina: "", imenska: false })) } });
  assert.equal(nacrtIzTeksta(nacrtUTekst(n), EMAIL)!.unos.tieri.length, 50);
});

test("spremi, učitaj, obriši kroz storage", () => {
  const s = memorija();
  assert.equal(ucitajNacrt(EMAIL, s), null);
  assert.equal(spremiNacrt(nacrt(), s), true);
  assert.ok(s.podaci.has(KLJUC_NACRTA));
  assert.deepEqual(ucitajNacrt(EMAIL, s), nacrt());
  assert.equal(ucitajNacrt("drugi@primjer.hr", s), null);
  obrisiNacrt(s);
  assert.equal(ucitajNacrt(EMAIL, s), null);
});

test("storage koji baca ili ne postoji: wizard radi bez nacrta", () => {
  assert.equal(ucitajNacrt(EMAIL, bacajuci), null);
  assert.equal(spremiNacrt(nacrt(), bacajuci), false);
  assert.doesNotThrow(() => obrisiNacrt(bacajuci));
  assert.equal(ucitajNacrt(EMAIL, null), null);
  assert.equal(spremiNacrt(nacrt(), null), false);
  assert.doesNotThrow(() => obrisiNacrt(null));
  // u Nodeu bez --localstorage-file zadani storage ne postoji ili baca: isto ponašanje
  assert.doesNotThrow(() => ucitajNacrt(EMAIL));
  assert.doesNotThrow(() => obrisiNacrt());
});

test("korak iz upita: 1–5, sve ostalo je 1", () => {
  assert.equal(korakIzUpita(""), 1);
  assert.equal(korakIzUpita("?korak=3"), 3);
  assert.equal(korakIzUpita("?x=1&korak=5"), 5);
  for (const los of ["?korak=0", "?korak=6", "?korak=2.5", "?korak=abc", "?korak=", "?korak=-1"]) assert.equal(korakIzUpita(los), 1, los);
});

test("korak iz URL-a ne preskače prvi nevaljani korak", () => {
  assert.equal(korakIzUrla("?korak=5", prazanUnos()), 1);
  assert.equal(korakIzUrla("?korak=5", valjan()), 5);
  assert.equal(korakIzUrla("?korak=3", valjan()), 3);
  assert.equal(korakIzUrla("?korak=5", { ...valjan(), grad: "" }), 2);
  assert.equal(korakIzUrla("?korak=5", { ...valjan(), tieri: [] }), 4);
  assert.equal(korakIzUrla("?korak=2", { ...valjan(), tieri: [] }), 2);
});

test("URL koraka čuva ostale parametre", () => {
  assert.equal(urlKoraka("/organizator/novi", "", 2), "/organizator/novi?korak=2");
  assert.equal(urlKoraka("/organizator/novi", "?korak=4&utm=x", 1), "/organizator/novi?korak=1&utm=x");
  assert.equal(urlKoraka("/organizator/novi", "?utm=x", 5), "/organizator/novi?utm=x&korak=5");
});
