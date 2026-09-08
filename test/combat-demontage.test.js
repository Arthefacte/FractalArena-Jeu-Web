// test/combat-demontage.test.js — un flux de combat ne survit pas au demontage
// de son ecran (audit web 2026-09-08, P1#1 et P1#2).
//
// P1#1 — Fosse : callFight pose serverFight (mise deduite en optimiste) et SEUL
// resolveFight le remet a null en appliquant le solde serveur. Quitter l'ecran
// pendant le replay laissait serverFight bloque : solde faux, ticker de rachat
// gele (reveillePools) — et le blob localStorage le rejouait au rechargement.
// P1#2 — Tour : la boucle d'auto-combat `while (!stopRef.current)` n'etait
// jamais stoppee au demontage et continuait ses POST /tower/fight.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
const FOSSE = fs.readFileSync(path.join(__dirname, "..", "fosse.jsx"), "utf8");
const TOUR = fs.readFileSync(path.join(__dirname, "..", "tour.jsx"), "utf8");

function blocCleanupFosse() {
  const i = FOSSE.indexOf("// cleanup on unmount");
  assert.ok(i > 0, "le cleanup de demontage de la Fosse est introuvable");
  return FOSSE.slice(i, FOSSE.indexOf("}, []);", i));
}

test("Fosse : le demontage pendant un replay regle le combat (resolveFight) et libere battleRef", () => {
  const bloc = blocCleanupFosse();
  assert.match(bloc, /const ctx = battleRef\.current;/,
    "le cleanup doit lire le combat en cours");
  assert.match(bloc, /battleRef\.current = null;/,
    "le combat regle ne doit pas pouvoir l'etre deux fois");
  assert.match(bloc, /actions\.resolveFight\(\{ win: battle\.winner === "p1", free, betTier: effTier, betAmount: bet\.betAmount, fromLocked: bet\.fromLocked, isLoop: isLoopRun \}\)/,
    "resolveFight doit etre appele avec les memes champs que settleBattle (solde serveur applique, serverFight remis a null)");
});

test("Fosse : le cleanup ne rejoue pas settleBattle (pas de log/XP pop ni de suite de boucle sur composant mort)", () => {
  const bloc = blocCleanupFosse();
  assert.ok(!/settleBattle\(/.test(bloc), "settleBattle ecrit du state et relance la boucle : interdit au demontage");
  assert.ok(!/playFight\(/.test(bloc), "aucune relance de combat au demontage");
  assert.match(bloc, /loopRef\.current = false/, "la boucle doit rester coupee");
});

test("resolveFight remet bien serverFight a null (le cleanup de la Fosse en depend)", () => {
  const i = APP.indexOf("resolveFight(");
  const bloc = APP.slice(i, APP.indexOf("return summary", i));
  assert.match(bloc, /serverFight: null/);
});

test("serverFight n'est jamais persiste dans le blob localStorage", () => {
  assert.match(APP, /localStorage\.setItem\(SAVE_KEY, JSON\.stringify\(\{ \.\.\.g, authToken: "", serverFight: null \}\)\)/,
    "un replay en cours ne doit pas survivre au rechargement (ticker gele + solde faux)");
});

test("loadState neutralise un serverFight herite d'un ancien blob", () => {
  const i = APP.indexOf("function loadState");
  const bloc = APP.slice(i, APP.indexOf("\n}\n", i));
  assert.match(bloc, /serverFight: null/,
    "les blobs ecrits avant l'exclusion contiennent encore serverFight : il doit etre ecrase au chargement");
});

test("Tour : le demontage stoppe l'auto-combat (stopRef + mountedRef)", () => {
  assert.match(TOUR, /useEffect\(\(\) => \(\) => \{ stopRef\.current = true; mountedRef\.current = false; \}, \[\]\);/,
    "sans ce cleanup la boucle onAuto continue ses POST /tower/fight apres le demontage");
  assert.match(TOUR, /const mountedRef = React\.useRef\(true\);/);
});

test("Tour : la boucle onAuto sort des le retour de towerFight si l'ecran a ete quitte", () => {
  const i = TOUR.indexOf("async function onAuto");
  const bloc = TOUR.slice(i, TOUR.indexOf("finally", i));
  assert.match(bloc, /while \(!stopRef\.current\)/);
  // \r?\n : les sources sont en CRLF sous Windows.
  assert.match(bloc, /await actions\.towerFight\([^\n]*\r?\n\s*if \(!mountedRef\.current\) break;/,
    "le test de montage doit suivre immediatement l'await towerFight (aucun setState sur composant mort)");
  assert.match(bloc, /await sleep\(350\);\r?\n\s*if \(!mountedRef\.current\) break;/,
    "le test de montage doit aussi suivre la pause entre deux etages");
});
