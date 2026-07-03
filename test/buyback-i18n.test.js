const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const T = window.FA_I18N.T;

test("nouvelles clés présentes en FR/EN/ZH", () => {
  for (const k of ["LB_TAB_BUYBACK", "BB_POOL_LABEL", "RES_BUYBACK"]) {
    assert.ok(T[k], `${k} manquante`);
    for (const lang of ["FR", "EN", "ZH"]) assert.ok(T[k][lang], `${k}.${lang} manquante`);
  }
});

test("clés retirées absentes", () => {
  for (const k of ["LB_TAB_BURNED", "LB_TAB_LIQUIDITY", "LB_TAB_AIRDROP", "RES_POOL", "RES_BURN", "BB_LIQ", "BB_BOUGHT"]) {
    assert.ok(!T[k], `${k} devrait être supprimée`);
  }
});

test("BB_POOL_LABEL contient un placeholder %s dans les 3 langues", () => {
  for (const lang of ["FR", "EN", "ZH"]) assert.ok(/%s/.test(T.BB_POOL_LABEL[lang]), `BB_POOL_LABEL.${lang} sans %s`);
});

test("FG_SUB ne mentionne plus l'ancien split 70/30 dans les 3 langues", () => {
  for (const lang of ["FR", "EN", "ZH"]) assert.ok(!/70%|Reward Pool|Mega buyback|超级回购/.test(T.FG_SUB[lang]), `FG_SUB.${lang} mentionne encore l'ancien split`);
});
