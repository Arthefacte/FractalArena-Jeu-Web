// test/pot-paiements.test.js
// Historique des paiements de la cagnotte (demande fondateur 15/10/2026) : « le jour, l'heure et le
// TXID, des personnes qui ont reçu ».
//
// Ce que ces tests tiennent :
//   1. les six libellés existent dans les TROIS langues, avec les mêmes placeholders (un joueur ZH
//      ne lit pas du français, et un `%d` oublié affiche un « %d » en clair) ;
//   2. le bandeau lit `/pot/history` sur l'instance humaine, page bornée, sans clé ;
//   3. le bouton ne compte que les parts PAYÉES : une part en attente n'est pas une preuve ;
//   4. chaque ligne montre jour + heure, montant, destinataire TRONQUÉ et le TXID cliquable vers le
//      réseau Fractal (UniScan `/fractal/tx/` — `/tx/` cherche sur Bitcoin et rend une page vide) ;
//   5. l'écran ne recompose JAMAIS une adresse entière : le serveur ne sert que la version
//      tronquée (règle D9-5), et l'écran ne doit pas défaire ce choix.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

globalThis.window = {};
require("../i18n.js");
const T = window.FA_I18N.T;
const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const BB = lire("buyback.jsx");
const I18N = lire("i18n.js");

const CLES = ["POT_PAY_BTN", "POT_PAY_MODAL_TITLE", "POT_PAY_MODAL_SUB", "POT_PAY_TOTALS", "POT_PAY_PENDING", "POT_PAY_EMPTY"];

test("les libellés de l'historique des paiements existent en FR/EN/ZH", () => {
  for (const k of CLES) {
    assert.ok(T[k], `${k} manquante`);
    for (const lang of ["FR", "EN", "ZH"]) assert.ok(T[k][lang], `${k}.${lang} manquante`);
  }
});

test("mêmes placeholders dans les trois langues", () => {
  const ph = (s) => (String(s).match(/%[sd]/g) || []).sort().join(",");
  for (const k of CLES) {
    assert.strictEqual(ph(T[k].EN), ph(T[k].FR), `${k} : EN et FR n'ont pas les mêmes placeholders`);
    assert.strictEqual(ph(T[k].ZH), ph(T[k].FR), `${k} : ZH et FR n'ont pas les mêmes placeholders`);
  }
  // Le bouton annonce un NOMBRE de paiements, le récapitulatif un total en FB + un nombre.
  assert.ok(/%d/.test(T.POT_PAY_BTN.FR));
  assert.ok(/%s/.test(T.POT_PAY_TOTALS.FR) && /%d/.test(T.POT_PAY_TOTALS.FR));
});

test("le libellé du panneau dit que la preuve est le TXID et que l'adresse est tronquée", () => {
  // Le joueur doit savoir ce qu'il regarde : une preuve on-chain, pas une liste d'adresses.
  assert.match(T.POT_PAY_MODAL_SUB.FR, /TXID/);
  assert.match(T.POT_PAY_MODAL_SUB.FR, /tronqu/i);
  assert.match(T.POT_PAY_MODAL_SUB.EN, /TXID/);
  assert.match(T.POT_PAY_MODAL_SUB.ZH, /TXID/);
});

test("le bandeau lit /pot/history sur l'instance humaine, page bornée et sans clé", () => {
  assert.match(BB, /\/pot\/history\?instance=human&limit=50/, "appel /pot/history absent du bandeau");
  const i = BB.indexOf("/pot/history?instance=human");
  const ligne = BB.slice(Math.max(0, i - 120), i + 60);
  assert.ok(!/authToken|Authorization|Bearer/.test(ligne), "l'historique est public : aucun jeton dans cet appel");
});

test("le bouton des paiements ne compte que les parts PAYÉES", () => {
  assert.match(BB, /paiements\.paid_count > 0/, "le bouton doit exiger des paiements prouvés");
  assert.ok(!/paiements\.total > 0/.test(BB),
    "compter les parts en attente annoncerait une preuve qui n'existe pas encore");
  assert.match(BB, /I\.t\("POT_PAY_BTN", paiements\.paid_count\)/, "le compte affiché est celui des parts payées");
});

test("chaque ligne montre jour + heure, montant en FB, destinataire et TXID", () => {
  assert.match(BB, /p\.paid_at \|\| p\.draw_at/, "jour et heure : envoi, sinon tirage");
  assert.match(BB, /sats\(p\.share_sats\) \+ " FB"/, "montant en FB");
  assert.match(BB, /\{p\.wallet \|\| "\?"\}/, "destinataire (version tronquée servie par le serveur)");
  assert.match(BB, /uniscan\.cc\/fractal\/tx\//, "TXID cliquable vers le réseau Fractal");
  assert.match(BB, /I\.t\("POT_PAY_PENDING"\)/, "une part sans txid est DITE en attente, jamais un txid vide");
  assert.match(BB, /I\.t\("POT_PAY_EMPTY"\)/, "liste vide : le panneau le dit");
});

test("aucun lien UniScan sur le réseau Bitcoin (/tx/ rend une page vide)", () => {
  assert.ok(!/uniscan\.cc\/tx\//.test(BB), "uniscan.cc/tx/ cherche sur Bitcoin");
  assert.ok(!/fractal\.unisat\.io\/tx\//.test(BB), "la page wallet UniSat n'affiche pas une tx Fractal");
});

test("l'écran ne recompose jamais une adresse entière", () => {
  const i = BB.indexOf("function PanneauPaiements");
  assert.ok(i > 0, "PanneauPaiements introuvable");
  const corps = BB.slice(i, BB.indexOf("function BuybackTicker", i));
  assert.ok(!/p\.wallet\.slice/.test(corps), "l'écran n'a pas à découper l'adresse : le serveur envoie la version tronquée");
  assert.ok(!/slice\(0, ?6\)/.test(corps), "pas de recomposition d'adresse tronquée à la main");
  // Il ne découpe QUE le txid (affichage court) : c'est lui qui est cliquable en entier.
  assert.match(corps, /p\.txid\.slice\(0, 8\)/);
});

test("le panneau est monté et exposé (patron PanneauRachats / PanneauBurns)", () => {
  assert.match(BB, /\{voirPaiements && paiements && <PanneauPaiements hist=\{paiements\}/, "panneau jamais monté");
  assert.match(BB, /<button className="bb-dex-btn" onClick=\{\(\) => setVoirPaiements\(true\)\}>/,
    "le bouton doit ouvrir le panneau");
  assert.match(BB, /PanneauPaiements,/, "composant non exposé");
});

test("les clés utilisées par le bandeau sont bien définies dans i18n.js", () => {
  // Double la garde globale (test/i18n-cles-utilisees.test.js) sur le périmètre de cette feature :
  // une clé des paiements absente s'afficherait EN CLAIR au joueur.
  for (const k of CLES) {
    assert.ok(new RegExp("\\b" + k + ":\\s*\\{").test(I18N), `${k} absente d'i18n.js`);
  }
});
