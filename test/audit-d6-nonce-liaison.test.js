// test/audit-d6-nonce-liaison.test.js
"use strict";
// ============================================================
// Audit serveur complet 2026-09, D6/F2 et F3 — partie client.
//
// F2 : le serveur indexait les challenges par wallet ; un tiers qui redemandait
//      /auth/challenge pour le wallet du joueur écrasait celui qu'il était en train
//      de signer. Le client renvoie désormais le nonce signé, et le serveur retrouve
//      CE challenge-là (serveur : PR #136).
// F3 : la liaison de portefeuille signait un texte qui ne nommait pas le compte lié.
//      Le challenge porte désormais &account=<compte>, le texte signé le nomme.
//
// Ordre de déploiement : le serveur de la PR #136 D'ABORD. Un serveur plus ancien
// refuserait la liaison signée avec un compte.
// ============================================================
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
const BUILD = fs.readFileSync(path.join(__dirname, "..", "build", "app.js"), "utf8");

// Fenêtre de source à partir d'un marqueur (même méthode que les autres tests de câblage).
function bloc(src, marqueur, n = 4000) {
  const i = src.indexOf(marqueur);
  assert.ok(i > -1, `${marqueur} introuvable`);
  return src.slice(i, i + n);
}

test("F2 : la connexion renvoie le nonce du challenge signé", () => {
  const b = bloc(APP, "&scope=session`");
  const iVerify = b.indexOf("/auth/verify");
  assert.ok(iVerify > -1);
  assert.match(b.slice(iVerify, iVerify + 700), /nonce: ch\.nonce/);
});

test("F2 : le jeton de retrait renvoie le nonce du challenge signé", () => {
  const b = bloc(APP, "async authForWithdraw", 2600);
  const iVerify = b.indexOf("/auth/verify");
  assert.ok(iVerify > -1);
  assert.match(b.slice(iVerify, iVerify + 500), /nonce: ch\.nonce/);
});

test("F2 + F3 : la liaison nomme le compte dans le challenge et renvoie le nonce", () => {
  const b = bloc(APP, "async linkWallet", 3200);
  const iChallenge = b.indexOf("/auth/challenge");
  const iLink = b.indexOf("/account/link-wallet");
  assert.ok(iChallenge > -1 && iLink > iChallenge);
  assert.match(b.slice(iChallenge, iLink), /&account=\$\{encodeURIComponent\(s\.wallet\)\}/,
    "le texte signé doit nommer le compte qui reçoit la liaison");
  assert.match(b.slice(iLink, iLink + 400), /nonce: ch\.nonce/);
});

test("le bundle publié contient les trois changements (pas de source sans rebuild)", () => {
  assert.ok((BUILD.match(/nonce: ch\.nonce/g) || []).length >= 3, "build/app.js non régénéré");
  assert.match(BUILD, /&account=\$\{encodeURIComponent\(s\.wallet\)\}/);
});
