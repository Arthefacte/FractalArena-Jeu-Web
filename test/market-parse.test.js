// test/market-parse.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Babel = require("@babel/standalone");

test("market.jsx parse sans erreur (presets react)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "market.jsx"), "utf8");
  assert.doesNotThrow(() => Babel.transform(src, { presets: ["react"] }));
});

test("app.jsx référence la vue market et les actions", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
  for (const needle of ["market: Market", "NAV_MARKET", "marketRefresh", "marketList", "marketBuy", "marketCancel"]) {
    assert.ok(src.includes(needle), `app.jsx doit contenir ${needle}`);
  }
});
