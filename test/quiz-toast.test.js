// test/quiz-toast.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = lire("quiz.jsx");
const css = lire("styles.css");
const app = lire("app.jsx");
const html = lire("index.html");

test("les deux boutons passent par i18n, jamais de texte en dur", () => {
  assert.match(src, /QUIZ_KEEP/);
  assert.match(src, /QUIZ_GIVE/);
  assert.ok(!/Garder 10 FA/.test(src), "libelle en dur");
});

test("le choix de destination n'apparait pas en revision", () => {
  assert.match(src, /revision/);
});

test("les deux boutons partagent la meme classe CSS (poids visuel identique)", () => {
  const boutons = src.match(/className="[^"]*quiz-choice[^"]*"/g) || [];
  assert.ok(boutons.length >= 2, "les deux boutons doivent porter la meme classe");
});

test("la classe du toast existe dans styles.css", () => {
  assert.match(css, /\.quiz-toast/);
});

// Une question ignoree n'est pas consommee : l'auto-effacement ferme le toast
// sans appeler /quiz/answer, sinon le joueur perdrait la question sans y toucher.
test("l'auto-effacement utilise QUIZ_TOAST_MS", () => {
  assert.match(src, /QUIZ_TOAST_MS/);
});

// Aucune bulle pendant un combat, une modale ou une signature : un seul point de
// verite (la classe fa-busy sur <body>), pose par FA_SET_BUSY.
test("le drapeau d'occupation est expose et consomme", () => {
  assert.match(src, /FA_SET_BUSY/);
  assert.match(src, /fa-busy/);
  assert.match(src, /\.overlay/);
});

test("la signature UniSat marque l'application occupee", () => {
  const bloc = app.slice(app.indexOf("signMessage") - 400, app.indexOf("signMessage") + 200);
  assert.match(bloc, /FA_SET_BUSY|pendantSignature/);
});

test("le toast est monte et son script charge", () => {
  assert.match(app, /<window\.QuizToast/);
  assert.match(html, /quiz-ui\.js\?v=/);
  assert.match(html, /build\/quiz\.js\?v=/);
});
