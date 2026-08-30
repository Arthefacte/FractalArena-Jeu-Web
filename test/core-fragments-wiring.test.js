// Fragments de core (expéditions → Forge) : action app.jsx, bloc ForgeCoreFragments,
// affichage au claim, aperçu previewLoot. Miroir des gardes de expeditions-wiring.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = read("app.jsx");
const screens = read("screens.jsx");
const expeditions = read("expeditions.jsx");

globalThis.window = globalThis.window || {};
require("../expeditions-ui.js");
const XU = globalThis.window.FA_EXPEDITIONS_UI;

function bloc(src, marker, len) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, marker + " absent");
  return src.slice(i, i + (len || 1600));
}

test("app.jsx : expeditionsCraftCore poste sur /expeditions/craft-core, authentifié, re-fetch /save", () => {
  const b = bloc(app, "async expeditionsCraftCore", 2200);
  assert.match(b, /\/expeditions\/craft-core/, "route craft-core manquante");
  assert.match(b, /Authorization/, "Bearer manquant");
  assert.match(b, /API_URL/, "API_URL manquant");
  assert.ok(!/https?:\/\//.test(b), "URL en dur interdite");
  assert.match(b, /401/, "retry 401 manquant");
  assert.match(b, /svOpts\(\)/, "re-fetch /save manquant (equipment bouge)");
  assert.match(b, /serverToState/);
  assert.match(b, /core: data\.core/, "le core forgé doit être retourné");
});

test("app.jsx : expCoreFragments amorcé à zéro et peuplé depuis core_fragments", () => {
  assert.match(app, /expCoreFragments: \{ C: 0, B: 0, A: 0, S: 0 \}/);
  assert.match(app, /expCoreFragments: data\.core_fragments \|\| \{ C: 0, B: 0, A: 0, S: 0 \}/);
});

test("screens.jsx : ForgeCoreFragments rend les 4 rangs et appelle expeditionsCraftCore", () => {
  const b = bloc(screens, "function ForgeCoreFragments", 6500);
  assert.match(b, /\["C", "B", "A", "S"\]\.map/, "les 4 rangs doivent être rendus");
  assert.match(b, /expeditionsCraftCore\(rk\)/, "le bouton doit appeler craft-core");
  assert.match(b, /g\.expCoreFragments/, "compteurs g.expCoreFragments manquants");
  assert.match(b, /CORE_FRAGMENT_COSTS/, "jauges sur les coûts de core manquantes");
  // Reveal : CoreViewer 220 avec repli CoreIcon 48 (pattern coreLast de ForgeEquipement).
  assert.match(b, /size=\{220\}/, "CoreViewer size 220 manquant");
  assert.match(b, /CoreIcon[^\n]*size=\{48\}/, "repli CoreIcon 48 manquant");
  assert.match(b, /rarityLabel\(coreLast\.rarity/, "rareté du core absente de la modale");
});

test("screens.jsx : le bloc cores est rendu dans la Forge, à côté de ForgeFragments", () => {
  assert.match(screens, /<ForgeCoreFragments \/>/);
});

test("expeditions.jsx : le claim affiche rewards.core_frags quand ils existent, rien sinon", () => {
  const b = bloc(expeditions, "const coreFrags", 6000);
  assert.match(b, /rw\.core_frags \|\| \{\}/, "repli serveur antérieur manquant");
  assert.match(b, /coreFragRanks\.length > 0 &&/, "un serveur sans core_frags ne doit rien afficher");
  assert.match(b, /EXP_FRAG_CORE_LINE/, "ligne i18n dédiée manquante");
  assert.match(b, /g\.expCoreFragments/, "jauge total/need sur les compteurs de core manquante");
  assert.match(b, /⬡/, "marqueur ⬡ (distinct du ✦ relique) manquant");
});

test("expeditions.jsx : l'aperçu au lancement montre win.core_frags si > 0", () => {
  assert.match(expeditions, /win\.core_frags > 0 &&/);
  assert.match(expeditions, /lose\.core_frags > 0 &&/);
});

test("previewLoot : core_frags au même rythme que frags, et 1 en échec Risquée (miroir serveur)", () => {
  const ok = XU.previewLoot("blocs", 8, "prudente", null, true);
  assert.equal(ok.core_frags, Math.round(XU.scaled(XU.CORE_FRAG_PER_H.C, 8)));
  assert.ok(ok.core_frags > 0);
  assert.equal(ok.core_frags, ok.frags, "le serveur crédite core_frags = copie exacte de frags");
  const koRisky = XU.previewLoot("coeur", 8, "risquee", null, false);
  assert.equal(koRisky.core_frags, 1);   // FAIL_RISKY_FRAGS s'applique aux deux flux
  assert.equal(koRisky.frags, 1);        // la consolation Risquée reste la relique
  const koPrudent = XU.previewLoot("coeur", 8, "prudente", null, false);
  assert.ok(koPrudent.core_frags >= 0);
});

test("CORE_FRAGMENT_COSTS : exposé pour les jauges (4 rangs)", () => {
  assert.deepStrictEqual(Object.keys(XU.CORE_FRAGMENT_COSTS), ["C", "B", "A", "S"]);
  for (const v of Object.values(XU.CORE_FRAGMENT_COSTS)) assert.ok(Number.isInteger(v) && v > 0);
});
