// test/exp-fx-cards.test.js
// L'animation de lancement d'expédition doit montrer LES cartes du joueur
// (visuel réel via D.artFor, cadre par rang), pas des tuiles génériques
// glyphe+nom. Verrouillage au niveau source, comme finisher-hooks.test.js.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "expeditions.jsx"), "utf8");

test("l'overlay de lancement affiche le vrai visuel des entités (artFor)", () => {
  const fx = src.match(/function renderFx\(\)[\s\S]*?\n  \}/);
  assert.ok(fx, "renderFx introuvable");
  assert.match(fx[0], /D\.artFor\(b\)/, "les cartes de l'animation doivent porter le visuel réel (D.artFor)");
  assert.match(fx[0], /D\.ART\[b\.image_key\]/, "le repli d'image (onError → D.ART) doit exister, comme sur les autres cartes");
});

test("le glyphe générique ne subsiste qu'en repli (entité introuvable)", () => {
  const fx = src.match(/function renderFx\(\)[\s\S]*?\n  \}/);
  const glyphes = [...fx[0].matchAll(/EXP_GLYPH/g)];
  assert.ok(glyphes.length <= 1, "le glyphe ne doit servir que de repli, pas de visuel principal");
});
