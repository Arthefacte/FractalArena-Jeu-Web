"use strict";
// Wiring des actions coreSummon / coreEquip — mêmes patterns que
// relicSummon / relicEquip (pattern de test/discovery-wiring.test.js).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

function bloc(nom, taille = 1600) {
  const i = APP.indexOf("async " + nom);
  assert.ok(i > 0, `action ${nom} absente`);
  return APP.slice(i, i + taille);
}

test("les deux routes forge des cores sont appelées", () => {
  assert.match(APP, /\/forge\/core-summon/);
  assert.match(APP, /\/forge\/core-equip/);
});

test("coreSummon : coût 8000 vérifié côté client, Bearer, resync du save", () => {
  const b = bloc("coreSummon");
  assert.match(b, /8000/, "CORE_SUMMON_COST serveur = 8000, aligné relics");
  assert.match(b, /Authorization/, "coreSummon n'authentifie pas sa requête");
  assert.match(b, /insufficient_balance/, "le cas solde insuffisant a son message");
  assert.match(b, /\/save\//, "après summon, resync du save (solde + inventaire)");
});

test("coreEquip : poste beast_id + core_id, Bearer, roster resynchronisé", () => {
  const b = bloc("coreEquip");
  assert.match(b, /beast_id/, "le serveur attend beast_id");
  assert.match(b, /core_id/, "le serveur attend core_id");
  assert.match(b, /Authorization/, "coreEquip n'authentifie pas sa requête");
  assert.match(b, /creatures/, "le roster revient du serveur après équipement");
});

test("aucune action core ne lève : elles rendent toutes {ok:false}", () => {
  for (const nom of ["coreSummon", "coreEquip"]) {
    assert.match(bloc(nom), /catch/, `${nom} doit capturer ses erreurs réseau`);
  }
});
