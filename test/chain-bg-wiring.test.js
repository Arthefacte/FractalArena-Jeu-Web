const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

test("index.html charge chain-bg-ui.js puis chain-bg.js (scripts classiques)", () => {
  const a = html.indexOf('<script src="chain-bg-ui.js');
  const b = html.indexOf('<script src="chain-bg.js');
  assert.ok(a > -1, "chain-bg-ui.js chargé");
  assert.ok(b > a, "chain-bg.js après chain-bg-ui.js");
  assert.ok(!/type="module" src="chain-bg/.test(html), "scripts classiques");
});

test("cache-busting >= v89, plus aucun v87/v88", () => {
  // Comparaison numérique et non de forme : la regex d'origine (`89|9\d`) ne
  // reconnaissait que deux chiffres et déclarait la v100 « inférieure à 89 ».
  const versions = [...html.matchAll(/\?v=(\d+)/g)].map((m) => Number(m[1])).filter((v) => v !== 1);
  assert.ok(versions.length, "aucune balise versionnée");
  assert.ok(Math.max(...versions) >= 89, "une version >= 89 présente");
  assert.ok(!html.includes("?v=87") && !html.includes("?v=88"));
});

test("Ambient monte le fond avec repli silencieux", () => {
  const m = app.match(/function Ambient\(\)[\s\S]{0,600}FA_CHAIN_BG\?\.mount\(\)/);
  assert.ok(m, "FA_CHAIN_BG?.mount() dans Ambient");
});

test("l'existant reste : .app-bg et braises inchangés", () => {
  assert.match(app, /className="app-bg"/);
  assert.match(app, /className="embers"/);
});
