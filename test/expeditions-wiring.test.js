// Câblage Expéditions dans app.jsx : actions authentifiées, pas d'URL en dur,
// retry 401 sur le claim, re-fetch /save après les actions qui changent la save.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

function bloc(marker, len) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, marker + " absent d'app.jsx");
  return src.slice(i, i + (len || 1600));
}

test("les 5 actions expeditions existent, authentifiées, sans URL en dur", () => {
  for (const name of ["async expeditionsState", "async expeditionsStart", "async expeditionsClaim", "async expeditionsRecall", "async expeditionsCraftRelic"]) {
    const b = bloc(name);
    assert.match(b, /Authorization/, name + " : Bearer manquant");
    assert.match(b, /API_URL/, name + " : API_URL manquant");
    assert.ok(!/https?:\/\//.test(b), name + " : URL en dur interdite");
  }
});

test("expeditionsClaim : retry 401 + re-fetch /save (XP/FA/tickets bougent)", () => {
  const b = bloc("async expeditionsClaim", 2200);
  assert.match(b, /401/);
  assert.match(b, /svOpts\(\)/);
  assert.match(b, /serverToState/);
});

test("expeditionsCraftRelic : re-fetch /save (equipment bouge)", () => {
  const b = bloc("async expeditionsCraftRelic", 2200);
  assert.match(b, /svOpts\(\)/);
});

test("état amorcé à la connexion + champs freshState", () => {
  assert.match(src, /if \(g\.authToken\) actions\.expeditionsState\(\)/);
  assert.match(src, /expFragments: \{ C: 0, B: 0, A: 0, S: 0 \}/);
  assert.match(src, /expNowOffset/);
});
