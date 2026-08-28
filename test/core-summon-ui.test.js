// Câblage UI de l'invocation des cores : ForgeEquipement (screens.jsx) doit
// offrir un bouton « Invoquer un core » branché sur actions.coreSummon
// (app.jsx), avec coût 8000 et garde de solde. Vérification au niveau SOURCE
// (pattern forge-equip-wiring) : le JSX n'est pas exécutable en node.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SCREENS = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");
const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
const I18N = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

function bloc(src, marker, len) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, marker + " absent");
  return src.slice(i, i + (len || 1600));
}

test("ForgeEquipement : un bouton Invoquer un core branché sur actions.coreSummon", () => {
  const b = bloc(SCREENS, "function ForgeEquipement", 7000);
  assert.match(b, /doCoreSummon/, "handler doCoreSummon manquant");
  assert.match(b, /actions\.coreSummon\(\)/, "actions.coreSummon non appelée");
  assert.match(b, /CORE_SUMMON_BTN/, "bouton CORE_SUMMON_BTN manquant");
  assert.match(b, /coreCost/, "coût de summon absent");
  assert.match(b, /coreBalOk/, "garde de solde absente");
  assert.match(b, /INSUFFICIENT/, "message solde insuffisant absent");
});

test("coreSummon (app.jsx) : route, Bearer, coût 8000, resync /save", () => {
  const b = bloc(APP, "async coreSummon()", 1200);
  assert.match(b, /forge\/core-summon/);
  assert.match(b, /Authorization/, "Bearer manquant");
  assert.match(b, /8000/, "coût 8000 manquant");
  assert.match(b, /svOpts\(\)/, "resync /save manquante");
  assert.match(b, /serverToState/);
});

test("i18n : les clés CORE_SUMMON_* existent dans les 3 langues, avec %s pour les args", () => {
  for (const k of ["CORE_SUMMON_TITLE", "CORE_SUMMON_HINT", "CORE_SUMMON_BTN", "CORE_SUMMON_OK"]) {
    assert.match(I18N, new RegExp(k + ": \\{ FR: \""), k + " absente ou non FR");
    assert.match(I18N, new RegExp(k + ": \\{ FR: \"[^\"]*\", EN: \""), k + " : EN manquant");
    assert.match(I18N, new RegExp(k + ": \\{ FR: \"[^\"]*\", EN: \"[^\"]*\", ZH: \""), k + " : ZH manquant");
  }
  // %s présent dans les clés à argument, absent de CORE_SUMMON_TITLE/HINT (0-arg)
  assert.match(I18N, /CORE_SUMMON_BTN: \{ FR: "[^"]*%s[^"]*"/);
  assert.match(I18N, /CORE_SUMMON_OK: \{ FR: "[^"]*%s[^"]*"/);
  assert.ok(!/CORE_SUMMON_TITLE: \{ FR: "[^"]*%/.test(I18N), "CORE_SUMMON_TITLE ne doit pas porter de %");
  assert.ok(!/CORE_SUMMON_HINT: \{ FR: "[^"]*%/.test(I18N), "CORE_SUMMON_HINT ne doit pas porter de %");
});
