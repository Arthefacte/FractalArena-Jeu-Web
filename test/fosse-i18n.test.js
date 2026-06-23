const test = require("node:test");
const assert = require("node:assert");

// i18n.js est une IIFE qui fait `window.FA_I18N = {...}`.
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;

const LANGS = ["FR", "EN", "ZH"];

test("la clé NAV_FOSSE existe dans les 3 langues, non vide", () => {
  assert.ok(T.NAV_FOSSE, "clé manquante : NAV_FOSSE");
  for (const lg of LANGS) {
    assert.ok(T.NAV_FOSSE[lg] && T.NAV_FOSSE[lg].trim().length > 0, `NAV_FOSSE.${lg} vide`);
  }
});

test("l'ancienne clé NAV_ARENA est retirée (le nom Arène est libéré pour le PvP)", () => {
  assert.strictEqual(T.NAV_ARENA, undefined, "NAV_ARENA devrait avoir disparu");
});

test("aucun texte de MODE ne dit encore « l'Arène » (FR) pour désigner le farm", () => {
  assert.match(T.TEAM_ENTER.FR, /Fosse/, "TEAM_ENTER.FR doit pointer vers La Fosse");
  assert.match(T.CAMP_TICKET_HINT.FR, /Fosse/, "CAMP_TICKET_HINT.FR doit pointer vers La Fosse");
  assert.match(T.CAMP_NO_TICKET.FR, /Fosse/, "CAMP_NO_TICKET.FR doit pointer vers La Fosse");
});
