const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "forge-cine.js"), "utf8");

test("expose FA_FORGE_CINE.play", () => {
  assert.match(src, /window\.FA_FORGE_CINE\s*=\s*\{\s*play\s*\}/);
});

test("onDone garanti exactement 1x (wrapper once)", () => {
  assert.match(src, /function once\(/);
  assert.match(src, /if \(called\) return/);
});

test("reduced-motion et module absent → onDone immédiat, pas de canvas", () => {
  assert.match(src, /prefers-reduced-motion/);
  assert.match(src, /if \(!ui \|\| reduced\)/);
});

test("boucle de rendu sous try/catch, teardown sur erreur", () => {
  assert.match(src, /catch \(e\) \{ finish\(\); \}/);
});

test("skip au pointerdown", () => {
  assert.match(src, /addEventListener\("pointerdown",\s*skip/);
});

test("SFX optionnels : strike au départ, born/fizzle à l'éclat", () => {
  assert.match(src, /forge_strike/);
  assert.match(src, /forge_born/);
  assert.match(src, /forge_fizzle/);
  assert.match(src, /window\.FA_SFX/);
});

test("pas de Math.random : éclats par angle d'or", () => {
  assert.ok(!/Math\.random/.test(src), "rendu déterministe requis");
  assert.match(src, /2\.399963/);
});

test("un nouveau play coupe le précédent (garde sur current.done)", () => {
  assert.match(src, /current\.done !== done/);
});
