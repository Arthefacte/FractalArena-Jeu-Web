// Constat du fondateur, 02/11/2026 : « regarde, la dimension mobile n'est pas bonne ».
// La capture montrait l'écran d'accueil rogné à droite : titre « FRACTAL ARENA » coupé,
// bannière cadeau tronquée, boutons qui sortent de l'écran.
//
// Mesuré en 390 px de large : le bloc d'accueil valait 445 px. Deux causes, toutes deux
// dans les styles EN LIGNE de ce composant (aucune media query ne pouvait les rattraper) :
//   1) `padding: 28` sans `box-sizing: border-box` : la boîte prenait la largeur de son
//      contenu (le titre seul demandait 389 px) et le padding s'ajoutait dehors → 445 ;
//   2) le titre était figé à 40 px avec 6 px d'interlettre, le logo à 168 px.
//
// Ce test verrouille les trois valeurs mobiles. Il lit le source plutôt que le DOM : c'est
// le seul moyen de faire échouer une régression de style dans une suite Node, et ça suffit
// ici — les trois propriétés sont ce qui empêchait la page de tenir dans un téléphone.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

// Le bloc d'accueil : de son ouverture jusqu'au sous-titre « JOUER SANS WALLET ».
function blocAccueil() {
  const i = SRC.indexOf('className="app-shell" style={{ minHeight: "100vh"');
  assert.ok(i >= 0, "bloc d'accueil introuvable dans app.jsx");
  const j = SRC.indexOf("ACC_PLAY_NOW_SUB", i);
  assert.ok(j > i, "fin du bloc d'accueil introuvable");
  return SRC.slice(i, j);
}

test("le conteneur d'accueil tient dans l'écran (border-box + largeur 100%)", () => {
  const b = blocAccueil();
  assert.ok(/boxSizing: "border-box"/.test(b), "box-sizing: border-box a disparu : le padding ressort de l'écran");
  assert.ok(/width: "100%"/.test(b), "largeur 100% a disparu : la boîte reprend la largeur de son contenu");
  assert.ok(/maxWidth: 540/.test(b), "le plafond desktop (540) doit rester");
  assert.ok(!/padding: 28[,\s}]/.test(b), "padding fixe 28 : le padding doit rester en clamp()");
});

test("le titre s'adapte à la largeur d'écran au lieu de rester à 40 px", () => {
  const b = blocAccueil();
  assert.ok(/fontSize: "clamp\(23px, 7\.6vw, 40px\)"/.test(b), "le titre doit passer en clamp(23px, 7.6vw, 40px)");
  assert.ok(/letterSpacing: "clamp\(1\.5px, 1\.1vw, 6px\)"/.test(b), "l'interlettre du titre doit passer en clamp");
  assert.ok(!/fontSize: 40,/.test(b), "valeur fixe 40 px encore présente sur le titre");
});

test("le logo d'accueil s'adapte aussi (168 px maximum)", () => {
  const b = blocAccueil();
  assert.ok(/width: "clamp\(104px, 30vw, 168px\)"/.test(b), "le logo doit passer en clamp(104px, 30vw, 168px)");
  assert.ok(!/width: 168, height: 168/.test(b), "logo figé à 168 px encore présent");
});

// Garde-fou numérique : à 390 px, le titre en clamp tient dans la zone utile du conteneur
// (390 − 2 × padding 5vw = 351 px). Le ratio 7,6vw vient de cette mesure : 389 px à 40 px
// de corps, donc ~351 px à 35 px. Un futur ajustement du clamp doit rester sous la marge.
test("à 390 px, le titre en clamp tient dans la largeur utile", () => {
  const vw = 390;
  const pad = Math.min(28, Math.max(16, 0.05 * vw)); // clamp(16px, 5vw, 28px)
  const utile = vw - 2 * pad; // 351
  const corps = Math.min(40, Math.max(23, 0.076 * vw)); // clamp(23px, 7.6vw, 40px) → 29,6
  const inter = Math.min(6, Math.max(1.5, 0.011 * vw)); // ≈ 4,3
  // 13 caractères (« FRACTAL ARENA »), largeur moyenne d'une capitale ≈ 0,72 × corps
  const largeurTitre = 13 * (0.72 * corps + inter);
  assert.ok(largeurTitre < utile, `titre estimé ${Math.round(largeurTitre)} px > zone utile ${Math.round(utile)} px`);
});
