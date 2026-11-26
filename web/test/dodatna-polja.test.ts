// Dodatna polja kupnje (Google obrazac organizatora): klijentska provjera i
// tijelo za POST /api/narudzba. Ista pravila kao provjeriOdgovore u Workeru.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ocisceniOdgovori, provjeriDodatnaPolja, type DodatnoPolje } from "../src/lib/dodatna-polja.ts";
import { greskaNarudzbe } from "../src/lib/poruke.ts";

const POLJA: DodatnoPolje[] = [
  { id: "101", naslov: "Ime i prezime", opis: null, vrsta: "tekst", obavezno: true },
  { id: "103", naslov: "Spol", opis: null, vrsta: "izbor", obavezno: true, opcije: ["Muško", "Žensko"] },
  { id: "106", naslov: "Interesi", opis: null, vrsta: "visestruki", obavezno: false, opcije: ["Glazba", "Sport"] },
];

test("obavezna polja: greška dok nisu popunjena, razmaci se ne broje", () => {
  const prazno = provjeriDodatnaPolja(POLJA, { "101": "   " });
  assert.equal(prazno.valjano, false);
  assert.deepEqual(Object.keys(prazno.greske), ["101", "103"]);
  assert.equal(prazno.greske["103"], "Odaberite odgovor.");
  assert.equal(provjeriDodatnaPolja(POLJA, { "101": "Ana", "103": "Žensko" }).valjano, true);
});

test("tijelo: bez praznih odgovora, tekst trimiran, višestruki kao niz", () => {
  assert.deepEqual(ocisceniOdgovori(POLJA, { "101": " Ana ", "103": "Žensko", "106": [] }), { "101": "Ana", "103": "Žensko" });
  assert.deepEqual(ocisceniOdgovori(POLJA, { "106": ["Sport"] }), { "106": ["Sport"] });
});

test("greška s poslužitelja cilja dodatna polja", () => {
  const g = greskaNarudzbe("dodatna_polja_neispravna");
  assert.equal(g.cilj, "dodatna");
  assert.equal(g.poruka, "Popunite obavezna dodatna polja.");
});
