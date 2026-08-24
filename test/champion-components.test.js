"use strict";
/* Composants Champion de soutien : exports, chargement, montage de la modale. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "champion.jsx"), "utf8");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

test("champion.jsx exporte les 3 composants sur window", () => {
  assert.match(SRC, /Object\.assign\(window/);
  for (const c of ["ChampionRow", "ChampionTile", "ChampionUsesModal"]) assert.match(SRC, new RegExp(c));
});

test("les montants passent par FaText, l agregat par FA_CHAMPION_UI", () => {
  assert.match(SRC, /FaText/);
  assert.match(SRC, /aggregateUsesByDay/);
  assert.match(SRC, /CHAMP_USES_LINE/);
});

test("index.html charge champion-ui (racine) puis build/champion avant build/app", () => {
  const iUi = HTML.indexOf('src="champion-ui.js?');
  const iCmp = HTML.indexOf('src="build/champion.js?');
  const iApp = HTML.indexOf('src="build/app.js?');
  assert.ok(iUi > 0, "champion-ui.js absent");
  assert.ok(iCmp > 0, "build/champion.js absent");
  assert.ok(iApp > 0);
  assert.ok(iUi < iCmp && iCmp < iApp, "ordre de chargement");
});

test("App monte ChampionUsesModal quand unseen > 0", () => {
  assert.match(APP, /ChampionUsesModal/);
  assert.match(APP, /championUses\.unseen/);
  assert.match(APP, /championUsesSeen/);
});

test("pas de rar-tag/lvl-tag sur la vignette de la tuile champion", () => {
  assert.ok(!/rar-tag|lvl-tag/.test(SRC));
});
