const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../data.js");
const D = globalThis.window.FA_DATA;

// fmtStat : format compact pour les cellules de stats (≤ 4 caractères).
// < 10 000 → brut ; 10k–999k → arrondi en "Nk" ; ≥ 999 500 → "N.NM" (1 déc.), ≥ 10M → "NM".
test("fmtStat : en dessous de 10 000, valeur brute", () => {
  assert.strictEqual(D.fmtStat(0), "0");
  assert.strictEqual(D.fmtStat(999), "999");
  assert.strictEqual(D.fmtStat(4805), "4805");
  assert.strictEqual(D.fmtStat(9999), "9999");
});

test("fmtStat : milliers arrondis en k (≤ 4 caractères)", () => {
  assert.strictEqual(D.fmtStat(10000), "10k");
  assert.strictEqual(D.fmtStat(13541), "14k");
  assert.strictEqual(D.fmtStat(191405), "191k");
  assert.strictEqual(D.fmtStat(999499), "999k");
});

test("fmtStat : millions (≤ 4 caractères)", () => {
  assert.strictEqual(D.fmtStat(999500), "1M");
  assert.strictEqual(D.fmtStat(1234567), "1.2M");
  assert.strictEqual(D.fmtStat(9950000), "9.9M"); // 9.95 → 9.9499… en flottant, toFixed arrondit bas
  assert.strictEqual(D.fmtStat(10000000), "10M");
});

test("fmtStat : jamais plus de 4 caractères jusqu'au plafond validate (1e7)", () => {
  for (let n = 0; n <= 1e7; n += 7919) assert.ok(D.fmtStat(n).length <= 4, n + " → " + D.fmtStat(n));
});
