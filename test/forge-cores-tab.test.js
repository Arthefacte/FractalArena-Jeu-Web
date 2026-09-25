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

// Bornes mesurées dans screens.jsx : ForgeFragments 3004 car., ForgeCoreFragments 4295
// avant ForgeEquipement. On reste SOUS ces bornes pour ne pas lire le bloc d'à côté.
const F_RELIC = bloc(SCREENS, "function ForgeFragments", 3000);
const F_CORE = bloc(SCREENS, "function ForgeCoreFragments", 4200);

test("la Forge a un onglet Cores distinct de l'onglet Reliques", () => {
  assert.match(bloc(SCREENS, "function Forge()", 2000), /\{ k: "cores"/, "onglet cores absent de la barre de la Forge");
  assert.match(SCREENS, /\{tab === "cores" && <ForgeCores \/>\}/, "l'onglet cores ne rend pas ForgeCores");
  assert.match(I18N, /FG_CORES: \{ FR: "[^"]+", EN: "[^"]+", ZH: "[^"]+" \}/, "FG_CORES incomplète");
});

test("l'onglet Cores regroupe invocation, forge de fragments et inventaire", () => {
  const b = bloc(SCREENS, "function ForgeCores", 300);
  for (const c of ["ForgeCoreSummon", "ForgeCoreFragments", "CoreInventory"]) {
    assert.match(b, new RegExp("<" + c + " />"), c + " absent de ForgeCores");
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

test("la modale de forge d'un core annonce un RÉSULTAT, pas l'action", () => {
  const modal = F_CORE.split("coreLast &&")[1] || "";
  assert.ok(modal.length > 0, "modale de résultat absente de ForgeCoreFragments");
  assert.match(modal, /FG_CORE_DONE/, "titre de résultat manquant");
  assert.ok(!/EXP_FORGE_CORE_TITLE/.test(modal), "la modale reprend le titre de l'action");
});

test("l'inventaire des cores ne montre que des cores (le core forgé devient visible)", () => {
  const b = bloc(SCREENS, "function CoreInventory", 3000);
  assert.match(b, /isCoreItem/, "filtre isCoreItem manquant");
  assert.match(b, /CoreIcon/, "icône de core manquante");
  assert.match(b, /core_id/, "nom/description à construire sur core_id");
});
