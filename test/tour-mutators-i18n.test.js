// test/tour-mutators-i18n.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

const IDS = ["surcharge", "blocs_lourds", "frais_gaz", "chiffrement", "resonance", "fork", "affinite"];
const STATS = ["hp", "atk", "def", "spd", "mag", "crit", "typeBonus", "typeMalus"];
const TYPES = ["HASH", "MINING", "LEDGER", "NETWORK", "BLOCK", "GENESIS"];

function bloc(cle) {
  const re = new RegExp("\\b" + cle + ":\\s*\\{[^}]*\\}");
  const m = SRC.match(re);
  return m ? m[0] : null;
}

test("MUT_TITLE présent dans les 3 langues", () => {
  const b = bloc("MUT_TITLE");
  assert.ok(b, "MUT_TITLE absent");
  for (const lang of ["FR", "EN", "ZH"]) assert.match(b, new RegExp(lang + ":"), `${lang} manquant`);
});

test("un nom par mutateur, dans les 3 langues", () => {
  for (const id of IDS) {
    const cle = "MUT_NAME_" + id.toUpperCase();
    const b = bloc(cle);
    assert.ok(b, `${cle} absent`);
    for (const lang of ["FR", "EN", "ZH"]) {
      assert.match(b, new RegExp(lang + ":\\s*\"[^\"]+\""), `${cle} : ${lang} vide ou manquant`);
    }
  }
});

test("un nom par stat affichable, dans les 3 langues", () => {
  for (const s of STATS) {
    const cle = "MUT_STAT_" + s.toUpperCase();
    const b = bloc(cle);
    assert.ok(b, `${cle} absent`);
    for (const lang of ["FR", "EN", "ZH"]) {
      assert.match(b, new RegExp(lang + ":\\s*\"[^\"]+\""), `${cle} : ${lang} vide ou manquant`);
    }
  }
});

test("un nom par type de créature, dans les 3 langues", () => {
  for (const t of TYPES) {
    const cle = "MUT_TYPE_" + t;
    const b = bloc(cle);
    assert.ok(b, `${cle} absent`);
    for (const lang of ["FR", "EN", "ZH"]) {
      assert.match(b, new RegExp(lang + ":\\s*\"[^\"]+\""), `${cle} : ${lang} vide ou manquant`);
    }
  }
});

test("MUT_AFFINITY_LINE présent avec 2 placeholders %s", () => {
  const b = bloc("MUT_AFFINITY_LINE");
  assert.ok(b, "MUT_AFFINITY_LINE absent");
  for (const lang of ["FR", "EN", "ZH"]) {
    const m = b.match(new RegExp(lang + ':\\s*"([^"]+)"'));
    assert.ok(m, `${lang} manquant`);
    assert.strictEqual((m[1].match(/%s/g) || []).length, 2, `${lang} : attendu 2 %s, trouvé dans "${m[1]}"`);
  }
});

test("aucune valeur numérique du catalogue en dur dans les clés MUT_*", () => {
  // Les chiffres viennent du serveur (formatMutator) — les dupliquer ici
  // recréerait la classe de bug par dérive que ce design supprime.
  for (const id of IDS) {
    const b = bloc("MUT_NAME_" + id.toUpperCase());
    assert.doesNotMatch(b, /\d+\s*%/, `MUT_NAME_${id.toUpperCase()} contient un pourcentage en dur`);
  }
});
