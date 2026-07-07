"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = window.FA_I18N;

const LANGS = ["FR", "EN", "ZH"];
const KEYS = ["FG_LOCK_HINT", "FG_LOCK_MAX", "FG_LOCK_TAG", "FG_ERR_LOCKS", "FG_ERR_BUDGET"];

test("i18n verrous de reroll : 5 clés non vides dans les 3 langues", () => {
  for (const k of KEYS) {
    assert.ok(T[k], `clé manquante : ${k}`);
    for (const l of LANGS) assert.ok(typeof T[k][l] === "string" && T[k][l].length > 0, `${k}.${l} vide`);
  }
});

test("i18n verrous : pas de % dans les templates sans argument (piège fmt)", () => {
  // Aucune de ces clés ne prend d'argument → aucun % toléré.
  for (const k of KEYS) for (const l of LANGS) assert.ok(!T[k][l].includes("%"), `${k}.${l} contient %`);
});
