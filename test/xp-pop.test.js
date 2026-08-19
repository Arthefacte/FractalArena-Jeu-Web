// test/xp-pop.test.js
// L'XP gagnée dans la Fosse "pope" sur les cartes de l'équipe, même langage
// visuel que les dégâts (FA_JUICE). Verrouillage au niveau source, comme
// finisher-hooks.test.js (les .jsx ne sont pas requirables en node:test).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const juice = read("juice.js");
const fosse = read("fosse.jsx");
const css = read("styles.css");

test("FA_JUICE expose xp()", () => {
  assert.match(juice, /function xp\(/, "juice.js doit définir xp()");
  assert.match(juice, /window\.FA_JUICE = \{[^}]*\bxp\b[^}]*\}/, "xp doit être exporté dans window.FA_JUICE");
});

test("settleBattle fait poper l'XP sur chaque carte de l'équipe, victoire seulement", () => {
  const settle = fosse.match(/function settleBattle\(\)[\s\S]*?\n  \}/);
  assert.ok(settle, "settleBattle introuvable");
  assert.match(settle[0], /win && summary\.xp > 0/, "le pop d'XP doit être gardé par win && summary.xp > 0");
  assert.match(settle[0], /p1Refs\.current\.forEach/, "le pop doit balayer les cartes de l'équipe (p1Refs)");
  assert.match(settle[0], /FA_JUICE\.xp\(/, "le pop doit passer par FA_JUICE.xp");
  assert.match(settle[0], /window\.FA_JUICE && window\.FA_JUICE\.xp/, "l'appel doit être gardé (juice.js peut être absent — même règle que FA_FINISHER)");
});

test("la carte de combat côté joueur porte une jauge d'XP", () => {
  assert.match(fosse, /xpMax: D\.xpToNext\(b\)/, "beastMeta doit embarquer xp/xpMax pour la jauge");
  const card = fosse.match(/function CombatCard\([\s\S]*?\n\}/);
  assert.ok(card, "CombatCard introuvable");
  assert.match(card[0], /side === "p1"[\s\S]*?kind="xp"/, "la jauge XP doit être rendue côté joueur (p1) seulement");
});

test("le style du pop d'XP existe et respecte prefers-reduced-motion", () => {
  assert.match(css, /\.xp-glow \{/, "styles.css doit définir .xp-glow");
  // styles.css a plusieurs blocs reduced-motion : on vérifie que la ligne de
  // neutralisation du juice inclut bien .xp-glow (aux côtés de .heal-glow).
  assert.match(css, /\.heal-glow, \.xp-glow[^{]*\{ animation: none; \}/,
    ".xp-glow doit être neutralisé sous prefers-reduced-motion");
});
