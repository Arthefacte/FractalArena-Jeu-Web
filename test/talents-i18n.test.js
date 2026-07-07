// test/talents-i18n.test.js
const test = require("node:test");
const assert = require("node:assert");

globalThis.window = {};
require("../talents-data.js");
require("../talents-ui.js");
require("../i18n.js");
const TAL = window.FA_TALENTS;
const TUI = window.FA_TALENTS_UI;
const { T, t } = window.FA_I18N;

const LANGS = ["FR", "EN", "ZH"];
const CHROME_KEYS = [
  "TAL_TITLE", "TAL_TIER", "TAL_TIER_LOCKED", "TAL_PICK_FREE", "TAL_RESPEC_COST",
  "TAL_RESPEC_FREE", "TAL_NONE_UNLOCKED", "TAL_ERR_LOCKED", "TAL_ERR_ALREADY", "TAL_ERR_BALANCE",
];

function assertKey(key) {
  assert.ok(T[key], `clé manquante : ${key}`);
  for (const l of LANGS) {
    assert.ok(typeof T[key][l] === "string" && T[key][l].length > 0, `${key}.${l} vide`);
  }
}

test("i18n : nom + description pour chacun des 36 talents, 3 langues", () => {
  for (const tal of TAL.TALENT_LIST) {
    assertKey("TAL_" + tal.id);
    assertKey("TAL_" + tal.id + "_D");
  }
});

test("i18n : clés chrome du panneau, 3 langues", () => {
  for (const key of CHROME_KEYS) assertKey(key);
});

test("i18n : nombre de %s/%d des descriptions == descArgs, dans les 3 langues", () => {
  for (const tal of TAL.TALENT_LIST) {
    const nArgs = TUI.descArgs(tal, "Common").length;
    for (const l of LANGS) {
      const tpl = T["TAL_" + tal.id + "_D"][l];
      const n = (tpl.match(/%[sd]/g) || []).length;
      assert.strictEqual(n, nArgs, `TAL_${tal.id}_D.${l} : ${n} placeholders, ${nArgs} args`);
      // PIÈGE fmt : t() ne remplace %% que si args.length > 0 — interdit dans les templates sans arg.
      if (nArgs === 0) assert.ok(!tpl.includes("%"), `TAL_${tal.id}_D.${l} sans arg ne doit pas contenir %`);
    }
  }
});

test("i18n : rendu bout-en-bout d'une description scalée", () => {
  window.FA_I18N.setLang("FR");
  const s = TUI.talentDesc(TAL.TALENTS.hash_cadence, "Legendary", t);
  assert.ok(s.includes("64"), s);   // per 0.32 × 2.0 → 64
  assert.ok(s.includes("220"), s);  // cap 1.10 × 2.0 → 220
  assert.ok(s.includes("%"), s);    // %% rendu en %
});
