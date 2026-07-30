// test/tour-onboarding.test.js
"use strict";
// ============================================================
// Volet web de l'ouverture de la Tour (serveur : feat/tour-onboarding).
//
// Trois changements a refleter : palier d'entree a l'etage 3, etape `d_tower` du
// parcours ramenee a 3 etages, et prix de re-run progressif (100 / 125 / 150).
//
// Le prix n'est plus une constante : le client ne peut plus l'afficher de memoire.
// Le serveur l'annonce dans /tower/state (`next_cost`) et fait foi ; la table locale
// ne sert que de repli si le champ manque — le temps que le serveur soit deploye.
// ============================================================
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const TOUR = read("tour.jsx");
const I18N = read("i18n.js");

function chargerTU() {
  global.window = {};
  delete require.cache[require.resolve("../tour-ui.js")];
  require("../tour-ui.js");
  return global.window.FA_TOUR_UI;
}
const TU = chargerTU();

// ---- Miroir du serveur ----

test("le palier d'entree de l'etage 3 existe aussi cote client", () => {
  // La table est dupliquee (miroir d'affichage) : une derive et le joueur voit une
  // recompense qui n'existe pas, ou rate celle qui existe.
  const t = TU.TIERS.find((x) => x.floor === 3);
  assert.ok(t, "palier d'entree absent du miroir client");
  assert.strictEqual(t.fa, 50);
  assert.strictEqual(t.silver, 0);
  assert.strictEqual(t.gold, 0);
});

test("la table des paliers reste identique au serveur", () => {
  assert.strictEqual(TU.TIERS.length, 11);
  assert.deepStrictEqual(TU.TIERS.map((t) => t.floor), [3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  assert.strictEqual(TU.TIERS.reduce((s, t) => s + t.fa, 0), 6550);
  assert.strictEqual(TU.TIERS.reduce((s, t) => s + t.silver, 0), 2);
  assert.strictEqual(TU.TIERS.reduce((s, t) => s + t.gold, 0), 2);
});

test("les prix de re-run refletent le serveur", () => {
  assert.deepStrictEqual(TU.RERUN_COSTS, [100, 125, 150]);
  assert.strictEqual(TU.entryCost(0), 100);
  assert.strictEqual(TU.entryCost(1), 125);
  assert.strictEqual(TU.entryCost(2), 150);
  assert.strictEqual(TU.entryCost(9), 150, "le prix plafonne");
});

// ---- Le serveur fait foi sur le prix ----

test("nextCost prefere le montant annonce par le serveur", () => {
  // Si le serveur dit 125, on affiche 125 — meme si le calcul local donnait autre
  // chose. Un prix affiche plus bas que le prix reellement debite serait pris pour
  // une arnaque, et il serait de notre fait.
  assert.strictEqual(TU.nextCost({ next_cost: 125 }, { free_run_used: true, runs_paid: 0 }), 125);
  assert.strictEqual(TU.nextCost({ next_cost: 0 }, { free_run_used: false, runs_paid: 0 }), 0,
    "run gratuite disponible : le serveur annonce 0");
});

test("sans next_cost (serveur pas encore deploye), le client retombe sur son calcul", () => {
  assert.strictEqual(TU.nextCost({}, { free_run_used: true, runs_paid: 0 }), 100);
  assert.strictEqual(TU.nextCost({}, { free_run_used: true, runs_paid: 2 }), 150);
  assert.strictEqual(TU.nextCost({}, { free_run_used: false, runs_paid: 0 }), 0);
});

test("un next_cost aberrant est ignore au profit du calcul local", () => {
  // Le client ne doit jamais afficher un prix negatif ou non numerique venu du reseau.
  for (const v of [-100, "gratuit", NaN, {}]) {
    assert.strictEqual(TU.nextCost({ next_cost: v }, { free_run_used: true, runs_paid: 0 }), 100,
      "valeur aberrante : " + String(v));
  }
});

// ---- Branchement ----

test("la modale de depart affiche le prix du serveur, pas une constante", () => {
  const i = TOUR.indexOf("function TourStartModal");
  assert.ok(i > 0, "TourStartModal introuvable");
  const bloc = TOUR.slice(i, i + 1500);
  assert.ok(!/TU\.ENTRY_COST/.test(bloc),
    "le prix unique fige subsiste : le joueur verrait 2 000 la ou on debite 100");
  assert.match(bloc, /nextCost|cost/, "le cout doit venir de l'etat serveur");
});

test("le bouton de lancement affiche le meme prix que la modale", () => {
  // Deux sources de prix dans le meme ecran, c'est une incoherence garantie.
  assert.ok(!/TU\.ENTRY_COST/.test(TOUR), "tour.jsx utilise encore le prix unique fige");
});

// ---- Libelles ----

test("l'etape Tour du parcours annonce 2 etages", () => {
  // 3 -> 2 le 2026-07-30, apres avoir joue le parcours en production : l'attrition
  // (PV non regeneres entre etages, roster de depart a 3 betes) laisse les betes a
  // 34 % / 95 % / 13 % de PV apres UN seul etage. Le troisieme etait hors de portee.
  // Le libelle doit suivre le serveur : un joueur qui lit « etage 3 » alors que
  // l'etape se valide a 2 croit son parcours bloque.
  const m = I18N.match(/\bDISC_D_TOWER:\s*\{[^}]*\}/);
  assert.ok(m, "DISC_D_TOWER absente");
  assert.match(m[0], /étage 2/, "FR : la cible affichee doit suivre le serveur (2 etages)");
  assert.match(m[0], /floor 2/, "EN");
  assert.match(m[0], /第 2 层/, "ZH");
});

test("l'etape Campagne du parcours annonce 3 etages", () => {
  // 5 -> 3 : l'etage 5 est le premier vrai pic (Epiques/Rares a vol de vie,
  // DEF 15, 284 PV), trois defaites d'affilee au niveau 8-9 en verification.
  const m = I18N.match(/\bDISC_D_CAMP:\s*\{[^}]*\}/);
  assert.ok(m, "DISC_D_CAMP absente");
  assert.match(m[0], /3 étages/, "FR");
  assert.match(m[0], /3 Campaign floors/, "EN");
  assert.match(m[0], /3 层战役/, "ZH");
});

test("le cache-busting est incremente", () => {
  const html = read("index.html");
  const vs = [...html.matchAll(/\?v=(\d+)/g)].map((m) => Number(m[1])).filter((n) => n > 1);
  assert.ok(vs.length > 0, "aucune version trouvee");
  assert.ok(Math.min(...vs) >= 98, "index.html doit passer en v98 (v97 est en prod)");
});
