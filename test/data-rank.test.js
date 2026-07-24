const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../data.js");
const D = globalThis.window.FA_DATA;

test("parité serveur : RANK_FACTOR et RANK_ODDS identiques au serveur", () => {
  // Valeurs du spec 2026-07-19 — doivent être identiques à data.node.js (serveur).
  assert.deepStrictEqual(D.RANK_FACTOR, { C: 1.0, B: 1.25, A: 1.6, S: 2.0 });
  assert.deepStrictEqual(D.RANK_ODDS, [["C", 0.55], ["B", 0.28], ["A", 0.13], ["S", 0.04]]);
  assert.deepStrictEqual(D.RANK_LIST, ["C", "B", "A", "S"]);
});

test("RANK_COLORS : une couleur par rang", () => {
  for (const r of ["C", "B", "A", "S"]) assert.ok(/^#[0-9A-Fa-f]{6}$/.test(D.RANK_COLORS[r]), r);
});

test("mintBeast : défaut rang C, rang S ×2, rang inconnu → C", () => {
  const tpl = D.TEMPLATES["HashByte-1"];
  const c = D.mintBeast("HashByte-1", "Common");
  assert.strictEqual(c.rank, "C");
  const s = D.mintBeast("HashByte-1", "Common", null, "S");
  assert.strictEqual(s.rank, "S");
  assert.ok(s.base_hp >= Math.floor(tpl.hp * 0.85 * 2) - 1 && s.base_hp <= Math.floor(tpl.hp * 1.0 * 2));
  assert.strictEqual(D.mintBeast("HashByte-1", "Common", null, "Z").rank, "C");
});

test("starterRoster : tous rang C", () => {
  for (const b of D.starterRoster()) assert.strictEqual(b.rank, "C");
});

test("upgradeRarity préserve b.rank", () => {
  const b = D.mintBeast("HashByte-1", "Common", null, "A");
  D.upgradeRarity(b);
  assert.strictEqual(b.rank, "A");
});

test("artFor : chemin type × rang, défaut legacy C, repli art de base", () => {
  assert.strictEqual(D.artFor({ image_key: "BLOCK", rank: "S" }), "assets/BLOCK_S.webp");
  assert.strictEqual(D.artFor({ image_key: "HashByte", rank: "A" }), "assets/HASHBYTE_A.webp");
  assert.strictEqual(D.artFor({ image_key: "Miner" }), "assets/MINER_C.webp"); // legacy sans rank
  assert.strictEqual(D.artFor({ image_key: "GENESIS", rank: "??" }), "assets/GENESIS_C.webp"); // rang bidon
  assert.strictEqual(D.artFor({ image_key: "BLOCK" }), "assets/BLOCK_C.webp");
  assert.strictEqual(D.artFor({ image_key: "inconnu" }), D.ART["inconnu"]); // repli (undefined === undefined)
});
