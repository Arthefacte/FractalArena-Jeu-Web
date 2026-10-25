// test/entete-mobile.test.js
// En-tête mobile du 25/10/2026 (v402). Trois régressions ont été corrigées d'un
// coup, et chacune tenait à une ligne qu'un futur passage peut défaire sans rien
// voir sur un écran de bureau :
//   1. la rangée d'outils (quiz, support, salon, caret) prenait la place du logo
//      et du nom du jeu → elle passe dans le tiroir « Plus » en portrait ;
//   2. une montée de liquidité à sept chiffres poussait les chips hors du cadre
//      → montant COMPACT dans le chip, montant EXACT au clic ;
//   3. le nom du jeu était masqué (`.hdr-word { display: none }`) → il revient.
// Ces gardes lisent la SOURCE et le BUNDLE : un composant qui ne serait pas
// transpilé (build/app.js oublié) ne partirait pas chez le joueur, et une suite
// verte sur la source seule ne le verrait pas.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = lire("app.jsx");
const MOB = lire("mobile.css");
const BUNDLE = lire(path.join("build", "app.js"));

// Bloc du composant ChipAmount, du `function ChipAmount` jusqu'au `function` suivant.
// Extraire le bloc (et pas le fichier entier) évite qu'un `chip-exact` posé
// ailleurs dans les 4 000 lignes d'app.jsx ne valide la garde à sa place.
function corpsChipAmount() {
  const debut = APP.indexOf("function ChipAmount(");
  assert.ok(debut >= 0, "ChipAmount a disparu d'app.jsx");
  const fin = APP.indexOf("\nfunction ", debut + 10);
  return APP.slice(debut, fin > 0 ? fin : APP.length);
}

test("le montant compact vient d'abbr() et l'exact de ChipAmount", () => {
  assert.match(APP, /function abbr\(/,
    "abbr() est le seul formatage compact du bandeau : le retirer remet un montant de sept chiffres dans un chip de téléphone");
  const corps = corpsChipAmount();
  // Le chip affiche le COMPACT et la bulle l'EXACT : les deux, depuis le même
  // composant. Un chip qui n'afficherait que l'un des deux perd soit la place,
  // soit la valeur.
  assert.match(corps, /className="chip-exact"/,
    "le montant exact ne s'affiche plus au clic (la bulle .chip-exact a quitté ChipAmount)");
  assert.match(corps, /\{compact\}/, "le chip n'affiche plus le montant compact");
  assert.match(corps, /\{exact\}/, "la bulle n'affiche plus le montant exact");
});

test("les trois chips du bandeau passent par ChipAmount", () => {
  // Liquidité, FB et verrouillé : le bandeau ne doit pas garder un {fmt(...)} nu
  // à côté de chips compacts — c'est le plus gros montant qui déborde.
  const debut = APP.indexOf("function Header(");
  assert.ok(debut >= 0, "Header a disparu d'app.jsx");
  const header = APP.slice(debut, APP.indexOf("\nfunction ", debut + 10));
  const chips = header.match(/<ChipAmount /g) || [];
  assert.ok(chips.length >= 3,
    `les trois chips du bandeau doivent porter ChipAmount (trouvé : ${chips.length})`);
  assert.doesNotMatch(header, /<b className="chip-amount">\{fmt\(/,
    "un chip est revenu au montant brut : c'est celui qui pousse la rangée hors cadre");
});

test("en portrait, les outils du bandeau sont dans le tiroir, pas dans le header", () => {
  assert.match(MOB, /\.hdr-mtools\s*\{\s*display:\s*none\s*;/,
    "les outils du bandeau doivent être masqués en portrait (le logo et le nom du jeu reprennent la place)");
  assert.match(MOB, /\.hdr-mtools\s*\{\s*display:\s*flex\s*;/,
    "en paysage la place abonde : la rangée d'outils revient dans le bandeau");
  // Le tiroir porte les mêmes actions, en miroir du Header.
  assert.match(MOB, /\.fa-sheet-tools\s*\{/,
    "le tiroir « Plus » doit porter la rangée d'outils (.fa-sheet-tools)");
  assert.match(APP, /className="fa-sheet-tools"/,
    "app.jsx ne monte plus les outils dans le tiroir « Plus »");
});

test("le nom du jeu reste affiché en portrait", () => {
  assert.doesNotMatch(MOB, /\.hdr-word\s*\{\s*display:\s*none/,
    "le nom du jeu est remasqué en mobile — c'est la régression d'origine");
  assert.match(MOB, /\.hdr-word\s*\{[^}]*display:\s*flex/,
    "le nom du jeu doit être en flex pour céder la place sans rogner le texte");
});

test("le bundle committé porte le composant", () => {
  // build/app.js est le fichier RÉELLEMENT servi : un app.jsx modifié sans
  // `npm run build` laisse le joueur sur l'ancien header, suite verte comprise.
  assert.match(BUNDLE, /chip-exact/,
    "build/app.js ne porte pas .chip-exact — relancer `npm run build` et committer l'artefact");
  assert.match(BUNDLE, /chip-amount-wrap/,
    "build/app.js ne porte pas .chip-amount-wrap — le bundle est en retard sur app.jsx");
});
