/* Idée esthétique #2 — « rareté-comme-matière ».
   La rareté ne se lisait qu'à une couleur, un tag et un reflet au SURVOL
   (--foil), donc invisible sur mobile. Elle devient une matière permanente :
   métal brut / verre / cristal / or en fusion. Prototypé dans
   _rarete-proto.html, validé, puis porté ici.

   Verrouillage au niveau SOURCE (modèle finisher-play.test.js) : ces règles
   sont du CSS et du JSX, non exécutables en node. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const CSS = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");
const COMPONENTS = fs.readFileSync(path.join(__dirname, "..", "components.jsx"), "utf8");

test("chaque rareté a sa matière dans styles.css", () => {
  for (const r of ["common", "rare", "epic", "legendary"]) {
    assert.ok(CSS.includes(".card.r-" + r), "matière manquante pour : " + r);
  }
});

test("la matière se voit SANS survol : elle ne vit pas dans une règle :hover", () => {
  // Le défaut d'origine : --foil n'apparaît qu'au survol, donc jamais sur mobile.
  const blocs = CSS.split("\n").filter((l) => /\.card\.r-(common|rare|epic|legendary)/.test(l));
  assert.ok(blocs.length >= 4, "règles de matière introuvables");
  for (const b of blocs) assert.ok(!/:hover/.test(b), "la matière ne doit pas dépendre du survol : " + b.trim());
});

test("une seule rareté est animée : la Légendaire", () => {
  // Corps de toutes les règles dont le sélecteur cible cette rareté.
  const bloc = (r) => CSS.split("}")
    .filter((chunk) => {
      const sel = chunk.split("{")[0] || "";
      return sel.includes(".card.r-" + r);
    })
    .map((chunk) => chunk.split("{")[1] || "")
    .join(" ");
  assert.match(bloc("legendary"), /animation:/, "l'or en fusion doit vivre");
  for (const r of ["common", "rare", "epic"]) {
    assert.ok(!/animation:/.test(bloc(r)), `${r} doit rester statique — une seule rareté bouge`);
  }
});

test("l'animation de la Légendaire est coupée sous prefers-reduced-motion", () => {
  // Le jeu a plusieurs blocs reduced-motion : celui des cartes doit couper l'or.
  const blocs = CSS.split("@media (prefers-reduced-motion: reduce)").slice(1);
  assert.ok(blocs.length > 0, "aucune prise en compte de reduced-motion");
  const coupe = blocs.some((b) => b.slice(0, 400).includes("r-legendary") && b.slice(0, 400).includes("animation: none"));
  assert.ok(coupe, "l'or en fusion doit se figer comme le reste des animations du jeu");
});

test("CreatureCard pose la classe de rareté sur la carte", () => {
  assert.match(COMPONENTS, /"r-" \+ String\(beast\.rarity/,
    "sans classe de rareté sur la carte, aucune matière ne s'applique");
});
