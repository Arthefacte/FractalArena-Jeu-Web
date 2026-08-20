// Sur le plateau de combat (Fosse et Campagne), les cartes tiennent à 3 par
// rangée : ~108 px de large sur un écran de 390. Les deux badges de la vignette
// étaient tous deux ancrés en HAUT — rareté à gauche, niveau à droite — et
// « LÉGENDAIRE » + « LV 20 » réclament ~128 px avec leurs marges. Mesuré dans un
// navigateur à 390 px : 23 px de recouvrement en Légendaire, 4 en Commune.
// Le niveau est donc ancré en BAS de la vignette. Ce test verrouille cet ancrage :
// le rendu n'est couvert par aucun test, une régression repasserait en silence.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const MOBILE = read("mobile.css");
const CSS = read("styles.css");

const rule = (css, selector) => {
  const i = css.indexOf(selector);
  assert.ok(i >= 0, selector + " introuvable");
  const j = css.indexOf("}", i);
  return css.slice(i, j + 1);
};

test("les deux badges de la vignette sont bien aux deux bouts en desktop", () => {
  assert.match(rule(CSS, ".card .rar-tag"), /top: 8px; left: 8px/);
  assert.match(rule(CSS, ".card .lvl-tag"), /top: 8px; right: 8px/);
});

test("sur le plateau de combat, le niveau descend en bas de la vignette", () => {
  const r = rule(MOBILE, ".arena-board-row .card .lvl-tag");
  assert.match(r, /bottom:/, "le niveau doit être ancré en bas, sinon il heurte la rareté");
  assert.doesNotMatch(r, /top: [0-9]/, "un top chiffré le ramènerait à côté de la rareté");
});

test("le niveau n'est ancré que par le bas (sinon le badge s'étire)", () => {
  // top ET bottom sur un élément absolu sans hauteur = badge étiré sur toute la
  // vignette. Neutraliser le `top: 8px` hérité est obligatoire, pas cosmétique.
  assert.match(rule(MOBILE, ".arena-board-row .card .lvl-tag"), /top: auto/);
});

test("la rareté, elle, reste en haut (les deux ne doivent pas se retrouver en bas)", () => {
  assert.doesNotMatch(rule(MOBILE, ".arena-board-row .card .rar-tag"), /bottom:|top: auto/);
});
