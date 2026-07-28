// Le rendu n'est couvert par aucun test : une classe ou une variable CSS inventee
// passerait toute la suite et casserait l'ecran en silence. C'est arrive deux fois
// en ecrivant ce lot (`input` au lieu de `field`, `--good` au lieu de `--success`).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const CSS = read("styles.css");

// Bloc du parcours dans chaque fichier : on ne valide que ce que ce lot a ajoute,
// pas tout le depot.
const ZONES = [
  { f: "quests.jsx", from: "DISC_TITLE", len: 2500 },
  { f: "account.jsx", from: "DISC_CRYPTO_TITLE", len: 2500 },
];

function zone({ f, from, len }) {
  const src = read(f);
  const i = src.indexOf(from);
  assert.ok(i > 0, `${from} introuvable dans ${f}`);
  return src.slice(i - 500 > 0 ? i - 500 : 0, i + len);
}

test("toutes les classes CSS employees par le parcours existent", () => {
  const inconnues = [];
  for (const z of ZONES) {
    for (const m of zone(z).matchAll(/className="([^"{]+)"/g)) {
      for (const cls of m[1].split(/\s+/).filter(Boolean)) {
        if (!new RegExp("\\." + cls.replace(/[-]/g, "\\-") + "\\b").test(CSS)) {
          inconnues.push(`${z.f} → .${cls}`);
        }
      }
    }
  }
  assert.deepStrictEqual(inconnues, []);
});

test("toutes les variables CSS employees par le parcours existent", () => {
  const inconnues = [];
  for (const z of ZONES) {
    for (const m of zone(z).matchAll(/var\((--[a-z-]+)\)/g)) {
      if (!CSS.includes(m[1] + ":")) inconnues.push(`${z.f} → ${m[1]}`);
    }
  }
  assert.deepStrictEqual(inconnues, []);
});
