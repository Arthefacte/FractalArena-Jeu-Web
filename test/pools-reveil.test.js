// test/pools-reveil.test.js — les jauges de rachat se reveillent sur CHAQUE
// depense, pas seulement sur le don du quiz.
// Constat joueur (09/08) : le don du quiz mettait les pools a jour tout de
// suite (fa:buyback-refresh, v131) mais un achat ou une mise perdue attendait
// le poll de 60 s du ticker. Le point d'ancrage choisi est useVariationSolde :
// toute BAISSE d'un solde est une depense ou une perte, et le serveur credite
// les pools dans la meme transaction que la reponse. Un seul crochet couvre
// donc boosts, forge, invocations, frais du marche et mises perdues — y
// compris les routes de depense futures.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
const QUIZ = fs.readFileSync(path.join(__dirname, "..", "quiz.jsx"), "utf8");

test("une baisse de solde (liquide OU verrouille) reveille le ticker", () => {
  assert.match(APP, /if \(liquidPop\.delta < 0\) reveillePools\(\)/,
    "les depenses liquides (boosts, forge, frais) doivent reveiller les pools");
  assert.match(APP, /if \(lockedPop\.delta < 0\) reveillePools\(\)/,
    "les mises verrouillees perdues doivent reveiller les pools");
  assert.match(APP, /dispatchEvent\(new CustomEvent\("fa:buyback-refresh"\)\)/,
    "le reveil doit passer par l'evenement que le ticker ecoute deja");
});

test("le reveil est borne : la boucle de Fosse ne mitraille pas le serveur", () => {
  const i = APP.indexOf("const reveillePools");
  const bloc = APP.slice(i, i + 400);
  assert.match(bloc, /< 2500\) return;/,
    "sans garde-fou, un combat par seconde = un GET /buyback/status par seconde");
});

test("les hausses ne reveillent pas (les gains ne nourrissent pas les pools)", () => {
  assert.ok(!/liquidPop\.delta > 0\) reveillePools/.test(APP)
    && !/lockedPop\.delta > 0\) reveillePools/.test(APP),
    "un credit (gain, retrait annule) ne doit pas declencher de lecture des pools");
});

test("le don du quiz garde son reveil direct (il precede la baisse de solde)", () => {
  // Le don debite arte_locked via le serveur et rafraichit deja explicitement ;
  // le crochet global est un filet, pas un remplacement.
  assert.match(QUIZ, /dispatchEvent\(new CustomEvent\("fa:buyback-refresh"\)\)/);
});
