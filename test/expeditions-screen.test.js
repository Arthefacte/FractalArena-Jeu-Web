// Câblage de l'écran Expéditions : composant exposé, routé, navigable, stylé, chargé.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("expeditions.jsx : composant exposé sur window", () => {
  const src = read("expeditions.jsx");
  assert.match(src, /function Expeditions\(\)/);
  assert.match(src, /Object\.assign\(window, \{ Expeditions \}\)/);
});

test("app.jsx : Expeditions routé et dans le sheet", () => {
  const src = read("app.jsx");
  assert.match(src, /expeditions: Expeditions/);
  assert.match(src, /\["expeditions", "NAV_EXPEDITIONS"\]/);
});

test("index.html : build/expeditions.js chargé avant build/app.js", () => {
  const src = read("index.html");
  const iExp = src.indexOf("build/expeditions.js");
  const iApp = src.indexOf("build/app.js");
  assert.ok(iExp > 0, "balise script manquante");
  assert.ok(iExp < iApp, "expeditions doit être chargé avant app");
});

test("styles.css : accent de vue + keyframes du portail", () => {
  const src = read("styles.css");
  assert.match(src, /body\[data-view="expeditions"\]/);
  assert.match(src, /@keyframes exqRingOpen/);
  assert.match(src, /prefers-reduced-motion/);
});
