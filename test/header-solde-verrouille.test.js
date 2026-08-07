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

// (La garde du premier remplissage est verifiee plus bas, dans le bloc de
// useVariationSolde : elle sert desormais les deux soldes.)

test("juice-ui.js est charge avant app.js", () => {
  assert.ok(HTML.indexOf("juice-ui.js") < HTML.indexOf("build/app.js"),
    "app.jsx lit window.FA_JUICE_UI : le module doit exister avant");
});

// --- Les deux soldes, crédit ET débit ---
// Le liquide (« retirable ») bouge autant que le verrouillé : combats, retraits,
// Tour, PvP. Il n'avait qu'une pulsation muette, sans montant.

test("le chip liquide annonce lui aussi son montant", () => {
  const ligne = APP.split("\n").find((l) => /cx\("chip",\s*"liquid"/.test(l));
  assert.ok(ligne, "chip liquide introuvable dans le bandeau");
  assert.match(ligne, /key=\{/, "sans key, l'animation ne rejoue pas");
  assert.match(ligne, /liquidPop/, "le chip liquide doit recevoir sa variation");
});

// Deux effets copies l'un sur l'autre auraient diverge a la premiere correction :
// une seule mecanique sert les deux soldes.
test("les deux soldes partagent la meme mecanique", () => {
  assert.match(APP, /function useVariationSolde\(/, "la mecanique doit etre factorisee");
  const usages = APP.match(/useVariationSolde\(/g) || [];
  assert.ok(usages.length >= 3, "definie une fois, utilisee par les deux soldes");
});

// Un debit n'est pas un gain terne : il se lit d'un coup d'oeil.
test("un debit s'affiche en rouge, un credit en vert", () => {
  const bas = CSS.match(/\.chip-delta\.down\s*\{[^}]*\}/);
  assert.ok(bas, "regle .chip-delta.down introuvable");
  assert.match(bas[0], /--alert/, "un debit doit se voir comme un debit");
  const haut = CSS.match(/\.chip-delta\.up\s*\{[^}]*\}/);
  assert.match(haut[0], /--success/);
});

// Meme garde que pour le verrouille : au login la save arrive d'un coup et le
// liquide passe de 0 a son total.
test("le premier remplissage des deux soldes n'est pas annonce comme un gain", () => {
  const i = APP.indexOf("function useVariationSolde(");
  const bloc = APP.slice(i, i + 700);
  assert.match(bloc, /variationSolde/, "la decision vient de la logique pure");
  assert.match(bloc, /pret|initialise/, "la garde du premier remplissage est absente");
});
