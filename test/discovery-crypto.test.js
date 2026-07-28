"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const A = read("account.jsx");
const APP = read("app.jsx");

test("le volet crypto lit son etat du serveur", () => {
  assert.match(A, /discoveryState/, "l'etat du parcours doit venir du serveur");
  for (const champ of ["game_done", "dust_sent", "txid_verified"]) {
    assert.match(A, new RegExp(champ), `champ ${champ} jamais lu`);
  }
});

test("la partie crypto est fermee tant que le volet jeu n'est pas fini", () => {
  assert.match(A, /DISC_CRYPTO_LOCKED/,
    "le joueur doit comprendre POURQUOI c'est ferme, sinon il croit a un bug");
});

test("les trois etats d'attente ont chacun leur message", () => {
  for (const k of ["DISC_DUST_WAIT", "DISC_DUST_ARRIVED", "DISC_TXID_OK"]) {
    assert.match(A, new RegExp(k), `message ${k} absent`);
  }
});

test("les echecs de txid sont distingues", () => {
  assert.match(A, /DISC_TXID_BAD/, "mauvais txid");
  assert.match(A, /DISC_TXID_NONE/, "poussiere pas encore partie");
});

test("le champ txid n'est pas capitalise par le clavier mobile", () => {
  const i = A.indexOf("DISC_TXID_PLACEHOLDER");
  assert.ok(i > 0, "champ txid absent");
  const bloc = A.slice(Math.max(0, i - 900), i + 400);
  assert.match(bloc, /autoCapitalize="off"/,
    "un txid est de l'hexadecimal : la capitalisation automatique le rendrait invalide");
  assert.match(bloc, /autoCorrect="off"/);
});

// Ecart au plan : un joueur venu avec UniSat mais pas encore verifie voit LUI AUSSI
// ce bandeau (onchain_verified = FALSE a la creation). Il n'a aucun parcours —
// le serveur lui rend {eligible:false}. Lui afficher « termine les six etapes
// ci-dessus » le renverrait vers un ecran qui n'existe pas pour lui.
test("un joueur venu avec UniSat ne voit pas le parcours", () => {
  assert.match(A, /\.eligible/,
    "le volet parcours doit etre conditionne a l'eligibilite rendue par le serveur");
});

// Sans cela, « lie, poussiere en route » et « pas encore lie » sont indiscernables :
// dust_sent vaut false dans les deux cas.
test("l'etape « lier » se distingue de l'etape « attendre la poussiere »", () => {
  assert.match(A, /linkedWallet/,
    "il faut savoir si un portefeuille est deja lie pour choisir le message");
});

test("le portefeuille lie est rehydrate depuis /save", () => {
  // Il n'etait ecrit qu'au moment de la liaison : au rechargement, l'etat le
  // perdait et le volet serait retombe sur « lie ton portefeuille » alors que
  // c'est deja fait. Le serveur expose linked_wallet depuis la PR #67.
  assert.match(APP, /linkedWallet\s*=\s*save\.linked_wallet|linkedWallet:\s*save\.linked_wallet/,
    "app.jsx doit lire save.linked_wallet au chargement");
});
