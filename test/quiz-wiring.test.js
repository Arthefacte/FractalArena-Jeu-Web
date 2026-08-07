// test/quiz-wiring.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

test("les quatre appels quiz existent", () => {
  for (const fn of ["fetchQuizQuestion", "answerQuiz", "donateQuiz", "fetchQuizTicker"]) {
    assert.ok(src.includes(fn), fn + " absent");
  }
});

test("answerQuiz est authentifie et gere le 401", () => {
  const bloc = src.slice(src.indexOf("async answerQuiz"), src.indexOf("async answerQuiz") + 1400);
  assert.match(bloc, /Authorization/);
  assert.match(bloc, /401/);
});

test("donateQuiz est authentifie et gere le 401", () => {
  const bloc = src.slice(src.indexOf("async donateQuiz"), src.indexOf("async donateQuiz") + 1400);
  assert.match(bloc, /Authorization/);
  assert.match(bloc, /401/);
});

test("aucune URL d'API en dur", () => {
  const bloc = src.slice(src.indexOf("async fetchQuizQuestion"), src.indexOf("async fetchQuizTicker") + 800);
  assert.ok(!/https?:\/\//.test(bloc), "utiliser API_URL");
});

// La langue courante se lit par I18N.getLang() : FA_I18N n'expose pas de champ `lang`
// (i18n.js:941), donc un `I18N.lang` renverrait undefined et le serveur retomberait en FR.
test("la langue envoyee au serveur vient de getLang()", () => {
  const bloc = src.slice(src.indexOf("async fetchQuizQuestion"), src.indexOf("async fetchQuizTicker") + 800);
  assert.match(bloc, /getLang\(\)/);
  assert.ok(!/I18N\.lang\b/.test(bloc), "I18N.lang n'existe pas");
});
