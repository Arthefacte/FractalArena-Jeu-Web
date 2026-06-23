const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../forge-ui.js");
const F = globalThis.window.FA_FORGE_UI;

test("rerollDiff : 5 lignes ordonnées, direction correcte", () => {
  const rows = F.rerollDiff(
    { base_hp: 100, base_atk: 20, base_def: 10, base_spd: 12, base_mag: 8 },
    { base_hp: 90,  base_atk: 30, base_def: 10, base_spd: 14, base_mag: 6 }
  );
  assert.strictEqual(rows.length, 5);
  assert.deepStrictEqual(rows.map((r) => r.key), ["base_hp", "base_atk", "base_def", "base_spd", "base_mag"]);
  const byKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  assert.strictEqual(byKey.base_hp.dir, "down");
  assert.strictEqual(byKey.base_atk.dir, "up");
  assert.strictEqual(byKey.base_def.dir, "same");
  assert.strictEqual(byKey.base_atk.from, 20);
  assert.strictEqual(byKey.base_atk.to, 30);
});

test("rerollDiff : tolère stats manquantes (→ 0)", () => {
  const rows = F.rerollDiff({}, { base_hp: 5 });
  assert.strictEqual(rows.find((r) => r.key === "base_hp").to, 5);
  assert.strictEqual(rows.find((r) => r.key === "base_hp").from, 0);
});
