// test/quiz-i18n.test.js
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;

const LANGS = ["FR", "EN", "ZH"];
const CLES = [
  "QUIZ_KEEP", "QUIZ_GIVE", "QUIZ_CORRECT", "QUIZ_WRONG", "QUIZ_REVIEW",
  "QUIZ_GIVEN", "QUIZ_TICKER_DON", "QUIZ_TICKER_TOTAL",
  "QUIZ_TITLE_KNOWLEDGE", "QUIZ_TITLE_CONTRIB",
  "QUIZ_SECONDS", "QUIZ_TIMEOUT", "QUIZ_CLOSE",
  "QUIZ_KEPT", "QUIZ_GIVE_REFUSED", "QUIZ_GIVE_UNSURE", "QUIZ_GIVE_UNVERIFIED",
];

test("toutes les cles du quiz existent en FR, EN et ZH", () => {
  for (const cle of CLES) {
    assert.ok(T[cle], "cle manquante : " + cle);
    for (const lang of LANGS) {
      assert.ok(T[cle][lang] && T[cle][lang].trim(), `${cle}/${lang} manquant`);
    }
  }
});

test("les deux boutons ne portent aucun adjectif valorisant", () => {
  for (const lang of LANGS) {
    assert.ok(!/héros|hero|sois|be a /i.test(T.QUIZ_GIVE[lang]), `${lang} : bouton culpabilisant`);
  }
});

// Les deux boutons doivent peser pareil : ni l'un ni l'autre ne porte de montant
// en dur, et « garder » prend son montant du serveur (%d) comme « offrir ».
test("aucun montant en dur dans les libelles de bouton", () => {
  for (const lang of LANGS) {
    assert.ok(!/\b10\b/.test(T.QUIZ_KEEP[lang]), `${lang} : montant fige dans QUIZ_KEEP`);
    assert.match(T.QUIZ_KEEP[lang], /%d/, `${lang} : QUIZ_KEEP doit porter %d`);
  }
});

// Le decompte previent, il ne presse pas : il dit ce qui se passera si le joueur
// ne repond pas (rien n'est offert), sans injonction a donner ni compte a rebours
// dramatise. Et le nombre de secondes vient du code, jamais fige dans le libelle.
test("le message d'expiration annonce le fait, sans pousser au don", () => {
  for (const lang of LANGS) {
    const m = T.QUIZ_TIMEOUT[lang];
    assert.ok(!/vite|hurry|快点|dernière chance|last chance/i.test(m), `${lang} : message pressant`);
  }
  assert.match(T.QUIZ_SECONDS.FR, /%d/, "le decompte doit recevoir les secondes du code");
});

// Convention du depot (components.jsx:30) : un montant s'ecrit « %d FA » dans i18n,
// FaText le remplace par le logo du token. Sans « FA » apres le nombre, pas de logo.
// Le gain va dans le solde VERROUILLE (arte_locked, « misable uniquement »), que
// le bandeau du haut n'affiche pas — il ne montre que le liquide. Un « 10 FA
// gardés » sec laisserait le joueur chercher un solde qui n'a pas bouge.
test("le message de conservation dit ou vont les FA", () => {
  for (const lang of LANGS) {
    assert.ok(/misable|bettable|下注/i.test(T.QUIZ_KEPT[lang]),
      `${lang} : QUIZ_KEPT doit nommer le solde misable, sinon le joueur cherche en vain`);
  }
});

// Un don qui echoue ne doit jamais se taire, et ne doit pas non plus affirmer
// ce qu'on ne sait pas : serveur qui refuse (rien n'est parti) et reseau coupe
// (le serveur a pu commettre le don) sont deux situations differentes.
test("l'echec d'un don distingue le refus du doute", () => {
  for (const lang of LANGS) {
    assert.ok(!/erreur 4\d\d|error 5\d\d|undefined/i.test(T.QUIZ_GIVE_REFUSED[lang]),
      `${lang} : erreur technique brute renvoyee au joueur`);
  }
  assert.match(T.QUIZ_GIVE_REFUSED.FR, /%d FA/, "le refus doit rappeler le montant conserve");
  assert.ok(!/%d/.test(T.QUIZ_GIVE_UNSURE.FR),
    "le doute ne doit annoncer aucun montant : on ignore si le don est passe");
});

// Le refus le plus frequent a une cause precise — le compte n'a pas encore prouve
// d'activite on-chain, et addToBuyback refuse alors le versement au pool. « Don
// impossible » sans la raison ni le geste a faire laisse le joueur devant un mur :
// il croit a une panne, ou que le quiz ne marche pas pour lui.
test("le refus pour compte non verifie dit la cause ET le geste", () => {
  for (const lang of LANGS) {
    const m = T.QUIZ_GIVE_UNVERIFIED[lang];
    assert.ok(!/compte_non_verifie|erreur 4\d\d|400/i.test(m), `${lang} : code technique brut`);
    assert.match(m, /%d FA\b/, `${lang} : le montant conserve doit suivre la convention FaText`);
    assert.ok(/🔒/.test(m), `${lang} : le message doit renvoyer au bandeau de verification`);
  }
});

test("les montants suivent la convention FaText", () => {
  for (const lang of LANGS) {
    for (const cle of ["QUIZ_KEEP", "QUIZ_GIVEN", "QUIZ_KEPT", "QUIZ_TICKER_DON", "QUIZ_TICKER_TOTAL"]) {
      assert.match(T[cle][lang], /%d\s*FA\b/, `${cle}/${lang} : montant hors convention FaText`);
    }
  }
});
