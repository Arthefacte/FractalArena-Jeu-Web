// test/juice-play.test.js
// juice.js touche le DOM (matchMedia, éléments) → non exécutable en node:test ;
// on verrouille ses invariants au niveau source (modèle finisher-play.test.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "juice.js"), "utf8");

test("expose l'API impérative window.FA_JUICE", () => {
  assert.match(src, /window\.FA_JUICE\s*=/, "export window.FA_JUICE manquant");
  for (const fn of ["hit", "heal", "ko", "lunge", "hitStopMs"]) {
    assert.match(src, new RegExp("function " + fn + "\\s*\\("), "fonction " + fn + " manquante");
  }
});

test("respecte prefers-reduced-motion", () => {
  assert.match(src, /prefers-reduced-motion/, "garde reduced-motion manquant");
});

test("délègue les intensités à FA_JUICE_UI (pas de duplication)", () => {
  assert.match(src, /FA_JUICE_UI/, "juice.js doit consommer le module pur");
  assert.match(src, /shakeIntensity/, "usage de shakeIntensity attendu");
  assert.match(src, /particleSpec/, "usage de particleSpec attendu");
});

test("joue le son via FA_SFX", () => {
  assert.match(src, /FA_SFX/, "juice.js doit jouer le son de combat");
});
