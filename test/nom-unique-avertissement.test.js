// UN SEUL NOM S'AFFICHE (règle produit du 01/10/2026) : « soit tu paies pour un nom, soit tu
// mets ton nom ordinal ». Poser un nom ordinal EFFACE le titre payant (1 000 FA), sans
// remboursement — le serveur applique la règle, l'écran doit donc la DIRE avant le clic.
//
// Ce que ces tests tiennent :
//   1. l'écran Options demande confirmation quand un titre payant est en place ;
//   2. l'écran Personnalisation prévient quand payer un titre va retirer le nom .fb ;
//   3. les deux phrases existent dans les trois langues (un joueur ZH ne lit pas du français) ;
//   4. le client adopte le titre vidé que le serveur renvoie — sinon l'écran afficherait
//      encore « Le Grand » alors que la base ne le porte plus.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = lire("app.jsx");
const SCREENS = lire("screens.jsx");
const I18N = lire("i18n.js");

function bloc(source, entete) {
  const i = source.indexOf(entete);
  assert.ok(i > 0, entete + " introuvable");
  const fin = source.indexOf("\n  }", i);
  return source.slice(i, fin > i ? fin : i + 1200);
}

test("l'écran Options demande confirmation avant de remplacer un titre payant", () => {
  const f = bloc(SCREENS, "function choisirNom");
  assert.match(f, /g\.playerTitle/, "le titre payant doit déclencher l'avertissement");
  assert.match(f, /setConfirmNom\(name\)/, "l'avertissement doit passer par la modale");
  assert.match(f, /sansAvertissement/, "le chemin confirmé doit pouvoir passer outre");
  // Le bouton de la modale rappelle le MÊME chemin d'écriture, avec l'avertissement déjà donné.
  assert.match(SCREENS, /choisirNom\(n, true\)/, "la confirmation doit écrire le nom");
  assert.match(SCREENS, /OP_ORDINAL_REPLACE_BODY/, "la modale doit nommer le titre perdu");
});

test("l'écran Personnalisation prévient avant de payer un titre qui retire le nom .fb", () => {
  const f = bloc(SCREENS, "async function doTitle");
  assert.match(f, /g\.ordinalName/, "le nom ordinal affiché doit déclencher l'avertissement");
  assert.match(f, /setConfirmTitre\(true\)/, "l'avertissement doit passer par la modale");
  assert.match(SCREENS, /PE_TITLE_REPLACE_ORDINAL_BODY/, "la modale doit nommer le nom retiré");
  assert.match(SCREENS, /doTitle\(true\)/, "le bouton confirmé doit lancer l'achat");
  // `onClick={doTitle}` passait l'ÉVÉNEMENT de clic comme premier argument : le garde
  // `!sansAvertissement` aurait été sauté, et le joueur n'aurait jamais vu l'avertissement.
  assert.ok(!/onClick=\{doTitle\}/.test(SCREENS), "le bouton ne doit pas passer l'événement au garde");
});

test("le client adopte le titre vidé renvoyé par le serveur", () => {
  const f = bloc(APP, "async saveOrdinalName(name)");
  assert.match(f, /d\.player_title/, "le titre renvoyé par le serveur doit être adopté");
  assert.match(f, /titleCleared/, "l'écran doit pouvoir dire au joueur que le titre est tombé");
  const t = bloc(APP, "async setTitle(title)");
  assert.match(t, /ordinal_replaced/, "le nom .fb retiré à l'achat d'un titre doit être connu du client");
});

test("les avertissements existent dans les trois langues", () => {
  for (const cle of ["OP_ORDINAL_REPLACE_TITLE", "OP_ORDINAL_REPLACE_BODY", "OP_ORDINAL_REPLACE_BTN",
                     "OP_ORDINAL_REPLACE_CANCEL", "OP_ORDINAL_TITLE_REPLACED",
                     "PE_TITLE_REPLACE_ORDINAL_TITLE", "PE_TITLE_REPLACE_ORDINAL_BODY",
                     "PE_TITLE_REPLACE_ORDINAL_BTN", "PE_TITLE_ORDINAL_REMOVED"]) {
    const m = I18N.match(new RegExp(cle + "\\s*:\\s*\\{[\\s\\S]{0,700}?\\}", "m"));
    assert.ok(m, "clé i18n absente : " + cle);
    for (const langue of ["FR:", "EN:", "ZH:"]) {
      assert.ok(m[0].includes(langue), cle + " sans " + langue);
    }
  }
  // Le remboursement est le point de la règle : le texte doit le dire, dans les trois langues.
  const body = I18N.match(/OP_ORDINAL_REPLACE_BODY[\s\S]{0,700}?\}/)[0];
  assert.match(body, /Aucun remboursement/);
  assert.match(body, /No refund/);
  assert.match(body, /不予退款/);
});

test("le cache-bust accompagne la livraison (un seul oubli sert du code périmé)", () => {
  const index = lire("index.html");
  const data = lire("data.js");
  const sw = lire("sw-policy.js");
  const wire = lire("test/account-wiring.test.js");
  const versions = new Set([...index.matchAll(/\?v=(\d+)/g)].map((m) => m[1]));
  assert.strictEqual(versions.size, 1, "index.html doit porter une seule version : " + [...versions].join(","));
  const v = [...versions][0];
  assert.match(data, new RegExp('FA_ASSET_V = "' + v + '"'));
  assert.match(sw, new RegExp("fa-v" + v));
  assert.match(wire, new RegExp('\\["' + v + '"\\]'));
});
