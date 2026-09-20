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

// Bandeau buyback (brief 2026-09-17) : chaque chiffre nomme son unité, sa source
// et sa nature. Le repli base (BB_BOUGHT_SUB_DB) a un libellé DIFFÉRENT du cumul
// on-chain : un joueur ne doit jamais lire « depuis le lancement » devant un
// nombre qui vient de reculer.
test("libellés du bandeau buyback présents en FR/EN/ZH", () => {
  for (const k of ["BB_BOUGHT_SUB", "BB_BOUGHT_SUB_DB", "BB_TICK_TITLE", "BB_POOL_LABEL"]) {
    assert.ok(T[k], `${k} manquante`);
    for (const lang of ["FR", "EN", "ZH"]) assert.ok(T[k][lang], `${k}.${lang} manquante`);
  }
});

test("BB_BOUGHT_SUB et BB_BOUGHT_SUB_DB contiennent un placeholder %s dans les 3 langues", () => {
  for (const k of ["BB_BOUGHT_SUB", "BB_BOUGHT_SUB_DB"]) {
    for (const lang of ["FR", "EN", "ZH"]) assert.ok(/%s/.test(T[k][lang]), `${k}.${lang} sans %s`);
  }
});

test("BB_BOUGHT_SUB dit la nature (cumul) et la source (on-chain), BB_BOUGHT_SUB_DB non", () => {
  assert.match(T.BB_BOUGHT_SUB.FR, /cumul/i);
  assert.match(T.BB_BOUGHT_SUB.FR, /on-chain/i);
  assert.match(T.BB_BOUGHT_SUB.EN, /cumulative/i);
  assert.match(T.BB_BOUGHT_SUB.EN, /on-chain/i);
  assert.match(T.BB_BOUGHT_SUB.ZH, /累计/);
  assert.match(T.BB_BOUGHT_SUB.ZH, /链上/);
  for (const lang of ["FR", "EN", "ZH"]) {
    assert.ok(!/on-chain|链上/i.test(T.BB_BOUGHT_SUB_DB[lang]), `BB_BOUGHT_SUB_DB.${lang} ne doit pas se réclamer de l'on-chain`);
    assert.notStrictEqual(T.BB_BOUGHT_SUB_DB[lang], T.BB_BOUGHT_SUB[lang], `BB_BOUGHT_SUB_DB.${lang} doit différer du libellé on-chain`);
  }
});

test("BB_TICK_TITLE dit les 3 poches et distingue proportion instantanée / cumul (3 langues)", () => {
  assert.match(T.BB_TICK_TITLE.FR, /trois poches/);
  assert.match(T.BB_TICK_TITLE.FR, /un tiers/);
  assert.match(T.BB_TICK_TITLE.FR, /cagnotte/);
  assert.match(T.BB_TICK_TITLE.FR, /proportion instantanée/);
  assert.match(T.BB_TICK_TITLE.FR, /jamais un cumul/);
  assert.match(T.BB_TICK_TITLE.EN, /three pockets/);
  assert.match(T.BB_TICK_TITLE.EN, /one third is burned/);
  assert.match(T.BB_TICK_TITLE.EN, /jackpot/);
  assert.match(T.BB_TICK_TITLE.EN, /instantaneous proportion/);
  assert.match(T.BB_TICK_TITLE.EN, /never a cumulative/);
  assert.match(T.BB_TICK_TITLE.ZH, /三个资金池/);
  assert.match(T.BB_TICK_TITLE.ZH, /三分之一销毁/);
  assert.match(T.BB_TICK_TITLE.ZH, /彩池/);
  assert.match(T.BB_TICK_TITLE.ZH, /即时比例/);
  assert.match(T.BB_TICK_TITLE.ZH, /并非累计/);
});

test("clés du modèle 3 pools présentes en FR/EN/ZH", () => {
  for (const k of ["BB_POOL_KIND_BUYBACK", "BB_POOL_KIND_BURN", "BB_POOL_KIND_POT",
    "TAPE_RACHAT_K", "TAPE_BURN_K", "TAPE_POT_K", "TAPE_ENTREE_K", "TAPE_POOL_K"]) {
    assert.ok(T[k], `${k} manquante`);
    for (const lang of ["FR", "EN", "ZH"]) assert.ok(T[k][lang], `${k}.${lang} manquante`);
  }
});

test("FG_SUB ne mentionne plus l'ancien split 70/30 dans les 3 langues", () => {
  for (const lang of ["FR", "EN", "ZH"]) assert.ok(!/70%|Reward Pool|Mega buyback|超级回购/.test(T.FG_SUB[lang]), `FG_SUB.${lang} mentionne encore l'ancien split`);
});
