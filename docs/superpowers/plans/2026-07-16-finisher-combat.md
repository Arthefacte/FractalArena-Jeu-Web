# Finisher de fin de combat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intercaler une cinématique procédurale de ~800 ms (fracture à la victoire, dé-minage à la défaite) entre la fin du rejeu de combat et la modale de résultat, dans les 4 modes du jeu.

**Architecture :** Deux fichiers neufs. `finisher-ui.js` = timeline **pure** (`finisherVals(t, {win})` → état à l'instant t), testable en `node:test`. `finisher.js` = overlay `<canvas>` singleton + boucle rAF + son + garde `prefers-reduced-motion`, exposé en API impérative `window.FA_FINISHER.play({ win, onDone })` — hors React, sur le modèle de `totem-cine.js`. Les modes existants enveloppent leur `setResult`/`setDone` actuel dans `onDone`.

**Tech Stack :** JS vanilla ES5-compatible en IIFE (convention des `.js` du repo), Canvas 2D, `node --test` natif (CommonJS), Playwright headless pour la vérif visuelle.

## Global Constraints

- **Client web seul.** Aucun changement serveur. Le serveur reste autoritatif sur le combat ; le finisher ne lit que le `win`/`won` déjà renvoyé.
- **Zéro asset, zéro dépendance.** Pas de fichier image/audio, pas de WebGL, pas de lib. `package.json` ne bouge pas (seule devDependency : `@babel/standalone@7.29.0`).
- **Les `.jsx` ne sont pas requirables en `node:test`** (Babel-transpilés dans le navigateur). Les tester = lire le source en `fs.readFileSync` et asserter sur le texte. Toute logique testable par exécution doit vivre dans un `.js` pur. Pattern de référence : `test/arene-replay-spoiler.test.js:14`.
- **Convention des `.js` du repo :** IIFE `(function () { "use strict"; ... })()`, garde `if (typeof window === "undefined") return;` si le module touche le DOM, export final `window.FA_XXX = { ... }`. Référence : `sfx.js:8-92`, `tour-ui.js` (dernière ligne : `window.FA_TOUR_UI = {...}`).
- **Aucune purge du bypass Loop.** Le garde `if (!isLoopRun)` de `fosse.jsx:296` et le `return` anticipé de la boucle (`fosse.jsx:279-294`) doivent rester intacts : **jamais de finisher en boucle**. Invariant verrouillé par test.
- **`test/arene-replay-spoiler.test.js` doit rester vert.** Il verrouille que `onAttack` de `arene.jsx` n'appelle pas `pvpRefresh` (anti-spoiler). Le finisher s'intercale sur `setDone(true)`, en amont — ne pas y toucher.
- **Cache-bust :** `?v=80` → `?v=81` sur **toutes** les occurrences de `index.html` (39 aujourd'hui, 41 après ajout des 2 fichiers). Convention documentée `index.html:118`.
- **`npm test` = `node --test --test-force-exit test/*.test.js`.** Le `--test-force-exit` est obligatoire (sans lui le runner pend).

## Correction du spec appliquée ici

Le spec (`docs/superpowers/specs/2026-07-16-finisher-combat-design.md`) annonce 4 points d'ancrage dont un pour la Tour. **C'est faux et corrigé dans ce plan : il y en a 3.** La Tour rend `AreneBattle` (`tour.jsx:398-402`) — le même composant de rejeu que l'Arène. Hooker `setDone(true)` dans `arene-battle.jsx:47` couvre Arène **et** Tour. La Tour ne gagne aucun appel à `FA_FINISHER` ; elle perd seulement son `useEffect` de son.

Conséquence : le son victoire/défaite part aujourd'hui **deux fois à la Tour** (une fois en `arene-battle.jsx:69` quand le rejeu finit, une fois en `tour.jsx:136` quand la modale se monte). Bug préexistant, supprimé par construction en consolidant le son dans `finisher.js`.

---

### Task 1 : `finisher-ui.js` — la timeline pure

**Files:**
- Create: `finisher-ui.js`
- Test: `test/finisher-ui.test.js`

**Interfaces:**
- Consumes: rien.
- Produces: `window.FA_FINISHER_UI = { FIN_DUR, FIN_IMPACT, SHARDS, BLOCK_COLS, BLOCK_ROWS, finisherVals }`.
  - `FIN_DUR = 0.8` (secondes, durée totale), `FIN_IMPACT = 0.52` (secondes, beat du flash victoire), `SHARDS = 14`, `BLOCK_COLS = 10`, `BLOCK_ROWS = 6`.
  - `finisherVals(t: number, o: { win: boolean }) → { win, k, shards, blocks, flash, energy, veil, scramble }`
    - `k`: number 0→1, avancement global.
    - `shards`: `Array<{ angle, dist, rot, scale, alpha }>` — vide si `win === false`.
    - `blocks`: `Array<{ col, row, dx, dy, alpha, sat }>` — vide si `win === true`.
    - `flash`: number 0→1 (blanc plein écran). **Toujours 0 sur le chemin défaite.**
    - `energy`: number 0→1 (monte à la victoire, descend à la défaite).
    - `veil`: number 0→1 (voile sombre).
    - `scramble`: number 0→1 (avancement de la perte du hash ; 0 à la victoire).

**Pureté :** aucun `Math.random()`, aucun `Date.now()`, aucun accès DOM. Les irrégularités par bloc viennent d'un seed déterministe dérivé de `(row, col)`. C'est ce qui rend le test de pureté possible.

- [ ] **Step 1: Write the failing test**

Créer `test/finisher-ui.test.js` :

```js
// test/finisher-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../finisher-ui.js");
const FU = globalThis.window.FA_FINISHER_UI;

test("constantes : durée 0.8 s, impact avant la fin", () => {
  assert.strictEqual(FU.FIN_DUR, 0.8);
  assert.ok(FU.FIN_IMPACT > 0 && FU.FIN_IMPACT < FU.FIN_DUR, "l'impact doit tomber dans la durée");
  assert.strictEqual(FU.SHARDS, 14);
  assert.strictEqual(FU.BLOCK_COLS, 10);
  assert.strictEqual(FU.BLOCK_ROWS, 6);
});

test("pureté : deux appels identiques rendent le même résultat", () => {
  const a = FU.finisherVals(0.3, { win: true });
  const b = FU.finisherVals(0.3, { win: true });
  assert.deepStrictEqual(a, b);
  const c = FU.finisherVals(0.3, { win: false });
  const d = FU.finisherVals(0.3, { win: false });
  assert.deepStrictEqual(c, d);
});

test("balayage complet : aucune valeur NaN/undefined, bornes tenues", () => {
  for (const win of [true, false]) {
    for (let t = 0; t <= FU.FIN_DUR + 0.2; t += 0.01) {
      const v = FU.finisherVals(t, { win });
      for (const key of ["k", "flash", "energy", "veil", "scramble"]) {
        assert.ok(Number.isFinite(v[key]), `${key} non fini à t=${t.toFixed(2)} win=${win}`);
        assert.ok(v[key] >= 0 && v[key] <= 1, `${key}=${v[key]} hors [0,1] à t=${t.toFixed(2)} win=${win}`);
      }
      v.shards.forEach((s) => {
        ["angle", "dist", "rot", "scale", "alpha"].forEach((key) =>
          assert.ok(Number.isFinite(s[key]), `shard.${key} non fini à t=${t.toFixed(2)}`));
      });
      v.blocks.forEach((b) => {
        ["dx", "dy", "alpha", "sat"].forEach((key) =>
          assert.ok(Number.isFinite(b[key]), `block.${key} non fini à t=${t.toFixed(2)}`));
      });
    }
  }
});

test("victoire : éclats présents, aucun bloc, énergie croissante, flash après l'impact", () => {
  const v0 = FU.finisherVals(0, { win: true });
  assert.strictEqual(v0.shards.length, FU.SHARDS);
  assert.strictEqual(v0.blocks.length, 0);
  assert.strictEqual(v0.win, true);

  let prev = -1;
  for (let t = 0; t <= FU.FIN_IMPACT; t += 0.02) {
    const e = FU.finisherVals(t, { win: true }).energy;
    assert.ok(e >= prev - 1e-9, `énergie non croissante à t=${t.toFixed(2)}`);
    prev = e;
  }
  assert.strictEqual(FU.finisherVals(FU.FIN_IMPACT - 0.05, { win: true }).flash, 0, "pas de flash avant l'impact");
  assert.ok(FU.finisherVals(FU.FIN_IMPACT + 0.02, { win: true }).flash > 0, "flash attendu après l'impact");
});

test("victoire : les éclats convergent vers le centre", () => {
  const early = FU.finisherVals(0.05, { win: true }).shards[0].dist;
  const late = FU.finisherVals(FU.FIN_IMPACT - 0.02, { win: true }).shards[0].dist;
  assert.ok(late < early, "dist doit décroître (bord → centre)");
});

test("défaite : blocs présents, aucun éclat, aucun flash, énergie décroissante", () => {
  const v = FU.finisherVals(0.4, { win: false });
  assert.strictEqual(v.blocks.length, FU.BLOCK_COLS * FU.BLOCK_ROWS);
  assert.strictEqual(v.shards.length, 0);
  assert.strictEqual(v.win, false);
  for (let t = 0; t <= FU.FIN_DUR; t += 0.02) {
    assert.strictEqual(FU.finisherVals(t, { win: false }).flash, 0, `flash non nul à t=${t.toFixed(2)}`);
  }
  assert.ok(FU.finisherVals(0.7, { win: false }).energy < FU.finisherVals(0.1, { win: false }).energy);
  assert.ok(FU.finisherVals(0.7, { win: false }).scramble > FU.finisherVals(0.1, { win: false }).scramble);
});

test("défaite : les blocs tombent et s'effacent", () => {
  const early = FU.finisherVals(0.1, { win: false }).blocks;
  const late = FU.finisherVals(0.75, { win: false }).blocks;
  assert.ok(late.some((b, i) => b.dy > early[i].dy), "au moins un bloc doit être tombé");
  assert.ok(late.every((b, i) => b.alpha <= early[i].alpha + 1e-9), "l'alpha ne doit jamais remonter");
});

test("victoire et défaite produisent des timelines distinctes", () => {
  assert.notDeepStrictEqual(FU.finisherVals(0.4, { win: true }), FU.finisherVals(0.4, { win: false }));
});

test("bornes : t négatif et t au-delà de la durée restent bien formés", () => {
  assert.strictEqual(FU.finisherVals(-1, { win: true }).k, 0);
  assert.strictEqual(FU.finisherVals(99, { win: true }).k, 1);
  assert.strictEqual(FU.finisherVals(99, { win: false }).k, 1);
});

test("options manquantes : traité comme une défaite, pas de crash", () => {
  assert.strictEqual(FU.finisherVals(0.2, {}).win, false);
  assert.strictEqual(FU.finisherVals(0.2, undefined).win, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../finisher-ui.js'`

- [ ] **Step 3: Write the implementation**

Créer `finisher-ui.js` :

```js
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

  function winVals(t) {
    const kk = clamp01(t / FIN_IMPACT);
    const conv = eIn(kk);            // 0 = éclats au bord, 1 = au centre
    const shards = [];
    for (let i = 0; i < SHARDS; i++) {
      const angle = (i / SHARDS) * Math.PI * 2;
      shards.push({
        angle,
        dist: 1 - conv,                          // fraction du rayon écran
        rot: angle + conv * 2.2,                 // vrille en convergeant
        scale: 0.35 + 0.5 * (1 - conv),
        alpha: kk < 0.08 ? clamp01(kk / 0.08) : clamp01(1 - eIn(kk) * 0.15),
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — les 10 tests de `finisher-ui.test.js` verts, et les 24 fichiers de test existants toujours verts.

- [ ] **Step 5: Commit**

```bash
git add finisher-ui.js test/finisher-ui.test.js
git commit -m "feat(finisher): timeline pure du finisher de fin de combat"
```

---

### Task 2 : `finisher.js` — overlay canvas, son, reduced-motion

**Files:**
- Create: `finisher.js`
- Modify: `index.html:131-133` (déclarer les 2 nouveaux scripts)
- Test: `test/finisher-play.test.js`

**Interfaces:**
- Consumes: `window.FA_FINISHER_UI.finisherVals / FIN_DUR / BLOCK_COLS / BLOCK_ROWS` (Task 1) ; `window.FA_SFX.play(name)` (`sfx.js:91`) ; la var CSS `--accent` posée sur `body` (`styles.css:49-59`).
- Produces: `window.FA_FINISHER = { play }` avec `play({ win: boolean, onDone?: () => void }) → void`. **Contrat : `onDone` est appelé exactement une fois, toujours**, y compris en `prefers-reduced-motion`, y compris si un autre `play()` interrompt celui-ci, y compris si le canvas est indisponible. C'est ce qui garantit que la modale de résultat n'est jamais perdue.

**Note de design — le son part à `t=0`, pas au beat d'impact.** Le spec disait « à son beat d'impact ». À l'implémentation c'est faux : `victory` est un arpège de 4 notes espacées de 100 ms (`sfx.js:59`), soit ~400 ms de queue. Lancé à `t=0`, il **résout** sur le flash à 520 ms — le son et l'image tombent ensemble. Lancé à 520 ms, il traînerait 400 ms après. Même raisonnement pour `defeat` (3 notes descendantes, `sfx.js:61`). Bénéfice annexe : le son vit dans `play()` et non dans la boucle de rendu, donc le chemin `prefers-reduced-motion` le garde gratuitement.

- [ ] **Step 1: Write the failing test**

Créer `test/finisher-play.test.js` — asserts au niveau source (le module touche le DOM, non requirable en `node:test` sans jsdom, et le repo n'a pas jsdom) :

```js
// test/finisher-play.test.js
// finisher.js touche le DOM (canvas, rAF, matchMedia) → non exécutable en node:test
// sans jsdom, que le repo n'a pas. On verrouille donc ses invariants au niveau source,
// comme test/arene-replay-spoiler.test.js le fait pour les .jsx.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "..", "finisher.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("expose l'API impérative window.FA_FINISHER.play", () => {
  assert.match(src, /window\.FA_FINISHER\s*=/, "export window.FA_FINISHER manquant");
  assert.match(src, /function play\s*\(/, "fonction play manquante");
});

test("respecte prefers-reduced-motion", () => {
  assert.match(src, /prefers-reduced-motion/, "garde reduced-motion manquant (le jeu le respecte partout ailleurs)");
});

test("le son vit ici et nulle part ailleurs", () => {
  assert.match(src, /FA_SFX/, "le finisher doit jouer le son");
  assert.match(src, /"victory"/, "son de victoire manquant");
  assert.match(src, /"defeat"/, "son de défaite manquant");
});

test("délègue tout le timing à finisher-ui.js (aucune constante de durée en dur)", () => {
  assert.match(src, /FA_FINISHER_UI/, "finisher.js doit consommer la timeline pure");
  assert.ok(!/FIN_DUR\s*=\s*[0-9]/.test(src), "FIN_DUR redéfini ici = duplication du timing");
});

test("lit --accent (pas de couleur de mode en dur)", () => {
  assert.match(src, /--accent/, "le finisher doit prendre l'accent de l'écran");
  assert.ok(!/#FF2D78/.test(src), "couleur d'Arène en dur = --accent contourné");
});

test("index.html déclare les deux fichiers, sans type=module", () => {
  assert.match(html, /<script src="finisher-ui\.js\?v=\d+"><\/script>/, "finisher-ui.js non déclaré");
  assert.match(html, /<script src="finisher\.js\?v=\d+"><\/script>/, "finisher.js non déclaré");
  const iUi = html.indexOf('src="finisher-ui.js');
  const iFin = html.indexOf('src="finisher.js');
  assert.ok(iUi > -1 && iFin > iUi, "finisher-ui.js doit être chargé AVANT finisher.js");
  const iSfx = html.indexOf('src="sfx.js');
  assert.ok(iSfx > -1 && iFin > iSfx, "sfx.js doit être chargé AVANT finisher.js");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ENOENT: no such file or directory, open '.../finisher.js'`

- [ ] **Step 3: Write the implementation**

Créer `finisher.js` :

```js
/* ============================================================
   FRACTAL ARENA — Finisher de fin de combat.
   Overlay canvas singleton, API impérative hors React (modèle
   totem-cine.js) : FA_FINISHER.play({ win, onDone }).
   Tout le timing vient de finisher-ui.js ; ici on ne fait que
   peindre. Contrat : onDone est appelé exactement une fois,
   toujours — la modale de résultat ne doit jamais être perdue.
   ============================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  let cv = null, cx = null, raf = null, pending = null, t0 = 0, opts = null;
  const HEX = "0123456789abcdef";

  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }

  function ensure() {
    if (cv) return cv;
    cv = document.createElement("canvas");
    cv.id = "fa-finisher";
    cv.style.cssText = "position:fixed;inset:0;width:100%;height:100%;z-index:9990;pointer-events:none;display:none";
    document.body.appendChild(cv);
    cx = cv.getContext("2d");
    return cv;
  }

  function accent() {
    try {
      const v = getComputedStyle(document.body).getPropertyValue("--accent").trim();
      if (v) return v;
    } catch (e) {}
    return "#00F0FF"; // repli = cyan de marque
  }

  // Appelle le onDone en attente, une fois et une seule.
  function flush() {
    const d = pending;
    pending = null;
    if (d) d();
  }

  function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = null; }
    if (cv) cv.style.display = "none";
  }

  function hexLine(scramble, n) {
    // Le hash perd ses caractères à mesure que scramble monte. Déterministe.
    let s = "0x";
    for (let i = 0; i < n; i++) {
      const gone = (((i * 5) % 17) / 17) < scramble;
      s += gone ? " " : HEX[(i * 7 + Math.floor(scramble * 16)) % 16];
    }
    return s;
  }

  function drawWin(v, W, H, acc) {
    const ccx = W / 2, ccy = H / 2, R = Math.hypot(W, H) / 2;
    cx.fillStyle = "rgba(3,5,11," + v.veil.toFixed(3) + ")";
    cx.fillRect(0, 0, W, H);
    cx.lineWidth = 2;
    cx.strokeStyle = acc;
    cx.shadowColor = acc;
    for (let i = 0; i < v.shards.length; i++) {
      const s = v.shards[i];
      const x = ccx + Math.cos(s.angle) * s.dist * R;
      const y = ccy + Math.sin(s.angle) * s.dist * R;
      const r = 26 + 54 * s.scale;
      cx.save();
      cx.translate(x, y);
      cx.rotate(s.rot);
      cx.globalAlpha = s.alpha;
      cx.shadowBlur = 18 * v.energy;
      cx.beginPath();
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2;
        const px = Math.cos(a) * r, py = Math.sin(a) * r;
        if (j) cx.lineTo(px, py); else cx.moveTo(px, py);
      }
      cx.closePath();
      cx.stroke();
      cx.restore();
    }
    if (v.flash > 0) {
      cx.globalAlpha = 1;
      cx.shadowBlur = 0;
      cx.fillStyle = "rgba(255,255,255," + v.flash.toFixed(3) + ")";
      cx.fillRect(0, 0, W, H);
    }
  }

  function drawLose(v, W, H, acc) {
    const UI = window.FA_FINISHER_UI;
    cx.fillStyle = "rgba(3,5,11," + v.veil.toFixed(3) + ")";
    cx.fillRect(0, 0, W, H);
    const bw = W / UI.BLOCK_COLS, bh = H / UI.BLOCK_ROWS;
    cx.shadowBlur = 0;
    for (let i = 0; i < v.blocks.length; i++) {
      const b = v.blocks[i];
      const x = b.col * bw + b.dx, y = b.row * bh + b.dy;
      cx.globalAlpha = b.alpha * 0.5;
      cx.fillStyle = "#0a0e1a";
      cx.fillRect(x, y, bw + 1, bh + 1);
      cx.globalAlpha = b.alpha * b.sat * 0.35;
      cx.strokeStyle = acc;
      cx.lineWidth = 1;
      cx.strokeRect(x, y, bw, bh);
    }
    // Le hash se dé-mine.
    cx.globalAlpha = (1 - v.scramble) * 0.8;
    cx.fillStyle = acc;
    cx.font = "600 " + Math.max(11, Math.round(W / 70)) + "px ui-monospace, monospace";
    cx.textAlign = "center";
    cx.fillText(hexLine(v.scramble, 24), W / 2, H / 2);
    cx.globalAlpha = 1;
  }

  function frame() {
    const UI = window.FA_FINISHER_UI;
    const t = (performance.now() - t0) / 1000;
    const W = cv.width, H = cv.height;
    cx.clearRect(0, 0, W, H);
    const v = UI.finisherVals(t, opts);
    if (v.win) drawWin(v, W, H, opts.acc); else drawLose(v, W, H, opts.acc);
    if (t >= UI.FIN_DUR) { stop(); flush(); return; }
    raf = requestAnimationFrame(frame);
  }

  function play(o) {
    const win = !!(o && o.win);
    // Un play() pendant un play() : on coupe le précédent mais on honore SON onDone
    // (sinon sa modale de résultat serait perdue).
    if (raf) { stop(); flush(); }
    pending = (o && o.onDone) || null;

    if (window.FA_SFX) window.FA_SFX.play(win ? "victory" : "defeat");

    const UI = window.FA_FINISHER_UI;
    if (reduced() || !UI || !window.requestAnimationFrame) { flush(); return; }

    try { ensure(); } catch (e) { flush(); return; }
    if (!cx) { flush(); return; }

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(window.innerWidth * dpr);
    cv.height = Math.round(window.innerHeight * dpr);
    cv.style.display = "block";
    opts = { win, acc: accent() };
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }

  window.FA_FINISHER = { play };
})();
```

- [ ] **Step 4: Declare both scripts in `index.html`**

Dans le bloc « plain JS data/logic », **après** `sfx.js` (le finisher en dépend) et avant `arene-ui.js`. Remplacer :

```html
  <script src="sfx.js?v=80"></script>
  <script src="loop.js?v=80"></script>
```

par :

```html
  <script src="sfx.js?v=80"></script>
  <script src="finisher-ui.js?v=80"></script>
  <script src="finisher.js?v=80"></script>
  <script src="loop.js?v=80"></script>
```

Ne PAS mettre `type="module"` : ce sont des IIFE classiques comme `sfx.js`/`loop.js`, pas des modules ES (`totem-cine.js` est l'exception). Le `?v=80` passera à `81` en Task 4, en même temps que tout le reste.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — les 6 tests de `finisher-play.test.js` verts, tout le reste vert.

- [ ] **Step 6: Commit**

```bash
git add finisher.js test/finisher-play.test.js index.html
git commit -m "feat(finisher): overlay canvas, son consolidé, garde reduced-motion"
```

---

### Task 3 : brancher les 3 modes et consolider le son

**Files:**
- Modify: `fosse.jsx:296` et `fosse.jsx:442`
- Modify: `arene-battle.jsx:69`
- Modify: `campaign.jsx:263-269` et `campaign.jsx:379`
- Modify: `tour.jsx:136`
- Test: `test/finisher-hooks.test.js`

**Interfaces:**
- Consumes: `window.FA_FINISHER.play({ win, onDone })` (Task 2).
- Produces: rien pour les tâches suivantes.

**Rappel : 3 hooks, pas 4.** La Tour rend `AreneBattle` (`tour.jsx:399`) → le hook de `arene-battle.jsx` la couvre. La Tour ne perd que son `useEffect` de son (`tour.jsx:136`), ce qui supprime au passage le double son actuel.

- [ ] **Step 1: Write the failing test**

Créer `test/finisher-hooks.test.js` :

```js
// test/finisher-hooks.test.js
// Les .jsx ne sont pas requirables en node:test (Babel dans le navigateur) :
// on verrouille les branchements au niveau source, comme arene-replay-spoiler.test.js.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const fosse = read("fosse.jsx");
const areneBattle = read("arene-battle.jsx");
const campaign = read("campaign.jsx");
const tour = read("tour.jsx");

test("les 3 modes appellent le finisher", () => {
  assert.match(fosse, /FA_FINISHER\.play/, "Fosse non branchée");
  assert.match(areneBattle, /FA_FINISHER\.play/, "Arène/Tour non branchées (AreneBattle est partagé)");
  assert.match(campaign, /FA_FINISHER\.play/, "Campagne non branchée");
});

test("la Tour n'a PAS de hook propre : elle passe par AreneBattle", () => {
  assert.ok(!/FA_FINISHER/.test(tour), "tour.jsx doit hériter du hook d'AreneBattle, pas en ajouter un");
});

test("INVARIANT : jamais de finisher en boucle (bypass Loop de la Fosse intact)", () => {
  assert.match(fosse, /if \(!isLoopRun\)/, "le garde isLoopRun a disparu → finisher en boucle");
  const settle = fosse.match(/function settleBattle\(\)[\s\S]*?\n  \}/);
  assert.ok(settle, "settleBattle introuvable");
  const idxGuard = settle[0].indexOf("if (!isLoopRun)");
  const idxPlay = settle[0].indexOf("FA_FINISHER.play");
  assert.ok(idxGuard > -1 && idxPlay > idxGuard,
    "FA_FINISHER.play doit rester DERRIÈRE le garde !isLoopRun");
});

test("le son a quitté les modales : un seul émetteur, finisher.js", () => {
  for (const [name, src] of [["fosse.jsx", fosse], ["arene-battle.jsx", areneBattle], ["tour.jsx", tour]]) {
    assert.ok(!/FA_SFX\.play\((won|win) \?/.test(src),
      name + " joue encore victory/defeat — doublon avec le finisher");
  }
});

test("la Campagne ne joue plus le son 'open' générique", () => {
  assert.match(campaign, /openSound=\{null\}/, "CampResultModal doit couper le son open générique");
});

test("les modales de résultat gardent openSound={null}", () => {
  assert.match(fosse, /openSound=\{null\}/, "ResultModal a perdu openSound={null}");
  assert.match(tour, /openSound=\{null\}/, "TourResultModal a perdu openSound={null}");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — « Fosse non branchée » (`FA_FINISHER.play` absent de `fosse.jsx`).

- [ ] **Step 3a: Brancher la Fosse**

Dans `fosse.jsx`, remplacer la ligne 296 :

```jsx
    if (!isLoopRun) setResult({ win, free, ...summary });
```

par :

```jsx
    if (!isLoopRun) {
      // Le finisher précède la modale ; le garde !isLoopRun le rend inatteignable
      // depuis la boucle (invariant verrouillé par test/finisher-hooks.test.js).
      window.FA_FINISHER.play({ win, onDone: () => setResult({ win, free, ...summary }) });
    }
```

Puis retirer le `useEffect` de son de `ResultModal` (`fosse.jsx:442`) — le finisher l'a joué. Supprimer la ligne :

```jsx
  useEffect(() => { window.FA_SFX.play(win ? "victory" : "defeat"); }, []);
```

⚠️ Garder `openSound={null}` sur le `<Modal>` (`fosse.jsx:444`) : sans le `useEffect`, la modale jouerait sinon le `open` générique par-dessus la queue du finisher.

- [ ] **Step 3b: Brancher l'Arène (et donc la Tour)**

Dans `arene-battle.jsx`, remplacer la ligne 69 :

```jsx
  // SFX : victoire/défaite quand le combat est résolu.
  useEffect(() => { if (done && window.FA_SFX) window.FA_SFX.play(won ? "victory" : "defeat"); }, [done]);
```

par :

```jsx
  // Finisher : cinématique de fin quand le combat est résolu (il joue aussi le son
  // victory/defeat). Partagé Arène + Tour — tour.jsx rend ce même composant.
  useEffect(() => {
    if (done && window.FA_FINISHER) window.FA_FINISHER.play({ won: undefined, win: won });
  }, [done]);
```

⚠️ Le paramètre s'appelle `win`, pas `won` — `AreneBattle` reçoit la prop `won`, l'API attend `win`. Ne pas passer `{ won }` : `finisherVals` lirait `o.win === undefined` et jouerait une défaite sur une victoire. (Le `won: undefined` explicite ci-dessus est là pour rendre le piège visible ; le supprimer est équivalent.)

Pas de `onDone` ici : l'Arène révèle son verdict dans le bloc `{done && (...)}` déjà à l'écran (`arene-battle.jsx:92`), il n'y a pas de modale à chaîner. Le finisher se superpose (z-index 9990 > `.overlay` à 100, `styles.css:489`) et ponctue la révélation.

- [ ] **Step 3c: Brancher la Campagne**

Dans `campaign.jsx`, remplacer le `setResult({...})` de `settle()` (lignes 263-269) :

```jsx
    setResult({
      win, survivors, stars: r.stars || 0,
      lockedGain: (r.reward && r.reward.lockedGain) || 0,
      silver: (r.reward && r.reward.silver) || 0,
      gold: (r.reward && r.reward.gold) || 0,
      titleUnlocked: r.titleUnlocked || null, legend: !!r.legend,
    });
```

par :

```jsx
    const summary = {
      win, survivors, stars: r.stars || 0,
      lockedGain: (r.reward && r.reward.lockedGain) || 0,
      silver: (r.reward && r.reward.silver) || 0,
      gold: (r.reward && r.reward.gold) || 0,
      titleUnlocked: r.titleUnlocked || null, legend: !!r.legend,
    };
    // Le finisher précède la modale, et joue le victory/defeat que la Campagne
    // n'avait jamais eu (elle tombait sur le son 'open' générique).
    window.FA_FINISHER.play({ win, onDone: () => setResult(summary) });
```

Puis, dans `CampResultModal` (`campaign.jsx:379`), ajouter `openSound={null}` au `<Modal>` — comme `fosse.jsx:444` et `tour.jsx:138`. C'est le seul mode qui ne l'avait pas.

- [ ] **Step 3d: Retirer le son de la Tour**

Dans `tour.jsx`, supprimer la ligne 136 de `TourResultModal` :

```jsx
  useEffect(() => { if (window.FA_SFX) window.FA_SFX.play(won ? "victory" : "defeat"); }, []);
```

C'est ce qui supprime le **double son** actuel : `AreneBattle` le jouait déjà à la fin du rejeu, puis cette modale le rejouait à sa fermeture. Garder `openSound={null}` (`tour.jsx:138`).

Si `useEffect` n'est plus utilisé ailleurs dans `tour.jsx`, il l'est encore (`tour.jsx:189`, `:190`) — ne pas toucher à l'import destructuré en tête de fichier.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — les 6 tests de `finisher-hooks.test.js` verts. **Vérifier en particulier que `test/arene-replay-spoiler.test.js` reste vert** (il inspecte `arene-battle.jsx` et `arene.jsx`).

- [ ] **Step 5: Commit**

```bash
git add fosse.jsx arene-battle.jsx campaign.jsx tour.jsx test/finisher-hooks.test.js
git commit -m "feat(finisher): brancher Fosse/Arene/Tour/Campagne, consolider le son victory-defeat"
```

---

### Task 4 : vérif visuelle Playwright et cache-bust v81

**Files:**
- Create: `_bake/verify-finisher.mjs`
- Modify: `index.html` (les 41 occurrences de `?v=80` → `?v=81`)

**Interfaces:**
- Consumes: `_bake/serve.mjs` (serveur statique local existant), `window.FA_FINISHER.play` (Task 2).
- Produces: `_bake/verify-finisher-{win,lose}-{accent}.png` — artefacts non committés.

Le harnais suit `_bake/verify-accent.mjs` (même serveur, même lancement Playwright). `NODE_PATH="$(npm root -g)"` est requis : Playwright est installé en global, pas dans le repo.

- [ ] **Step 1: Écrire le script de vérif**

Calqué sur `_bake/verify-accent.mjs` (serveur `http` sur port éphémère, même harnais de seed localStorage, même filtrage d'erreurs console). Créer `_bake/verify-finisher.mjs` :

```js
// verify-finisher.mjs — vérifie le finisher (#6) : le canvas apparaît, peint l'accent
// de l'écran, se retire, et appelle onDone. Capture 3 beats par cas pour contrôle
// visuel. Lancement : NODE_PATH="$(npm root -g)" node _bake/verify-finisher.mjs
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".jsx":"text/javascript", ".mjs":"text/javascript",
  ".css":"text/css", ".json":"application/json", ".png":"image/png", ".glb":"model/gltf-binary", ".wasm":"application/wasm", ".svg":"image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, p === "/" ? "/index.html" : p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(d); });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
// Même seed que verify-accent.mjs : roster starter + tuto vu, pour arriver sur le jeu.
await page.addInitScript(() => {
  Object.defineProperty(window, "FA_TALENTS_UI", { configurable: true, set(v) {
    try { const roster = window.FA_DATA.starterRoster();
      localStorage.setItem("fractal_arena_v1", JSON.stringify({ roster, view: "team", lang: "FR", wallet: "bc1qfinisher0000000000000000000000", options: { sound: false, speed: 1 } }));
      localStorage.setItem("fractal_arena_tutorial_v1", "1"); } catch (e) {}
    Object.defineProperty(window, "FA_TALENTS_UI", { value: v, configurable: true, writable: true });
  } });
});
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.FA_DATA && window.FA_FINISHER).catch(() => {});
await page.waitForTimeout(8000);   // boot (≥2400 ms) + montage React
await page.keyboard.press("Escape").catch(() => {});

let ok = 0, ko = 0;
const check = (label, pass, info) => { console.log(`${pass ? "OK " : "KO "} ${label}${info ? " — " + info : ""}`); pass ? ok++ : ko++; };

// L'API est-elle là, et le canvas absent tant qu'on n'a rien joué ?
check("API exposée", await page.evaluate(() => !!(window.FA_FINISHER && window.FA_FINISHER.play)));

// Cas : {victoire, défaite} × {fosse (orange), arene (rouge-magenta)}.
for (const view of ["fosse", "arene"]) {
  for (const win of [true, false]) {
    const tag = `${win ? "win" : "lose"}-${view}`;
    await page.evaluate((v) => { document.body.dataset.view = v; }, view);
    await page.waitForTimeout(450);   // laisse la transition --accent .35s se poser
    await page.evaluate((w) => {
      window.__finDone = false;
      window.FA_FINISHER.play({ win: w, onDone: () => { window.__finDone = true; } });
    }, win);

    await page.waitForTimeout(150);   // beat 1 : mise en place
    await page.screenshot({ path: path.join(ROOT, "_bake", `verify-finisher-${tag}-150.png`) });
    const shown = await page.evaluate(() => {
      const c = document.getElementById("fa-finisher");
      return !!c && getComputedStyle(c).display === "block";
    });
    check(`${tag} canvas visible pendant`, shown);

    await page.waitForTimeout(410);   // beat 2 : ~560 ms → flash de victoire (520→680 ms)
    await page.screenshot({ path: path.join(ROOT, "_bake", `verify-finisher-${tag}-560.png`) });
    await page.waitForTimeout(190);   // beat 3 : ~750 ms, juste avant la fin
    await page.screenshot({ path: path.join(ROOT, "_bake", `verify-finisher-${tag}-750.png`) });

    await page.waitForTimeout(250);   // ~1000 ms : le finisher doit s'être retiré
    const after = await page.evaluate(() => ({
      hidden: getComputedStyle(document.getElementById("fa-finisher")).display === "none",
      done: window.__finDone === true,
    }));
    check(`${tag} canvas retiré à la fin`, after.hidden);
    check(`${tag} onDone appelé`, after.done, "la modale de résultat en dépend");
  }
}

// prefers-reduced-motion : aucune animation, mais onDone quand même.
const ctxR = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
const pageR = await ctxR.newPage();
await pageR.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
await pageR.waitForFunction(() => window.FA_FINISHER).catch(() => {});
await pageR.waitForTimeout(6000);
const red = await pageR.evaluate(() => {
  window.__finDone = false;
  window.FA_FINISHER.play({ win: true, onDone: () => { window.__finDone = true; } });
  const c = document.getElementById("fa-finisher");
  return { done: window.__finDone, painted: !!c && getComputedStyle(c).display === "block" };
});
check("reduced-motion : onDone immédiat", red.done === true);
check("reduced-motion : aucun canvas peint", red.painted === false);

const realErrors = errors.filter((e) => !/frame-ancestors|Content Security Policy|401|Failed to load resource.*401/i.test(e));
console.log(`\nchecks OK: ${ok}/${ok + ko} | erreurs console: ${realErrors.length}`, realErrors.slice(0, 5));
console.log((ko === 0 && realErrors.length === 0) ? "RESULTAT: OK" : "RESULTAT: ECHEC");
await browser.close(); server.close();
process.exit(ko === 0 && realErrors.length === 0 ? 0 : 1);
```

**Note sur le beat 2.** Le flash de victoire vit entre 520 et 680 ms (`FIN_IMPACT` + 160 ms). Les `waitForTimeout` cumulés visent ~560 ms, mais la précision réelle est de l'ordre de quelques dizaines de ms : la capture peut tomber en début ou en fin de flash. C'est acceptable pour un contrôle visuel — ne pas transformer ça en assertion automatique sur les pixels.

- [ ] **Step 2: Lancer la vérif**

```bash
cd "C:/Users/PC/Documents/Arthefacte Games/Fractal Arena/fractal-arena-web"
NODE_PATH="$(npm root -g)" node _bake/verify-finisher.mjs
```
Expected: `RESULTAT: OK`, exit 0, et 12 PNG écrits dans `_bake/` (4 cas × 3 beats).

- [ ] **Step 3: Regarder les images**

Ouvrir les PNG produits et vérifier de visu :
- **Victoire Fosse** : éclats hexagonaux **orange** (`--fire`) convergents, flash blanc à ~530 ms.
- **Victoire Arène** : mêmes éclats en **rouge-magenta** (`#FF2D78`) — preuve que `--accent` est bien lu et non codé en dur.
- **Défaite** : grille de blocs affaissée, hash qui se vide, **aucun flash blanc**.

Si le rendu déçoit, les seuls réglages à toucher sont dans `finisher-ui.js` (constantes en tête + les 2 fonctions `winVals`/`loseVals`) — `finisher.js` ne connaît aucun timing.

- [ ] **Step 4: Cache-bust v80 → v81**

Dans `index.html` uniquement, remplacer toutes les occurrences de `?v=80` par `?v=81` (41 après l'ajout des 2 scripts en Task 2).

```bash
cd "C:/Users/PC/Documents/Arthefacte Games/Fractal Arena/fractal-arena-web"
sed -i 's/?v=80/?v=81/g' index.html
grep -c '?v=81' index.html   # attendu : 41
grep -c '?v=80' index.html   # attendu : 0
```

⚠️ Ne PAS toucher `assets/favicon.png?v=1` (`index.html:19`) — il a son propre versionnage. Le `sed` ci-dessus ne le touche pas (il cible `?v=80`).

- [ ] **Step 5: Run tests one final time**

Run: `npm test`
Expected: PASS — tout vert, y compris `finisher-play.test.js` (qui asserte `finisher.js?v=\d+`, donc insensible au bump).

- [ ] **Step 6: Commit**

```bash
git add _bake/verify-finisher.mjs index.html
git commit -m "chore(finisher): vérif Playwright + cache-bust v81"
```

- [ ] **Step 7: STOP — ne pas pousser**

Le déploiement est **une décision de l'utilisateur**. Ne pas `git push`. Rendre la main avec : les tests verts, les captures produites, et l'attente du « commit deploie ». Le push (`origin main` → GitHub Pages auto) et le poll de la prod se font ensuite, suivis de la mise à jour de la mémoire (roadmap : #6 → LIVE, prochaine = #7 header vivant).

---

## Notes pour l'implémenteur

**Pourquoi deux fichiers.** `finisher-ui.js` est pur → `node:test` l'exécute vraiment, donc le timing est testé pour de bon (pureté, bornes, monotonie). `finisher.js` touche le DOM → il n'est vérifiable qu'au niveau source + Playwright. C'est la ligne de partage du repo (`tour-ui.js` vs `tour.jsx`, `loop.js` vs `fosse.jsx`). Ne pas remonter de logique de timing dans `finisher.js` : le test `finisher-play.test.js` le refuse explicitement.

**Le piège `win` vs `won`.** `AreneBattle` reçoit la prop `won`. `FA_FINISHER.play` attend `win`. `finisherVals(t, o)` fait `o && o.win` — un `{ won: true }` produit donc silencieusement une **défaite sur une victoire**, sans erreur. C'est le bug le plus probable de ce chantier. Le test `finisher-ui.test.js` (« options manquantes : traité comme une défaite ») documente ce comportement.

**Ce qui reste hors scope :** `totem-cine.js` et `cinematique.jsx` ne respectent toujours pas `prefers-reduced-motion`. Dette réelle, actée dans le spec, pas ce chantier.
