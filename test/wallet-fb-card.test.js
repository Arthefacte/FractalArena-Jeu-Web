// test/wallet-fb-card.test.js
// Cagnotte FB dans l'écran Wallet (demande fondateur 16/10/2026, variante C) : le FB est une monnaie
// SÉPARÉE du FA (dépôt en sats, jamais converti, dépensé en boutique), donc un encart à part — badge
// réel du jeu + solde — et les deux actions FA sur leur propre rangée.
//
// Ce que ces tests tiennent :
//   1. le glyphe « ◎ » ne tient plus lieu de logo : c'est l'asset du jeu (assets/fb-badge.webp), le
//      même que le chip du header, et il passe par FA_ASSET_URL (sans quoi le CDN sert l'ancien) ;
//   2. le solde vient du SERVEUR (GET /fb, authentifié) et l'encart disparaît s'il ne répond pas :
//      aucun solde inventé, et pas de carte vide qui promet un chiffre ;
//   3. la rangée du bas ne contient plus QUE les deux actions FA (Dépôt / Retrait) : mélanger les
//      deux monnaies dans une même rangée de boutons faisait croire à un même solde.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

globalThis.window = {};
require("../i18n.js");
const T = window.FA_I18N.T;
const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const SCREENS = lire("screens.jsx");
const I18N = lire("i18n.js");

// Le corps de l'écran Wallet, borné par le composant suivant (FbCaseModal).
function blocWallet() {
  const i = SCREENS.indexOf("function Wallet()");
  assert.ok(i > 0, "écran Wallet introuvable");
  const fin = SCREENS.indexOf("function FbCaseModal", i);
  assert.ok(fin > i, "fin de l'écran Wallet introuvable");
  return SCREENS.slice(i, fin);
}

test("le logo de la cagnotte FB est l'asset du jeu, plus un glyphe texte", () => {
  const w = blocWallet();
  assert.ok(!/◎ \{I18N\.t\("FB_CASE"\)\}/.test(w), "le glyphe ◎ ne doit plus servir de logo");
  assert.match(w, /FA_ASSET_URL\("assets\/fb-badge\.webp"\)/,
    "le badge FB du jeu doit être chargé via FA_ASSET_URL (cache-busting)");
  assert.match(w, /alt="FB"/);
});

test("le solde FB vient du serveur, et l'encart disparaît s'il ne répond pas", () => {
  const w = blocWallet();
  assert.match(w, /fetch\(`\$\{API_URL\}\/fb\?wallet=/, "le solde FB se lit sur GET /fb");
  assert.match(w, /Authorization: `Bearer \$\{g\.authToken\}`/, "l'appel est authentifié");
  assert.match(w, /\{fbInfo && \(/, "l'encart est conditionné à la réponse serveur");
  assert.ok(!/fbInfo \|\| \{/.test(w), "pas de solde de repli inventé");
});

test("les deux actions FA gardent leur rangée, et la cagnotte FB n'y est plus", () => {
  const w = blocWallet();
  const i = w.indexOf("Les deux actions FA gardent LEUR rangée");
  assert.ok(i > 0, "rangée des actions FA introuvable");
  // Bornée par le bouton suivant (l'historique) : sinon la tranche attrape les boutons d'après et
  // le compte devient faux pour une raison qui n'a rien à voir avec la rangée testée.
  const fin = w.indexOf('setModal("history")', i);
  assert.ok(fin > i, "fin de la rangée des actions FA introuvable");
  // S'arrête à la fermeture de la rangée : la tranche jusqu'au bouton suivant attrape son ouverture
  // (`<button … onClick={() =>`) et le compte devient faux pour une raison hors sujet.
  const rang = w.slice(i, fin).split("</div>")[0];
  assert.match(rang, /I18N\.t\("WL_DEPOSIT"\)/);
  assert.match(rang, /I18N\.t\("WL_WITHDRAW"\)/);
  assert.ok(!/FB_CASE/.test(rang), "la cagnotte FB ne doit plus être un bouton de cette rangée");
  assert.strictEqual((rang.match(/<button /g) || []).length, 2, "exactement deux boutons : Dépôt et Retrait");
});

test("le bouton de l'encart ouvre la modale FB et son libellé existe en FR/EN/ZH", () => {
  const w = blocWallet();
  assert.match(w, /onClick=\{\(\) => setModal\("fb"\)\}/, "le bouton doit ouvrir la modale de dépôt FB");
  assert.match(w, /I18N\.t\("FB_CASE_OPEN"\)/);
  for (const lang of ["FR", "EN", "ZH"]) assert.ok(T.FB_CASE_OPEN[lang], `FB_CASE_OPEN.${lang} manquante`);
  assert.ok(!/%[sd]/.test(T.FB_CASE_OPEN.FR), "pas de placeholder : le libellé est fixe");
  assert.ok(new RegExp("\\bFB_CASE_OPEN:\\s*\\{").test(I18N), "FB_CASE_OPEN absente d'i18n.js");
});

test("l'encart dit la monnaie qui est affichée (libellé FB_CASE) et son montant en FB", () => {
  const w = blocWallet();
  assert.match(w, /I18N\.t\("FB_CASE"\)/, "l'encart doit nommer la cagnotte FB");
  assert.match(w, /\{fbTexte\(fbInfo\.fb_sats\)\}/, "le montant affiché vient du solde serveur");
  assert.match(w, /toFixed\(4\) \+ " FB"/, "même format que la modale (4 décimales + FB)");
});
