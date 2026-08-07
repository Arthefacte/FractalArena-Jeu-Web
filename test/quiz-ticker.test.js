// test/quiz-ticker.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = lire("quiz.jsx");
const app = lire("app.jsx");

test("le bandeau utilise tickerLine (aucune mise en forme dupliquee)", () => {
  assert.match(src, /tickerLine/);
});

test("le bandeau ne fabrique jamais de nom de joueur", () => {
  assert.ok(!/Joueur \$\{|nom \|\| "/.test(src), "aucun nom inventé côté client");
});

test("le bandeau est rafraichi au plus toutes les 30 s", () => {
  assert.match(src, /30000|QUIZ_INTERVAL_MS/);
});

// Une barre vide vaut moins que pas de barre du tout : tickerLine renvoie "" quand
// il n'y a ni don ni cumul, et le composant doit alors ne rien rendre.
test("aucune barre quand la ligne est vide", () => {
  const bloc = src.slice(src.indexOf("function QuizTicker"));
  assert.match(bloc, /if \(!ligne\) return null|!ligne\s*\)\s*return null/);
});

test("le bandeau est monte dans l'application", () => {
  assert.match(app, /<window\.QuizTicker/);
});
