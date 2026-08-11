// test/quiz-ticker.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = lire("quiz.jsx");
const app = lire("app.jsx");

test("le bandeau utilise tickerItems (aucune mise en forme dupliquee)", () => {
  assert.match(src, /tickerItems/);
});

// Constat joueur (11/08) : le bandeau etait fige sur dons[0]. Les dons doivent
// defiler comme la tape boursiere (memes classes .fa-tape), et rester visibles
// sur mobile (modificateur `toujours`, sinon la regle mobile de .fa-tape eteint
// le seul contenu du bandeau).
test("les dons defilent (tape) et survivent au mobile", () => {
  const bloc = src.slice(src.indexOf("function QuizTicker"));
  assert.match(bloc, /fa-tape toujours/, "tape presente avec le modificateur mobile");
  assert.match(bloc, /fa-tape-track/, "piste de defilement reutilisee");
  const css = lire("styles.css");
  assert.match(css, /\.fa-tape\.toujours \{ display: block; \}/,
    "sans cette regle, le bandeau disparait sous 640 px");
});

test("un seul item : ligne fixe, rien a faire defiler", () => {
  const bloc = src.slice(src.indexOf("function QuizTicker"));
  assert.match(bloc, /items\.length === 1/);
});

test("le bandeau ne fabrique jamais de nom de joueur", () => {
  assert.ok(!/Joueur \$\{|nom \|\| "/.test(src), "aucun nom inventé côté client");
});

test("le bandeau est rafraichi au plus toutes les 30 s", () => {
  assert.match(src, /30000|QUIZ_INTERVAL_MS/);
});

// Une barre vide vaut moins que pas de barre du tout : tickerItems renvoie []
// quand il n'y a ni don ni cumul, et le composant doit alors ne rien rendre.
test("aucune barre quand la liste est vide", () => {
  const bloc = src.slice(src.indexOf("function QuizTicker"));
  assert.match(bloc, /if \(!items\.length\) return null/);
});

test("le bandeau est monte dans l'application", () => {
  assert.match(app, /<window\.QuizTicker/);
});
