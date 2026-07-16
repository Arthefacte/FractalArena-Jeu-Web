/* ============================================================
   FRACTAL ARENA — Timeline pure du finisher de fin de combat.
   Aucun DOM, aucun aléa, aucune horloge : finisherVals(t, {win})
   rend l'état exact de la cinématique à l'instant t. Tout le
   timing vit ici (testable en node:test) ; finisher.js ne fait
   que peindre le résultat.
   ============================================================ */
(function () {
  "use strict";

  const FIN_DUR = 0.8;      // s — durée totale du finisher
  const FIN_IMPACT = 0.52;  // s — beat d'impact (flash de victoire)
  const SHARDS = 14;        // éclats hexagonaux (victoire)
  const BLOCK_COLS = 10, BLOCK_ROWS = 6;  // grille de dé-minage (défaite)

  const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
  const eIn = (x) => x * x * x;             // accélère
  const eOut = (x) => 1 - Math.pow(1 - x, 3); // décélère

  // Seed déterministe par cellule : remplace Math.random() pour garder la
  // fonction pure (et donc testable). Nombres premiers → pas de motif visible.
  const seedOf = (row, col) => (((row * 7 + col * 13) % 11) / 11);

  // Seed déterministe par éclat (index). 4 flux indépendants (angle, cadence,
  // taille, rayon de repos) via des multiplicateurs premiers distincts, pour
  // casser la symétrie parfaite sans jamais toucher à Math.random().
  const shardSeed = (i, a, b, m) => (((i * a + b) % m) / m);

  function winVals(t) {
    const kk = clamp01(t / FIN_IMPACT);
    const shards = [];
    for (let i = 0; i < SHARDS; i++) {
      const base = (i / SHARDS) * Math.PI * 2;
      const sAng = shardSeed(i, 7, 3, 11);
      const sLag = shardSeed(i, 13, 5, 9);
      const sSize = shardSeed(i, 17, 2, 7);
      const sRest = shardSeed(i, 23, 11, 13);

      const angle = base + (sAng - 0.5) * 0.9;         // casse la symétrie en roue
      const lag = sLag * 0.22;                         // chaque éclat démarre à son heure
      const kl = clamp01((kk - lag) / (1 - lag));       // convergence locale de l'éclat
      const conv = eIn(kl);

      // Fraction du rayon-jusqu'au-bord (converti en pixels par finisher.js) :
      // départ dispersé près du bord, repos = petit essaim autour de l'impact
      // (jamais un point unique, sinon 14 hexagones identiques se confondent).
      const startFrac = 0.62 + 0.30 * sSize;
      const restFrac = 0.05 + 0.11 * sRest;

      shards.push({
        angle,
        dist: startFrac + (restFrac - startFrac) * conv,
        rot: angle + kl * 2.4 + sAng * 1.1,              // vrille + variété de vitesse
        scale: (0.42 + 0.5 * (1 - kl)) * (0.75 + 0.5 * sSize),
        alpha: kk < 0.07 ? clamp01(kk / 0.07) : clamp01(1 - conv * 0.2),
      });
    }
    const ft = (t - FIN_IMPACT) / 0.16;          // le flash dure 160 ms
    return {
      win: true,
      k: clamp01(t / FIN_DUR),
      shards, blocks: [],
      flash: t < FIN_IMPACT ? 0 : clamp01(1 - ft),
      energy: eOut(kk),
      veil: clamp01(0.55 * kk),
      scramble: 0,
    };
  }

  function loseVals(t) {
    const kk = clamp01(t / FIN_DUR);
    const blocks = [];
    for (let row = 0; row < BLOCK_ROWS; row++) {
      for (let col = 0; col < BLOCK_COLS; col++) {
        const seed = seedOf(row, col);
        const lag = seed * 0.35;                 // chaque bloc lâche à son heure
        const p = clamp01((kk - lag) / (1 - lag));
        blocks.push({
          col, row,
          dx: (seed - 0.5) * 26 * p,             // dérive latérale
          dy: eIn(p) * 90 * (0.5 + seed),        // affaissement
          alpha: clamp01(1 - p),
          sat: clamp01(1 - p),                   // désaturation
        });
      }
    }
    return {
      win: false,
      k: kk,
      shards: [], blocks,
      flash: 0,                                  // la défaite ne frappe pas
      energy: clamp01(1 - eOut(kk)),
      veil: clamp01(0.5 * kk),
      scramble: kk,
    };
  }

  function finisherVals(t, o) {
    return (o && o.win) ? winVals(t) : loseVals(t);
  }

  window.FA_FINISHER_UI = { FIN_DUR, FIN_IMPACT, SHARDS, BLOCK_COLS, BLOCK_ROWS, finisherVals };
})();
