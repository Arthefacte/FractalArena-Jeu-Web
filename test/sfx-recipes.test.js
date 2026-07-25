// test/sfx-recipes.test.js
// sfx.js touche document + Web Audio → non exécutable en node:test ; on verrouille
// la présence des recettes de combat au niveau source (modèle finisher-play.test.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "sfx.js"), "utf8");

test("les recettes de combat existent", () => {
  for (const name of ["hit", "crit", "special", "heal", "ko"]) {
    assert.match(src, new RegExp("\\b" + name + ":\\s*\\(t\\)\\s*=>"), "recette " + name + " manquante");
  }
});

test("FA_SFX expose has() pour l'introspection des recettes", () => {
  assert.match(src, /has:\s*\(/, "FA_SFX.has manquant");
});
