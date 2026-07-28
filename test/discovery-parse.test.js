// Le parcours touche deux fichiers JSX rendus par Babel dans le navigateur : une
// coquille de syntaxe n'y casse pas un test, elle casse l'application entiere au
// chargement. Meme garde que test/market-parse.test.js.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Babel = require("@babel/standalone");

for (const f of ["quests.jsx", "account.jsx", "app.jsx"]) {
  test(`${f} parse sans erreur (presets react)`, () => {
    const src = fs.readFileSync(path.join(__dirname, "..", f), "utf8");
    assert.doesNotThrow(() => Babel.transform(src, { presets: ["react"] }));
  });
}
