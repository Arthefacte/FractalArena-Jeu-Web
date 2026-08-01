"use strict";
// La fenêtre « Bien joué » (decision du user, 2026-07-29).
//
// Le volet crypto n'avait qu'une seule porte : le bandeau « Tes gains sont
// verrouillés ». Ce bandeau est fermable, et se tait alors 24 h. Un joueur qui
// l'avait fermé finissait ses six étapes sans qu'aucun écran ne lui propose de
// lier son portefeuille — il ne lui restait plus que la console du navigateur
// pour effacer la clé de fermeture. C'était le défaut relevé le 2026-07-29.
//
// Désormais : à la réclamation qui termine le volet jeu, la fenêtre s'ouvre
// d'elle-même ; et le panneau du parcours garde une porte permanente, qu'aucun
// geste ne peut refermer pour 24 h.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const A = read("account.jsx");
const Q = read("quests.jsx");
const I = read("i18n.js");
const IDX = read("index.html");

test("la fenetre de fin est un composant a part, exporte", () => {
  assert.match(A, /function DiscoveryFinish/, "composant absent");
  assert.match(A, /Object\.assign\(window,[^)]*DiscoveryFinish/,
    "les composants du jeu se rendent disponibles par window (pas de bundler)");
});

test("la fenetre de fin ne depend pas du bandeau fermable", () => {
  // Borne au composant lui-meme : LockedBanner, juste apres dans le fichier, lit
  // legitimement la cle de fermeture — c'est SA porte, pas celle-ci.
  const i = A.indexOf("function DiscoveryFinish");
  assert.ok(i > 0, "composant absent");
  const fin = A.indexOf("\n}", A.indexOf("return (", i));
  const b = A.slice(i, fin);
  assert.doesNotMatch(b, /shouldShowLockedBanner|DISMISS_KEY|dismissedAt/,
    "c'est tout l'objet du correctif : cette porte ne doit pas pouvoir etre condamnee pour 24 h");
});

test("le volet crypto est partage, pas duplique", () => {
  // Deux copies divergent : l'une gagnerait un etat que l'autre n'a pas, et le
  // joueur verrait un ecran different selon la porte empruntee.
  const champ = A.split("DISC_TXID_PLACEHOLDER").length - 1;
  assert.strictEqual(champ, 1, "le champ txid ne doit exister qu'une fois dans le fichier");
  assert.match(A, /function CryptoVolet/, "le volet doit etre extrait en composant reutilisable");
});

test("l'etape restante vient du helper teste, pas d'une condition recopiee", () => {
  // « Que reste-t-il a faire du volet crypto ? » se decide en UN endroit,
  // account-ui.js, testable sans navigateur. Les .jsx affichent l'etat rendu par
  // le serveur (les cinq etats du volet), mais la DECISION d'ouvrir la fenetre et
  // de garder la porte visible ne doit pas etre re-derivee ailleurs.
  const ACCUI = read("account-ui.js");
  assert.match(ACCUI, /function discoveryNextAction/, "la regle vit dans account-ui.js");
  assert.match(Q, /ACC\.discoveryNextAction/, "le panneau du parcours l'appelle au lieu de la reecrire");
  assert.doesNotMatch(Q, /game_done/,
    "le panneau ne doit pas relire lui-meme les drapeaux : c'est la porte ouverte a deux verites divergentes");
});

test("le panneau du parcours ouvre la fenetre quand la derniere etape vient d'etre reclamee", () => {
  assert.match(Q, /DiscoveryFinish/, "le panneau doit pouvoir monter la fenetre");
  assert.match(Q, /discoveryNextAction/,
    "l'ouverture se decide sur l'etat serveur relu apres la reclamation, jamais sur un compteur local");
});

test("le panneau garde une porte permanente vers le volet crypto", () => {
  assert.match(Q, /DISC_FINISH_OPEN/,
    "un joueur qui a ferme le bandeau et quitte l'ecran doit pouvoir revenir a cette etape");
});

test("le gain de l'epreuve du txid est annonce, et lu du serveur", () => {
  assert.match(A, /txid_reward/,
    "le montant ne doit pas etre recopie cote client : le serveur en est la source");
  assert.match(A, /DISC_TXID_REWARD/, "le joueur doit voir ce que l'etape rapporte avant de la faire");
});

// --- i18n ---

const bloc = (cle) => {
  const m = I.match(new RegExp("\\b" + cle + ":\\s*\\{[^}]*\\}"));
  return m ? m[0] : null;
};

test("les nouvelles cles existent en FR/EN/ZH", () => {
  const manquantes = [];
  for (const k of ["DISC_FINISH_TITLE", "DISC_FINISH_SUB", "DISC_FINISH_OPEN", "DISC_TXID_REWARD"]) {
    const b = bloc(k);
    if (!b) { manquantes.push(k + " (absente)"); continue; }
    for (const lang of ["FR", "EN", "ZH"]) {
      const m = b.match(new RegExp(lang + ':\\s*"([^"]*)"'));
      if (!m || !m[1].trim()) manquantes.push(k + " → " + lang);
    }
  }
  assert.deepStrictEqual(manquantes, []);
});

test("plus aucun texte n'exige du Fractal Bitcoin pour lier son portefeuille", () => {
  // C'etait la boucle : « joue sans wallet » puis « apporte du FB pour debloquer ».
  // Le serveur n'exige plus rien (accounts.js, 2026-07-29) ; un ecran qui le
  // reclamerait encore enverrait le joueur chercher un exchange pour rien.
  const howto2 = bloc("ACC_HOWTO_2");
  assert.ok(howto2, "ACC_HOWTO_2 absente");
  assert.doesNotMatch(howto2, /Assure-toi d'avoir un peu de Fractal Bitcoin/,
    "l'etape 2 du mode d'emploi doit dire l'inverse : un portefeuille vide convient");
  assert.strictEqual(bloc("ACC_LINK_NO_ACTIVITY"), null,
    "ce refus n'existe plus cote serveur : garder son texte laisse un cas mort qui ment");
  assert.doesNotMatch(A, /ACC_LINK_NO_ACTIVITY|"no-activity"/,
    "et le client ne doit plus l'attendre");
});

test("le cache-bust suit la version", () => {
  // Sans bump, les joueurs gardent l'ancien account.jsx en cache et n'ont jamais
  // la nouvelle porte — le correctif serait invisible pour ceux qui en ont besoin.
  const m = IDX.match(/build\/account\.js\?v=(\d+)/);
  assert.ok(m, "account.jsx doit etre versionne dans index.html");
  assert.ok(Number(m[1]) >= 99, "la version doit avoir ete bumpee pour cette livraison");
});
