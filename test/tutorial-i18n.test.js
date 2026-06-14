const test = require("node:test");
const assert = require("node:assert");

// i18n.js est une IIFE qui fait `window.FA_I18N = {...}`. On shim `window`
// sur le global pour pouvoir le charger en Node (identifiant `window` nu).
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;

const KEYS = [
  "TUT_TITLE", "TUT_SKIP", "TUT_NEXT", "TUT_START", "TUT_HELP",
  "TUT_S1_T", "TUT_S1_B", "TUT_S2_T", "TUT_S2_B", "TUT_S3_T", "TUT_S3_B",
  "TUT_S4_T", "TUT_S4_B", "TUT_S5_T", "TUT_S5_B",
];
const LANGS = ["FR", "EN", "ZH"];

test("les 15 clés TUT_* existent dans les 3 langues, non vides", () => {
  for (const k of KEYS) {
    assert.ok(T[k], `clé manquante : ${k}`);
    for (const lg of LANGS) {
      assert.ok(T[k][lg] && T[k][lg].trim().length > 0, `${k}.${lg} vide`);
    }
  }
});
