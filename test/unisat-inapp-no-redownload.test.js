// test/unisat-inapp-no-redownload.test.js
//
// Boucle vécue le 2026-10-23 (PWA / Safari, téléphone) : le joueur était DANS
// le navigateur de l'app UniSat, son wallet déconnecté dans le jeu. L'écran
// d'accueil ne lui proposait que « Ouvrir dans l'app UniSat » — qui renvoie sur
// app.unisat.cloud/request, une page de TÉLÉCHARGEMENT (le jeu disparaît) — et
// le pont de liaison lui proposait encore « Télécharge-la ».
//
// Ces tests protègent les deux surfaces : on n'envoie plus quelqu'un qui EST
// dans l'app l'installer depuis l'intérieur de l'app.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("accueil : dans l'app UniSat, le bouton principal connecte au lieu de renvoyer vers l'app", () => {
  const src = lire("app.jsx");
  const i = src.indexOf('{mobile ? (');
  assert.ok(i > 0, "branche mobile de l'écran d'accueil introuvable");
  // La branche mobile court jusqu'au début du repli « non mobile » (même
  // parenthèse, même retrait) — pas jusqu'à la première « ) : ( » rencontrée,
  // qui peut être celle d'un ternaire imbriqué.
  const fin = src.slice(i).indexOf(String.fromCharCode(10) + "        ) : (");
  const bloc = src.slice(i, i + fin);
  assert.match(bloc, /hasWallet \?/,
    "dans l'app (provider injecté), il faut une branche qui ne propose PAS le saut");
  assert.match(bloc, /onClick=\{connectUnisat\}/,
    "et cette branche doit connecter avec le portefeuille déjà injecté");
  assert.match(bloc, /onClick=\{OPEN_IN_UNISAT\}/,
    "hors de l'app, le chemin vers l'app reste le seul possible");
});

test("pont de liaison : le lien « télécharge l'app » disparaît quand on est dans l'app", () => {
  const src = lire("account.jsx");
  const i = src.indexOf("function UnisatAppBridge");
  assert.ok(i > 0, "UnisatAppBridge introuvable");
  const bloc = src.slice(i, src.indexOf("function LinkWalletButton", i));
  const j = bloc.indexOf("https://unisat.io/download");
  assert.ok(j > 0, "le lien de téléchargement de secours doit rester pour qui n'a pas l'app");
  const avant = bloc.slice(Math.max(0, j - 400), j);
  assert.match(avant, /estDansAppUnisat\(\)/,
    "le lien doit être gardé par estDansAppUnisat — sinon il réinstalle l'app depuis l'app");
});
