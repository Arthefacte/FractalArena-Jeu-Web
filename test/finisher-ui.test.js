// test/finisher-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../finisher-ui.js");
const FU = globalThis.window.FA_FINISHER_UI;

test("constantes : durée 0.8 s, impact avant la fin", () => {
  assert.strictEqual(FU.FIN_DUR, 0.8);
  assert.ok(FU.FIN_IMPACT > 0 && FU.FIN_IMPACT < FU.FIN_DUR, "l'impact doit tomber dans la durée");
  assert.strictEqual(FU.SHARDS, 14);
  assert.strictEqual(FU.BLOCK_COLS, 10);
  assert.strictEqual(FU.BLOCK_ROWS, 6);
});

test("pureté : deux appels identiques rendent le même résultat", () => {
  const a = FU.finisherVals(0.3, { win: true });
  const b = FU.finisherVals(0.3, { win: true });
  assert.deepStrictEqual(a, b);
  const c = FU.finisherVals(0.3, { win: false });
  const d = FU.finisherVals(0.3, { win: false });
  assert.deepStrictEqual(c, d);
});

test("balayage complet : aucune valeur NaN/undefined, bornes tenues", () => {
  for (const win of [true, false]) {
    for (let t = 0; t <= FU.FIN_DUR + 0.2; t += 0.01) {
      const v = FU.finisherVals(t, { win });
      for (const key of ["k", "flash", "energy", "veil", "scramble"]) {
        assert.ok(Number.isFinite(v[key]), `${key} non fini à t=${t.toFixed(2)} win=${win}`);
        assert.ok(v[key] >= 0 && v[key] <= 1, `${key}=${v[key]} hors [0,1] à t=${t.toFixed(2)} win=${win}`);
      }
      v.shards.forEach((s) => {
        ["angle", "dist", "rot", "scale", "alpha"].forEach((key) =>
          assert.ok(Number.isFinite(s[key]), `shard.${key} non fini à t=${t.toFixed(2)}`));
      });
      v.blocks.forEach((b) => {
        ["dx", "dy", "alpha", "sat"].forEach((key) =>
          assert.ok(Number.isFinite(b[key]), `block.${key} non fini à t=${t.toFixed(2)}`));
      });
    }
  }
});

test("victoire : éclats présents, aucun bloc, énergie croissante, flash après l'impact", () => {
  const v0 = FU.finisherVals(0, { win: true });
  assert.strictEqual(v0.shards.length, FU.SHARDS);
  assert.strictEqual(v0.blocks.length, 0);
  assert.strictEqual(v0.win, true);

  let prev = -1;
  for (let t = 0; t <= FU.FIN_IMPACT; t += 0.02) {
    const e = FU.finisherVals(t, { win: true }).energy;
    assert.ok(e >= prev - 1e-9, `énergie non croissante à t=${t.toFixed(2)}`);
    prev = e;
  }
  assert.strictEqual(FU.finisherVals(FU.FIN_IMPACT - 0.05, { win: true }).flash, 0, "pas de flash avant l'impact");
  assert.ok(FU.finisherVals(FU.FIN_IMPACT + 0.02, { win: true }).flash > 0, "flash attendu après l'impact");
});

test("victoire : les éclats convergent vers le centre", () => {
  const early = FU.finisherVals(0.05, { win: true }).shards[0].dist;
  const late = FU.finisherVals(FU.FIN_IMPACT - 0.02, { win: true }).shards[0].dist;
  assert.ok(late < early, "dist doit décroître (bord → centre)");
});

test("défaite : blocs présents, aucun éclat, aucun flash, énergie décroissante", () => {
  const v = FU.finisherVals(0.4, { win: false });
  assert.strictEqual(v.blocks.length, FU.BLOCK_COLS * FU.BLOCK_ROWS);
  assert.strictEqual(v.shards.length, 0);
  assert.strictEqual(v.win, false);
  for (let t = 0; t <= FU.FIN_DUR; t += 0.02) {
    assert.strictEqual(FU.finisherVals(t, { win: false }).flash, 0, `flash non nul à t=${t.toFixed(2)}`);
  }
  assert.ok(FU.finisherVals(0.7, { win: false }).energy < FU.finisherVals(0.1, { win: false }).energy);
  assert.ok(FU.finisherVals(0.7, { win: false }).scramble > FU.finisherVals(0.1, { win: false }).scramble);
});

test("défaite : les blocs tombent et s'effacent", () => {
  const early = FU.finisherVals(0.1, { win: false }).blocks;
  const late = FU.finisherVals(0.75, { win: false }).blocks;
  assert.ok(late.some((b, i) => b.dy > early[i].dy), "au moins un bloc doit être tombé");
  assert.ok(late.every((b, i) => b.alpha <= early[i].alpha + 1e-9), "l'alpha ne doit jamais remonter");
});

test("victoire et défaite produisent des timelines distinctes", () => {
  assert.notDeepStrictEqual(FU.finisherVals(0.4, { win: true }), FU.finisherVals(0.4, { win: false }));
});

test("bornes : t négatif et t au-delà de la durée restent bien formés", () => {
  assert.strictEqual(FU.finisherVals(-1, { win: true }).k, 0);
  assert.strictEqual(FU.finisherVals(99, { win: true }).k, 1);
  assert.strictEqual(FU.finisherVals(99, { win: false }).k, 1);
});

test("options manquantes : traité comme une défaite, pas de crash", () => {
  assert.strictEqual(FU.finisherVals(0.2, {}).win, false);
  assert.strictEqual(FU.finisherVals(0.2, undefined).win, false);
});
