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
  assert.match(APP, /const \{ token, account \} = await vr\.json\(\);/,
    "la réponse de /auth/verify porte `account` : elle doit être lue");
  assert.match(APP, /account: resolvedAccount,[\s\S]{0,160}signer: signataire,[\s\S]{0,160}epoch: context\.epoch/,
    "compte, signataire et époque doivent voyager dans un même résultat, jamais dans un global mutable");
  assert.ok(!/lastAuthAccount/.test(APP),
    "le compte résolu ne doit pas pouvoir être repris par une autre authentification");
});

test("l'authentification ne partage un vol qu'avec le même compte et signataire", () => {
  const i = APP.indexOf("authenticate(addr, replacementContext) {");
  assert.ok(i > -1, "authenticate doit exister");
  const bloc = APP.slice(i, i + 1800);
  assert.match(bloc, /const key = `\$\{context\.epoch\}:\$\{addr\}:\$\{signataire\}`;/,
    "la clé du vol doit inclure époque, compte demandé et signataire");
  assert.match(bloc, /authFlightsRef\.current\.get\(key\)/,
    "seul un vol portant exactement cette identité peut être partagé");
});

test("la connexion entre dans le compte reconnu au lieu d'en créer un", () => {
  assert.ok(CONNECT, "connectUnisat doit rester une fonction de premier niveau, suivie de createAccount");
  const iBranche = CONNECT.indexOf("if (compte !== addr) {");
  const iCreation = CONNECT.indexOf("const isNew = await actions.connectWallet(addr, token);");
  assert.ok(iBranche > -1, "la branche « compte reconnu » doit exister dans connectUnisat");
  assert.ok(iCreation > -1, "le chemin de création doit rester (joueur réellement nouveau)");
  assert.ok(iBranche < iCreation,
    "le compte reconnu se traite AVANT toute connexion à l'adresse du portefeuille");
});

test("le compte reconnu garde le bon genre de compte et le bon stockage", () => {
  const auth = APP.slice(APP.indexOf("const kind = resolvedAccount"), APP.indexOf("async connectUnisat()"));
  const branche = CONNECT.slice(CONNECT.indexOf("if (compte !== addr) {"));
  assert.match(auth, /resolvedAccount !== signataire[\s\S]{0,180}\? ACC\.KIND_GENERATED : ACC\.KIND_UNISAT/,
    "un compte distinct du signataire doit être installé comme compte généré");
  assert.match(auth, /installAccount\(context, \{ wallet: resolvedAccount, token, kind, linkedWallet \}\)/,
    "wallet, genre et jeton doivent être installés ensemble avant de charger la sauvegarde");
  assert.match(branche.slice(0, 900), /await actions\.connectWallet\(compte, token\);/,
    "c'est l'adresse du COMPTE qui charge la sauvegarde, jamais celle du portefeuille");
});

test("le client demande explicitement la resolution (opt-in)", () => {
  // Le serveur ne résout le compte que si le client le demande. Sans ce drapeau,
  // un client encore en cache recevait un jeton pour son compte tout en utilisant
  // l'adresse de son portefeuille : chaque appel en 401/403, une signature
  // redemandée pour chaque action, joueur bloqué (prod 23/10/2026).
  assert.match(APP, /body: JSON\.stringify\(\{ wallet: signataire, signature, nonce: ch\.nonce, want: "account" \}\)/,
    "l'authentification doit porter want: account et le nonce signé — c'est ce qui autorise le serveur à résoudre");
});

test("une seule authentification par identité, et le nonce signé est renvoyé", () => {
  // Plusieurs appels simultanés prenaient chacun un 401 et ouvraient chacun une popup ;
  // le dernier challenge écrasait les autres, donc les signatures étaient refusées et
  // le joueur revoyait la popup sans fin (prod 23/10/2026).
  assert.match(APP, /const authFlightsRef = useRef\(new Map\(\)\);/, "les vols en cours doivent être indexés");
  assert.match(APP, /const existing = authFlightsRef\.current\.get\(key\);\s*\n\s*if \(existing\) return existing\.promise;/,
    "authenticate doit partager uniquement le vol de la même clé");
  assert.match(APP, /async _authenticate\(context, signal\) \{/,
    "le corps reste dans _authenticate : un seul endroit fait la signature");
  assert.match(APP, /nonce: ch\.nonce/,
    "le nonce signé doit être renvoyé (sinon le serveur retombe sur le dernier challenge)");
});

test("une re-signature de compte généré passe par le PORTEFEUILLE LIÉ", () => {
  // L'adresse d'un compte créé sans portefeuille n'est signable par personne : le
  // serveur n'en a jamais gardé la clé. Re-signer avec elle ouvrait une popup dont
  // la signature était vérifiée contre le COMPTE — refus, « session expirée » en
  // boucle (prod 23/10/2026). Le signataire est donc le portefeuille lié, et le
  // serveur rend le compte derrière (want: account).
  const i = APP.indexOf("authenticate(addr, replacementContext) {");
  const fin = APP.indexOf("async connectUnisat()", i);
  const bloc = APP.slice(i, fin > i ? fin : i + 3000);
  assert.match(bloc, /const compteRattacheSignable = !base\.replacement && !!base\.linkedAtStart && addr === base\.walletAtStart;/,
    "le signataire se décide sur le PORTEFEUILLE LIÉ, jamais sur le marqueur de genre (qui peut manquer)");
  assert.match(bloc, /const signataire = compteRattacheSignable \? base\.linkedAtStart : addr;/,
    "le signataire doit être le portefeuille lié");
  assert.match(bloc, /auth\/challenge\?wallet=\$\{encodeURIComponent\(signataire\)\}/,
    "le challenge doit porter sur le signataire, pas sur l'adresse du compte");
  assert.match(bloc, /!compteRattacheSignable && !base\.replacement &&[\s\S]{0,100}base\.kindAtStart === ACC\.KIND_GENERATED/,
    "sans portefeuille lié, aucune popup ne doit s'ouvrir : elle ne prouverait rien");
});

test("une session perdue se rouvre par le portefeuille, pas par l'adresse du compte", () => {
  // Au démarrage sans jeton, le client signait l'adresse du COMPTE : signature refusée,
  // redemandée à chaque action (prod 23/10/2026). Avec un portefeuille lié, une seule
  // signature rouvre le compte côté serveur.
  const i = APP.indexOf("const generated = gRef.current.accountKind === ACC.KIND_GENERATED;");
  assert.ok(i > 0, "la reconnexion automatique doit exister");
  const bloc = APP.slice(i, i + 900);
  assert.match(bloc, /if \(!token && gRef\.current\.linkedWallet\) \{[\s\S]*actions\.connectUnisat\(\)/,
    "sans jeton et avec un portefeuille lié, on reconnecte par le portefeuille");
  const iConnect = bloc.indexOf("connectUnisat()");
  const iAuth = bloc.indexOf("actions.authenticate(w)");
  assert.ok(iConnect > 0 && iAuth > 0 && iConnect < iAuth,
    "la reconnexion par portefeuille passe AVANT la signature impossible");
});

test("une nouvelle version prend le relais sans fenêtre privée", () => {
  // Le service worker fait skipWaiting + clients.claim, mais la page en cours garde
  // l'ancien code : sans rechargement, un correctif livré n'atteint jamais le joueur
  // (prod 23/10/2026 — « il n'a pas à ouvrir une fenêtre privée »).
  const SWR = fs.readFileSync(path.join(__dirname, "..", "sw-register.js"), "utf8");
  assert.match(SWR, /addEventListener\("controllerchange"/,
    "la page doit réagir à la prise de contrôle du nouveau service worker");
  assert.match(SWR, /location\.reload\(\)/, "…et se recharger une fois");
  assert.match(SWR, /avaitControleur/, "une première visite ne doit pas être rechargée");
  assert.match(SWR, /\.update\(\)/, "le navigateur doit aller chercher la nouvelle version sans attendre 24 h");
});

test("un compte reconnu ne réclame pas l'airdrop de bienvenue", () => {
  const branche = CONNECT.slice(CONNECT.indexOf("if (compte !== addr) {"));
  const fin = branche.indexOf("const isNew");
  assert.ok(fin > 0, "la branche doit se terminer avant le chemin de création");
  assert.ok(!/claimAirdropIfNew/.test(branche.slice(0, fin)),
    "le compte existe déjà : réclamer l'airdrop d'un « nouveau » joueur n'a aucun sens");
});
