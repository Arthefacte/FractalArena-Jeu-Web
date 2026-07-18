// test/juice-wiring.test.js
// Les .jsx sont transformés par Babel-in-browser (non requérables en node) →
// on verrouille le câblage au niveau source, comme arene-replay-spoiler.test.js.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("fosse.jsx utilise FA_JUICE et ne redéfinit plus les helpers dupliqués", () => {
  const src = read("fosse.jsx");
  // NB : le câblage alias `const J = window.FA_JUICE;` puis appelle J.hit/J.ko
  // (cf. task-4-brief.md step 6) — on tolère l'alias en plus de l'appel direct.
  assert.match(src, /window\.FA_JUICE/, "fosse doit référencer window.FA_JUICE");
  assert.match(src, /(?:FA_JUICE|\bJ)\.hit\(/, "fosse doit appeler FA_JUICE.hit");
  assert.match(src, /FA_JUICE\.heal/, "fosse doit appeler FA_JUICE.heal");
  assert.match(src, /(?:FA_JUICE|\bJ)\.ko\(/, "fosse doit appeler FA_JUICE.ko");
  assert.match(src, /hitStopMs/, "fosse doit appliquer le hit-stop");
  assert.match(src, /boardRef/, "fosse doit passer le board pour le screen-shake");
  assert.ok(!/function floatText\s*\(/.test(src), "floatText dupliqué doit être supprimé");
  assert.ok(!/function animHit\s*\(/.test(src), "animHit dupliqué doit être supprimé");
  assert.ok(!/function animLunge\s*\(/.test(src), "animLunge dupliqué doit être supprimé");
});
