// Le roster est SERVER-OWNED (server.js, accounts.js depuis la PR #69). Le client
// ne doit plus en fabriquer un quand le serveur n'en renvoie pas : ce repli a
// masque pendant tout le lot « compte sans wallet » un compte qui n'avait aucune
// creature en base et auquel le serveur refusait donc tous les combats (400).
// L'ecran paraissait normal, la panne etait invisible.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

function blocServerToState() {
  const i = APP.indexOf("function serverToState");
  assert.ok(i > 0, "serverToState introuvable");
  return APP.slice(i, i + 1200);
}

test("serverToState ne fabrique aucun roster", () => {
  assert.ok(!/starterRoster/.test(blocServerToState()),
    "un roster fabrique ici masque un serveur qui n'en a pas — la panne devient invisible");
});

test("serverToState prend les creatures du serveur telles quelles", () => {
  assert.match(blocServerToState(), /save\.creatures/,
    "le roster affiche doit etre celui du serveur");
});

test("un roster serveur vide reste vide a l'ecran", () => {
  // Une collection vide est un symptome lisible : elle envoie chercher la cause
  // au bon endroit. Une equipe fantome, non persistee et regeneree a chaque
  // chargement, envoie chercher partout ailleurs.
  const bloc = blocServerToState();
  const m = bloc.match(/const roster = ([^;]+);/);
  assert.ok(m, "declaration du roster introuvable");
  assert.ok(!/\?[^:]*:/.test(m[1]) || !/starterRoster/.test(m[1]),
    `aucun repli ne doit subsister : ${m[1].trim()}`);
});
