// Marché de cores : onglet Reliques/Cores, browse item_type=core, vente body
// core_id, rendu CoreIcon — et le volet reliques inchangé (relic_id, isRelicItem).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Babel = require("@babel/standalone");
const MKT = require("../market-ui.js");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const market = read("market.jsx");
const app = read("app.jsx");

function bloc(src, marker, len) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, marker + " absent");
  return src.slice(i, i + (len || 1600));
}

test("market.jsx parse toujours sans erreur (presets react)", () => {
  assert.doesNotThrow(() => Babel.transform(market, { presets: ["react"] }));
});

test("market.jsx : onglet Reliques/Cores, le browse recharge par nature", () => {
  assert.match(market, /MKT_TAB_RELICS/);
  assert.match(market, /MKT_TAB_CORES/);
  assert.match(market, /marketRefresh\(kind\)/, "le changement d'onglet doit recharger les listings");
  assert.match(market, /setKind\("core"\)/);
  assert.match(market, /setKind\("relic"\)/);
});

test("app.jsx : marketRefresh demande item_type=core sur le volet cores et le mémorise", () => {
  const b = bloc(app, "async marketRefresh", 1600);
  assert.match(b, /item_type=core/, "paramètre item_type=core manquant");
  assert.match(b, /item_type: t/, "le volet doit être mémorisé pour les resync post-mutation");
});

test("app.jsx : marketList envoie core_id pour un core, relic_id sinon", () => {
  const b = bloc(app, "async marketList", 1600);
  assert.match(b, /body\.core_id = item\.id/, "body core_id manquant");
  assert.match(b, /body\.relic_id = item && item\.id/, "body relic_id (volet reliques) manquant");
  assert.match(b, /typeof item\.core_id === "string"/, "l'aiguillage doit tester la nature de l'objet");
});

test("market.jsx : MarketMine filtre l'inventaire par nature et repère l'équipé par le bon champ", () => {
  const b = bloc(market, "function MarketMine", 4500);
  assert.match(b, /core \? D\.isCoreItem : D\.isRelicItem/, "filtre d'inventaire par nature manquant");
  assert.match(b, /core \? c\.core_id : c\.relic_id/, "⚔ : le core équipé est référencé par c.core_id");
  assert.match(b, /marketList\(selItem, p\)/, "l'action doit recevoir l'OBJET (elle choisit relic_id/core_id)");
});

test("market.jsx : un listing core se rend avec CoreIcon + CORE_<core_id>, une relique avec RelicIcon", () => {
  const b = bloc(market, "function ItemIcon", 900);
  assert.match(b, /D\.isCoreItem\(it\)/);
  assert.match(b, /<CoreIcon type=\{it\.core_id\}/);
  assert.match(b, /<RelicIcon type=\{it\.type\}/);
  assert.match(market, /I18N\.t\("CORE_" \+ it\.core_id\.toUpperCase\(\)\)/);
  assert.match(market, /I18N\.t\("RELIC_" \+ String\(it\.type \|\| ""\)\.toUpperCase\(\)\)/);
});

test("market.jsx : confirmation d'achat et listes par nature (aucune fuite entre volets)", () => {
  assert.match(market, /MKT_CONFIRM_TEXT_CORE/, "texte de confirmation core manquant");
  assert.match(market, /isKind\(kind, l\.item\)/, "les listes doivent être filtrées par le volet courant");
});

test("filterListings : le filtre type matche aussi core_id, tri inchangé", () => {
  const L = [
    { id: 1, price: 900, item: { core_id: "fury_core", rarity: "Rare" } },
    { id: 2, price: 300, item: { type: "amber_cell", rarity: "Epic" } },
    { id: 3, price: 500, item: { core_id: "regen_core", rarity: "Common" } },
  ];
  assert.deepStrictEqual(MKT.filterListings(L, {}).map((l) => l.id), [2, 3, 1]);
  assert.deepStrictEqual(MKT.filterListings(L, { type: "fury_core" }).map((l) => l.id), [1]);
  assert.deepStrictEqual(MKT.filterListings(L, { type: "amber_cell" }).map((l) => l.id), [2]);
  assert.deepStrictEqual(MKT.filterListings(L, { rarity: "Common" }).map((l) => l.id), [3]);
});
