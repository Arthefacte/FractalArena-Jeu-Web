// Câblage Forge d'équipement : actions authentifiées dans app.jsx (fusion de
// reliques + désenchantement), écran branché sur les helpers purs de forge-ui.js.
// Verrouillage au niveau SOURCE (modèle expeditions-wiring) : le JSX n'est pas
// exécutable en node.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
const SCREENS = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");

function bloc(src, marker, len) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, marker + " absent");
  return src.slice(i, i + (len || 1600));
}

test("relicFuse : POST /forge/relic-fuse authentifié, body relic_ids, resync /save", () => {
  const b = bloc(APP, "async relicFuse(");
  assert.match(b, /forge\/relic-fuse/);
  assert.match(b, /Authorization/, "Bearer manquant");
  assert.match(b, /API_URL/, "API_URL manquant");
  assert.ok(!/https?:\/\//.test(b), "URL en dur interdite");
  assert.match(b, /relic_ids/, "relic_ids absent du body");
  assert.match(b, /svOpts\(\)/, "resync /save manquant (solde + inventaire bougent)");
  assert.match(b, /serverToState/);
});

test("equipDisenchant : POST /forge/equip-disenchant authentifié, body item_id, resync /save", () => {
  const b = bloc(APP, "async equipDisenchant(");
  assert.match(b, /forge\/equip-disenchant/);
  assert.match(b, /Authorization/, "Bearer manquant");
  assert.match(b, /API_URL/, "API_URL manquant");
  assert.ok(!/https?:\/\//.test(b), "URL en dur interdite");
  assert.match(b, /item_id/, "item_id absent du body");
  assert.match(b, /svOpts\(\)/, "resync /save manquant");
  assert.match(b, /serverToState/);
});

test("les deux actions traduisent les codes serveur (jamais de code brut au joueur)", () => {
  for (const name of ["async relicFuse(", "async equipDisenchant("]) {
    const b = bloc(APP, name, 2000);
    assert.match(b, /equipForgeErrText/, name + " : mapping i18n des erreurs manquant");
    assert.match(b, /insufficient_balance/, name + " : cas insufficient_balance manquant");
  }
});

test("écran : section Forge d'équipement branchée sur les helpers purs", () => {
  const b = bloc(SCREENS, "function ForgeEquipement", 6000);
  assert.match(b, /isRelicItem/, "la section doit filtrer les reliques (jamais les cores)");
  assert.match(b, /equipSelToggle/);
  assert.match(b, /relicFuseState/);
  assert.match(b, /disenchantState/);
  assert.match(b, /actions\.relicFuse\(/);
  assert.match(b, /actions\.equipDisenchant\(/);
  assert.match(b, /FG_EQ_DIS_CONFIRM/, "le désenchantement détruit : confirmation requise");
});

test("écran : la section est rendue dans l'onglet Reliques de la Forge", () => {
  const b = bloc(SCREENS, "function ForgeReliques", 12000);
  assert.match(b, /<ForgeEquipement/, "ForgeEquipement non rendue dans ForgeReliques");
});
