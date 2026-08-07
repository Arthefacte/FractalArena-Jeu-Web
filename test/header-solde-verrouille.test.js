// test/header-solde-verrouille.test.js
// Le quiz crédite le solde VERROUILLÉ (arte_locked, « misable uniquement »). Le
// bandeau du haut l'affichait déjà, mais en gris et sans le moindre mouvement :
// passer de 626 à 636 ne se voyait pas, et le joueur concluait qu'il n'avait
// rien reçu. Seul le solde liquide avait droit à une animation.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = lire("app.jsx");
const CSS = lire("styles.css");
const HTML = lire("index.html");

test("le chip verrouille s'anime quand le solde change", () => {
  // La balise elle-meme, pas son voisinage : le chip liquide juste au-dessus
  // porte deja key et pop, et une fenetre trop large passerait au vert sans
  // qu'aucune animation ne soit branchee sur le verrouille.
  const ligne = APP.split("\n").find((l) => /cx\("chip",\s*"locked"/.test(l));
  assert.ok(ligne, "chip verrouille introuvable dans le bandeau");
  assert.match(ligne, /key=\{/, "sans key, React reutilise le noeud et l'animation ne rejoue pas");
  assert.match(ligne, /"pop"/, "le chip verrouille doit recevoir la meme animation que le liquide");
});

test("la decision d'animer vient de la logique pure, pas du composant", () => {
  assert.match(APP, /variationSolde/, "app.jsx doit consommer FA_JUICE_UI.variationSolde");
});

test("le montant credite s'affiche en clair, signe", () => {
  assert.match(APP, /chip-delta/, "le delta flottant est absent");
  assert.match(CSS, /\.chip-delta/);
  assert.match(CSS, /@keyframes chipDelta/, "le delta doit monter et s'effacer");
  // « +10 » et « -10 » ne veulent pas dire la meme chose : le signe se voit.
  assert.match(APP, /delta\s*>\s*0\s*\?\s*"\+"/, "le signe du delta doit etre explicite");
});

// Au login la save arrive d'un coup (0 -> le solde reel) : sans garde, le joueur
// verrait « +38 610 » a chaque connexion.
test("le premier remplissage du solde n'est pas annonce comme un gain", () => {
  assert.match(APP, /lockedPret|initialise/, "la garde du premier remplissage est absente");
});

test("juice-ui.js est charge avant app.js", () => {
  assert.ok(HTML.indexOf("juice-ui.js") < HTML.indexOf("build/app.js"),
    "app.jsx lit window.FA_JUICE_UI : le module doit exister avant");
});
