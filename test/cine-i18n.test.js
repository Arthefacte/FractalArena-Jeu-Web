const test = require("node:test");
const assert = require("node:assert");

// i18n.js est une IIFE qui fait `window.FA_I18N = {...}`. On shim `window`
// sur le global pour pouvoir le charger en Node (identifiant `window` nu).
globalThis.window = {};
require("../i18n.js");
const { T, detectLang } = globalThis.window.FA_I18N;

const KEYS = [
  "CINE_CTA", "CINE_TAGLINE", "CINE_LORE1", "CINE_LORE2",
  "CINE_SKIP", "CINE_REPLAY", "CINE_LOADING", "CINE_SOUND",
];
const LANGS = ["FR", "EN", "ZH"];

test("les 4 clés CINE_* existent dans les 3 langues, non vides", () => {
  for (const k of KEYS) {
    assert.ok(T[k], `clé manquante : ${k}`);
    for (const lg of LANGS) {
      assert.ok(T[k][lg] && T[k][lg].trim().length > 0, `${k}.${lg} vide`);
    }
  }
});

test("detectLang : fr→FR, zh→ZH, tout le reste→EN", () => {
  assert.strictEqual(detectLang("fr-FR"), "FR");
  assert.strictEqual(detectLang("fr"), "FR");
  assert.strictEqual(detectLang("zh-CN"), "ZH");
  assert.strictEqual(detectLang("zh-Hant-TW"), "ZH");
  assert.strictEqual(detectLang("en-US"), "EN");
  assert.strictEqual(detectLang("de-DE"), "EN");
  assert.strictEqual(detectLang(""), "EN");
  assert.strictEqual(detectLang(undefined), "EN");
  assert.strictEqual(detectLang(null), "EN");
});
