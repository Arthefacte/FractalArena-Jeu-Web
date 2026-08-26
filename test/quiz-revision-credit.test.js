// Une révision payée (+5 verrouillés, déjà crédités par le serveur) passe par le
// MÊME choix garder/offrir que les questions neuves (décision user 26-08) : le
// bandeau ne bouge qu'au choix, via garder(), jamais au verdict.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "quiz.jsx"), "utf8");

test("le choix garder/offrir s'ouvre aussi pour une révision payée", () => {
  const m = SRC.match(/const gagne = [^\n]*/);
  assert.ok(m, "la constante gagne est attendue dans quiz.jsx");
  assert.ok(!m[0].includes("!verdict.revision"),
    "les révisions ne doivent plus être exclues du choix garder/offrir");
  assert.match(m[0], /reward > 0/, "le choix ne s'ouvre que sur un gain réel");
});

test("le verdict d'une révision ne crédite plus l'affichage d'office — c'est garder() qui le fait", () => {
  const i = SRC.indexOf("async function repondre");
  const corps = SRC.slice(i, SRC.indexOf("function garder"));
  assert.ok(!corps.includes("creditQuizGain"),
    "tant que le choix est ouvert, le solde affiché ne bouge pas (même règle que les questions neuves)");
});
