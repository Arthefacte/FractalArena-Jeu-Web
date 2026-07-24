const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

test("FA_API_URL : défini par data.js, Railway par défaut hors navigateur", () => {
  globalThis.window = {};
  delete require.cache[require.resolve("../data.js")];
  require("../data.js");
  assert.strictEqual(globalThis.window.FA_API_URL, "https://fractal-arena-server-production.up.railway.app");
});

test("FA_API_URL : la source gère localhost et 127.0.0.1", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "data.js"), "utf8");
  assert.ok(src.includes('location.hostname === "localhost"'), "localhost");
  assert.ok(src.includes('location.hostname === "127.0.0.1"'), "127.0.0.1");
  assert.ok(src.includes('"http://localhost:3000"'), "cible locale");
});

test("plus aucune URL Railway en dur dans les consommateurs", () => {
  for (const f of ["app.jsx", "buyback.jsx", "screens.jsx"]) {
    const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    assert.ok(!src.includes("railway.app"), f + " ne doit plus coder l'URL en dur");
    assert.ok(src.includes("window.FA_API_URL"), f + " consomme window.FA_API_URL");
  }
});
