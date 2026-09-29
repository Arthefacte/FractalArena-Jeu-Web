// Tirage d'invocation au plafond (badge « ✦ MAX », 1 sur 15) + garde anti-sacrifice en fusion.
//
// Deux décisions produit du 29/09/2026, invisibles côté serveur — donc à verrouiller ICI :
//  1. l'invocation au plafond se LIT (écran d'invocation + carte dans la collection) ;
//  2. la fusion prévient quand l'entité sacrifiée est plus forte que celle conservée, au lieu
//     de laisser un joueur qui ne lit pas le guide perdre son meilleur tirage.
//
// Les tests de LOGIQUE sont dans test/forge-ui.fusion.test.js (forge-ui.js). Ce fichier-ci
// vérifie le CÂBLAGE des composants : un helper correct que personne n'appelle ne protège rien.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const RACINE = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(RACINE, f), "utf8");

// Découpe d'une fonction de premier niveau : jamais une fenêtre de N caractères
// (cf. « Tests qui lisent la source » — une addition légitime ferait sortir le symbole).
function fonction(src, nom) {
  const i = src.indexOf("function " + nom);
  if (i < 0) return "";
  const fin = src.indexOf("\n}", i);
  return src.slice(i, fin > i ? fin : src.length);
}

test("le marqueur de tirage est une DONNÉE : il vit dans le corps de la carte, jamais sur l'art", () => {
  // Doctrine du roster (test/card-badges.test.js) : l'art ne porte que les états
  // d'interaction (coche de sélection, badge de rôle) ; les données descendent dans le corps.
  const card = fonction(read("components.jsx"), "CreatureCard");
  assert.ok(card.length > 0, "CreatureCard introuvable dans components.jsx");
  const art = card.slice(card.indexOf('className="art"'), card.indexOf('className="body"'));
  const corps = card.slice(card.indexOf('className="body"'));
  assert.ok(corps.includes("summon_roll_max"), "le corps de la carte doit porter le marqueur de tirage");
  assert.ok(!art.includes("summon_roll_max"), "le marqueur de tirage ne doit PAS être posé sur l'art");
  assert.match(card, /CARD_ROLL_MAX/, "le libellé du marqueur doit passer par l'i18n");
});

test("l'écran d'invocation annonce le plafond (toast + ligne sous la carte)", () => {
  const src = read("screens.jsx");
  const summon = fonction(src, "ForgeSummon");
  assert.ok(summon.includes("summon_roll_max"), "ForgeSummon doit lire le champ du serveur");
  assert.match(summon, /FG_SUMMON_OK_MAX/, "le toast d'invocation doit distinguer le plafond");
  assert.match(summon, /FG_SUMMON_ROLL_MAX/, "le panneau de résultat doit l'afficher sous la carte");
});

test("la fusion arme une confirmation quand la sacrifiée est plus forte", () => {
  const src = read("screens.jsx");
  const fusion = fonction(src, "ForgeFusion");
  assert.ok(fusion.includes("fusionKeepWarning"), "la garde doit être appelée avec les deux entités sélectionnées");
  assert.match(fusion, /FG_FUSE_WARN/, "l'avertissement doit être affiché");
  assert.match(fusion, /FG_FUSE_CONFIRM/, "le bouton doit demander une confirmation explicite");
  assert.match(fusion, /needConfirm \? setConfirmWeak\(true\) : doFuse\(goldMode\)/,
    "le premier clic ARME la confirmation, le second seulement fusionne — l'ordre inverse annulerait la garde");
  assert.match(fusion, /setConfirmWeak\(false\)/, "changer de sélection doit désarmer la confirmation (sinon elle survit au mauvais couple)");
});

test("les clés i18n du tirage et de la garde existent en FR, EN et ZH", () => {
  const I18N = read("i18n.js");
  for (const cle of ["CARD_ROLL_MAX", "CARD_ROLL_MAX_TIP", "FG_SUMMON_OK_MAX", "FG_SUMMON_ROLL_MAX", "FG_SACRIFICED_STRONG", "FG_FUSE_WARN", "FG_FUSE_CONFIRM"]) {
    const m = I18N.match(new RegExp("\\b" + cle + ":\\s*\\{([^}]*)\\}"));
    assert.ok(m, "clé absente : " + cle);
    for (const lang of ["FR:", "EN:", "ZH:"]) {
      assert.ok(m[1].includes(lang), cle + " : langue manquante " + lang);
    }
  }
});
