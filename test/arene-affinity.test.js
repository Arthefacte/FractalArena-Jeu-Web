// Indicateurs d'affinité de type (↑/↓) — PUREMENT COSMÉTIQUES, le serveur
// applique déjà le multiplicateur (engine.node.js, getTypeMultiplier).
// Le helper affinityIndicator (arene-ui.js) est le miroir de data.js :
// chiffres dérivés de getTypeMultiplier, jamais en dur.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

globalThis.window = {};
require("../data.js");
require("../i18n.js");
require("../arene-ui.js");
const D = globalThis.window.FA_DATA;
const I18N = globalThis.window.FA_I18N;
const U = globalThis.window.FA_ARENE_UI;

test("affinityIndicator : avantage → ↑ vert, pct dérivé de getTypeMultiplier", () => {
  const a = U.affinityIndicator("HASH", ["MINING"]);
  assert.ok(a, "HASH bat MINING : indicateur attendu");
  assert.strictEqual(a.dir, "up");
  assert.strictEqual(a.arrow, "↑");
  assert.strictEqual(a.vsType, "MINING");
  assert.strictEqual(a.pct, Math.round((D.getTypeMultiplier("HASH", "MINING") - 1) * 100));
  assert.strictEqual(a.pct, 25);
  assert.strictEqual(a.color, "var(--success)");
  assert.strictEqual(a.tipKey, "AFF_TIP_UP");
  assert.strictEqual(a.ariaKey, "AFF_UP_LABEL");
});

test("affinityIndicator : désavantage → ↓ rouge, pct dérivé de getTypeMultiplier", () => {
  const a = U.affinityIndicator("HASH", ["GENESIS"]);
  assert.ok(a, "GENESIS bat HASH : indicateur attendu");
  assert.strictEqual(a.dir, "down");
  assert.strictEqual(a.arrow, "↓");
  assert.strictEqual(a.vsType, "GENESIS");
  assert.strictEqual(a.pct, Math.round((1 - D.getTypeMultiplier("HASH", "GENESIS")) * 100));
  assert.strictEqual(a.pct, 20);
  assert.strictEqual(a.color, "var(--alert)");
  assert.strictEqual(a.tipKey, "AFF_TIP_DOWN");
  assert.strictEqual(a.ariaKey, "AFF_DOWN_LABEL");
});

test("affinityIndicator : neutre / inconnu / entrées invalides → null (rétro-compat)", () => {
  assert.strictEqual(U.affinityIndicator("HASH", ["LEDGER"]), null);    // ni fort ni faible
  assert.strictEqual(U.affinityIndicator("HASH", ["POTATO"]), null);    // type adverse inconnu
  assert.strictEqual(U.affinityIndicator("POTATO", ["HASH"]), null);    // mon type inconnu
  assert.strictEqual(U.affinityIndicator(null, ["HASH"]), null);
  assert.strictEqual(U.affinityIndicator("HASH", null), null);
  assert.strictEqual(U.affinityIndicator("HASH", []), null);
  assert.strictEqual(U.affinityIndicator("HASH", [null, undefined]), null);
});

test("affinityIndicator : l'avantage prime quand avantage et désavantage coexistent", () => {
  const a = U.affinityIndicator("HASH", ["GENESIS", "MINING"]);
  assert.strictEqual(a.dir, "up");
  assert.strictEqual(a.vsType, "MINING");
});

test("affinityIndicator : cycle complet — chaque type ↑ contre son strong, ↓ contre son weak", () => {
  for (const t of Object.keys(D.TYPE_ADVANTAGE)) {
    const adv = D.TYPE_ADVANTAGE[t];
    const up = U.affinityIndicator(t, [adv.strong]);
    assert.ok(up && up.dir === "up" && up.pct === 25, t + " vs " + adv.strong);
    const down = U.affinityIndicator(t, [adv.weak]);
    assert.ok(down && down.dir === "down" && down.pct === 20, t + " vs " + adv.weak);
  }
});

test("tooltip FR exact : « HASH > MINING : +25% dégâts » / « HASH < GENESIS : -20% dégâts »", () => {
  const prev = I18N.getLang();
  I18N.setLang("FR");
  const up = U.affinityIndicator("HASH", ["MINING"]);
  assert.strictEqual(I18N.t(up.tipKey, "HASH", up.vsType, up.pct), "HASH > MINING : +25% dégâts");
  const down = U.affinityIndicator("HASH", ["GENESIS"]);
  assert.strictEqual(I18N.t(down.tipKey, "HASH", down.vsType, down.pct), "HASH < GENESIS : -20% dégâts");
  I18N.setLang(prev);
});

test("i18n : clés d'affinité présentes et non vides dans les 3 langues", () => {
  const { T } = I18N;
  for (const k of ["AFF_TIP_UP", "AFF_TIP_DOWN", "AFF_UP_LABEL", "AFF_DOWN_LABEL"]) {
    assert.ok(T[k], "clé manquante : " + k);
    for (const lg of ["FR", "EN", "ZH"]) {
      assert.ok(T[k][lg] && T[k][lg].trim().length > 0, `${k}.${lg} vide`);
    }
  }
  // Les tooltips paramètrent types ET pourcentage (jamais de chiffre en dur).
  for (const k of ["AFF_TIP_UP", "AFF_TIP_DOWN"]) {
    for (const lg of ["FR", "EN", "ZH"]) {
      assert.strictEqual((T[k][lg].match(/%s/g) || []).length, 2, `${k}.${lg} : deux %s (types)`);
      assert.ok(T[k][lg].includes("%d"), `${k}.${lg} : %d (pourcentage)`);
      assert.ok(!/\d/.test(T[k][lg].replace(/%[sd]/g, "")), `${k}.${lg} : chiffre en dur interdit`);
    }
  }
});

// ---- Câblage des écrans (le JSX n'est pas requirable en node:test :
// on verrouille au niveau source, pattern arene-replay-spoiler.test.js) ----
const battleSrc = fs.readFileSync(path.join(__dirname, "..", "arene-battle.jsx"), "utf8");
const areneSrc = fs.readFileSync(path.join(__dirname, "..", "arene.jsx"), "utf8");
const campSrc = fs.readFileSync(path.join(__dirname, "..", "campaign.jsx"), "utf8");

test("arene-battle.jsx : AB_Unit affiche l'indicateur (couvre Arène, Tour et Quiz)", () => {
  assert.match(battleSrc, /affinityIndicator/, "AB_Unit doit appeler FA_ARENE_UI.affinityIndicator");
  assert.match(battleSrc, /tipKey/, "le tooltip doit venir des clés i18n de l'indicateur");
  assert.match(battleSrc, /ariaKey/, "libellé accessible requis sur la flèche");
});

test("arene.jsx : la sélection d'équipe (modal d'attaque) affiche l'indicateur", () => {
  assert.match(areneSrc, /affinityIndicator/, "arene.jsx doit appeler affinityIndicator");
  assert.match(areneSrc, /oppTeam/, "l'indicateur se calcule face à l'équipe adverse affichée");
});

test("campaign.jsx : le combat de campagne affiche l'indicateur", () => {
  assert.match(campSrc, /affinityIndicator/, "campaign.jsx doit appeler affinityIndicator");
  assert.match(campSrc, /type: b\.type/, "campMeta doit conserver le type (sinon indicateur toujours neutre)");
});
