// test/selection-persistee.test.js — la selection d'equipe survit au rechargement
// (audit du 2026-09-22, liste « ce qui reste a corriger », point 9).
//
// Symptome : on choisit ses 3 entites, on recharge, la selection est vide. Cause :
// loadState() la remettait a zero a chaque chargement (`selected: []`) alors que le
// blob localStorage contient deja tout l'etat (l. 418 serialise `...g`). Le commentaire
// d'origine invoquait les ids orphelins d'une session precedente — le filtre contre le
// roster les ecarte de toute facon, ici comme a la synchro serveur.
//
// Ce que ce test verrouille : la selection est RELUE du blob et FILTREE contre le roster
// restaure. Sans le filtre, un id orphelin passerait pour une entite de l'equipe et
// `selected.length === 3` autoriserait un lancer avec moins de 3 combattants reels.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

// Le bloc de loadState() : du debut de la fonction a la fin du Object.assign de reprise.
function blocLoadState() {
  const i = APP.indexOf("function loadState()");
  assert.ok(i > 0, "loadState() est introuvable dans app.jsx");
  const j = APP.indexOf("function ", i + 10);
  assert.ok(j > i, "fin de loadState() introuvable");
  return APP.slice(i, j);
}

test("au chargement, la selection d'equipe est relue du blob et filtree contre le roster", () => {
  const bloc = blocLoadState();
  assert.match(bloc, /selected: \(Array\.isArray\(s\.selected\) \? s\.selected : \[\]\)\.filter\(/,
    "loadState doit reprendre `s.selected` du blob (et non repartir d'une liste vide)");
  assert.match(bloc, /\.some\(\(b\) => b && b\.id === id\)/,
    "les ids absents du roster restaure doivent etre ecartes au chargement");
});

test("au chargement, la selection n'est PLUS remise a zero", () => {
  const bloc = blocLoadState();
  assert.doesNotMatch(bloc, /selected: \[\],/,
    "`selected: []` a ete reintroduit dans loadState : la selection serait reperdue a chaque rechargement");
});

test("le blob local contient bien la selection (sinon la relecture ne sert a rien)", () => {
  assert.match(APP, /localStorage\.setItem\(SAVE_KEY, JSON\.stringify\(\{ \.\.\.g,/,
    "la sauvegarde locale doit serialiser tout l'etat `g` — c'est ce qui rend `selected` relisible");
});
