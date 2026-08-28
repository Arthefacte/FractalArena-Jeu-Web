"use strict";
// Slot core dans l'écran d'équipe (même présentation que le slot relique) +
// rétro-compat : les listes de reliques existantes ne doivent pas afficher —
// ni faire planter (`it.type.toUpperCase()` sur un core sans `type`) — les
// cores qui coexistent désormais dans le même tableau `equipment`.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const SCREENS = read("screens.jsx");
const MARKET = read("market.jsx");

function composant(src, nom) {
  const i = src.indexOf("function " + nom);
  assert.ok(i > 0, `composant ${nom} absent`);
  const j = src.indexOf("\nfunction ", i + 1);
  return src.slice(i, j > 0 ? j : undefined);
}

test("l'écran d'équipe rend un CoreSlot sous chaque carte, comme RelicSlot", () => {
  assert.match(SCREENS, /<RelicSlot beast=\{b\} \/>/);
  assert.match(SCREENS, /<CoreSlot beast=\{b\} \/>/);
});

test("CoreSlot : équipé via beast.core_id, équipe par actions.coreEquip", () => {
  const c = composant(SCREENS, "CoreSlot");
  assert.match(c, /beast\.core_id/, "le slot lit l'instance équipée sur la bête");
  assert.match(c, /actions\.coreEquip/, "le slot équipe via l'action");
  assert.match(c, /CORE_NONE/, "slot vide : libellé dédié");
  assert.match(c, /isCoreItem/, "la liste équipable ne propose que des cores");
});

test("CoreSlot : un core porté par une autre bête n'est pas proposé", () => {
  const c = composant(SCREENS, "CoreSlot");
  assert.match(c, /\.core_id === inst\.id/, "même repère que RelicSlot (holder)");
});

test("rétro-compat : RelicSlot ne liste que des reliques", () => {
  const c = composant(SCREENS, "RelicSlot");
  assert.match(c, /isRelicItem/,
    "sans ce tri, un core (sans `type`) plante RELIC_ + type.toUpperCase()");
});

test("rétro-compat : l'inventaire de la Forge ne montre que des reliques", () => {
  // Dernière occurrence : la grille de la Forge (les modales des slots en ont une aussi).
  const i = SCREENS.lastIndexOf("RELIC_INVENTORY");
  assert.ok(i > 0);
  const b = SCREENS.slice(i, i + 1600);
  assert.match(b, /isRelicItem/,
    "sans ce tri, un core planterait la grille d'inventaire des reliques");
});

test("rétro-compat : l'onglet vente du Marché ne propose que des reliques", () => {
  const c = composant(MARKET, "MarketMine");
  assert.match(c, /isRelicItem/,
    "sans ce tri, un core planterait la liste « Choisis une relique »");
});
