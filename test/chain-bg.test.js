const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "chain-bg.js"), "utf8");

test("expose FA_CHAIN_BG.mount", () => {
  assert.match(src, /window\.FA_CHAIN_BG\s*=\s*\{\s*mount\s*\}/);
});

test("mount idempotent (garde sur l'instance)", () => {
  assert.match(src, /if \(mounted\) return/);
});

test("boucle plafonnée à ~24 fps", () => {
  assert.match(src, /1000 \/ 24/);
});

test("pause quand l'onglet est caché", () => {
  assert.match(src, /visibilitychange/);
  assert.match(src, /document\.hidden/);
});

test("reduced-motion → une frame statique, pas de boucle", () => {
  assert.match(src, /prefers-reduced-motion/);
});

test("accent du flash lu une fois par cycle via --accent, repli cyan", () => {
  assert.match(src, /--accent/);
  assert.match(src, /getComputedStyle/);
  assert.match(src, /#00F0FF|0,240,255/);
});

test("robustesse : try/catch + teardown (canvas retiré)", () => {
  assert.match(src, /catch/);
  assert.match(src, /remove\(\)/);
});

test("déterminisme : pas de Math.random, angle d'or", () => {
  assert.ok(!/Math\.random/.test(src));
  assert.match(src, /2\.399963|GOLD/);
});

test("chaîne pré-remplie au montage (pas d'écran vide les 2 premières minutes)", () => {
  assert.match(src, /cycles = PREFILL/);
  assert.match(src, /const OPACITY = 0\.1, CYCLE_MS = 8000, BLOCK_START = 841200, PREFILL = 40/);
});
