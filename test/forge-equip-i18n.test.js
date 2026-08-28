// Clés i18n de la Forge d'équipement (fusion de reliques + désenchantement) :
// présentes en FR/EN/ZH, avec les placeholders attendus par l'écran.
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const T = window.FA_I18N.T;
const LANGS = ["FR", "EN", "ZH"];

const CLES = [
  "FG_EQ_TITLE", "FG_EQ_SUB",
  "FG_EQ_FUSE_BTN", "FG_EQ_FUSE_HINT", "FG_EQ_MAX_RARITY", "FG_EQ_SEL_MAX",
  "FG_EQ_DIS_BTN", "FG_EQ_DIS_CONFIRM", "FG_EQ_DIS_OK",
];

// Un code d'erreur serveur = une clé FG_EQ_ERR_<code> (+ le repli générique).
const CODES_SERVEUR = [
  "relic_ids_invalide", "relique_introuvable", "pas_une_relique",
  "rarity_mismatch", "max_rarity", "objet_introuvable",
];

test("clés de la Forge d'équipement présentes en FR/EN/ZH", () => {
  for (const k of CLES) {
    assert.ok(T[k], `${k} manquante`);
    for (const lang of LANGS) assert.ok(T[k][lang], `${k}.${lang} manquante`);
  }
});

test("chaque code d'erreur serveur a sa clé, plus le repli générique", () => {
  for (const code of [...CODES_SERVEUR.map((c) => "FG_EQ_ERR_" + c), "FG_EQ_ERR_generic"]) {
    assert.ok(T[code], `${code} manquante`);
    for (const lang of LANGS) assert.ok(T[code][lang], `${code}.${lang} manquante`);
  }
});

test("placeholders : coût sur le bouton fusion, montant sur le désenchantement", () => {
  for (const lang of LANGS) {
    assert.ok(/%d/.test(T.FG_EQ_FUSE_BTN[lang]), `FG_EQ_FUSE_BTN.${lang} sans %d (coût)`);
    assert.ok(/%d/.test(T.FG_EQ_DIS_BTN[lang]), `FG_EQ_DIS_BTN.${lang} sans %d (net rendu)`);
    assert.ok(/%d/.test(T.FG_EQ_DIS_OK[lang]), `FG_EQ_DIS_OK.${lang} sans %d (crédité)`);
    // 3 × <rareté> → 1 × <rareté supérieure>
    assert.strictEqual((T.FG_EQ_FUSE_HINT[lang].match(/%s/g) || []).length, 2, `FG_EQ_FUSE_HINT.${lang} : 2 %s attendus`);
  }
});
