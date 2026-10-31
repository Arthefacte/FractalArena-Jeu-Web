// test/lp-i18n.test.js
// Liquidity Guardian : chaque clé existe en FR, EN et ZH, et les seuils
// affichés sortent d'UNE constante (window.FA_I18N.LP_TIER_MIN) — jamais d'un
// chiffre recopié à la main dans le texte. Le serveur reste juge : lp.js
// LP_TIERS = G2 500 000 / G1 250 000, G1 relevé de 50k à 250k le 04/09/2026
// (commit serveur 09e2709 « feat(lp): seuil G1 250k »). L'ancien texte client
// annonçait 50 000 : le palier était inatteignable à l'annonce (audit 19/10).
const test = require("node:test");
const assert = require("node:assert");

globalThis.window = {};
require("../i18n.js");
const I18N = globalThis.window.FA_I18N;
const T = I18N.T;

const KEYS = [
  "LP_TIER_G1", "LP_TIER_G2",
  "LP_PANEL_TITLE", "LP_PANEL_HINT", "LP_STATUS_NONE",
  "LP_REFRESH_BTN", "LP_REFRESH_OK", "LP_REFRESH_ERR", "LP_SWEEP_HINT",
  "LB_SEC_LP", "LB_TAB_LP", "LP_LB_UNAVAILABLE",
];

// Miroir du serveur (lp.js LP_TIERS). Ce n'est PAS une deuxième source : les
// textes sont construits à partir de I18N.LP_TIER_MIN, et ce test confronte
// cette constante aux seuils serveur. Relever un palier = changer les deux.
const SERVEUR = { G1: 250_000, G2: 500_000 };

// Même formatage que i18n.js : espace en FR, virgule en EN/ZH.
const fmt = (n, sep) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

test("i18n : toutes les clés LP_* / LB_*_LP existent en FR/EN/ZH", () => {
  for (const k of KEYS) {
    assert.ok(T[k], `clé manquante : ${k}`);
    for (const lang of ["FR", "EN", "ZH"]) {
      assert.ok(T[k][lang], `${k} : langue manquante ${lang}`);
    }
  }
});

test("i18n : LP_TIER_MIN est exposée et reflète les seuils du serveur", () => {
  assert.deepStrictEqual(I18N.LP_TIER_MIN, SERVEUR,
    "LP_TIER_MIN doit refléter lp.js LP_TIERS (G1 250k, G2 500k)");
});

test("i18n : les seuils affichés sont ceux de LP_TIER_MIN, dans les 3 langues", () => {
  const MIN = I18N.LP_TIER_MIN;
  for (const [lang, sep] of [["FR", " "], ["EN", ","], ["ZH", ","]]) {
    const hint = T.LP_PANEL_HINT[lang];
    assert.ok(hint.includes(fmt(MIN.G1, sep)),
      `LP_PANEL_HINT.${lang} n'annonce pas le seuil G1 (${MIN.G1})`);
    assert.ok(hint.includes(fmt(MIN.G2, sep)),
      `LP_PANEL_HINT.${lang} n'annonce pas le seuil G2 (${MIN.G2})`);
    assert.ok(T.LP_STATUS_NONE[lang].includes(fmt(MIN.G1, sep)),
      `LP_STATUS_NONE.${lang} n'annonce pas le seuil G1 (${MIN.G1})`);
  }
});

test("i18n : plus aucun ancien seuil (50k / 200k) dans les textes LP", () => {
  // 250 000 contient « 50 000 » : on exige que le seuil ne soit pas précédé
  // d'un chiffre, sinon le test passerait sur le nouveau chiffre.
  const anciens = [/(?<!\d)50[\s,]000/, /(?<!\d)200[\s,]000/];
  for (const key of ["LP_PANEL_HINT", "LP_STATUS_NONE"]) {
    for (const lang of ["FR", "EN", "ZH"]) {
      for (const re of anciens) {
        assert.ok(!re.test(T[key][lang]), `${key}.${lang} garde un ancien seuil : ${re}`);
      }
    }
  }
});

test("i18n : les titres des paliers sont les bons", () => {
  assert.match(T.LP_TIER_G1.FR, /Market Maker/, "titre G1");
  assert.match(T.LP_TIER_G2.FR, /Prime Market Maker/, "titre G2");
});
