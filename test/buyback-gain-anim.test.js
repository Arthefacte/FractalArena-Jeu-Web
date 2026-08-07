// test/buyback-gain-anim.test.js
// Un joueur qui offre ses FA au pool de rachat doit voir la jauge bouger. Sans
// ça, « Offrir » est un bouton qui ne produit rien à l'écran — exactement le
// reproche déjà fait à « Garder » (le gain qui ne se voyait nulle part).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const BB = lire("buyback.jsx");
const QUIZ = lire("quiz.jsx");
const CSS = lire("styles.css");
const HTML = lire("index.html");

test("la decision d'animer vient de la logique pure", () => {
  assert.match(BB, /gainsPools/, "buyback.jsx doit consommer FA_JUICE_UI.gainsPools");
});

test("le gain entrant s'affiche sur la jauge concernee", () => {
  assert.match(BB, /bb-delta/, "le montant entrant n'est pas affiche");
  assert.match(CSS, /\.bb-delta/);
  assert.match(CSS, /@keyframes bbDelta/);
});

test("la jauge qui recoit se distingue de celles qui ne bougent pas", () => {
  assert.match(BB, /bb-gain/, "la rangee qui encaisse doit se signaler");
  assert.match(CSS, /\.bb-row\.bb-gain|\.bb-gain/);
});

// Le ticker interroge /buyback/status toutes les 60 s. Sans rafraichissement
// declenche par le don, l'animation tomberait jusqu'a une minute apres le clic
// et ne se rattacherait plus a l'action du joueur.
test("un don rafraichit le ticker tout de suite", () => {
  assert.match(QUIZ, /fa:buyback-refresh/, "quiz.jsx doit signaler le don");
  assert.match(BB, /fa:buyback-refresh/, "buyback.jsx doit ecouter ce signal");
  const bloc = QUIZ.slice(QUIZ.indexOf("async function offrir("), QUIZ.indexOf("async function offrir(") + 1600);
  assert.match(bloc, /dispatchEvent/, "le signal doit partir depuis le don reussi");
});

// Le premier chargement remplit les quatre jauges d'un coup : sans garde, chaque
// ouverture du jeu ferait pleuvoir des « +2 400 ».
test("le premier chargement des pools n'est pas annonce comme un gain", () => {
  assert.match(BB, /poolsPret|initialise/, "la garde du premier chargement est absente");
});

test("juice-ui.js est charge avant buyback.js", () => {
  assert.ok(HTML.indexOf("juice-ui.js") < HTML.indexOf("build/buyback.js"),
    "buyback.jsx lit window.FA_JUICE_UI : le module doit exister avant");
});
