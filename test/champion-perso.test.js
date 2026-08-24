"use strict";
/* L'ecran Perso affiche le compteur de points de lien (Champion de soutien). */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");
const PERSO = SRC.slice(SRC.indexOf("function Perso("));

test("l ecran Perso affiche le compteur de points de lien", () => {
  assert.match(PERSO, /CHAMP_POINTS/);
  assert.match(PERSO, /championPoints/);
});
