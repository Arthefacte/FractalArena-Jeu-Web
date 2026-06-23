const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;
const LANGS = ["FR", "EN", "ZH"];
const KEYS = [
  "NAV_ARENE", "AR2_TITLE", "AR2_TAG", "AR2_MY_DEFENSE", "AR2_SET_DEFENSE",
  "AR2_OPPONENTS", "AR2_LADDER", "AR2_ATTACK", "AR2_REVANCHE", "AR2_ENTRY",
  "AR2_FREE", "AR2_FA", "AR2_TICKET", "AR2_NO_DEFENSE", "AR2_SEASON",
  "AR2_ENDS_IN", "AR2_PRIZE", "AR2_WIN", "AR2_LOSE", "AR2_ELO_DELTA",
  "AR2_NO_OPPONENTS", "AR2_POWER", "AR2_RANK", "AR2_REFRESH",
];
test("toutes les clés Arène existent dans les 3 langues, non vides", () => {
  for (const k of KEYS) {
    assert.ok(T[k], "clé manquante : " + k);
    for (const lg of LANGS) assert.ok(T[k][lg] && T[k][lg].trim().length > 0, `${k}.${lg} vide`);
  }
});
