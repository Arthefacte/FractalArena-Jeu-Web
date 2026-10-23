// test/recuperation-compte-connexion.test.js
// ============================================================
// Connexion d'un portefeuille qui appartient DÉJÀ à un compte.
//
// Le compte d'un joueur venu sans portefeuille est une adresse GÉNÉRÉE, dont le
// souvenir ne vit que dans le navigateur. Quand il disparaît (déconnexion, cache
// vidé, autre navigateur), le client ne connaît plus que le portefeuille : il
// signait, puis ouvrait un compte NEUF à cette adresse — le vrai compte devenait
// inatteignable (prod 23/10/2026, 25 000 FA).
//
// Le serveur rend désormais `account` quand le signataire est le portefeuille lié
// d'un compte. Le client doit s'en servir AU LIEU de créer. Ces assertions
// pincent ce contrat : sans elles, une passe suivante peut remettre le chemin
// « connectWallet(addr) » sans que rien ne rougisse.
// ============================================================
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
// Fenêtre du seul geste de connexion par portefeuille.
const iConnect = APP.indexOf("async connectUnisat() {");
const iSuivant = APP.indexOf("// Crée un compte + wallet côté serveur", iConnect);
const CONNECT = iConnect > -1 && iSuivant > iConnect ? APP.slice(iConnect, iSuivant) : "";

test("le compte rendu par le serveur est retenu à l'authentification", () => {
  assert.match(APP, /let lastAuthAccount = null;/,
    "le client a besoin d'un endroit où garder le compte que SEUL le serveur connaît");
  assert.match(APP, /const \{ token, account \} = await vr\.json\(\);/,
    "la réponse de /auth/verify porte `account` : elle doit être lue");
  assert.match(APP, /if \(account && account !== addr\) lastAuthAccount = account;/,
    "un compte égal au signataire n'est pas une redirection");
});

test("l'authentification ne réutilise jamais le compte de l'appel précédent", () => {
  const i = APP.indexOf("async authenticate(addr) {");
  assert.ok(i > -1, "authenticate doit exister");
  const bloc = APP.slice(i, i + 400);
  assert.match(bloc, /lastAuthAccount = null;/,
    "sans remise à zéro, une re-signature hériterait du compte d'un autre portefeuille");
});

test("la connexion entre dans le compte reconnu au lieu d'en créer un", () => {
  assert.ok(CONNECT, "connectUnisat doit rester une fonction de premier niveau, suivie de createAccount");
  const iBranche = CONNECT.indexOf("if (lastAuthAccount) {");
  const iCreation = CONNECT.indexOf("const isNew = await actions.connectWallet(addr, token);");
  assert.ok(iBranche > -1, "la branche « compte reconnu » doit exister dans connectUnisat");
  assert.ok(iCreation > -1, "le chemin de création doit rester (joueur réellement nouveau)");
  assert.ok(iBranche < iCreation,
    "le compte reconnu se traite AVANT toute connexion à l'adresse du portefeuille");
});

test("le compte reconnu garde le bon genre de compte et le bon stockage", () => {
  const branche = CONNECT.slice(CONNECT.indexOf("if (lastAuthAccount) {"));
  assert.match(branche.slice(0, 900), /writeToken\(token, ACC\.KIND_GENERATED\);/,
    "un compte créé sans wallet n'a aucune clé dans le navigateur : jeton en localStorage");
  assert.match(branche.slice(0, 900), /accountKind: ACC\.KIND_GENERATED/,
    "le genre de compte décide du signataire des retraits (portefeuille lié)");
  assert.match(branche.slice(0, 900), /await actions\.connectWallet\(compte, token\);/,
    "c'est l'adresse du COMPTE qui charge la sauvegarde, jamais celle du portefeuille");
});

test("le client demande explicitement la resolution (opt-in)", () => {
  // Le serveur ne résout le compte que si le client le demande. Sans ce drapeau,
  // un client encore en cache recevait un jeton pour son compte tout en utilisant
  // l'adresse de son portefeuille : chaque appel en 401/403, une signature
  // redemandée pour chaque action, joueur bloqué (prod 23/10/2026).
  assert.match(APP, /body: JSON\.stringify\(\{ wallet: signataire, signature, want: "account" \}\)/,
    "l'authentification doit porter want: account — c'est ce qui autorise le serveur à résoudre");
});

test("une re-signature de compte généré passe par le PORTEFEUILLE LIÉ", () => {
  // L'adresse d'un compte créé sans portefeuille n'est signable par personne : le
  // serveur n'en a jamais gardé la clé. Re-signer avec elle ouvrait une popup dont
  // la signature était vérifiée contre le COMPTE — refus, « session expirée » en
  // boucle (prod 23/10/2026). Le signataire est donc le portefeuille lié, et le
  // serveur rend le compte derrière (want: account).
  const i = APP.indexOf("async authenticate(addr) {");
  const fin = APP.indexOf("async connectUnisat()", i);
  const bloc = APP.slice(i, fin > i ? fin : i + 3000);
  assert.match(bloc, /const signataire = compteGenere \? courant\.linkedWallet : addr;/,
    "le signataire doit être le portefeuille lié pour un compte généré");
  assert.match(bloc, /auth\/challenge\?wallet=\$\{encodeURIComponent\(signataire\)\}/,
    "le challenge doit porter sur le signataire, pas sur l'adresse du compte");
  assert.match(bloc, /compteGenere && !courant\.linkedWallet/,
    "sans portefeuille lié, aucune popup ne doit s'ouvrir : elle ne prouverait rien");
});

test("un compte reconnu ne réclame pas l'airdrop de bienvenue", () => {
  const branche = CONNECT.slice(CONNECT.indexOf("if (lastAuthAccount) {"));
  const fin = branche.indexOf("const isNew");
  assert.ok(fin > 0, "la branche doit se terminer avant le chemin de création");
  assert.ok(!/claimAirdropIfNew/.test(branche.slice(0, fin)),
    "le compte existe déjà : réclamer l'airdrop d'un « nouveau » joueur n'a aucun sens");
});
