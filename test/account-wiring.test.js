// test/account-wiring.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = read("app.jsx");

test("app.jsx delegue le stockage du jeton a FA_ACCOUNT", () => {
  assert.match(APP, /FA_ACCOUNT/, "app.jsx doit consommer les helpers testes, pas redefinir les siens");
  assert.ok(!/function writeToken\(t\)\s*\{\s*try\s*\{\s*if \(t\) sessionStorage\.setItem/.test(APP),
    "l'ancien writeToken code en dur sur sessionStorage subsiste");
});

test("les trois routes de compte sont appelees", () => {
  assert.match(APP, /\/account\/create/);
  assert.match(APP, /\/auth\/recover/);
  assert.match(APP, /\/account\/verify-onchain/);
});

test("la seed et le code ne sont jamais persistes", () => {
  // Aucun stockage ne doit contenir de seed ni de code : ils vivent en etat React.
  assert.ok(!/setItem\([^)]*seed/i.test(APP), "une seed est ecrite dans un stockage");
  assert.ok(!/setItem\([^)]*recovery/i.test(APP), "un code de recuperation est ecrit dans un stockage");
  const blob = APP.match(/localStorage\.setItem\(SAVE_KEY[^;]*/);
  assert.ok(blob, "la persistance du blob est introuvable");
  assert.ok(!/seed|recovery_code/.test(blob[0]), "la seed ou le code fuient dans le blob de sauvegarde");
});

test("un compte genere ne declenche jamais de signature UniSat au boot", () => {
  const i = APP.indexOf("didAutoConnectRef");
  assert.ok(i > 0, "bloc de reconnexion introuvable");
  const bloc = APP.slice(i, i + 1400);
  assert.match(bloc, /KIND_GENERATED|accountKind/,
    "la reconnexion doit distinguer un compte genere : authenticate() n'a rien a signer sans UniSat");
});

test("recoverAccount refuse une seed avant tout appel reseau", () => {
  const i = APP.indexOf("async recoverAccount");
  assert.ok(i > 0, "recoverAccount introuvable");
  const bloc = APP.slice(i, i + 900);
  const iSeed = bloc.indexOf("looksLikeSeed");
  const iFetch = bloc.indexOf("fetch(");
  assert.ok(iSeed > 0, "la garde anti-phishing est absente");
  assert.ok(iSeed < iFetch, "la seed doit etre refusee AVANT de partir sur le reseau");
});

test("connectWallet (branche 404, compte tout juste cree) preserve accountKind", () => {
  // createAccount() met accountKind a jour AVANT d'appeler connectWallet(), qui pour un
  // compte tout juste cree tombe dans la branche 404 (aucune save serveur encore). Cette
  // branche part de {...freshState(), ...} : freshState() remet accountKind a "" si la
  // branche ne le reinjecte pas explicitement depuis l'etat courant -> accountKind resterait
  // "" en memoire pendant toute la session live qui suit une creation de compte.
  const i = APP.indexOf("saveResp.status === 404");
  assert.ok(i > 0, "branche 404 de connectWallet introuvable");
  const bloc = APP.slice(i, i + 700);
  assert.match(bloc, /accountKind:\s*s\.accountKind/,
    "la branche 404 doit reinjecter accountKind depuis l'etat courant (s), sinon freshState() l'ecrase a \"\"");
});

const ACCJSX = read("account.jsx");

test("l'ecran de recuperation ne suggere jamais la seed", () => {
  const i = ACCJSX.indexOf("function RecoverScreen");
  assert.ok(i > 0, "RecoverScreen introuvable");
  const bloc = ACCJSX.slice(i, i + 1800);
  assert.match(bloc, /ACC_RECOVER_PLACEHOLDER/, "le champ doit annoncer un CODE");
  assert.ok(!/ACC_SEED_LABEL|12 mots|mnemonic/i.test(bloc),
    "l'ecran de recuperation ne doit ni demander ni evoquer une saisie de seed");
});

test("l'ecran de recuperation traite le refus de seed", () => {
  const i = ACCJSX.indexOf("function RecoverScreen");
  const bloc = ACCJSX.slice(i, i + 1800);
  assert.match(bloc, /ACC_RECOVER_SEED_REFUSED/,
    "coller une seed doit produire un avertissement explicite, pas un 'code invalide' muet");
});
