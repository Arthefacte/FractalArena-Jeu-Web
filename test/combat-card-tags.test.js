// Sur le plateau de combat, les cartes tiennent à 3 par rangée (~108 px de large
// sur un écran de 390). Rareté et niveau y étaient posés sur la vignette, tous
// deux ancrés en haut : mesuré dans un navigateur, 23 px de recouvrement en
// Légendaire, 4 en Commune. Ils vivent maintenant dans le CORPS de la carte, en
// jauge — la vignette ne porte plus rien.
//
// La jauge ne mesure pas un plafond : à MAX_LEVEL_UPGRADE (100) la rareté monte
// d'un cran et le niveau repart à 1 (data.js). Elle dit donc ce qu'il reste
// avant la rareté SUIVANTE. La Légendaire est exclue de ce cycle et n'a aucune
// cible — un « x/100 » y mentirait.
//
// Le rendu n'est couvert par aucun test : sans ce verrou, un retour des badges
// sur la vignette repasserait en silence.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const COMBAT = ["fosse.jsx", "campaign.jsx"];

test("la vignette des cartes de combat ne porte plus de badge", () => {
  for (const f of COMBAT) {
    const src = read(f);
    assert.doesNotMatch(src, /className="rar-tag"/, f + " : la rareté ne doit plus être posée sur l'art");
    assert.doesNotMatch(src, /className="lvl-tag"/, f + " : le niveau ne doit plus être posé sur l'art");
  }
});

test("rareté et niveau sont dans le corps, avec la jauge de progression", () => {
  for (const f of COMBAT) {
    const src = read(f);
    assert.match(src, /kind="rar"/, f + " : la jauge de rareté doit exister");
    assert.match(src, /rarityLabel\(meta\.rarity\)/, f + " : le libellé de rareté doit rester affiché");
  }
});

test("la jauge vise le palier de rareté, pas un nombre écrit en dur", () => {
  // Si 100 est recopié à la main, le jour où MAX_LEVEL_UPGRADE bouge la jauge ment.
  for (const f of COMBAT) {
    const src = read(f);
    assert.match(src, /D\.ECON\.MAX_LEVEL_UPGRADE/, f + " : le palier doit venir de la constante");
    assert.doesNotMatch(src, /meta\.level \/ 100/, f + " : pas de 100 en dur");
  }
});

test("la Légendaire n'affiche pas de cible qu'elle n'a pas", () => {
  // data.js ne fait monter la rareté que si `b.rarity !== "Legendary"` : une
  // Légendaire monte sans fin, donc aucun dénominateur n'est vrai pour elle.
  const data = read("data.js");
  assert.match(data, /b\.rarity !== "Legendary"/, "le modèle a changé : revoir ce que la jauge raconte");
  for (const f of COMBAT) {
    assert.match(read(f), /maxRarity = meta\.rarity === "Legendary"/, f + " : le cas Légendaire doit être distingué");
  }
});

test("le roster, lui, garde ses badges (cartes plus grandes)", () => {
  const src = read("components.jsx");
  assert.match(src, /className="rar-tag"/, "le roster garde le badge de rareté");
  assert.match(src, /className="lvl-tag"/, "le roster garde le badge de niveau");
});

test("les surcharges mobiles des badges de combat ont disparu avec eux", () => {
  const mobile = read("mobile.css");
  assert.doesNotMatch(mobile, /\.arena-board-row \.card \.(rar|lvl)-tag/, "règle devenue morte : à retirer");
});
