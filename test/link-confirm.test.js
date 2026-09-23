"use strict";
// Confirmer l'adresse AVANT de lier (incident du 2026-07-30).
//
// Le user a lié son compte de test à l'adresse de son compte de jeu PRINCIPAL,
// sans l'avoir voulu et sans jamais l'avoir vue : `linkWallet()` prenait
// `accounts[0]`, c'est-à-dire le compte actif de l'extension UniSat, et
// enchaînait signature + POST sans rien afficher. Or lier est IRRÉVERSIBLE côté
// jeu (« un compte = un portefeuille »), redirige tous les retraits futurs, et
// déclenche un envoi on-chain de 1 000 sats. Il a fallu un accès direct à la base
// pour le défaire.
//
// Désormais : l'adresse est montrée, et rien ne part avant un geste explicite.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const A = read("account.jsx");
const APP = read("app.jsx");
const I = read("i18n.js");
const IDX = read("index.html");

test("l'ouverture d'UniSat et la liaison sont deux actions distinctes", () => {
  // Tant qu'une seule fonction fait « demander l'adresse + signer + POSTer », il
  // n'existe aucun instant où l'on puisse montrer quoi que ce soit au joueur.
  assert.match(APP, /async requestWalletAddress\(/,
    "il faut pouvoir obtenir l'adresse SANS rien engager");
  assert.match(APP, /async linkWallet\(\s*[A-Za-z_$][\w$]*/,
    "linkWallet doit recevoir l'adresse a lier, pas aller la chercher lui-meme");
});

test("linkWallet ne redemande jamais l'adresse a UniSat", () => {
  // Sinon le compte actif de l'extension a pu changer entre la confirmation et
  // l'envoi : on lierait une adresse que le joueur n'a jamais vue — exactement
  // le bug qu'on corrige, en pire (il croirait avoir confirme).
  const i = APP.indexOf("async linkWallet(");
  const b = APP.slice(i, APP.indexOf("\n    async ", i + 10));
  assert.doesNotMatch(b, /requestAccounts/,
    "l'adresse liee doit etre exactement celle qui a ete confirmee");
});

test("un seul composant porte le geste de liaison", () => {
  assert.match(A, /function LinkWalletButton/,
    "deux implementations divergeraient : l'une confirmerait, l'autre pas");
  // Aucun ecran ne doit appeler linkWallet directement en court-circuitant la
  // confirmation. Seul LinkWalletButton le fait.
  const occurrences = A.split("actions.linkWallet(").length - 1;
  assert.strictEqual(occurrences, 1, "un seul appelant : LinkWalletButton");
});

test("l'adresse est affichee avant que quoi que ce soit ne parte", () => {
  const i = A.indexOf("function LinkWalletButton");
  const b = A.slice(i, A.indexOf("\nfunction ", i + 10));
  assert.match(b, /ACC_LINK_CONFIRM/, "le joueur doit lire l'adresse exacte");
  assert.match(b, /requestWalletAddress/, "l'adresse vient d'UniSat, pas d'une saisie");
  // La confirmation garde l'adresse dans un etat, et c'est CETTE valeur qui part.
  assert.match(b, /useState/, "l'adresse en attente de confirmation doit vivre quelque part");
});

test("le geste est annulable sans consequence", () => {
  const i = A.indexOf("function LinkWalletButton");
  const b = A.slice(i, A.indexOf("\nfunction ", i + 10));
  assert.match(b, /ACC_LINK_CANCEL/,
    "renoncer doit etre possible : c'est le seul moment ou le joueur peut encore reculer");
});

test("l'irreversibilite est dite, pas sous-entendue", () => {
  const bloc = (cle) => {
    const m = I.match(new RegExp("\\b" + cle + ":\\s*\\{[^}]*\\}"));
    return m ? m[0] : null;
  };
  const c = bloc("ACC_LINK_CONFIRM");
  assert.ok(c, "ACC_LINK_CONFIRM absente");
  assert.match(c, /définitif|definitif|permanent|une seule fois/i,
    "« un compte = un portefeuille » : le joueur doit savoir qu'il n'y a pas de retour");
  for (const k of ["ACC_LINK_CONFIRM", "ACC_LINK_CONFIRM_BTN", "ACC_LINK_CANCEL"]) {
    const b = bloc(k);
    assert.ok(b, k + " absente");
    for (const lang of ["FR", "EN", "ZH"]) {
      const m = b.match(new RegExp(lang + ':\\s*"([^"]*)"'));
      assert.ok(m && m[1].trim(), `${k} → ${lang} vide`);
    }
  }
});

test("le sous-titre de la fenetre de fin ne parle de lier que quand il faut lier", () => {
  // Constate en prod le 2026-07-30 : la fenetre affichait « Il te reste a relier
  // un portefeuille » a l'etape txid, alors que le portefeuille etait deja lie.
  const i = A.indexOf("function DiscoveryFinish");
  const b = A.slice(i, A.indexOf("\nfunction ", i + 10));
  assert.match(b, /discoveryNextAction/,
    "la fenetre doit connaitre l'etape en cours pour choisir son texte");
  const j = b.indexOf("DISC_FINISH_SUB");
  assert.ok(j > 0, "sous-titre introuvable");
  assert.match(b.slice(Math.max(0, j - 200), j), /["']link["']/,
    "le sous-titre « relie un portefeuille » doit etre conditionne a l'etape link");
});

test("le cache-bust suit la version", () => {
  const m = IDX.match(/build\/account\.js\?v=(\d+)/);
  assert.ok(m && Number(m[1]) >= 100, "version bumpee pour cette livraison");
});

test("sans extension sur ordinateur, la fenetre de liaison porte le lien de telechargement UniSat", () => {
  // Le parcours se termine sur cette fenetre pour un compte cree SANS wallet —
  // donc pour un joueur qui n'a rien installe. Le texte lui disait seulement que
  // la signature « viendra d'ailleurs », sans lui donner ou la prendre : il
  // fallait sortir du jeu et chercher (constate le 2026-09-23).
  const i = A.indexOf("function LinkWalletButton");
  const b = A.slice(i, A.indexOf("\nfunction ", i + 10));
  assert.ok(b.length > 0, "LinkWalletButton introuvable");
  assert.match(b, /chemin === "desktop"/,
    "le lien de telechargement doit viser le cas SANS extension sur ordinateur");
  assert.match(b, /https:\/\/unisat\.io\/download/,
    "le lien de telechargement doit etre dans la fenetre, pas seulement decrit en texte");
  assert.match(b, /target="_blank"/,
    "sans _blank, partir installer remplace le jeu et fait perdre la session en cours");
  assert.match(b, /ACC_LINK_INSTALL_HINT/,
    "l'extension ne s'injecte qu'au chargement : le rechargement doit etre dit");
  assert.match(b, /OB_INSTALL_EXT_BTN/,
    "le libelle du bouton vient du meme lexique que l'accueil (« Telecharger UniSat »)");
});

test("le pont mobile ne laisse pas « ouvrir dans l'app » sans l'app", () => {
  // App absente = rien ne s'ouvre, et les etapes parlent d'une installation que
  // le joueur n'avait aucun moyen de faire depuis cet ecran.
  const i = A.indexOf("function UnisatAppBridge");
  const b = A.slice(i, A.indexOf("\nfunction ", i + 10));
  assert.match(b, /https:\/\/unisat\.io\/download/, "le lien de telechargement de l'app manque");
  assert.match(b, /UAPP_INSTALL/, "le libelle doit exister dans les trois langues");
});

test("les textes neufs existent en FR/EN/ZH", () => {
  for (const k of ["ACC_LINK_INSTALL_HINT", "ACC_LINK_RELOAD", "UAPP_INSTALL"]) {
    const m = I.match(new RegExp("\\b" + k + ":\\s*\\{[^}]*\\}"));
    assert.ok(m, k + " absente de i18n.js");
    for (const lang of ["FR", "EN", "ZH"]) {
      const v = m[0].match(new RegExp(lang + ':\\s*"([^"]*)"'));
      assert.ok(v && v[1].trim(), `${k} → ${lang} vide`);
    }
  }
});
