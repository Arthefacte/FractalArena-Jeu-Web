const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");

test("index.html charge forge-cine-ui.js puis forge-cine.js (scripts classiques)", () => {
  const a = html.indexOf('<script src="forge-cine-ui.js');
  const b = html.indexOf('<script src="forge-cine.js');
  assert.ok(a > -1, "forge-cine-ui.js chargé");
  assert.ok(b > a, "forge-cine.js chargé après forge-cine-ui.js");
  assert.ok(!/type="module" src="forge-cine/.test(html), "scripts classiques, pas ESM");
});

test("cache-busting bumpé au-delà de v87 (version courante vérifiée par chain-bg-wiring)", () => {
  assert.ok(!html.includes("?v=87"), "aucun ?v=87 restant");
  // Numérique, pas de forme : `8[89]|9\d` excluait les versions à trois chiffres.
  const versions = [...html.matchAll(/\?v=(\d+)/g)].map((m) => Number(m[1])).filter((v) => v !== 1);
  assert.ok(versions.length && Math.max(...versions) >= 88, "une version >= 88 présente");
});

test("doFuse branche la cinématique avec repli", () => {
  assert.match(screens, /FA_FORGE_CINE/);
  assert.match(screens, /mode:\s*"fuse"/);
  assert.match(screens, /D\.RARITY_COLORS\[/);
});

test("doSummon branche la cinématique (rang) et révèle la carte dans onDone", () => {
  assert.match(screens, /mode:\s*"summon"/);
  assert.match(screens, /D\.RANK_COLORS\[/);
  // le callback reveal (setLast + toast) est déclaré puis passé en onDone du play summon
  const m = screens.match(/const reveal = \(\) => \{\s*setLast\(r\.beast\)[\s\S]{0,500}mode:\s*"summon"[\s\S]{0,200}onDone:\s*reveal/);
  assert.ok(m, "setLast(r.beast) dans le onDone du summon");
});

test("doSummon reliques : cinématique teintée par la rareté, relique révélée dans onDone", () => {
  const m = screens.match(/const revealRelic = \(\) => \{\s*setLast\(r\.relic\)[\s\S]{0,500}mode:\s*"summon"[\s\S]{0,200}onDone:\s*revealRelic/);
  assert.ok(m, "setLast(r.relic) dans le onDone du summon relique");
  const tinted = screens.match(/tier:\s*r\.relic\.rarity/);
  assert.ok(tinted, "tier = r.relic.rarity pour la relique");
});
