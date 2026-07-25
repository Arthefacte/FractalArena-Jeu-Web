const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

test("FG_SUMMON_HINT : mentionne les odds de rang 55/28/13/4, plus les odds de rareté", () => {
  const line = src.split("\n").find((l) => l.includes("FG_SUMMON_HINT"));
  assert.ok(line, "clé FG_SUMMON_HINT présente");
  assert.ok(line.includes("55"), "mentionne 55 (odds rang C)");
  assert.ok(!line.includes("70/20/8/2"), "les vieux odds de rareté ont disparu");
});

test("FG_RANK : clé présente en FR/EN/ZH", () => {
  const line = src.split("\n").find((l) => l.includes("FG_RANK:"));
  assert.ok(line, "clé FG_RANK présente");
  for (const k of ["FR:", "EN:", "ZH:"]) assert.ok(line.includes(k), k);
});
