// Câblage UI de l'invocation des cores : ForgeCoreSummon (screens.jsx, onglet
// Forge → Cores) doit offrir un bouton « Invoquer un core » branché sur
// actions.coreSummon (app.jsx), avec coût 8000 et garde de solde. Le bloc vivait
// avant au bas de ForgeEquipement, où il était noyé sous la fusion de reliques.
// Vérification au niveau SOURCE (pattern forge-equip-wiring) : le JSX n'est pas
// exécutable en node.
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

test("ForgeCoreSummon : un bouton Invoquer un core branché sur actions.coreSummon", () => {
  const b = bloc(SCREENS, "function ForgeCoreSummon", 4000);
  assert.match(b, /doCoreSummon/, "handler doCoreSummon manquant");
  assert.match(b, /actions\.coreSummon\(\)/, "actions.coreSummon non appelée");
  assert.match(b, /CORE_SUMMON_BTN/, "bouton CORE_SUMMON_BTN manquant");
  assert.match(b, /coreCost/, "coût de summon absent");
  assert.match(b, /coreBalOk/, "garde de solde absente");
  assert.match(b, /INSUFFICIENT/, "message solde insuffisant absent");
});

test("ForgeEquipement ne porte plus l'invocation d'un core (elle a son onglet)", () => {
  const b = bloc(SCREENS, "function ForgeEquipement", 6000);
  assert.ok(!/CORE_SUMMON_BTN/.test(b), "l'invocation de core doit vivre dans ForgeCoreSummon");
  assert.ok(!/coreSummon/.test(b), "ForgeEquipement ne doit plus appeler coreSummon");
});

test("coreSummon (app.jsx) : route, Bearer, coût 8000, resync /save", () => {
  const b = bloc(APP, "async coreSummon()", 1200);
  assert.match(b, /forge\/core-summon/);
  assert.match(b, /Authorization/, "Bearer manquant");
  assert.match(b, /8000/, "coût 8000 manquant");
  assert.match(b, /svOpts\(\)/, "resync /save manquante");
  assert.match(b, /applySave\(save, s\.wallet, s\.authToken\)/, "la réponse /save doit passer par la garde d'identité applySave");
});

test("i18n : les clés CORE_SUMMON_* existent dans les 3 langues, avec %s pour les args", () => {
  for (const k of ["CORE_SUMMON_TITLE", "CORE_SUMMON_HINT", "CORE_SUMMON_BTN", "CORE_SUMMON_OK"]) {
    assert.match(I18N, new RegExp(k + ": \\{ FR: \""), k + " absente ou non FR");
    assert.match(I18N, new RegExp(k + ": \\{ FR: \"[^\"]*\", EN: \""), k + " : EN manquant");
    assert.match(I18N, new RegExp(k + ": \\{ FR: \"[^\"]*\", EN: \"[^\"]*\", ZH: \""), k + " : ZH manquant");
  }
  // % présent dans les clés à argument, absent de CORE_SUMMON_TITLE/HINT (0-arg)
  // %d (coût numérique) comme FG_SUMMON_BTN — pas de parenthèses, miroir reliques.
  assert.match(I18N, /CORE_SUMMON_BTN: \{ FR: "[^"]*%d[^"]*"/);
  assert.match(I18N, /CORE_SUMMON_OK: \{ FR: "[^"]*%s[^"]*"/);
  assert.ok(!/CORE_SUMMON_TITLE: \{ FR: "[^"]*%/.test(I18N), "CORE_SUMMON_TITLE ne doit pas porter de %");
  assert.ok(!/CORE_SUMMON_HINT: \{ FR: "[^"]*%/.test(I18N), "CORE_SUMMON_HINT ne doit pas porter de %");
});
