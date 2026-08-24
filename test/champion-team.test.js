"use strict";
/* L'ecran Equipe permet de designer son champion (Champion de soutien). */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");
const TEAM = SRC.slice(SRC.indexOf("function Team("), SRC.indexOf("function RelicSlot"));

test("l ecran Equipe charge la designation et permet de designer", () => {
  assert.match(TEAM, /championGet\(\)/);
  assert.match(TEAM, /championSet\(/);
  assert.match(TEAM, /CHAMP_DESIGNATE/);
  assert.match(TEAM, /CHAMP_IS/);
  assert.match(TEAM, /championBeastId/);
});

test("pas de rarete/niveau ajoutes sur la vignette (seul un badge est permis)", () => {
  assert.ok(!/rar-tag|lvl-tag/.test(TEAM));
});
