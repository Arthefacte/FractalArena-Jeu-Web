"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;
const LANGS = ["FR", "EN", "ZH"];

// [clé, nb d'args attendus] — Champion de soutien (location de puissance)
const KEYS = [
  ["CHAMP_ROW_TITLE", 0],
  ["CHAMP_RENT", 1],
  ["CHAMP_ACTIVE", 1],
  ["CHAMP_CLEAR", 0],
  ["CHAMP_EMPTY", 0],
  ["CHAMP_NEED2", 0],
  ["CHAMP_BORROWED_TAG", 1],
  ["CHAMP_DESIGNATE", 0],
  ["CHAMP_IS", 0],
  ["CHAMP_DESIGNATED_OK", 1],
  ["CHAMP_COMMISSION_ROW", 1],
  ["CHAMP_COMMISSION_GAIN", 1],
  ["CHAMP_USES_TITLE", 0],
  ["CHAMP_USES_LINE", 3],
  ["CHAMP_USES_BY", 1],
  ["CHAMP_POINTS", 0],
  ["CHAMP_POINTS_DESC", 0],
  ["CHAMP_ERR_champion_indisponible", 0],
  ["CHAMP_ERR_champion_epuise", 0],
  ["CHAMP_EXHAUSTED", 0],
  ["CHAMP_USES_EMPTY", 0],
  ["CHAMP_TOTAL_LINE", 2],
];

test("champion : toutes les clés présentes et non vides dans les 3 langues", () => {
  for (const [key] of KEYS) {
    assert.ok(T[key], `clé manquante : ${key}`);
    for (const l of LANGS) assert.ok(typeof T[key][l] === "string" && T[key][l].length > 0, `${key}.${l} vide`);
  }
});

test("champion : nombre de %s/%d conforme au nombre d'args, pas de % dans les 0-arg", () => {
  for (const [key, argc] of KEYS) {
    for (const l of LANGS) {
      const tpl = T[key][l];
      const n = (tpl.match(/%[sd]/g) || []).length;
      assert.strictEqual(n, argc, `${key}.${l} : ${n} placeholders, ${argc} attendus`);
      if (argc === 0) assert.ok(!tpl.includes("%"), `${key}.${l} : % interdit dans un template 0-arg`);
    }
  }
});

test("champion : jamais « bête » ni « mercenaire » dans le texte joueur", () => {
  for (const [key] of KEYS) {
    if (!T[key]) continue;
    assert.ok(!/bête|mercenaire/i.test(T[key].FR), `${key}.FR : vocabulaire interdit`);
  }
});
