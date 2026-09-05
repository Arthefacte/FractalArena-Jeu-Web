// test/lb-delta-wiring.test.js
// Indicateur de mouvement de rang (▲/▼/═/🆕) vs le snapshot quotidien.
// Les .jsx sont transformés par Babel-in-browser (non requérables en node) →
// on verrouille le câblage au niveau source, comme juice-wiring.test.js.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("leaderboard.jsx affiche l'indicateur de delta de rang (tous les rangs)", () => {
  const src = read("leaderboard.jsx");
  assert.ok(!/row\.rank <= 100/.test(src), "l'indicateur ne doit plus être limité au top 100 (snapshot étendu à tous les joueurs)");
  assert.match(src, /lb-delta up/, "classe .lb-delta.up (monté) attendue");
  assert.match(src, /lb-delta down/, "classe .lb-delta.down (descendu) attendue");
  assert.match(src, /lb-delta stable/, "classe .lb-delta.stable attendue");
  assert.match(src, /lb-delta new/, "classe .lb-delta.new (🆕) attendue");
  assert.match(src, /row\.delta == null/, "delta null = nouveau compte");
  // ▲/▼ en glyphes texte (recolorables en CSS), pas d'emoji flèche.
  assert.match(src, /▲/, "glyphe ▲ attendu pour la montée");
  assert.match(src, /▼/, "glyphe ▼ attendu pour la descente");
  // Tooltips localisés (jamais de chaîne en dur).
  for (const k of ["LB_DELTA_UP", "LB_DELTA_DOWN", "LB_DELTA_STABLE", "LB_DELTA_NEW"]) {
    assert.match(src, new RegExp(`I18N\\.t\\("${k}"`), `tooltip ${k} doit passer par I18N.t`);
  }
});

test("styles.css stylise l'indicateur (couleurs sémantiques + apparition douce)", () => {
  const css = read("styles.css");
  assert.match(css, /\.lb-delta\.up\s*\{[^}]*var\(--success\)/, ".lb-delta.up doit être vert (--success)");
  assert.match(css, /\.lb-delta\.down\s*\{[^}]*var\(--alert\)/, ".lb-delta.down doit être rouge (--alert)");
  assert.match(css, /\.lb-delta\.stable\s*\{[^}]*var\(--text-faint\)/, ".lb-delta.stable doit être gris (--text-faint)");
  assert.match(css, /\.lb-delta\.new\s*\{[^}]*var\(--gold\)/, ".lb-delta.new doit être doré (--gold)");
  assert.match(css, /@keyframes lb-delta-in/, "animation d'apparition subtile attendue");
});

test("i18n.js fournit les tooltips du delta en FR/EN/ZH", () => {
  const src = read("i18n.js");
  for (const k of ["LB_DELTA_UP", "LB_DELTA_DOWN", "LB_DELTA_STABLE", "LB_DELTA_NEW"]) {
    const m = src.match(new RegExp(`${k}:\\s*\\{([^}]*)\\}`));
    assert.ok(m, `clé ${k} absente de i18n.js`);
    for (const lang of ["FR", "EN", "ZH"]) {
      assert.match(m[1], new RegExp(`${lang}:`), `${k} doit avoir la langue ${lang}`);
    }
  }
});
