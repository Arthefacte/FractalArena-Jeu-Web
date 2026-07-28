"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const Q = fs.readFileSync(path.join(__dirname, "..", "quests.jsx"), "utf8");

test("la section du parcours existe et vient en tete", () => {
  assert.match(Q, /DISC_TITLE/, "titre du parcours absent");
  const iDisc = Q.indexOf("DISC_TITLE");
  const iDaily = Q.indexOf("Q_TITLE");
  assert.ok(iDisc > 0 && iDaily > 0 && iDisc < iDaily,
    "le parcours doit s'afficher AVANT les quetes du jour : c'est la premiere chose a faire");
});

test("les six etapes ont leur libelle, resolu par identifiant", () => {
  // Table de correspondance, comme Q_LABEL / QW_LABEL dans le meme fichier : une
  // cle i18n manquante se voit a la lecture, au lieu de produire une cle brute
  // a l'ecran via une concatenation silencieuse.
  for (const id of ["d_win", "d_paid", "d_level", "d_camp", "d_tower", "d_pvp"]) {
    assert.match(Q, new RegExp(id + '\\s*:\\s*"DISC_'), `etape ${id} sans libelle`);
  }
});

test("la section reutilise les styles des quetes, pas des classes inventees", () => {
  const i = Q.indexOf("DISC_TITLE");
  const bloc = Q.slice(i, i + 2500);
  for (const cls of ["q-list", "q-row", "q-info", "q-name", "q-reward", "q-bar", "q-fill", "q-foot", "q-prog", "q-claim"]) {
    assert.ok(bloc.includes(cls), `classe ${cls} non reutilisee — le parcours doit ressembler au reste du jeu`);
  }
});

test("la section disparait quand tout est reclame", () => {
  assert.match(Q, /game_done|every\(/,
    "un tutoriel termine ne doit plus occuper l'ecran");
});

// Ecart au plan : le contrat serveur documente omettait `eligible`. Le parcours
// est reserve aux comptes generes (discovery.js:85, seed_encrypted != null). Un
// joueur venu avec UniSat recoit {eligible:false, steps:[]} et ne doit rien voir.
test("un compte non eligible ne voit aucun parcours", () => {
  assert.match(Q, /\.eligible/,
    "l'eligibilite doit etre lue explicitement, pas deduite d'un tableau vide");
});

test("le client n'invente aucune progression", () => {
  // Tout vient de /discovery/state : aucun calcul local a partir de l'etat du jeu.
  const i = Q.indexOf("DISC_TITLE");
  const bloc = Q.slice(Math.max(0, i - 2000), i + 3000);
  assert.ok(!/g\.roster|g\.liquid|g\.locked/.test(bloc),
    "la progression du parcours ne se derive jamais de l'etat client");
});

test("le bouton est desactive tant que l'etape n'est pas accomplie", () => {
  const i = Q.indexOf("DISC_CLAIM");
  assert.ok(i > 0, "bouton de reclamation absent");
  const bloc = Q.slice(Math.max(0, i - 1500), i + 800);
  assert.match(bloc, /disabled/, "sans cela le joueur clique et recoit un refus serveur incomprehensible");
});
