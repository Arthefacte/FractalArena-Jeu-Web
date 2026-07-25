const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "sfx.js"), "utf8");

test("recettes forge présentes", () => {
  assert.match(src, /forge_strike:\s*\(t\)/);
  assert.match(src, /forge_born:\s*\(t,\s*lvl\)/);
  assert.match(src, /forge_fizzle:\s*\(t\)/);
});

test("play transmet un 2e argument aux recettes", () => {
  assert.match(src, /function play\(name,\s*arg\)/);
  assert.match(src, /fn\(c\.currentTime \+ 0\.001,\s*arg\)/);
});

test("forge_born : arpège dont la longueur dépend de lvl", () => {
  assert.match(src, /slice\(0,\s*2 \+/);
});
