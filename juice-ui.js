/* ============================================================
   FRACTAL ARENA — Paramètres purs du juice de combat.
   Aucun DOM, aucun aléa, aucune horloge : décrit l'intensité
   du feedback (screen-shake, gerbe d'étincelles) selon l'event.
   Testable en node:test ; juice.js peint le résultat.
   ============================================================ */
(function () {
  "use strict";

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

  // Intensité de screen-shake ∈ [0,1]. Design : crit = max ; sinon
  // proportionnel à la part des PV max encaissée (robuste au scaling de
  // niveau, contrairement à un seuil de dmg absolu) ; petit coup = 0 —
  // le board ne tremble QUE sur les gros moments.
  function shakeIntensity(dmg, maxHp, crit) {
    if (crit) return 1;
    if (!(maxHp > 0) || !(dmg > 0)) return 0;
    const frac = dmg / maxHp;
    if (frac >= 0.25) return 0.6;
    if (frac >= 0.15) return 0.35;
    return 0;
  }

  // Gerbe d'étincelles d'un impact : compte, couleur (token CSS), dispersion px.
  function particleSpec(kind, crit) {
    if (crit) return { count: 10, color: "var(--gold)", spread: 34 };
    if (kind === "sp") return { count: 8, color: "var(--forge)", spread: 28 };
    return { count: 6, color: "var(--alert)", spread: 22 };
  }

  // Un solde qui change doit se voir : un gain que rien ne signale n'a pas eu
  // lieu, du point de vue du joueur. `initialise` distingue un vrai mouvement du
  // premier remplissage — au login la sauvegarde arrive d'un coup (0 → le solde
  // réel) et annoncer « +38 610 » à chaque connexion serait un mensonge visuel.
  function variationSolde(prev, next, initialise) {
    if (!initialise) return { anime: false, delta: 0 };
    const delta = next - prev;
    if (!delta) return { anime: false, delta: 0 };
    return { anime: true, delta };
  }

  window.FA_JUICE_UI = { shakeIntensity, particleSpec, clamp01, variationSolde };
})();
