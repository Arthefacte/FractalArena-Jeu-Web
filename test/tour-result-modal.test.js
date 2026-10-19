"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const SRC = fs.readFileSync(path.join(ROOT, "tour.jsx"), "utf8");
const BUNDLE = fs.readFileSync(path.join(ROOT, "build", "tour.js"), "utf8");

/* Extrait le corps d'une fonction top-level (jusqu'à la suivante). */
function corps(source, nom) {
  const i = source.indexOf("function " + nom);
  assert.ok(i >= 0, "fonction " + nom + " introuvable");
  const fin = source.indexOf("\nfunction ", i + 10);
  return source.slice(i, fin < 0 ? source.length : fin);
}

/* Régression du 19/10/2026 : `g.onchainVerified` était lu sans que `g` existe,
   ce qui levait une ReferenceError au premier palier payant et laissait un
   écran blanc au moment exact où le joueur gagne. */
test("TourResultModal lit l'état du compte au lieu de supposer `g` défini", () => {
  const body = corps(SRC, "TourResultModal");
  assert.match(body, /const\s+g\s*=\s*useFA\(\)/, "la modale doit déclarer `g` depuis le contexte");
  assert.match(body, /g\.onchainVerified/, "la modale doit garder le cadenas des paliers non vérifiés");
});

test("TourResultModal tolère un contexte absent (useFA() peut rendre null)", () => {
  const body = corps(SRC, "TourResultModal");
  assert.match(body, /useFA\(\)\s*\|\|\s*\{\}/, "sans provider, useFA() rend null : prévoir un objet vide");
});

test("le bundle livré porte la correction (build/tour.js régénéré)", () => {
  const body = corps(BUNDLE, "TourResultModal");
  assert.match(body, /const\s+g\s*=\s*useFA\(\)\s*\|\|\s*\{\}/, "build/tour.js n'est pas à jour : lancer npm run build");
  assert.match(body, /onchainVerified/, "le bundle livré doit contenir la logique du cadenas");
});
