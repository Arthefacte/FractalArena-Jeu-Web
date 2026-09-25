// Forge → onglets Reliques / Cores (25/09).
//
// Constat : les deux forges de fragments étaient empilées dans le MÊME onglet, avec
// les mêmes rangs C/B/A/S, les mêmes coûts (100/250/600/1000), les mêmes barres cyan
// et le même bouton « Forger » — aucun marqueur. Un clic sur la mauvaise ligne
// forgeait un core au lieu d'une relique (vécu les 20/09 et 25/09), et le core forgé
// n'apparaissait nulle part : l'inventaire sous la modale ne listait que les reliques.
//
// Ces tests verrouillent la séparation (un onglet par famille d'objet), les marqueurs
// ✦ / ⬡ (comme au claim d'expédition), les libellés de bouton et le titre de résultat.
// Vérification au niveau SOURCE : le JSX n'est pas exécutable en node.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SCREENS = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");
const I18N = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

function bloc(src, marker, len) {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, marker + " absent");
  return src.slice(i, i + (len || 1600));
}

// Fenêtre d'un composant : de « function X » à la déclaration suivante. Les bornes
// mesurées en dur débordaient sur le bloc voisin dès qu'un composant changeait de taille.
const fnBloc = (m) => {
  const i = SCREENS.indexOf("function " + m);
  assert.ok(i >= 0, m + " absent");
  return SCREENS.slice(i, SCREENS.indexOf("\nfunction ", i));
};
const F_RELIC = fnBloc("ForgeFragments");
const F_CORE = fnBloc("ForgeCoreFragments");

test("la Forge a un onglet Cores distinct de l'onglet Reliques", () => {
  assert.match(bloc(SCREENS, "function Forge()", 2000), /\{ k: "cores"/, "onglet cores absent de la barre de la Forge");
  assert.match(SCREENS, /\{tab === "cores" && <ForgeCores \/>\}/, "l'onglet cores ne rend pas ForgeCores");
  assert.match(I18N, /FG_CORES: \{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \}/, "FG_CORES incomplète");
});

test("l'onglet Cores regroupe invocation, forge de fragments et inventaire", () => {
  const b = fnBloc("ForgeCores");
  for (const c of ["ForgeCoreSummon", "ForgeCoreFragments", "ForgeCoreEquipement"]) {
    assert.match(b, new RegExp("<" + c + "[ /]"), c + " absent de ForgeCores");
  }
});

test("ForgeReliques n'empile plus la forge de fragments de core", () => {
  const b = bloc(SCREENS, "function ForgeReliques", 12000);
  assert.ok(!/<ForgeCoreFragments/.test(b), "la forge de cores ne doit plus vivre dans l'onglet Reliques");
  assert.match(b, /<ForgeEquipement/, "la forge d'équipement doit rester dans l'onglet Reliques");
});

test("chaque forge de fragments porte son marqueur : ✦ relique, jamais ⬡ ; ⬡ core, jamais ✦", () => {
  assert.match(F_RELIC, /exq-hex[^>]*>✦</, "marqueur ✦ absent de la forge de reliques");
  assert.ok(!/⬡/.test(F_RELIC), "la forge de reliques ne doit porter aucun ⬡");
  assert.match(F_CORE, /exq-hex[^>]*>⬡</, "marqueur ⬡ absent de la forge de cores");
  assert.ok(!/✦/.test(F_CORE), "la forge de cores ne doit porter aucun ✦");
});

test("les boutons de forge nomment l'objet forgé (fini le « Forger » ambigu)", () => {
  assert.match(F_RELIC, /FG_FRAG_BTN_RELIC/, "bouton de forge de relique mal libellé");
  assert.match(F_CORE, /FG_FRAG_BTN_CORE/, "bouton de forge de core mal libellé");
  for (const k of ["FG_FRAG_BTN_RELIC", "FG_FRAG_BTN_CORE", "FG_CORE_DONE", "FG_CORE_INVENTORY", "FG_CORE_NONE"]) {
    assert.match(I18N, new RegExp(k + ": \\{ FR: \"[^\"]+\", EN: \"[^\"]+\", ZH: \"[^\"]+\" \\}"), k + " : FR/EN/ZH incomplets");
  }
});

test("un core s'affiche dans la MÊME petite case qu'une relique (aucune modale de résultat)", () => {
  // Exigence user 25/09 : « quand j'invoque un core ça apparaît comme ça [en grand],
  // alors que si j'invoque une relique ça apparaît dans une petite case ».
  const blocFn = (m) => { const i = SCREENS.indexOf("function " + m); assert.ok(i >= 0, m + " absent"); return SCREENS.slice(i, SCREENS.indexOf("\nfunction ", i)); };
  const summon = blocFn("ForgeCoreSummon");
  assert.ok(!/<Modal/.test(summon), "l'invocation d'un core ne doit plus ouvrir de modale");
  assert.ok(!/<Modal/.test(blocFn("ForgeCoreFragments")), "la forge de fragments de core ne doit plus ouvrir de modale");
  assert.match(summon, /gridTemplateColumns: "1fr 320px"/, "l'invocation de core doit reprendre la grille de la relique (odds | petite case)");
  assert.match(summon, /<CoreResultBox core=\{last\} \/>/, "la petite case de résultat doit être branchée");
  assert.match(blocFn("CoreResultBox"), /FG_CORE_DONE/, "titre de RÉSULTAT manquant dans la case");
  // Référence : l'invocation de relique reste la grille 2 colonnes qu'on imite.
  assert.match(blocFn("ForgeReliques"), /gridTemplateColumns: "1fr 320px"/, "la référence relique doit rester en 2 colonnes");
});

test("la forge d'équipement des cores liste les cores (le core forgé devient visible)", () => {
  const b = fnBloc("ForgeCoreEquipement");
  assert.match(b, /isCoreItem/, "filtre isCoreItem manquant");
  assert.match(b, /CoreIcon/, "icône de core manquante");
  assert.match(b, /core_id/, "nom/description à construire sur core_id");
  assert.ok(!/<Modal/.test(b), "grille + boutons, jamais une modale (miroir des reliques)");
});
