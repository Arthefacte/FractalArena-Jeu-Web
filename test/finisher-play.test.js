// test/finisher-play.test.js
// finisher.js touche le DOM (canvas, rAF, matchMedia) → non exécutable en node:test
// sans jsdom, que le repo n'a pas. On verrouille donc ses invariants au niveau source,
// comme test/arene-replay-spoiler.test.js le fait pour les .jsx.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "finisher.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("expose l'API impérative window.FA_FINISHER.play", () => {
  assert.match(src, /window\.FA_FINISHER\s*=/, "export window.FA_FINISHER manquant");
  assert.match(src, /function play\s*\(/, "fonction play manquante");
});

test("respecte prefers-reduced-motion", () => {
  assert.match(src, /prefers-reduced-motion/, "garde reduced-motion manquant (le jeu le respecte partout ailleurs)");
});

test("le son vit ici et nulle part ailleurs", () => {
  assert.match(src, /FA_SFX/, "le finisher doit jouer le son");
  assert.match(src, /"victory"/, "son de victoire manquant");
  assert.match(src, /"defeat"/, "son de défaite manquant");
});

test("délègue tout le timing à finisher-ui.js (aucune constante de durée en dur)", () => {
  assert.match(src, /FA_FINISHER_UI/, "finisher.js doit consommer la timeline pure");
  assert.ok(!/FIN_DUR\s*=\s*[0-9]/.test(src), "FIN_DUR redéfini ici = duplication du timing");
});

test("lit --accent (pas de couleur de mode en dur)", () => {
  assert.match(src, /--accent/, "le finisher doit prendre l'accent de l'écran");
  assert.ok(!/#FF2D78/.test(src), "couleur d'Arène en dur = --accent contourné");
});

test("index.html déclare les deux fichiers, sans type=module", () => {
  assert.match(html, /<script src="finisher-ui\.js\?v=\d+"><\/script>/, "finisher-ui.js non déclaré");
  assert.match(html, /<script src="finisher\.js\?v=\d+"><\/script>/, "finisher.js non déclaré");
  const iUi = html.indexOf('src="finisher-ui.js');
  const iFin = html.indexOf('src="finisher.js');
  assert.ok(iUi > -1 && iFin > iUi, "finisher-ui.js doit être chargé AVANT finisher.js");
  const iSfx = html.indexOf('src="sfx.js');
  assert.ok(iSfx > -1 && iFin > iSfx, "sfx.js doit être chargé AVANT finisher.js");
});
