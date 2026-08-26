// Une révision juste crédite +5 verrouillés côté serveur SANS choix garder/offrir :
// l'affichage doit suivre immédiatement (creditQuizGain), sinon le joueur croit
// que rien n'est versé jusqu'à sa prochaine reconnexion (constat user 26-08).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "quiz.jsx"), "utf8");

test("le verdict d'une révision payée met à jour le bandeau via creditQuizGain", () => {
  const i = SRC.indexOf("async function repondre");
  assert.ok(i > -1, "repondre attendue dans quiz.jsx");
  const corps = SRC.slice(i, SRC.indexOf("function garder"));
  assert.match(corps, /revision[\s\S]{0,120}creditQuizGain/,
    "une révision créditée doit rafraîchir l'affichage du solde — le serveur a déjà versé");
});
