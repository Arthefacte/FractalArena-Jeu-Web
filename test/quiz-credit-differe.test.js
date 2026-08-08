// test/quiz-credit-differe.test.js
//
// Le serveur ne peut PAS attendre le choix du joueur pour créditer : il doit dire
// « bonne réponse » avant que « garder ou offrir » ait un sens, et /quiz/answer
// crédite donc toujours les 10 FA (quiz.js, resolveAnswer). L'affichage, lui, n'a
// aucune raison de suivre ce calendrier : montrer +10 au chip verrouillé AVANT le
// choix, puis −10 dès que le joueur offre, faisait de « garder » un acquis déjà en
// poche et de « offrir » une reprise — deux options qui ne pèsent plus pareil, et
// un joueur qui croit voir ses FA partir chez lui ET dans la poule.
//
// Règle : le solde affiché ne bouge qu'UNE fois, au moment du choix, et seulement
// si le gain reste au joueur.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = lire("app.jsx");
const quiz = lire("quiz.jsx");

// Découpe le corps d'une action de app.jsx (jusqu'à l'action suivante).
function bloc(src, debut, fin) {
  const i = src.indexOf(debut);
  assert.ok(i >= 0, debut + " introuvable");
  const j = src.indexOf(fin, i);
  assert.ok(j > i, fin + " introuvable après " + debut);
  return src.slice(i, j);
}

test("answerQuiz ne fait plus bouger le solde affiche", () => {
  const b = bloc(app, "async answerQuiz", "async donateQuiz");
  assert.ok(!/setG\(/.test(b), "answerQuiz ne doit plus toucher au solde : le choix n'est pas fait");
});

test("donateQuiz ne retire pas un gain qui n'a jamais ete affiche", () => {
  const b = bloc(app, "async donateQuiz", "async fetchQuizTicker");
  assert.ok(!/locked:[\s\S]{0,80}-\s*donne/.test(b),
    "plus de debit d'affichage : rien n'a ete credite avant le choix");
});

test("le credit d'affichage est une action dediee", () => {
  assert.match(app, /creditQuizGain/, "action creditQuizGain absente");
  const b = bloc(app, "creditQuizGain", "async fetchQuizTicker");
  assert.match(b, /locked:\s*\(st\.locked\s*\|\|\s*0\)\s*\+/, "creditQuizGain doit ajouter au verrouille");
});

test("garder() applique le credit au moment du choix", () => {
  const b = bloc(quiz, "function garder(", "async function offrir(");
  assert.match(b, /creditQuizGain/, "garder() doit rendre le gain visible");
});

test("un don accepte ne fait bouger aucun solde du joueur", () => {
  const b = quiz.slice(quiz.indexOf("async function offrir("));
  const succes = b.slice(b.indexOf("if (r.ok)"), b.indexOf("} else if"));
  assert.ok(!/creditQuizGain/.test(succes), "offrir reussi : les FA vont au pool, pas au joueur");
  assert.match(succes, /fa:buyback-refresh/, "seule la jauge de rachat doit bouger");
});

test("un don refuse par le serveur rend le gain visible", () => {
  // Refus = le serveur n'a rien pris (fenetre ecoulee, compte non verifie, 429) :
  // les 10 FA sont bien au joueur, l'ecran doit le montrer.
  const b = quiz.slice(quiz.indexOf("async function offrir("));
  const refus = b.slice(b.indexOf("} else {"), b.indexOf("fermer();", b.indexOf("} else {")));
  assert.match(refus, /creditQuizGain/, "un refus laisse les FA au joueur : le solde doit le dire");
});

// Le refus le plus frequent (compte pas encore verifie on-chain) a sa propre cause
// et son propre geste : le fondre dans le message generique « don impossible »
// laissait le joueur sans rien a faire de cette information.
test("le refus pour compte non verifie a son propre message", () => {
  const b = quiz.slice(quiz.indexOf("async function offrir("));
  assert.match(b, /compte_non_verifie/, "le cas doit etre reconnu, pas noye dans le refus generique");
  assert.match(b, /QUIZ_GIVE_UNVERIFIED/, "message dedie absent");
  // Et les FA restent au joueur, comme pour tout refus serveur.
  const iCas = b.indexOf("compte_non_verifie");
  assert.match(b.slice(Math.max(0, iCas - 400), iCas + 400), /creditQuizGain/,
    "un refus laisse les FA au joueur : le solde doit le montrer");
});

test("le doute reseau se leve par une relecture du solde, pas par un pari", () => {
  const b = bloc(app, "async donateQuiz", "async fetchQuizTicker");
  assert.match(b, /catch[\s\S]{0,600}\/save\//,
    "en cas de coupure, relire le solde serveur plutot que deviner s'il faut crediter");
  assert.ok(!/creditQuizGain/.test(b), "donateQuiz ne decide pas du credit : elle relit la verite serveur");
});
