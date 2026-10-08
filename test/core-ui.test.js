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

test("description d'un core : passe par core-ui.js (valeur de SA rareté)", () => {
  // Le gabarit nu porte les valeurs d'une Commune : c'est ce qui faisait passer
  // une Rare pour une Commune à l'écran (signalé le 08/10/2026).
  assert.ok(!/I18N\.t\("CORE_" *\+[^)]*_D"\)/.test(SCREENS),
    "aucun appel nu à CORE_<ID>_D : les valeurs viennent de core-ui.js");
  assert.strictEqual((SCREENS.match(/window\.FA_CORE_UI\.coreDesc\(/g) || []).length, 3,
    "les trois surfaces (slot d'équipement, résultat d'invocation, grille de forge) délèguent");
  // core-ui.js lit FA_DATA au chargement : après data.js, et avant les composants.
  const html = read("index.html");
  assert.ok(html.includes("core-ui.js?v="), "index.html charge core-ui.js");
  assert.ok(html.indexOf("core-ui.js") > html.indexOf("data.js?v="),
    "core-ui.js s'exécute après data.js");
  assert.ok(html.indexOf("core-ui.js") < html.indexOf("build/screens.js"),
    "core-ui.js s'exécute avant les composants");
});
