// Le halo de rareté est MULTIPLIÉ par l'emissiveMap du matériau. Là où elle
// existe, il n'allume que les zones voulues par l'artiste (veines, circuits).
// Là où elle MANQUE, il s'étale uniformément sur toute la surface et remplace le
// modèle par une couleur pleine.
//
// Signalé sur la Membrane d'Onyx le 2026-08-20 (« un voile blanc, ça ne
// ressemble pas du tout à l'image originale »). Mesuré dans un navigateur,
// moyenne des pixels du rendu :
//
//                       avant            après
//   Onyx Commune     67,71,76        19,23,24   (le voile → la vraie matière)
//   Onyx Légendaire  242,146,35      49,36,19   (orange saturé → onyx doré)
//
// En Légendaire, la relique disparaissait entièrement sous le halo.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// Matériaux d'un .glb, lus dans son chunk JSON (aucune dépendance).
const materiaux = (type) => {
  const b = fs.readFileSync(path.join(__dirname, "..", "assets", "relics", type + ".glb"));
  const json = JSON.parse(b.slice(20, 20 + b.readUInt32LE(12)).toString("utf8"));
  return json.materials || [];
};

const SANS_MAP = ["sapphire_plate", "cobalt_spring", "onyx_membrane"];

test("l'inventaire des modèles sans texture émissive est à jour", () => {
  // Si un modèle est réexporté avec (ou sans) emissiveMap, ce test le dit : le
  // rendu de sa rareté bascule alors d'un chemin à l'autre sans prévenir.
  const A = require("../relic-assets.js");
  const constate = A.TYPES.filter((t) => !materiaux(t).some((m) => m.emissiveTexture));
  assert.deepStrictEqual(constate.sort(), [...SANS_MAP].sort(),
    "la liste des modèles sans emissiveMap a changé — revoir le rendu de la rareté");
});

test("le halo n'est appliqué que là où une emissiveMap le canalise", () => {
  const src = read("relic-models.js");
  assert.match(src, /if \(c\.emissive && c\.emissiveMap\)/,
    "sans cette condition, le halo repeint toute la surface des modèles nus");
  assert.match(src, /userData\.rarityTinted = tinted/,
    "l'appelant doit savoir si la matière a pris la teinte, pour porter la rareté autrement");
});

test("les modèles nus portent leur rareté par la lumière, pas par la matière", () => {
  const src = read("relic-icons.js");
  assert.match(src, /rar\.decay = 0/,
    "avec le decay physique par défaut, la lampe ne marque pas un modèle noir (mesuré)");
  assert.match(src, /rar\.intensity = tinted \? 0 : glow\.intensity \* 8/,
    "même échelle que RARITY_GLOW : la Commune reste discrète, la Légendaire marque");
});

test("la lampe ne déborde pas sur le rendu suivant", () => {
  // Le renderer et la scène sont partagés par tous les appels : une lampe
  // laissée allumée teinterait la relique d'après, d'une autre rareté.
  const src = read("relic-icons.js");
  const i = src.indexOf("function _renderObject");
  const bloc = src.slice(i, src.indexOf("function _primitive", i));
  assert.match(bloc, /rar\.intensity = 0/, "la lampe doit être éteinte après chaque rendu");
});
