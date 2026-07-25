// test/finisher-hooks.test.js
// Les .jsx ne sont pas requirables en node:test (Babel dans le navigateur) :
// on verrouille les branchements au niveau source, comme arene-replay-spoiler.test.js.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const fosse = read("fosse.jsx");
const areneBattle = read("arene-battle.jsx");
const campaign = read("campaign.jsx");
const tour = read("tour.jsx");

test("les 3 modes appellent le finisher", () => {
  assert.match(fosse, /FA_FINISHER\.play/, "Fosse non branchée");
  assert.match(areneBattle, /FA_FINISHER\.play/, "Arène/Tour non branchées (AreneBattle est partagé)");
  assert.match(campaign, /FA_FINISHER\.play/, "Campagne non branchée");
});

test("la Tour n'a PAS de hook propre : elle passe par AreneBattle", () => {
  assert.ok(!/FA_FINISHER/.test(tour), "tour.jsx doit hériter du hook d'AreneBattle, pas en ajouter un");
});

test("INVARIANT : jamais de finisher en boucle (bypass Loop de la Fosse intact)", () => {
  assert.match(fosse, /if \(!isLoopRun\)/, "le garde isLoopRun a disparu → finisher en boucle");
  const settle = fosse.match(/function settleBattle\(\)[\s\S]*?\n  \}/);
  assert.ok(settle, "settleBattle introuvable");
  const idxGuard = settle[0].indexOf("if (!isLoopRun)");
  const idxPlay = settle[0].indexOf("FA_FINISHER.play");
  assert.ok(idxGuard > -1 && idxPlay > idxGuard,
    "FA_FINISHER.play doit rester DERRIÈRE le garde !isLoopRun");
});

test("le son a quitté les modales : un seul émetteur, finisher.js", () => {
  for (const [name, src] of [["fosse.jsx", fosse], ["arene-battle.jsx", areneBattle], ["tour.jsx", tour]]) {
    assert.ok(!/FA_SFX\.play\((won|win) \?/.test(src),
      name + " joue encore victory/defeat — doublon avec le finisher");
  }
});

test("la Campagne ne joue plus le son 'open' générique", () => {
  assert.match(campaign, /openSound=\{null\}/, "CampResultModal doit couper le son open générique");
});

test("les modales de résultat gardent openSound={null}", () => {
  assert.match(fosse, /openSound=\{null\}/, "ResultModal a perdu openSound={null}");
  assert.match(tour, /openSound=\{null\}/, "TourResultModal a perdu openSound={null}");
});

test("INVARIANT : Fosse et Campagne gardent window.FA_FINISHER et replient sur onDone si absent", () => {
  // Ces deux call sites portent un onDone qui montre les gains déjà réglés par le
  // serveur (actions.resolveFight / actions.campaignFight) : si finisher.js est absent
  // (404 GH Pages) et l'appel n'est pas gardé, TypeError après paiement → modale et
  // gains perdus pour le joueur. On verrouille la forme exacte du repli : guard +
  // appel direct de la même fonction dans la branche else (pas juste sa présence).
  const guardRe = /if\s*\(window\.FA_FINISHER\)\s*window\.FA_FINISHER\.play\(\{[^}]*onDone:\s*(\w+)[^}]*\}\);\s*else\s*\1\(\);/;
  for (const [name, src] of [["fosse.jsx", fosse], ["campaign.jsx", campaign]]) {
    const m = src.match(guardRe);
    assert.ok(m, name + " : window.FA_FINISHER.play doit être gardé par `if (window.FA_FINISHER)` avec un `else` qui appelle la même fonction onDone directement");
  }
});
