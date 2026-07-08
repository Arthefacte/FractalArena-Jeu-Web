// Régression : le rejeu PvP spoilait le résultat avant la fin du combat.
// Deux causes cumulées, verrouillées ici au niveau source (le JSX n'est pas
// requirable en node:test) :
//   1. arene-battle.jsx utilisait la classe `modal-backdrop`, absente du CSS
//      → le rejeu se rendait dans le flux de la page sans rien recouvrir.
//   2. arene.jsx appelait pvpRefresh() dès la réponse de /pvp/attack
//      → le pill ELO du header et le ladder (ELO · V-D) se mettaient à jour
//      pendant le rejeu, révélant l'issue du match.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const battleSrc = fs.readFileSync(path.join(__dirname, "..", "arene-battle.jsx"), "utf8");
const areneSrc = fs.readFileSync(path.join(__dirname, "..", "arene.jsx"), "utf8");

test("rejeu PvP : backdrop = classe .overlay du design system (plein écran + flou)", () => {
  assert.ok(!battleSrc.includes("modal-backdrop"),
    "arene-battle.jsx référence `modal-backdrop`, classe qui n'existe pas dans styles.css");
  assert.match(battleSrc, /className="overlay"/,
    "le conteneur du rejeu doit utiliser la classe .overlay (comme le composant Modal)");
});

test("pas de spoiler : onAttack ne rafraîchit pas l'état PvP pendant le rejeu", () => {
  const onAttack = areneSrc.match(/async function onAttack[\s\S]*?\n  \}/);
  assert.ok(onAttack, "fonction onAttack introuvable dans arene.jsx");
  assert.ok(!onAttack[0].includes("pvpRefresh"),
    "onAttack appelle pvpRefresh : ELO/ladder mis à jour avant la fin du rejeu = résultat spoilé");
});

test("le refresh PvP est différé à la fermeture du rejeu", () => {
  assert.match(areneSrc, /setResult\(null\);\s*actions\.pvpRefresh\(\);/,
    "la fermeture d'AreneBattle doit enchaîner setResult(null) puis pvpRefresh()");
});
