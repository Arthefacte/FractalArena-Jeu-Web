const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../chain-bg-ui.js");
const U = globalThis.window.FA_CHAIN_BG_UI;

test("cycleVals : flash nul avant la découverte (t=0,74), présent juste après", () => {
  assert.strictEqual(U.cycleVals(0.5).flash, 0);
  assert.strictEqual(U.cycleVals(0.5).mined, false);
  assert.ok(U.cycleVals(0.75).flash > 0.5, "flash fort juste après 0,74");
  assert.strictEqual(U.cycleVals(0.75).mined, true);
  assert.ok(U.cycleVals(0.99).flash < 0.01, "flash éteint en fin de cycle");
});

test("cycleVals : slide nul avant 0,8, monte vers 1 en fin de cycle", () => {
  assert.strictEqual(U.cycleVals(0.79).slide, 0);
  assert.ok(U.cycleVals(0.9).slide > 0.3);
  assert.ok(U.cycleVals(0.999).slide > 0.95);
});

test("cycleVals : spark -1 avant la découverte, 0..1 après", () => {
  assert.strictEqual(U.cycleVals(0.5).spark, -1);
  const s = U.cycleVals(0.78).spark;
  assert.ok(s >= 0 && s <= 1);
});

test("cycleVals : pulse et hexTick varient dans le cycle", () => {
  assert.notStrictEqual(U.cycleVals(0.1).pulse, U.cycleVals(0.15).pulse);
  assert.strictEqual(U.cycleVals(0.5).hexTick, 15);
});

test("blockGeom : déterministe et borné", () => {
  assert.deepStrictEqual(U.blockGeom(42), U.blockGeom(42));
  for (const i of [0, 1, 7, 100, 12345]) {
    const g = U.blockGeom(i);
    assert.ok(Math.abs(g.dy) <= 6.001, "dy borné");
    assert.ok(g.scale >= 0.9 && g.scale <= 1.04001, "scale borné");
    assert.ok(Math.abs(g.rot) <= 0.08001, "rot borné");
  }
  assert.notDeepStrictEqual(U.blockGeom(1), U.blockGeom(2), "varie par index");
});

test("hexPair : 2 caractères hex, déterministe", () => {
  for (const [i, t] of [[0, 0], [3, 7], [99, 12]]) {
    const h = U.hexPair(i, t);
    assert.match(h, /^[0-9a-f]{2}$/);
    assert.strictEqual(h, U.hexPair(i, t));
  }
});

test("pureté : mêmes entrées → mêmes sorties", () => {
  assert.deepStrictEqual(U.cycleVals(0.42), U.cycleVals(0.42));
});
