"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../forge-ui.js");
const F = window.FA_FORGE_UI;

test("constantes miroir serveur", () => {
  assert.strictEqual(F.MAX_REROLL_LOCKS, 2);
  assert.strictEqual(F.REROLL_LOCK_MULT, 1.5);
  assert.deepStrictEqual(F.LOCKABLE.map((l) => l.stat), ["hp", "atk", "def", "spd", "mag"]);
  assert.deepStrictEqual(F.LOCKABLE.map((l) => l.key), ["base_hp", "base_atk", "base_def", "base_spd", "base_mag"]);
});

test("toggleLock : ajoute, retire, refuse le 3e verrou (null), n'altère pas l'entrée", () => {
  const l0 = [];
  const l1 = F.toggleLock(l0, "spd");
  assert.deepStrictEqual(l1, ["spd"]);
  assert.deepStrictEqual(l0, [], "immutabilité");
  const l2 = F.toggleLock(l1, "hp");
  assert.deepStrictEqual(l2, ["spd", "hp"]);
  assert.strictEqual(F.toggleLock(l2, "atk"), null, "3e verrou refusé");
  assert.deepStrictEqual(F.toggleLock(l2, "spd"), ["hp"], "retrait");
});

test("withLockCost : ×1.5^n arrondi sur le produit", () => {
  assert.strictEqual(F.withLockCost(1000, 0), 1000);
  assert.strictEqual(F.withLockCost(1000, 1), 1500);
  assert.strictEqual(F.withLockCost(1000, 2), 2250);
  assert.strictEqual(F.withLockCost(2250, 2), 5063, "round(2250×2.25)=5062.5→5063 (parité serveur)");
});

test("rerollDiff : flag locked par row, rétro-compatible sans 3e argument", () => {
  const o = { base_hp: 90, base_atk: 14, base_def: 4, base_spd: 11, base_mag: 16 };
  const n = { base_hp: 80, base_atk: 20, base_def: 8, base_spd: 11, base_mag: 16 };
  const rows = F.rerollDiff(o, n, ["spd", "mag"]);
  assert.deepStrictEqual(rows.map((r) => r.locked), [false, false, false, true, true]);
  assert.strictEqual(rows[0].dir, "down");
  const legacy = F.rerollDiff(o, n);
  assert.deepStrictEqual(legacy.map((r) => r.locked), [false, false, false, false, false]);
  assert.deepStrictEqual(legacy.map((r) => r.key), ["base_hp", "base_atk", "base_def", "base_spd", "base_mag"]);
});
