"use strict";
/* Classement vivant : detection des lignes qui bougent + cablage de l'ecran. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
globalThis.window = globalThis.window || {};
require("../lb-live-ui.js");
const LU = window.FA_LB_LIVE_UI;

test("diffChanges : valeur ou rang change = flash ; nouvel entrant et inchange = rien", () => {
  const prev = [
    { rank: 1, wallet_short: "bc1qaa…111", value: 10 },
    { rank: 2, wallet_short: "bc1qbb…222", value: 8 },
    { rank: 3, wallet_short: "bc1qcc…333", value: 5 },
  ];
  const next = [
    { rank: 1, wallet_short: "bc1qbb…222", value: 12 },   // valeur ET rang → flash
    { rank: 2, wallet_short: "bc1qaa…111", value: 10 },   // rang seul → flash
    { rank: 3, wallet_short: "bc1qcc…333", value: 5 },    // inchange → rien
    { rank: 4, wallet_short: "bc1qdd…444", value: 1 },    // nouvel entrant → rien
  ];
  const ch = LU.diffChanges(prev, next);
  assert.deepEqual([...ch].sort(), ["bc1qaa…111", "bc1qbb…222"]);
  assert.deepEqual([...LU.diffChanges(null, next)], [], "premier fetch : aucun flash");
  assert.deepEqual([...LU.diffChanges(prev, null)], []);
});

const SRC = fs.readFileSync(path.join(__dirname, "..", "leaderboard.jsx"), "utf8");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("l'ecran Classement vit : polling 20 s, point vert, flash via diffChanges", () => {
  assert.match(SRC, /20_?000/);
  assert.match(SRC, /setInterval/);
  assert.match(SRC, /clearInterval/);
  assert.match(SRC, /row\.live/);
  assert.match(SRC, /diffChanges/);
  assert.match(SRC, /LB_LIVE_HINT/);
});

test("index.html charge lb-live-ui.js avant build/leaderboard.js", () => {
  const iUi = HTML.indexOf('src="lb-live-ui.js?');
  const iLb = HTML.indexOf('src="build/leaderboard.js?');
  assert.ok(iUi > 0, "lb-live-ui.js absent");
  assert.ok(iLb > 0);
  assert.ok(iUi < iLb, "ordre de chargement");
});
