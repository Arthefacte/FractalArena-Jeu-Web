// Se connecter à SON compte sur un téléphone, sans passer par l'app UniSat.
//
// Le chemin existait déjà — un code de liaison pris là où l'on est connecté,
// saisi dans « Récupérer mon compte » — mais le jeu affirmait qu'il fallait un
// ordinateur, et l'offrait dans un lien souligné de 11 px sous le pli. Résultat
// vécu par le user : on manque le lien, on touche « Ouvrir dans l'app UniSat »,
// et on y retourne à chaque ouverture.
//
// Ce que ces tests protègent : le vocabulaire (un APPAREIL, pas un ordinateur ni
// un téléphone) et la visibilité de l'option sur mobile.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const I18N = read("i18n.js");
// Certaines entrées tiennent sur une ligne, d'autres s'ouvrent sur « { » et
// courent sur un bloc (une ligne par langue). L'accolade ouvrante en fin de
// ligne dit lequel des deux : pas de seuil de longueur à deviner.
const ligne = (cle) => {
  const i = I18N.indexOf("    " + cle + ":");
  assert.ok(i >= 0, cle + " introuvable");
  const finLigne = I18N.indexOf("\n", i);
  const premiere = I18N.slice(i, finLigne);
  if (!premiere.trimEnd().endsWith("{")) return premiere;
  const finBloc = I18N.indexOf("\n    },", i);
  assert.ok(finBloc > i, cle + " : bloc non refermé");
  return I18N.slice(i, finBloc);
};

test("aucun texte n'impose un ordinateur pour récupérer son compte", () => {
  // Le serveur émet un code pour req.authenticated_wallet : TOUTE session
  // authentifiée y a droit, le jeu ouvert dans l'app UniSat compris.
  const sub = ligne("ACC_RECOVER_SUB");
  assert.doesNotMatch(sub, /sur ton ordinateur/, "ce mot faisait croire qu'un PC était obligatoire");
  assert.doesNotMatch(sub, /on your computer/, "idem en anglais");
  assert.match(sub, /appareil où tu es déjà connecté/, "le code vient de n'importe quel appareil connecté");
});

test("le panneau parle d'un APPAREIL, pas d'un téléphone", () => {
  // « Connecter un téléphone » : on ne pense pas à s'en servir DEPUIS un
  // téléphone, pour emporter sa session vers un autre navigateur du même.
  const t = ligne("OP_DEVLINK_TITLE");
  assert.match(t, /Connecter un autre appareil/);
  assert.doesNotMatch(t, /Connecter un téléphone/);
});

test("l'aide dit comment emporter sa session hors de l'app UniSat", () => {
  assert.match(ligne("OP_DEVLINK_HINT"), /app UniSat/, "le cas qui bloquait le user doit être nommé");
});

test("sur mobile, récupérer son compte est une vraie option, pas un lien perdu", () => {
  const app = read("app.jsx");
  assert.match(app, /mobile && !hasWallet \?/, "l'écran d'entrée doit distinguer le cas mobile sans wallet");
  assert.match(app, /ACC_ALREADY_ELSEWHERE/, "l'option doit exister");
  // Elle doit être un bouton de même rang que celui qui mène à l'app UniSat.
  const i = app.indexOf("ACC_ALREADY_ELSEWHERE");
  const bloc = app.slice(i - 300, i + 100);
  assert.match(bloc, /className="btn block"/, "un bouton, pas un lien souligné");
});
