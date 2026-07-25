# Moment Forge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cinématique canvas 2D « moment Forge » pour la fusion (succès/échec) et le summon créature, calibrée par tier (rang C/B/A/S ou rareté), avec SFX procéduraux.

**Architecture:** Module pur `forge-cine-ui.js` (`window.FA_FORGE_CINE_UI`, testable node) qui calcule l'état exact du rendu à chaque instant ; overlay canvas 2D singleton `forge-cine.js` (`window.FA_FORGE_CINE`) qui le dessine ; 3 recettes SFX ajoutées à `sfx.js` ; branchement dans `doFuse`/`doSummon` (screens.jsx) avec toast/`setLast` déplacés dans `onDone` (garanti exactement 1×).

**Tech Stack:** Vanilla JS (IIFE, pas de build), canvas 2D (pas de three.js), Web Audio (recettes `FA_SFX`), React sans build (Babel in-browser), tests `node --test`.

## Global Constraints

- Spec : `docs/superpowers/specs/2026-07-25-moment-forge-design.md`. Branche `moment-forge` (worktree `wt-forge-cine`), base origin/main v87.
- Client seulement — AUCUN changement serveur.
- Cache-busting : bump global `?v=87` → `?v=88` dans `index.html` (tâche 4 uniquement).
- Tests : `node --test --test-force-exit test/*.test.js` (⚠️ toujours `--test-force-exit`, sinon la suite ne se termine jamais). CommonJS (`"type": "commonjs"`).
- Scripts classiques (pas ESM) : `forge-cine-ui.js` et `forge-cine.js` sont des IIFE comme `forge-ui.js`/`sfx.js`.
- Pas de `Math.random()` dans le rendu (déterminisme) — positions d'éclats par angle d'or (`i * 2.399963`).
- `onDone` appelé EXACTEMENT une fois dans tous les cas (fin, skip, erreur, reduced-motion, double `play`).
- Aucune entrée CSP nouvelle (pas de fetch, pas d'assets externes).
- Messages de commit : suffixe `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: `forge-cine-ui.js` — module pur (durées + `forgeVals`)

**Files:**
- Create: `forge-cine-ui.js`
- Test: `test/forge-cine-ui.test.js`

**Interfaces:**
- Produces: `window.FA_FORGE_CINE_UI = { DUR, tierIndex, duration, forgeVals }`
  - `tierIndex(tier: 'C'|'B'|'A'|'S'|'Common'|'Rare'|'Epic'|'Legendary'|any) → 0..3` (inconnu → 0)
  - `duration({mode:'fuse'|'summon', success?:bool, tier}) → ms` (échec fusion → 1000 ; sinon `[800,1200,1600,2000][tierIndex]`)
  - `forgeVals(t: 0..1, {mode, success?, tier, premium?}) → { phase, lvl, fail, gold, heat, sparks, wave, gem, flash, rise, fall }`
  - Phases succès : `strike` [0,.22) → `shockwave` [.22,.55) → `crystallize` [.55,.8) → `burst` [.8,1] ; échec : `strike` [0,.22) → `sparks` [.22,.6) → `ashes` [.6,1]

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/forge-cine-ui.test.js` :

```js
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../forge-cine-ui.js");
const U = globalThis.window.FA_FORGE_CINE_UI;

test("tierIndex : rangs, raretés, inconnus", () => {
  assert.strictEqual(U.tierIndex("C"), 0);
  assert.strictEqual(U.tierIndex("B"), 1);
  assert.strictEqual(U.tierIndex("A"), 2);
  assert.strictEqual(U.tierIndex("S"), 3);
  assert.strictEqual(U.tierIndex("Common"), 0);
  assert.strictEqual(U.tierIndex("Rare"), 1);
  assert.strictEqual(U.tierIndex("Epic"), 2);
  assert.strictEqual(U.tierIndex("Legendary"), 3);
  assert.strictEqual(U.tierIndex(undefined), 0);
  assert.strictEqual(U.tierIndex("garbage"), 0);
});

test("duration : par tier + échec fusion fixe", () => {
  assert.strictEqual(U.duration({ mode: "summon", tier: "C" }), 800);
  assert.strictEqual(U.duration({ mode: "summon", tier: "S" }), 2000);
  assert.strictEqual(U.duration({ mode: "fuse", success: true, tier: "Legendary" }), 2000);
  assert.strictEqual(U.duration({ mode: "fuse", success: false, tier: "Rare" }), 1000);
});

test("phases succès dans l'ordre, phases échec dédiées", () => {
  const o = { mode: "summon", success: true, tier: "B" };
  assert.strictEqual(U.forgeVals(0.1, o).phase, "strike");
  assert.strictEqual(U.forgeVals(0.4, o).phase, "shockwave");
  assert.strictEqual(U.forgeVals(0.7, o).phase, "crystallize");
  assert.strictEqual(U.forgeVals(0.95, o).phase, "burst");
  const f = { mode: "fuse", success: false, tier: "Rare" };
  assert.strictEqual(U.forgeVals(0.1, f).phase, "strike");
  assert.strictEqual(U.forgeVals(0.4, f).phase, "sparks");
  assert.strictEqual(U.forgeVals(0.9, f).phase, "ashes");
  assert.strictEqual(U.forgeVals(0.9, f).fail, true);
});

test("intensité strictement croissante par tier (burst)", () => {
  const at = (tier) => U.forgeVals(0.9, { mode: "summon", success: true, tier });
  const tiers = ["C", "B", "A", "S"];
  for (let i = 1; i < tiers.length; i++) {
    const lo = at(tiers[i - 1]), hi = at(tiers[i]);
    assert.ok(hi.sparks > lo.sparks, `sparks ${tiers[i]} > ${tiers[i - 1]}`);
    assert.ok(hi.flash > lo.flash, `flash ${tiers[i]} > ${tiers[i - 1]}`);
  }
  const wa = (tier) => U.forgeVals(0.5, { mode: "summon", success: true, tier }).wave;
  assert.ok(wa("S") > wa("C"), "wave S > C");
});

test("premium → gold ; échec jamais gold", () => {
  assert.strictEqual(U.forgeVals(0.9, { mode: "fuse", success: true, tier: "Epic", premium: true }).gold, true);
  assert.strictEqual(U.forgeVals(0.9, { mode: "fuse", success: true, tier: "Epic" }).gold, false);
  assert.strictEqual(U.forgeVals(0.9, { mode: "fuse", success: false, tier: "Epic", premium: true }).gold, false);
});

test("pureté + clamp de t", () => {
  const o = { mode: "summon", success: true, tier: "A" };
  assert.deepStrictEqual(U.forgeVals(0.5, o), U.forgeVals(0.5, o));
  assert.strictEqual(U.forgeVals(-1, o).phase, "strike");
  assert.strictEqual(U.forgeVals(2, o).phase, "burst");
  assert.ok(Number.isFinite(U.forgeVals(1, o).flash));
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `node --test --test-force-exit test/forge-cine-ui.test.js`
Expected: FAIL (`Cannot find module '../forge-cine-ui.js'`)

- [ ] **Step 3: Implémenter `forge-cine-ui.js`**

```js
/* FRACTAL ARENA — Moment Forge : état pur de la cinématique (testable Node).
   Aucun DOM, aucun aléa, aucune horloge : t (0..1) + options → état exact du rendu. */
(function () {
  "use strict";

  const DUR = { FUSE_FAIL: 1000, TIER: [800, 1200, 1600, 2000] };
  const TIER_MAP = { C: 0, B: 1, A: 2, S: 3, Common: 0, Rare: 1, Epic: 2, Legendary: 3 };

  function tierIndex(tier) {
    const i = TIER_MAP[tier];
    return i === undefined ? 0 : i;
  }

  function duration(o) {
    o = o || {};
    if (o.mode === "fuse" && !o.success) return DUR.FUSE_FAIL;
    return DUR.TIER[tierIndex(o.tier)];
  }

  const easeOut = (k) => 1 - Math.pow(1 - Math.max(0, Math.min(1, k)), 3);

  // t normalisé 0..1 → état du rendu. Toutes les intensités de succès portent
  // un facteur `base` strictement croissant par tier (0.4 / 0.6 / 0.8 / 1.0).
  function forgeVals(t, o) {
    o = o || {};
    const x = Math.max(0, Math.min(1, Number(t) || 0));
    const fail = o.mode === "fuse" && !o.success;
    if (fail) {
      const phase = x < 0.22 ? "strike" : x < 0.6 ? "sparks" : "ashes";
      return {
        phase, lvl: 0, fail: true, gold: false,
        heat: phase === "strike" ? easeOut(x / 0.22) : Math.max(0, 1 - (x - 0.22) / 0.5),
        sparks: 26,
        rise: phase === "strike" ? 0 : easeOut((x - 0.22) / 0.38),
        fall: phase === "ashes" ? easeOut((x - 0.6) / 0.4) : 0,
        wave: 0, gem: 0, flash: 0,
      };
    }
    const lvl = tierIndex(o.tier);
    const base = 0.4 + 0.2 * lvl;
    const phase = x < 0.22 ? "strike" : x < 0.55 ? "shockwave" : x < 0.8 ? "crystallize" : "burst";
    return {
      phase, lvl, fail: false, gold: !!o.premium,
      heat: phase === "strike" ? easeOut(x / 0.22) : 1,
      sparks: Math.round((24 + 20 * lvl) * (phase === "burst" ? 1 : 0.4)),
      wave: phase === "strike" ? 0 : easeOut((x - 0.22) / 0.5) * base,
      gem: phase === "crystallize" ? easeOut((x - 0.55) / 0.25) : phase === "burst" ? 1 : 0,
      flash: phase === "burst" ? easeOut((x - 0.8) / 0.2) * base : 0,
      rise: 0, fall: 0,
    };
  }

  const api = { DUR, tierIndex, duration, forgeVals };
  if (typeof window !== "undefined") window.FA_FORGE_CINE_UI = api;
})();
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `node --test --test-force-exit test/forge-cine-ui.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Suite complète + commit**

Run: `node --test --test-force-exit test/*.test.js` → tout PASS, puis :

```bash
git add forge-cine-ui.js test/forge-cine-ui.test.js
git commit -m "feat(forge-cine): module pur FA_FORGE_CINE_UI — durées + forgeVals par tier

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: SFX — recettes `forge_strike` / `forge_born` / `forge_fizzle`

**Files:**
- Modify: `sfx.js` (RECIPES ligne ~47-62, `play` ligne ~64-71)
- Test: `test/forge-cine-sfx.test.js`

**Interfaces:**
- Consumes: rien (indépendant de Task 1).
- Produces: `FA_SFX.play(name, arg)` — 2e argument optionnel transmis à la recette ; recettes `forge_strike(t)`, `forge_born(t, lvl 0..3)` (arpège plus riche par lvl), `forge_fizzle(t)`. Rétro-compatible : les recettes existantes ignorent `arg`.

- [ ] **Step 1: Écrire le test qui échoue** (niveau source, modèle `test/api-url.test.js`)

Créer `test/forge-cine-sfx.test.js` :

```js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "sfx.js"), "utf8");

test("recettes forge présentes", () => {
  assert.match(src, /forge_strike:\s*\(t\)/);
  assert.match(src, /forge_born:\s*\(t,\s*lvl\)/);
  assert.match(src, /forge_fizzle:\s*\(t\)/);
});

test("play transmet un 2e argument aux recettes", () => {
  assert.match(src, /function play\(name,\s*arg\)/);
  assert.match(src, /fn\(c\.currentTime \+ 0\.001,\s*arg\)/);
});

test("forge_born : arpège dont la longueur dépend de lvl", () => {
  assert.match(src, /slice\(0,\s*2 \+/);
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `node --test --test-force-exit test/forge-cine-sfx.test.js`
Expected: FAIL (3 assertions `match`)

- [ ] **Step 3: Modifier `sfx.js`**

Dans `RECIPES`, après la recette `defeat` (ligne ~61), ajouter :

```js
    // frappe de forge : impact grave + claquement métallique bref
    forge_strike: (t) => { tone(t, { type: "sine", f: 90, f2: 55, dur: 0.30, peak: 0.8 });
                           tone(t + 0.01, { type: "square", f: 1400, f2: 700, dur: 0.06, peak: 0.2 }); },
    // carillon de naissance : arpège dont la richesse monte avec lvl (0..3)
    forge_born: (t, lvl) => { const notes = [523, 659, 784, 1047, 1319].slice(0, 2 + (Number(lvl) || 0));
                              notes.forEach((f, i) => tone(t + i * 0.09, { type: "triangle", f, dur: 0.20, peak: 0.5 })); },
    // échec : retombée mate, deux chutes graves
    forge_fizzle: (t) => { tone(t, { type: "sawtooth", f: 220, f2: 70, dur: 0.35, peak: 0.38 });
                           tone(t + 0.12, { type: "sine", f: 160, f2: 60, dur: 0.30, peak: 0.3 }); },
```

Et remplacer la fonction `play` (lignes 64-71) par :

```js
  function play(name, arg) {
    if (!enabled) return;
    const c = ensureCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume();
    const fn = RECIPES[name];
    if (fn) try { fn(c.currentTime + 0.001, arg); } catch (e) {}
  }
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test --test-force-exit test/forge-cine-sfx.test.js` → PASS, puis suite complète `node --test --test-force-exit test/*.test.js` → tout PASS.

- [ ] **Step 5: Commit**

```bash
git add sfx.js test/forge-cine-sfx.test.js
git commit -m "feat(sfx): recettes forge_strike/forge_born/forge_fizzle + play(name, arg)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `forge-cine.js` — overlay canvas 2D

**Files:**
- Create: `forge-cine.js`
- Test: `test/forge-cine.test.js`

**Interfaces:**
- Consumes: `window.FA_FORGE_CINE_UI` (Task 1 : `duration`, `forgeVals`) ; `window.FA_SFX.play(name, arg)` (Task 2, optionnel — silencieux si absent).
- Produces: `window.FA_FORGE_CINE = { play }` avec `play({ mode:'fuse'|'summon', success, tier, color, premium, onDone })`. `color` = couleur CSS hex fournie par l'appelant. Garanties : `onDone` exactement 1× ; reduced-motion ou `FA_FORGE_CINE_UI` absent → `onDone` immédiat sans canvas ; erreur de rendu → teardown + `onDone` ; nouveau `play` pendant une cinématique → l'ancienne se termine (son `onDone` est appelé) ; clic/tap → skip.

- [ ] **Step 1: Écrire le test qui échoue** (niveau source — le canvas ne tourne pas sous node)

Créer `test/forge-cine.test.js` :

```js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "forge-cine.js"), "utf8");

test("expose FA_FORGE_CINE.play", () => {
  assert.match(src, /window\.FA_FORGE_CINE\s*=\s*\{\s*play\s*\}/);
});

test("onDone garanti exactement 1x (wrapper once)", () => {
  assert.match(src, /function once\(/);
  assert.match(src, /if \(called\) return/);
});

test("reduced-motion et module absent → onDone immédiat, pas de canvas", () => {
  assert.match(src, /prefers-reduced-motion/);
  assert.match(src, /if \(!ui \|\| reduced\)/);
});

test("boucle de rendu sous try/catch, teardown sur erreur", () => {
  assert.match(src, /catch \(e\) \{ finish\(\); \}/);
});

test("skip au pointerdown", () => {
  assert.match(src, /addEventListener\("pointerdown",\s*skip/);
});

test("SFX optionnels : strike au départ, born/fizzle au burst", () => {
  assert.match(src, /forge_strike/);
  assert.match(src, /forge_born/);
  assert.match(src, /forge_fizzle/);
});

test("pas de Math.random : eclats par angle d'or", () => {
  assert.ok(!/Math\.random/.test(src), "rendu déterministe requis");
  assert.match(src, /2\.399963/);
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `node --test --test-force-exit test/forge-cine.test.js`
Expected: FAIL (`ENOENT ... forge-cine.js`)

- [ ] **Step 3: Implémenter `forge-cine.js`**

```js
/* FRACTAL ARENA — Moment Forge : overlay canvas 2D plein écran.
   window.FA_FORGE_CINE.play({ mode, success, tier, color, premium, onDone }).
   L'état de chaque frame vient de FA_FORGE_CINE_UI.forgeVals (pur) ; ici on ne fait
   que dessiner. Toast/carte restent gérés par l'appelant dans onDone (garanti 1x). */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  const GOLD = "#f5c542", EMBER = "#ff7a1a", ASH = "#8a8f98";
  let dom = null, raf = 0, current = null;

  function once(fn) {
    let called = false;
    return function () { if (called) return; called = true; try { fn(); } catch (e) {} };
  }

  function build() {
    if (dom) return dom;
    const root = document.createElement("div");
    root.style.cssText = "position:fixed;inset:0;z-index:9990;display:none;background:rgba(4,7,12,.9);cursor:pointer;";
    const cv = document.createElement("canvas");
    cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%;";
    root.appendChild(cv);
    root.addEventListener("pointerdown", skip, true);
    document.body.appendChild(root);
    dom = { root, cv, g: cv.getContext("2d") };
    return dom;
  }

  function finish() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    if (dom) dom.root.style.display = "none";
    const cb = current && current.done;
    current = null;
    if (cb) cb();
  }
  function skip() { if (current) finish(); }

  // Octogone régulier (thème forge « à la Griffe »).
  function octPath(g, cx, cy, r, rot) {
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = rot + (Math.PI / 4) * i;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.closePath();
  }

  function draw(v, color, gold, w, h) {
    const g = dom.g, cx = w / 2, cy = h / 2, R = Math.min(w, h);
    g.clearRect(0, 0, w, h);

    // Cœur en fusion (orange) — toujours présent tant que heat > 0.
    if (v.heat > 0) {
      const r = R * (0.05 + 0.06 * v.heat);
      const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r * 3);
      grad.addColorStop(0, "#fff6e0");
      grad.addColorStop(0.35, EMBER);
      grad.addColorStop(1, "rgba(255,122,26,0)");
      g.globalAlpha = v.fail ? 0.5 + 0.5 * v.heat : 1;
      g.fillStyle = grad;
      g.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);
      g.globalAlpha = 1;
    }

    // Onde de choc octogonale teintée par le tier.
    if (v.wave > 0) {
      g.strokeStyle = color;
      g.globalAlpha = Math.max(0, 1 - v.wave) * 0.9;
      g.lineWidth = 3 + 5 * v.wave;
      octPath(g, cx, cy, R * 0.55 * v.wave, Math.PI / 8);
      g.stroke();
      g.globalAlpha = 1;
    }

    // Gemme octogonale qui cristallise puis éclate.
    if (v.gem > 0) {
      const r = R * 0.09 * v.gem;
      g.save();
      g.fillStyle = color;
      g.strokeStyle = gold ? GOLD : "#eaf4ff";
      g.lineWidth = 2;
      g.globalAlpha = 0.35 + 0.65 * v.gem;
      octPath(g, cx, cy, r, Math.PI / 8 + v.gem * 0.6);
      g.fill(); g.stroke();
      g.restore();
      g.globalAlpha = 1;
    }

    // Éclats radiaux — angle d'or : déterministe, sans Math.random.
    const n = v.sparks;
    const spread = v.fail ? v.rise : (v.phase === "burst" ? v.flash / Math.max(0.001, 1) : v.wave);
    for (let i = 0; i < n; i++) {
      const a = i * 2.399963;
      const rr = R * (0.08 + 0.45 * spread) * (0.6 + 0.4 * ((i % 5) / 4));
      let x = cx + Math.cos(a) * rr;
      let y = cy + Math.sin(a) * rr + (v.fail ? v.fall * R * 0.3 * ((i % 3) + 1) / 3 : 0);
      g.fillStyle = v.fail && v.phase === "ashes" ? ASH : (gold && i % 4 === 0 ? GOLD : color);
      g.globalAlpha = v.fail ? Math.max(0, 1 - v.fall * 0.9) : 0.9;
      g.fillRect(x - 1.5, y - 1.5, 3, 3);
    }
    g.globalAlpha = 1;

    // Flash final (succès), teinté or si premium.
    if (v.flash > 0) {
      g.fillStyle = gold ? GOLD : "#ffffff";
      g.globalAlpha = v.flash * 0.55;
      g.fillRect(0, 0, w, h);
      g.globalAlpha = 1;
    }
  }

  function play(opts) {
    opts = opts || {};
    const done = once(typeof opts.onDone === "function" ? opts.onDone : function () {});
    try {
      const ui = window.FA_FORGE_CINE_UI;
      const reduced = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      if (!ui || reduced) { done(); return; }
      if (current) finish(); // coupe la cinématique en cours (son onDone est appelé)
      const d = build();
      current = { done };
      const dur = ui.duration(opts);
      const color = opts.color || "#46e6ff";
      const gold = !!opts.premium && !(opts.mode === "fuse" && !opts.success);
      d.cv.width = innerWidth; d.cv.height = innerHeight;
      d.root.style.display = "block";
      if (window.FA_SFX) window.FA_SFX.play("forge_strike");
      let endSfx = false;
      const t0 = performance.now();
      function tick(now) {
        try {
          if (!current || current.done !== done) return; // un autre play a pris la main
          const t = Math.min(1, (now - t0) / dur);
          const v = ui.forgeVals(t, opts);
          draw(v, color, gold, d.cv.width, d.cv.height);
          if (!endSfx && (v.phase === "burst" || v.phase === "ashes") && window.FA_SFX) {
            endSfx = true;
            window.FA_SFX.play(v.fail ? "forge_fizzle" : "forge_born", v.lvl);
          }
          if (t >= 1) { finish(); return; }
          raf = requestAnimationFrame(tick);
        } catch (e) { finish(); }
      }
      raf = requestAnimationFrame(tick);
    } catch (e) { done(); }
  }

  window.FA_FORGE_CINE = { play };
})();
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test --test-force-exit test/forge-cine.test.js` → PASS, puis suite complète → tout PASS.

- [ ] **Step 5: Commit**

```bash
git add forge-cine.js test/forge-cine.test.js
git commit -m "feat(forge-cine): overlay canvas 2D FA_FORGE_CINE — beats par phase, skip, reduced-motion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Intégration — `screens.jsx` + `index.html` (v88)

**Files:**
- Modify: `screens.jsx` (`doFuse` lignes ~235-248, `doSummon` créatures lignes ~407-415, `doSummon` reliques lignes ~458-466)
- Modify: `index.html` (bloc scripts lignes ~119-137, bump `?v=87` → `?v=88` GLOBAL)
- Test: `test/forge-cine-wiring.test.js`

**Interfaces:**
- Consumes: `window.FA_FORGE_CINE.play(...)` (Task 3), `D.RANK_COLORS` / `D.RARITY_COLORS` (data.js existant).
- Produces: rien de nouveau — comportement utilisateur.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/forge-cine-wiring.test.js` :

```js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");

test("index.html charge forge-cine-ui.js puis forge-cine.js (scripts classiques)", () => {
  const a = html.indexOf('<script src="forge-cine-ui.js');
  const b = html.indexOf('<script src="forge-cine.js');
  assert.ok(a > -1, "forge-cine-ui.js chargé");
  assert.ok(b > a, "forge-cine.js chargé après forge-cine-ui.js");
  assert.ok(!/type="module" src="forge-cine/.test(html), "scripts classiques, pas ESM");
});

test("cache-busting bumpé en v88, plus aucun v87", () => {
  assert.ok(html.includes("?v=88"), "v88 présent");
  assert.ok(!html.includes("?v=87"), "aucun ?v=87 restant");
});

test("doFuse branche la cinématique avec repli", () => {
  assert.match(screens, /FA_FORGE_CINE/);
  assert.match(screens, /mode:\s*"fuse"/);
  assert.match(screens, /D\.RARITY_COLORS\[/);
});

test("doSummon branche la cinématique (rang) et révèle la carte dans onDone", () => {
  assert.match(screens, /mode:\s*"summon"/);
  assert.match(screens, /D\.RANK_COLORS\[/);
  // setLast(r.beast) doit être DANS le onDone du play summon
  const m = screens.match(/mode:\s*"summon"[\s\S]{0,400}setLast\(r\.beast\)/);
  assert.ok(m, "setLast(r.beast) dans le onDone du summon");
});

test("doSummon reliques : cinématique teintée par la rareté, relique révélée dans onDone", () => {
  const m = screens.match(/mode:\s*"summon"[\s\S]{0,400}setLast\(r\.relic\)/);
  assert.ok(m, "setLast(r.relic) dans le onDone du summon relique");
  const tinted = screens.match(/tier:\s*r\.relic\.rarity/);
  assert.ok(tinted, "tier = r.relic.rarity pour la relique");
});
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `node --test --test-force-exit test/forge-cine-wiring.test.js`
Expected: FAIL (4 tests)

- [ ] **Step 3: Modifier `screens.jsx`**

Dans `doFuse` (ForgeFusion), remplacer le bloc résultat (lignes 240-247) :

```jsx
    if (!r.ok) { toast(r.reason, "bad"); return; }
    const showFuseResult = () => {
      if (r.success) {
        if (r.result?.premium) toast(I18N.t("FG_FUSE_PREMIUM", rarityLabel(r.result?.rarity)), "good");
        else toast(I18N.t("FG_FUSE_OK", rarityLabel(r.result?.rarity)), "good");
      }
      else toast(I18N.t("FG_FUSE_FAIL"), "bad");
    };
    if (window.FA_FORGE_CINE) {
      window.FA_FORGE_CINE.play({
        mode: "fuse", success: r.success, tier: r.result?.rarity,
        color: D.RARITY_COLORS[r.result?.rarity] || "var(--elec)",
        premium: r.result?.premium, onDone: showFuseResult,
      });
    } else showFuseResult();
    setSel([]);
    setGoldMode(false);
```

⚠️ `color` doit être une vraie couleur canvas : `D.RARITY_COLORS[...]` est un hex ; le repli `"var(--elec)"` ne marche pas en canvas — utiliser `"#46e6ff"` comme repli :
`color: D.RARITY_COLORS[r.result?.rarity] || "#46e6ff",`

Dans `doSummon` (ForgeSummon créatures, lignes ~407-415), remplacer :

```jsx
    if (!r.ok) { toast(r.reason, "bad"); return; }
    const reveal = () => {
      setLast(r.beast);
      toast(I18N.t("FG_SUMMON_OK", D.displayName(r.beast), I18N.t("FG_RANK") + " " + (r.beast.rank || "C")), "good");
    };
    if (window.FA_FORGE_CINE) {
      window.FA_FORGE_CINE.play({
        mode: "summon", success: true, tier: r.beast.rank || "C",
        color: D.RANK_COLORS[r.beast.rank || "C"] || "#46e6ff",
        onDone: reveal,
      });
    } else reveal();
```

(Le `setLast(null)` du début de `doSummon` reste — la carte n'apparaît qu'après la cinématique.)

Dans `doSummon` (ForgeReliques, lignes ~458-466), remplacer :

```jsx
    if (!r.ok) { toast(r.reason, "bad"); return; }
    const revealRelic = () => {
      setLast(r.relic);
      toast(I18N.t("FG_SUMMON_OK", I18N.t("RELIC_" + r.relic.type.toUpperCase()), rarityLabel(r.relic.rarity)), "good");
    };
    if (window.FA_FORGE_CINE) {
      window.FA_FORGE_CINE.play({
        mode: "summon", success: true, tier: r.relic.rarity,
        color: D.RARITY_COLORS[r.relic.rarity] || "#46e6ff",
        onDone: revealRelic,
      });
    } else revealRelic();
```

- [ ] **Step 4: Modifier `index.html`**

Après la ligne `<script src="forge-ui.js?v=87"></script>` (ligne ~128), insérer :

```html
  <script src="forge-cine-ui.js?v=87"></script>
  <script src="forge-cine.js?v=87"></script>
```

Puis bump global (PowerShell, à la racine du worktree) :

```powershell
(Get-Content index.html -Raw) -replace '\?v=87', '?v=88' | Set-Content index.html -NoNewline
```

- [ ] **Step 5: Vérifier que les tests passent**

Run: `node --test --test-force-exit test/forge-cine-wiring.test.js` → PASS, puis suite complète `node --test --test-force-exit test/*.test.js` → tout PASS.

- [ ] **Step 6: Commit**

```bash
git add screens.jsx index.html test/forge-cine-wiring.test.js
git commit -m "feat(forge): moment Forge branché sur fusion + summon, cache-bust v88

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Page proto + vérification navigateur (le « visu »)

**Files:**
- Create: `_forge-cine-proto.html` (page de démo locale, modèle `_totem-cine-proto.html` — préfixe `_` = hors prod)
- Vérification : Playwright (captures d'écran)

**Interfaces:**
- Consumes: `forge-cine-ui.js`, `forge-cine.js`, `sfx.js`, `data.js` (RANK_COLORS/RARITY_COLORS).

- [ ] **Step 1: Créer `_forge-cine-proto.html`**

```html
<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Proto — Moment Forge</title>
<style>
  body { background:#0a0e14; color:#eaf4ff; font-family:monospace; padding:24px; }
  button { margin:4px; padding:10px 14px; background:#141a24; color:#eaf4ff; border:1px solid #2a3446; cursor:pointer; }
  #log { margin-top:12px; color:#8a8f98; font-size:12px; }
</style>
</head>
<body>
<h3>Moment Forge — proto</h3>
<div>
  Summon :
  <button onclick="go('summon',true,'C')">Rang C</button>
  <button onclick="go('summon',true,'B')">Rang B</button>
  <button onclick="go('summon',true,'A')">Rang A</button>
  <button onclick="go('summon',true,'S')">Rang S</button>
</div>
<div>
  Fusion :
  <button onclick="go('fuse',true,'Rare')">Succès Rare</button>
  <button onclick="go('fuse',true,'Legendary')">Succès Legendary</button>
  <button onclick="go('fuse',true,'Epic',true)">Succès Epic PREMIUM</button>
  <button onclick="go('fuse',false,'Rare')">ÉCHEC</button>
</div>
<div>
  Relique (rareté) :
  <button onclick="go('summon',true,'Common')">Commune</button>
  <button onclick="go('summon',true,'Rare')">Rare</button>
  <button onclick="go('summon',true,'Epic')">Épique</button>
  <button onclick="go('summon',true,'Legendary')">Légendaire</button>
</div>
<div id="log">prêt</div>
<script src="data.js"></script>
<script src="sfx.js"></script>
<script src="forge-cine-ui.js"></script>
<script src="forge-cine.js"></script>
<script>
  const D = window.FA_DATA || window.D || {};
  const RANKC = (D.RANK_COLORS) || { C:"#9CA3AF", B:"#38BDF8", A:"#FB923C", S:"#FACC15" };
  const RARC = (D.RARITY_COLORS) || { Common:"#9CA3AF", Rare:"#38BDF8", Epic:"#a78bfa", Legendary:"#FB923C" };
  function go(mode, success, tier, premium) {
    document.getElementById("log").textContent = "play " + mode + " " + tier + (premium ? " premium" : "") + (success ? "" : " FAIL") + "…";
    window.FA_FORGE_CINE.play({
      mode, success, tier, premium,
      color: RANKC[tier] || RARC[tier] || "#46e6ff",
      onDone: () => { document.getElementById("log").textContent = "onDone ✓ (" + mode + " " + tier + ")"; },
    });
  }
</script>
</body>
</html>
```

⚠️ Vérifier au passage comment `data.js` expose ses constantes (`window.D` ? `window.FA_DATA` ?) et ajuster la ligne `const D = …` ; les replis codés en dur suffisent de toute façon pour le proto.

- [ ] **Step 2: Vérification navigateur Playwright**

Servir le worktree (`npx serve` ou `python -m http.server 8123`) puis, avec Playwright (ou les outils navigateur de la session) :
1. Ouvrir `http://localhost:8123/_forge-cine-proto.html`.
2. Cliquer « Rang C » → capture à ~300 ms (cinématique visible) ; attendre → `#log` affiche `onDone ✓`.
3. Cliquer « Rang S » → 3 captures (~300 / 1000 / 1800 ms : strike, onde, burst).
4. Cliquer « ÉCHEC » → capture à ~700 ms (cendres) ; vérifier `onDone ✓`.
5. Cliquer « Succès Epic PREMIUM » → capture au burst (accent or visible).
6. Console : zéro erreur.

Expected: captures nettes des beats, `onDone ✓` à chaque fois, aucune erreur console.

- [ ] **Step 3: Vérification in-app (smoke)**

Ouvrir `http://localhost:8123/` (l'app charge v88) : vérifier en console que `window.FA_FORGE_CINE` et `window.FA_FORGE_CINE_UI` existent et qu'aucune erreur de chargement n'apparaît. (Le summon réel exige login + solde — le proto couvre le visuel.)

- [ ] **Step 4: Commit**

```bash
git add _forge-cine-proto.html
git commit -m "chore(forge-cine): page proto _forge-cine-proto.html pour valider le visuel

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

- [ ] **Step 5: Montrer les captures au user pour verdict visuel** — STOP : attendre son retour avant toute PR.

---

## Self-Review (fait à l'écriture du plan)

- Couverture spec : module pur (T1), SFX (T2), canvas + garanties (T3), intégration + v88 (T4), vérif navigateur (T5). Summon reliques : hors portée v1 (spec). ✓
- Types cohérents : `play({mode, success, tier, color, premium, onDone})` identique en T3 (producteur), T4 et T5 (consommateurs) ; `forgeVals` T1 = consommé T3 (`heat/wave/gem/flash/sparks/rise/fall/phase/lvl/fail/gold`). ✓
- Pas de placeholder : tout le code est écrit. La seule vérification laissée à l'exécutant est le nom de l'objet global de `data.js` (T5 step 1, replis fournis). ✓
