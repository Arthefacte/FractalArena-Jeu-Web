// test/core-i18n.test.js
// Pattern de test/market-i18n.test.js : chaque clé existe en FR, EN et ZH.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const KEYS = [
  // noms des 6 cores
  "CORE_FURY_CORE", "CORE_GUARDIAN_CORE", "CORE_OVERCLOCK_CORE",
  "CORE_REGEN_CORE", "CORE_FEEDBACK_CORE", "CORE_LAST_STAND_CORE",
  // descriptions (suffixe _D, pattern RELIC_*_D)
  "CORE_FURY_CORE_D", "CORE_GUARDIAN_CORE_D", "CORE_OVERCLOCK_CORE_D",
  "CORE_REGEN_CORE_D", "CORE_FEEDBACK_CORE_D", "CORE_LAST_STAND_CORE_D",
  // slot d'équipement
  "CORE_EQUIP", "CORE_UNEQUIP", "CORE_NONE",
];

test("i18n : toutes les clés CORE_* existent en FR/EN/ZH", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");
  for (const k of KEYS) {
    const idx = src.indexOf(k + ":");
    assert.notStrictEqual(idx, -1, `clé manquante : ${k}`);
    const block = src.slice(idx, src.indexOf("}", idx) + 1);
    for (const lang of ["FR:", "EN:", "ZH:"]) {
      assert.ok(block.includes(lang), `${k} : langue manquante ${lang}`);
    }
  }
});

test("i18n : nombre de %s des descriptions == descArgs, dans les 3 langues", () => {
  globalThis.window = globalThis.window || {};
  require("../data.js");
  require("../core-ui.js");
  require("../i18n.js");
  const CU = window.FA_CORE_UI;
  const { T } = window.FA_I18N;
  for (const id of [
    "fury_core", "guardian_core", "overclock_core",
    "regen_core", "feedback_core", "last_stand_core",
  ]) {
    const key = "CORE_" + id.toUpperCase() + "_D";
    const nArgs = CU.descArgs(id, "Common").length;
    assert.ok(T[key], `clé manquante : ${key}`);
    for (const l of ["FR", "EN", "ZH"]) {
      const tpl = T[key][l];
      const n = (tpl.match(/%[sd]/g) || []).length;
      assert.strictEqual(n, nArgs, `${key}.${l} : ${n} placeholders, ${nArgs} args`);
      // PIÈGE fmt : t() ne remplace %% que si args.length > 0 — interdit dans les
      // templates sans arg (l'Overclock n'en a aucun).
      if (nArgs === 0) assert.ok(!tpl.includes("%"), `${key}.${l} sans arg ne doit pas contenir %`);
    }
  }
});

test("i18n : rendu bout-en-bout — une Rare n'affiche PAS le chiffre d'une Commune", () => {
  window.FA_I18N.setLang("FR");
  const { t } = window.FA_I18N;
  const CU = window.FA_CORE_UI;
  assert.strictEqual(CU.coreDesc({ core_id: "fury_core", rarity: "Common" }, t),
    "+15% ATK à chaque kill allié (cumulable)");
  assert.strictEqual(CU.coreDesc({ core_id: "fury_core", rarity: "Rare" }, t),
    "+18.75% ATK à chaque kill allié (cumulable)");
  assert.strictEqual(CU.coreDesc({ core_id: "fury_core", rarity: "Legendary" }, t),
    "+30% ATK à chaque kill allié (cumulable)");
  // Le seuil (30 % PV du Last Stand) et la durée (1 tour) restent fixes, hors %s.
  assert.strictEqual(CU.coreDesc({ core_id: "last_stand_core", rarity: "Epic" }, t),
    "+37.5% ATK et +22.5% DEF sous 30% PV");
  window.FA_I18N.setLang("EN");
  assert.strictEqual(CU.coreDesc({ core_id: "guardian_core", rarity: "Rare" }, t),
    "25% Max HP shield on first hit taken (1 turn)");
  window.FA_I18N.setLang("FR");
});
