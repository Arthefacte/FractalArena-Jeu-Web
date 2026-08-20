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

test("aucun texte du parcours de liaison n'impose un ordinateur", () => {
  // Le serveur émet un code pour req.authenticated_wallet : TOUTE session
  // authentifiée y a droit, le jeu ouvert dans l'app UniSat compris.
  //
  // Tout le PARCOURS est couvert, pas la seule première étape : la première
  // passe n'avait corrigé que ACC_RECOVER_SUB, et le joueur retombait sur
  // « le compte affiché sur ton ordinateur » à l'écran suivant.
  //
  // Restent volontairement hors liste ACC_LINK_NO_UNISAT et OB_INSTALL_EXT_SUB :
  // ils parlent de l'EXTENSION UniSat, qui n'existe effectivement que sur
  // ordinateur. Ce n'est pas une fausse contrainte, c'est un fait.
  for (const cle of ["ACC_RECOVER_SUB", "OP_DEVLINK_HINT", "DEVLINK_CLAIM_SUB",
                     "DEVLINK_CLAIM_REPLACE", "DEVLINK_FAIL"]) {
    const t = ligne(cle);
    assert.doesNotMatch(t, /ton ordinateur/, cle + " : fait croire qu'un PC est obligatoire");
    assert.doesNotMatch(t, /your computer/, cle + " : idem en anglais");
    assert.doesNotMatch(t, /你电脑上|在电脑上/, cle + " : idem en chinois");
  }
  assert.match(ligne("ACC_RECOVER_SUB"), /appareil où tu es déjà connecté/,
    "le code vient de n'importe quel appareil connecté");
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

test("le panneau permet de copier LE CODE, pas seulement le lien", () => {
  // Depuis qu'on prend un code sur son propre téléphone pour ouvrir sa session
  // dans un autre navigateur, on ne scanne pas son écran : on colle. Et ce
  // qu'on colle est un CODE — voir « https://… » apparaître à la place fait
  // croire qu'on s'est trompé de bouton (signalé par le user).
  const src = read("screens.jsx");
  assert.match(src, /const copierCode = \(\) => copierTexte\(link\.code,/, "le bouton code doit copier le code nu");
  assert.match(src, /const copierLien = \(\) => copierTexte\(window\.FA_DEVICE_LINK\.linkUrl\(/, "le lien reste copiable à part");
  assert.match(src, /OP_DEVLINK_COPY_CODE/, "le bouton doit exister à l'écran");
});

test("sur mobile, récupérer son compte est une vraie option, pas un lien perdu", () => {
  const app = read("app.jsx");
  assert.match(app, /mobile && !hasWallet \?/, "l'écran d'entrée doit distinguer le cas mobile sans wallet");
  assert.match(app, /ACC_ALREADY_LINKED/, "l'option doit exister");
  // Elle doit être un bouton de même rang que celui qui mène à l'app UniSat.
  const i = app.indexOf("ACC_ALREADY_LINKED");
  const bloc = app.slice(i - 300, i + 100);
  assert.match(bloc, /className="btn block"/, "un bouton, pas un lien souligné");
});
