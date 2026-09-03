// test/lp-i18n.test.js
// Liquidity Guardian : chaque clé existe en FR, EN et ZH (pattern core-i18n),
// et le texte d'aide porte les VRAIS seuils (50k / 200k — design du 03/09,
// jamais les anciens 2k/10k).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const KEYS = [
  "LP_TIER_G1", "LP_TIER_G2",
  "LP_PANEL_TITLE", "LP_PANEL_HINT", "LP_STATUS_NONE",
  "LP_REFRESH_BTN", "LP_REFRESH_OK", "LP_REFRESH_ERR",
  "LB_SEC_LP", "LB_TAB_LP", "LP_LB_UNAVAILABLE",
];

const src = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

test("i18n : toutes les clés LP_* / LB_*_LP existent en FR/EN/ZH", () => {
  for (const k of KEYS) {
    const idx = src.indexOf(k + ":");
    assert.notStrictEqual(idx, -1, `clé manquante : ${k}`);
    const block = src.slice(idx, src.indexOf("}", idx) + 1);
    for (const lang of ["FR:", "EN:", "ZH:"]) {
      assert.ok(block.includes(lang), `${k} : langue manquante ${lang}`);
    }
  }
});

test("i18n : les seuils affichés sont 50k et 200k, et les titres sont les bons", () => {
  const bloc = (k) => {
    const idx = src.indexOf(k + ":");
    return src.slice(idx, src.indexOf("},", idx) + 1);
  };
  // 50 000 / 50,000 / 50,000（ZH）— l'espace ou la virgule varie selon la langue.
  assert.match(bloc("LP_PANEL_HINT"), /50[\s,]000/, "seuil d'entrée 50 000 absent du hint");
  assert.match(bloc("LP_PANEL_HINT"), /200[\s,]000/, "seuil 3D 200 000 absent du hint");
  assert.match(bloc("LP_STATUS_NONE"), /50[\s,]000/, "seuil d'entrée 50 000 absent du statut vide");
  assert.match(bloc("LP_TIER_G1"), /Market Maker/, "titre G1");
  assert.match(bloc("LP_TIER_G2"), /Prime Market Maker/, "titre G2");
  // Aucun ancien seuil (2k / 10k) ne doit survivre dans les textes LP.
  assert.ok(!/\b2[\s,]000\b/.test(bloc("LP_PANEL_HINT")), "ancien seuil 2 000 encore présent");
  assert.ok(!/\b10[\s,]000\b/.test(bloc("LP_PANEL_HINT")), "ancien seuil 10 000 encore présent");
});
