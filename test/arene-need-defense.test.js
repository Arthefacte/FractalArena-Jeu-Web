// Constat du fondateur, 01/11/2026 : « je ne vois pas d'ennemis pour la bagarre ».
// Les six cartes étaient bien servies par /pvp/opponents, mais chaque bouton « Attaquer »
// était grisé sans un mot d'explication : l'Arène exige une défense POSÉE avant tout
// combat (V2, D1), et la consigne ne vivait que dans le bloc « Ma défense », plus haut.
//
// Ce test verrouille les deux morceaux du correctif : la phrase dans le panneau des
// adversaires, et l'infobulle sur les boutons morts. Sans eux, l'écran redevient muet.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "arene.jsx"), "utf8");

function bloc(debut, fin) {
  const i = SRC.indexOf(debut);
  assert.ok(i >= 0, "bloc introuvable : " + debut);
  const j = SRC.indexOf(fin, i);
  assert.ok(j > i, "fin de bloc introuvable : " + fin);
  return SRC.slice(i, j);
}

test("le panneau des adversaires dit POURQUOI les boutons sont grisés", () => {
  const i = SRC.indexOf('data-fa="arene-need-defense"');
  assert.ok(i >= 0, "l'explication a disparu du panneau des adversaires");
  // Elle est conditionnée à l'absence de défense posée, et seulement s'il y a des cartes.
  const avant = SRC.slice(Math.max(0, i - 400), i);
  assert.match(avant, /!myDefensePosted/);
  assert.match(avant, /\(pvp\.opponents \|\| \[\]\)\.length > 0/);
  const apres = SRC.slice(i, i + 300);
  assert.match(apres, /I18N\.t\("AR2_NEED_DEFENSE"\)/);
});

test("les deux boutons d'attaque portent l'infobulle quand ils sont morts", () => {
  for (const guide of ['data-guide="arene-attack"', "onPickOpponent(o, true)"]) {
    const i = SRC.indexOf(guide);
    assert.ok(i >= 0, "bouton introuvable : " + guide);
    const ligne = SRC.slice(SRC.lastIndexOf("<button", i), i + 200);
    assert.match(ligne, /title=\{canAttack \? undefined : I18N\.t\("AR2_NEED_DEFENSE_TIP"\)\}/,
      "bouton sans infobulle : " + guide);
    assert.match(ligne, /disabled=\{busy \|\| !canAttack\}/);
  }
});

test("l'explication n'apparaît pas quand la défense est posée", () => {
  // Garde-fou inverse : un joueur qui a posé sa défense ne doit pas lire une consigne
  // qui ne le concerne plus (le bloc entier est sous `!myDefensePosted`).
  const i = SRC.indexOf('data-fa="arene-need-defense"');
  const ouverture = SRC.lastIndexOf("{", i);
  assert.match(SRC.slice(ouverture, i), /!myDefensePosted/);
});
