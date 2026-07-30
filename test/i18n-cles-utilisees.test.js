"use strict";
// Toute clé passée littéralement à I18N.t() doit exister dans i18n.js.
//
// Constaté en jouant le 2026-07-30 : la modale d'attaque de l'Arène affichait
// « AR2_DEFENDER_EDGE_HINT » en toutes lettres au joueur. La clé n'existait pas,
// et le repli écrit à côté — `I18N.t("AR2_DEFENDER_EDGE_HINT") || "texte"` — ne
// pouvait pas servir : `t()` rend la CLÉ quand elle est absente, et une chaîne
// non vide est truthy. Le repli était mort-né, le bug invisible en test.
//
// Ce test couvre tout le dépôt : c'est la seule garde qui attrape une clé oubliée
// avant qu'un joueur ne la lise.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const RACINE = path.join(__dirname, "..");
const I18N = fs.readFileSync(path.join(RACINE, "i18n.js"), "utf8");

// Fichiers de l'app (pas les protos, les outils de bake, ni les tests).
function fichiersApp() {
  return fs.readdirSync(RACINE)
    .filter((f) => /\.(jsx|js)$/.test(f))
    .filter((f) => !/^_/.test(f) && f !== "i18n.js");
}

const cleDefinie = (cle) => new RegExp("\\b" + cle + ":\\s*\\{").test(I18N);

test("toutes les cles litterales passees a I18N.t existent", () => {
  const manquantes = [];
  for (const f of fichiersApp()) {
    const src = fs.readFileSync(path.join(RACINE, f), "utf8");
    // Uniquement les cles ENTIERES : `I18N.t("PREFIXE_" + x)` construit sa cle a
    // l'execution, on ne peut pas la verifier ici. Le `[),]` exige donc que la
    // chaine soit immediatement suivie de la fermeture ou d'un argument de format.
    for (const m of src.matchAll(/I18N\.t\(\s*["']([A-Z][A-Z0-9_]+)["']\s*[),]/g)) {
      if (!cleDefinie(m[1])) manquantes.push(`${f} → ${m[1]}`);
    }
  }
  assert.deepStrictEqual(manquantes, [],
    "ces cles seraient affichees telles quelles au joueur");
});

test("aucun repli mort derriere I18N.t", () => {
  // `t()` ne rend jamais de valeur falsy : un `|| "repli"` derriere donne
  // l'illusion d'un filet de securite qui n'existe pas, et masque la clé absente.
  const coupables = [];
  for (const f of fichiersApp()) {
    const src = fs.readFileSync(path.join(RACINE, f), "utf8");
    for (const m of src.matchAll(/I18N\.t\([^)]*\)\s*\|\|\s*["']/g)) {
      coupables.push(`${f} : ${m[0].slice(0, 60)}`);
    }
  }
  assert.deepStrictEqual(coupables, [],
    "retirer le repli et definir la cle : t() rend la cle elle-meme, jamais une valeur falsy");
});
