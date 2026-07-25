# Juice de combat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre chaque coup de combat « ressenti » (son + impact visuel + emphase crit/KO) via un module partagé, purement cosmétique, sans toucher au serveur.

**Architecture:** Un module pur `FA_JUICE_UI` (intensités, testable node) + une couche de peinture DOM `FA_JUICE` (modèle `FA_FINISHER`) que `fosse.jsx` et `campaign.jsx` appellent à la place de leurs 3 helpers dupliqués (`floatText`/`animHit`/`animLunge`). Les sons passent par le moteur procédural existant `FA_SFX`. Tout est rejoué sur les events serveur déjà produits — aucun changement serveur, invariant EV de la Fosse préservé.

**Tech Stack:** JS vanilla dans navigateur (IIFE → `window.*`), Babel-in-browser pour les `.jsx`, CSS keyframes, Web Audio API (SFX procéduraux), tests `node --test`.

## Global Constraints

- **Aucun changement serveur** ; juice = feedback cosmétique pur (pas de buff → invariant EV de la Fosse préservé).
- **CSP-safe** : aucun fichier média, aucun asset externe. Sons synthétisés (`FA_SFX`), effets en DOM/CSS.
- **Respect de `prefers-reduced-motion`** : chemin dégradé (chiffres + son conservés ; shake, particules, hit-stop, glow coupés). Le jeu le respecte partout.
- **Robustesse non bloquante** : toute fonction `FA_JUICE.*` en `try/catch` silencieux, no-op si élément absent ; un effet raté ne casse jamais la boucle de combat (contrat calqué sur `FA_FINISHER`).
- **Convention modules** : module pur `*-ui.js` → `window.FA_*_UI` (testé en runtime node) ; couche DOM séparée (verrouillée au niveau source, comme `finisher-play.test.js`).
- **Cache-bust** : bump global du numéro de version d'assets dans `index.html` (`?v=81` → `?v=82`).
- **Tests** : `npm test` = `node --test --test-force-exit test/*.test.js`.

---

### Task 1: Module pur `FA_JUICE_UI` (intensités testables)

**Files:**
- Create: `juice-ui.js`
- Test: `test/juice-ui.test.js`

**Interfaces:**
- Consumes: rien (module autonome, aucun DOM/aléa/horloge).
- Produces: `window.FA_JUICE_UI = { shakeIntensity, particleSpec, clamp01 }`
  - `shakeIntensity(dmg: number, maxHp: number, crit: boolean) → number` ∈ [0,1] (0 = pas de screen-shake).
  - `particleSpec(kind: "atk"|"sp", crit: boolean) → { count: number, color: string, spread: number }`.

- [ ] **Step 1: Write the failing test**

Create `test/juice-ui.test.js` :

```js
// test/juice-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../juice-ui.js");
const J = globalThis.window.FA_JUICE_UI;

test("shakeIntensity : crit = max (1)", () => {
  assert.strictEqual(J.shakeIntensity(1, 100, true), 1);
  assert.strictEqual(J.shakeIntensity(0, 0, true), 1); // crit prime, même sans PV connus
});

test("shakeIntensity : petit coup = 0 (le board ne tremble pas)", () => {
  assert.strictEqual(J.shakeIntensity(5, 100, false), 0);   // 5% des PV
  assert.strictEqual(J.shakeIntensity(14, 100, false), 0);  // 14% < seuil 15%
});

test("shakeIntensity : paliers montants sur gros coup", () => {
  assert.strictEqual(J.shakeIntensity(15, 100, false), 0.35); // 15%
  assert.strictEqual(J.shakeIntensity(25, 100, false), 0.6);  // 25%
  assert.strictEqual(J.shakeIntensity(60, 100, false), 0.6);  // plafonné
});

test("shakeIntensity : robuste aux entrées dégénérées", () => {
  assert.strictEqual(J.shakeIntensity(10, 0, false), 0);
  assert.strictEqual(J.shakeIntensity(0, 100, false), 0);
  for (const v of [J.shakeIntensity(30, 100, false)]) assert.ok(v >= 0 && v <= 1);
});

test("particleSpec : crit et sp se distinguent de atk", () => {
  const atk = J.particleSpec("atk", false);
  const sp = J.particleSpec("sp", false);
  const crit = J.particleSpec("atk", true);
  assert.ok(atk.count > 0 && sp.count > 0 && crit.count > 0);
  assert.notStrictEqual(atk.color, sp.color);   // couleurs distinctes
  assert.ok(crit.count >= atk.count);            // crit ≥ atk en densité
  for (const s of [atk, sp, crit]) {
    assert.strictEqual(typeof s.color, "string");
    assert.ok(s.spread > 0);
  }
});

test("pureté : deux appels identiques rendent le même résultat", () => {
  assert.deepStrictEqual(J.particleSpec("sp", true), J.particleSpec("sp", true));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-force-exit test/juice-ui.test.js`
Expected: FAIL — `Cannot read properties of undefined` (FA_JUICE_UI absent, fichier `juice-ui.js` inexistant).

- [ ] **Step 3: Write minimal implementation**

Create `juice-ui.js` :

```js
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

  window.FA_JUICE_UI = { shakeIntensity, particleSpec, clamp01 };
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-force-exit test/juice-ui.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add juice-ui.js test/juice-ui.test.js
git commit -m "feat(juice): module pur FA_JUICE_UI (shakeIntensity, particleSpec)"
```

---

### Task 2: Sons de combat dans `FA_SFX`

**Files:**
- Modify: `sfx.js` (RECIPES ~47-62, export ~91)
- Test: `test/sfx-recipes.test.js`

**Interfaces:**
- Consumes: `tone(t0, opts)` interne existant.
- Produces: recettes `hit`, `crit`, `special`, `heal`, `ko` dans `RECIPES` ; `window.FA_SFX.has(name: string) → boolean` (consommé par les tests ; `play`/`setEnabled` inchangés).

- [ ] **Step 1: Write the failing test**

Create `test/sfx-recipes.test.js` (source-level : `sfx.js` touche `document`/Web Audio, non exécutable en node sans jsdom — on verrouille au niveau source, comme `finisher-play.test.js`) :

```js
// test/sfx-recipes.test.js
// sfx.js touche document + Web Audio → non exécutable en node:test ; on verrouille
// la présence des recettes de combat au niveau source (modèle finisher-play.test.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "sfx.js"), "utf8");

test("les recettes de combat existent", () => {
  for (const name of ["hit", "crit", "special", "heal", "ko"]) {
    assert.match(src, new RegExp("\\b" + name + ":\\s*\\(t\\)\\s*=>"), "recette " + name + " manquante");
  }
});

test("FA_SFX expose has() pour l'introspection des recettes", () => {
  assert.match(src, /has:\s*\(/, "FA_SFX.has manquant");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-force-exit test/sfx-recipes.test.js`
Expected: FAIL — recette `hit` manquante.

- [ ] **Step 3: Add the recipes**

Dans `sfx.js`, dans l'objet `RECIPES` (juste après la ligne `defeat: ...`, avant le `};` de fermeture ~ligne 62), ajouter :

```js
    // --- Combat (courts, calés sous le master 0.22 ; cadence ~165 ms) ---
    hit:     (t) => tone(t, { type: "square", f: 220, f2: 90, dur: 0.06, peak: 0.34 }),
    crit:    (t) => { tone(t, { type: "square", f: 520, f2: 180, dur: 0.09, peak: 0.5 });
                      tone(t, { type: "sine", f: 90, f2: 55, dur: 0.12, peak: 0.4 }); },
    special: (t) => { tone(t, { type: "sawtooth", f: 300, f2: 900, dur: 0.14, peak: 0.34 });
                      tone(t + 0.02, { type: "sine", f: 700, f2: 1300, dur: 0.12, peak: 0.2 }); },
    heal:    (t) => tone(t, { type: "sine", f: 500, f2: 760, dur: 0.13, peak: 0.32 }),
    ko:      (t) => { tone(t, { type: "sawtooth", f: 160, f2: 60, dur: 0.22, peak: 0.44 });
                      tone(t + 0.04, { type: "sine", f: 80, f2: 45, dur: 0.26, peak: 0.34 }); },
```

- [ ] **Step 4: Add `has()` to the exported API**

Dans `sfx.js`, remplacer la ligne d'export (~91) :

```js
  window.FA_SFX = { play, setEnabled };
```

par :

```js
  window.FA_SFX = { play, setEnabled, has: (n) => Object.prototype.hasOwnProperty.call(RECIPES, n) };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test --test-force-exit test/sfx-recipes.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add sfx.js test/sfx-recipes.test.js
git commit -m "feat(sfx): recettes de combat (hit/crit/special/heal/ko) + has()"
```

---

### Task 3: Couche de peinture DOM `FA_JUICE` + CSS

**Files:**
- Create: `juice.js`
- Modify: `styles.css` (ajout à la fin de la section animations combat, après la ligne `.dead {...}` ~470)
- Test: `test/juice-play.test.js`

**Interfaces:**
- Consumes: `window.FA_JUICE_UI` (Task 1), `window.FA_SFX` (Task 2), DOM.
- Produces: `window.FA_JUICE = { hit, heal, ko, lunge, hitStopMs }`
  - `hit(cardEl: Element, { dmg, maxHp, kind: "atk"|"sp", crit, boardEl })` — chiffre + flash/shake + étincelles + screen-shake + son.
  - `heal(cardEl: Element, { amount })` — chiffre vert + glow + son.
  - `ko(cardEl: Element)` — burst KO + son.
  - `lunge(cardEl: Element, side: "p1"|"p2")` — fente de l'attaquant.
  - `hitStopMs(crit: boolean) → number` — ms à ajouter au delay du stepper (0 si reduced-motion / non-crit).

- [ ] **Step 1: Write the failing test**

Create `test/juice-play.test.js` (source-level, comme `finisher-play.test.js`) :

```js
// test/juice-play.test.js
// juice.js touche le DOM (matchMedia, éléments) → non exécutable en node:test ;
// on verrouille ses invariants au niveau source (modèle finisher-play.test.js).
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "juice.js"), "utf8");

test("expose l'API impérative window.FA_JUICE", () => {
  assert.match(src, /window\.FA_JUICE\s*=/, "export window.FA_JUICE manquant");
  for (const fn of ["hit", "heal", "ko", "lunge", "hitStopMs"]) {
    assert.match(src, new RegExp("function " + fn + "\\s*\\("), "fonction " + fn + " manquante");
  }
});

test("respecte prefers-reduced-motion", () => {
  assert.match(src, /prefers-reduced-motion/, "garde reduced-motion manquant");
});

test("délègue les intensités à FA_JUICE_UI (pas de duplication)", () => {
  assert.match(src, /FA_JUICE_UI/, "juice.js doit consommer le module pur");
  assert.match(src, /shakeIntensity/, "usage de shakeIntensity attendu");
  assert.match(src, /particleSpec/, "usage de particleSpec attendu");
});

test("joue le son via FA_SFX", () => {
  assert.match(src, /FA_SFX/, "juice.js doit jouer le son de combat");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-force-exit test/juice-play.test.js`
Expected: FAIL — `ENOENT` (`juice.js` inexistant).

- [ ] **Step 3: Write `juice.js`**

Create `juice.js` :

```js
/* ============================================================
   FRACTAL ARENA — Juice de combat (couche de peinture DOM).
   API impérative hors React (modèle FA_FINISHER) : chaque coup
   déclenche chiffre flottant + flash/shake carte + gerbe
   d'étincelles + screen-shake du board + son. Tout en try/catch
   silencieux : un effet raté ne casse jamais la boucle de combat.
   Intensités pures → FA_JUICE_UI (testable). Son → FA_SFX.
   ============================================================ */
(function () {
  "use strict";
  if (typeof window === "undefined") return;

  const UI = window.FA_JUICE_UI;

  function reduced() {
    return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function sfx(name) {
    if (window.FA_SFX) { try { window.FA_SFX.play(name); } catch (e) {} }
  }
  function artOf(cardEl) {
    return cardEl && cardEl.querySelector ? cardEl.querySelector(".art") : null;
  }

  // Chiffre flottant (reprend .dmg-float ; classe .crit pour l'emphase).
  function floatText(cardEl, text, color, crit) {
    const art = artOf(cardEl);
    if (!art) return;
    const el = document.createElement("div");
    el.className = crit ? "dmg-float crit" : "dmg-float";
    el.textContent = text;
    el.style.color = color;
    el.style.left = (30 + Math.random() * 40) + "%";
    el.style.top = "40%";
    art.appendChild(el);
    setTimeout(() => el.remove(), crit ? 1100 : 980);
  }

  function flashShake(cardEl) {
    if (!cardEl) return;
    cardEl.classList.remove("shake", "flash"); void cardEl.offsetWidth;
    cardEl.classList.add("shake", "flash");
    setTimeout(() => cardEl.classList.remove("shake", "flash"), 360);
  }

  // Gerbe d'étincelles au point d'impact (divs CSS auto-détruits).
  function sparks(cardEl, spec) {
    if (reduced()) return;
    const art = artOf(cardEl);
    if (!art) return;
    for (let i = 0; i < spec.count; i++) {
      const p = document.createElement("div");
      p.className = "jspark";
      const ang = (i / spec.count) * Math.PI * 2 + Math.random() * 0.6;
      const d = spec.spread * (0.5 + Math.random() * 0.5);
      p.style.setProperty("--dx", (Math.cos(ang) * d).toFixed(1) + "px");
      p.style.setProperty("--dy", (Math.sin(ang) * d).toFixed(1) + "px");
      p.style.background = spec.color;
      p.style.boxShadow = "0 0 6px 1px " + spec.color;
      art.appendChild(p);
      setTimeout(() => p.remove(), 460);
    }
  }

  // Screen-shake du board, intensité ∈ [0,1] → amplitude px via --shake.
  function screenShake(boardEl, intensity) {
    if (!boardEl || reduced() || intensity <= 0) return;
    const amp = (3 + intensity * 7).toFixed(1); // 3..10 px
    boardEl.style.setProperty("--shake", amp + "px");
    boardEl.classList.remove("arena-shake"); void boardEl.offsetWidth;
    boardEl.classList.add("arena-shake");
    setTimeout(() => boardEl.classList.remove("arena-shake"), 320);
  }

  // Fente de l'attaquant (remplace l'ancien animLunge dupliqué).
  function lunge(cardEl, side) {
    if (!cardEl || reduced()) return;
    const cls = side === "p1" ? "lunge-l" : "lunge-r";
    cardEl.classList.remove(cls); void cardEl.offsetWidth; cardEl.classList.add(cls);
    setTimeout(() => cardEl.classList.remove(cls), 380);
  }

  function hit(cardEl, o) {
    try {
      o = o || {};
      const crit = !!o.crit;
      const kind = o.kind === "sp" ? "sp" : "atk";
      const color = crit ? "var(--gold)" : kind === "sp" ? "var(--forge)" : "var(--alert)";
      floatText(cardEl, "-" + o.dmg, color, crit);
      flashShake(cardEl);
      const spec = UI ? UI.particleSpec(kind, crit) : { count: 6, color: color, spread: 22 };
      sparks(cardEl, spec);
      const inten = UI ? UI.shakeIntensity(o.dmg, o.maxHp, crit) : (crit ? 1 : 0);
      screenShake(o.boardEl, inten);
      sfx(crit ? "crit" : kind === "sp" ? "special" : "hit");
    } catch (e) {}
  }

  function heal(cardEl, o) {
    try {
      o = o || {};
      floatText(cardEl, "+" + o.amount, "var(--success)", false);
      const art = artOf(cardEl);
      if (art && !reduced()) {
        art.classList.remove("heal-glow"); void art.offsetWidth; art.classList.add("heal-glow");
        setTimeout(() => art.classList.remove("heal-glow"), 620);
      }
      sfx("heal");
    } catch (e) {}
  }

  function ko(cardEl) {
    try {
      const art = artOf(cardEl);
      if (art && !reduced()) {
        art.classList.remove("ko-burst"); void art.offsetWidth; art.classList.add("ko-burst");
        setTimeout(() => art.classList.remove("ko-burst"), 520);
      }
      sfx("ko");
    } catch (e) {}
  }

  // ms de hit-stop à ajouter au delay du stepper (0 si reduced-motion / non-crit).
  function hitStopMs(crit) {
    return (crit && !reduced()) ? 90 : 0;
  }

  window.FA_JUICE = { hit, heal, ko, lunge, hitStopMs };
})();
```

- [ ] **Step 4: Add the CSS**

Dans `styles.css`, juste après la ligne `.dead { ... }` (~470), ajouter :

```css
/* ---- Juice de combat ---- */
.dmg-float.crit {
  font-size: 32px;
  text-shadow: 0 0 12px rgba(255,230,0,0.9), 0 2px 8px rgba(0,0,0,0.85);
}
.jspark {
  position: absolute; z-index: 19; left: 50%; top: 45%;
  width: 4px; height: 4px; border-radius: 50%; pointer-events: none;
  animation: jspark 0.44s ease-out forwards;
}
@keyframes jspark {
  0%   { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(calc(-50% + var(--dx, 0px)), calc(-50% + var(--dy, 0px))) scale(0.2); opacity: 0; }
}
.arena-shake { animation: arenaShake 0.3s cubic-bezier(.36,.07,.19,.97); }
@keyframes arenaShake {
  10%,90%     { transform: translate(calc(var(--shake, 6px) * -0.2), 0); }
  20%,80%     { transform: translate(calc(var(--shake, 6px) * 0.3), 0); }
  30%,50%,70% { transform: translate(calc(var(--shake, 6px) * -0.6), calc(var(--shake, 6px) * 0.2)); }
  40%,60%     { transform: translate(var(--shake, 6px), calc(var(--shake, 6px) * -0.2)); }
}
.heal-glow { animation: healGlow 0.6s ease-out; }
@keyframes healGlow {
  0%   { box-shadow: inset 0 0 0 color-mix(in srgb, var(--success) 0%, transparent); }
  30%  { box-shadow: inset 0 0 30px color-mix(in srgb, var(--success) 55%, transparent); }
  100% { box-shadow: inset 0 0 0 color-mix(in srgb, var(--success) 0%, transparent); }
}
.ko-burst { animation: koBurst 0.5s ease-out; }
@keyframes koBurst {
  0%   { filter: brightness(3) saturate(0); }
  30%  { filter: brightness(2.2) saturate(0.3); }
  100% { filter: brightness(1) saturate(1); }
}
@media (prefers-reduced-motion: reduce) {
  .jspark, .arena-shake, .heal-glow, .ko-burst { animation: none; }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test --test-force-exit test/juice-play.test.js`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add juice.js styles.css test/juice-play.test.js
git commit -m "feat(juice): couche DOM FA_JUICE (impact/shake/étincelles/KO) + CSS"
```

---

### Task 4: Câbler la Fosse (`fosse.jsx`)

**Files:**
- Modify: `fosse.jsx` (refs ~114-120 ; supprimer helpers ~140-166 ; board `.panel.oct` ~349 ; switch ~228-252)
- Test: `test/juice-wiring.test.js`

**Interfaces:**
- Consumes: `window.FA_JUICE` (Task 3).
- Produces: rien (câblage interne).

- [ ] **Step 1: Write the failing test**

Create `test/juice-wiring.test.js` :

```js
// test/juice-wiring.test.js
// Les .jsx sont transformés par Babel-in-browser (non requérables en node) →
// on verrouille le câblage au niveau source, comme arene-replay-spoiler.test.js.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

test("fosse.jsx utilise FA_JUICE et ne redéfinit plus les helpers dupliqués", () => {
  const src = read("fosse.jsx");
  assert.match(src, /FA_JUICE\.hit/, "fosse doit appeler FA_JUICE.hit");
  assert.match(src, /FA_JUICE\.heal/, "fosse doit appeler FA_JUICE.heal");
  assert.match(src, /FA_JUICE\.ko/, "fosse doit appeler FA_JUICE.ko");
  assert.match(src, /hitStopMs/, "fosse doit appliquer le hit-stop");
  assert.match(src, /boardRef/, "fosse doit passer le board pour le screen-shake");
  assert.ok(!/function floatText\s*\(/.test(src), "floatText dupliqué doit être supprimé");
  assert.ok(!/function animHit\s*\(/.test(src), "animHit dupliqué doit être supprimé");
  assert.ok(!/function animLunge\s*\(/.test(src), "animLunge dupliqué doit être supprimé");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-force-exit test/juice-wiring.test.js`
Expected: FAIL — `FA_JUICE.hit` absent (fosse pas encore câblée).

- [ ] **Step 3: Add `boardRef` alongside the other refs**

Dans `fosse.jsx`, après la ligne `const p2Refs = useRef([]);` (~120), ajouter :

```js
  const boardRef = useRef(null);
```

- [ ] **Step 4: Delete the three duplicated helpers**

Dans `fosse.jsx`, supprimer entièrement les fonctions `floatText`, `animHit`, `animLunge` (bloc ~140-166), c'est-à-dire de :

```js
  function floatText(cardEl, text, color) {
```

jusqu'à la fin de :

```js
  function animLunge(side, idx) {
    const el = (side === "p1" ? p1Refs : p2Refs).current[idx];
    if (!el) return;
    const cls = side === "p1" ? "lunge-l" : "lunge-r";
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 380);
  }
```

(Laisser `function stopBattle()` et le reste intacts.)

- [ ] **Step 5: Attach `boardRef` to the arena board**

Dans `fosse.jsx`, la ligne du board (~349) :

```jsx
      <div className="panel oct" style={{ position: "relative", overflow: "hidden", border: "1px solid var(--line)", padding: "26px 22px 22px" }}>
```

devient :

```jsx
      <div ref={boardRef} className="panel oct" style={{ position: "relative", overflow: "hidden", border: "1px solid var(--line)", padding: "26px 22px 22px" }}>
```

- [ ] **Step 6: Rewire the `atk/sp/crit` case**

Dans `fosse.jsx` `stepBattle`, remplacer le bloc `case "atk": case "sp": case "crit":` (~228-240) :

```js
      case "atk":
      case "sp":
      case "crit": {
        animLunge(ev.side, ev.idx);
        animHit(ev.tside, ev.tidx);
        const tEl = (ev.tside === "p1" ? p1Refs : p2Refs).current[ev.tidx];
        floatText(tEl, "-" + ev.dmg, ev.crit ? "var(--gold)" : ev.t === "sp" ? "var(--forge)" : "var(--alert)");
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        const key = ev.crit ? "L_CRIT" : ev.t === "sp" ? "L_SP" : "L_ATK";
        log(I18N.t(key, ev.name, ev.tname, ev.dmg), ev.crit ? "lc-gold" : ev.t === "sp" ? "lc-purple" : "lc-red");
        if (ev.down) log(I18N.t("L_DOWN", ev.tname), "lc-yellow");
        break;
      }
```

par :

```js
      case "atk":
      case "sp":
      case "crit": {
        const J = window.FA_JUICE;
        const aEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
        const tEl = (ev.tside === "p1" ? p1Refs : p2Refs).current[ev.tidx];
        const tLive = (ev.tside === "p1" ? ev.state.p1 : ev.state.p2)[ev.tidx];
        if (J) {
          J.lunge(aEl, ev.side);
          J.hit(tEl, { dmg: ev.dmg, maxHp: tLive ? tLive.maxHp : 0, kind: ev.t === "sp" ? "sp" : "atk", crit: ev.crit, boardEl: boardRef.current });
        }
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        const key = ev.crit ? "L_CRIT" : ev.t === "sp" ? "L_SP" : "L_ATK";
        log(I18N.t(key, ev.name, ev.tname, ev.dmg), ev.crit ? "lc-gold" : ev.t === "sp" ? "lc-purple" : "lc-red");
        if (ev.down) { if (J) J.ko(tEl); log(I18N.t("L_DOWN", ev.tname), "lc-yellow"); }
        if (J) delay += J.hitStopMs(ev.crit) / spd;
        break;
      }
```

- [ ] **Step 7: Rewire the `heal` case**

Dans `fosse.jsx` `stepBattle`, remplacer le bloc `case "heal":` (~245-252) :

```js
      case "heal": {
        const hEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
        floatText(hEl, "+" + ev.heal, "var(--success)");
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        log(I18N.t("L_HEAL", ev.name, ev.heal), "lc-green");
        delay = baseDelay * 0.5 / spd;
        break;
      }
```

par :

```js
      case "heal": {
        const hEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
        if (window.FA_JUICE) window.FA_JUICE.heal(hEl, { amount: ev.heal });
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        log(I18N.t("L_HEAL", ev.name, ev.heal), "lc-green");
        delay = baseDelay * 0.5 / spd;
        break;
      }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test --test-force-exit test/juice-wiring.test.js`
Expected: PASS (1 test).

- [ ] **Step 9: Commit**

```bash
git add fosse.jsx test/juice-wiring.test.js
git commit -m "feat(juice): câbler la Fosse sur FA_JUICE (supprime les helpers dupliqués)"
```

---

### Task 5: Câbler la Campagne (`campaign.jsx`)

**Files:**
- Modify: `campaign.jsx` (refs ~130-131 ; supprimer helpers ~149-173 ; board `.panel.oct` ~298 ; switch ~217-239)
- Test: `test/juice-wiring.test.js` (étendre)

**Interfaces:**
- Consumes: `window.FA_JUICE` (Task 3).
- Produces: rien (câblage interne).

- [ ] **Step 1: Extend the wiring test (failing)**

Dans `test/juice-wiring.test.js`, ajouter un test :

```js
test("campaign.jsx utilise FA_JUICE et ne redéfinit plus les helpers dupliqués", () => {
  const src = read("campaign.jsx");
  assert.match(src, /FA_JUICE\.hit/, "campaign doit appeler FA_JUICE.hit");
  assert.match(src, /FA_JUICE\.heal/, "campaign doit appeler FA_JUICE.heal");
  assert.match(src, /FA_JUICE\.ko/, "campaign doit appeler FA_JUICE.ko");
  assert.match(src, /hitStopMs/, "campaign doit appliquer le hit-stop");
  assert.match(src, /boardRef/, "campaign doit passer le board pour le screen-shake");
  assert.ok(!/function floatText\s*\(/.test(src), "floatText dupliqué doit être supprimé");
  assert.ok(!/function animHit\s*\(/.test(src), "animHit dupliqué doit être supprimé");
  assert.ok(!/function animLunge\s*\(/.test(src), "animLunge dupliqué doit être supprimé");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-force-exit test/juice-wiring.test.js`
Expected: FAIL — nouveau test échoue (campaign pas encore câblée).

- [ ] **Step 3: Add `boardRef`**

Dans `campaign.jsx`, après `const p2Refs = useRef([]);` (~131), ajouter :

```js
  const boardRef = useRef(null);
```

- [ ] **Step 4: Delete the three duplicated helpers**

Dans `campaign.jsx`, supprimer entièrement `floatText`, `animHit`, `animLunge` (bloc ~149-173), de :

```js
  function floatText(cardEl, text, color) {
```

jusqu'à la fin de :

```js
  function animLunge(side, idx) {
    const el = (side === "p1" ? p1Refs : p2Refs).current[idx];
    if (!el) return;
    const cls = side === "p1" ? "lunge-l" : "lunge-r";
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 380);
  }
```

- [ ] **Step 5: Attach `boardRef` to the arena board**

Dans `campaign.jsx`, la ligne du board (~298) :

```jsx
      <div className="panel oct" style={{ position: "relative", overflow: "hidden", border: "1px solid var(--line)", padding: "26px 22px 22px" }}>
```

devient :

```jsx
      <div ref={boardRef} className="panel oct" style={{ position: "relative", overflow: "hidden", border: "1px solid var(--line)", padding: "26px 22px 22px" }}>
```

- [ ] **Step 6: Rewire the `atk/sp/crit` case**

Dans `campaign.jsx` `stepBattle`, remplacer le bloc `case "atk": case "sp": case "crit":` (~217-227) :

```js
      case "atk": case "sp": case "crit": {
        animLunge(ev.side, ev.idx);
        animHit(ev.tside, ev.tidx);
        const tEl = (ev.tside === "p1" ? p1Refs : p2Refs).current[ev.tidx];
        floatText(tEl, "-" + ev.dmg, ev.crit ? "var(--gold)" : ev.t === "sp" ? "var(--forge)" : "var(--alert)");
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        const key = ev.crit ? "L_CRIT" : ev.t === "sp" ? "L_SP" : "L_ATK";
        log(I18N.t(key, ev.name, ev.tname, ev.dmg), ev.crit ? "lc-gold" : ev.t === "sp" ? "lc-purple" : "lc-red");
        if (ev.down) log(I18N.t("L_DOWN", ev.tname), "lc-yellow");
        break;
      }
```

par :

```js
      case "atk": case "sp": case "crit": {
        const J = window.FA_JUICE;
        const aEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
        const tEl = (ev.tside === "p1" ? p1Refs : p2Refs).current[ev.tidx];
        const tLive = (ev.tside === "p1" ? ev.state.p1 : ev.state.p2)[ev.tidx];
        if (J) {
          J.lunge(aEl, ev.side);
          J.hit(tEl, { dmg: ev.dmg, maxHp: tLive ? tLive.maxHp : 0, kind: ev.t === "sp" ? "sp" : "atk", crit: ev.crit, boardEl: boardRef.current });
        }
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        const key = ev.crit ? "L_CRIT" : ev.t === "sp" ? "L_SP" : "L_ATK";
        log(I18N.t(key, ev.name, ev.tname, ev.dmg), ev.crit ? "lc-gold" : ev.t === "sp" ? "lc-purple" : "lc-red");
        if (ev.down) { if (J) J.ko(tEl); log(I18N.t("L_DOWN", ev.tname), "lc-yellow"); }
        if (J) delay += J.hitStopMs(ev.crit) / spd;
        break;
      }
```

- [ ] **Step 7: Rewire the `heal` case**

Dans `campaign.jsx` `stepBattle`, remplacer le bloc `case "heal":` (~232-239) :

```js
      case "heal": {
        const hEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
        floatText(hEl, "+" + ev.heal, "var(--success)");
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        log(I18N.t("L_HEAL", ev.name, ev.heal), "lc-green");
        delay = baseDelay * 0.5 / spd;
        break;
      }
```

par :

```js
      case "heal": {
        const hEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
        if (window.FA_JUICE) window.FA_JUICE.heal(hEl, { amount: ev.heal });
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        log(I18N.t("L_HEAL", ev.name, ev.heal), "lc-green");
        delay = baseDelay * 0.5 / spd;
        break;
      }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `node --test --test-force-exit test/juice-wiring.test.js`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add campaign.jsx test/juice-wiring.test.js
git commit -m "feat(juice): câbler la Campagne sur FA_JUICE (supprime les helpers dupliqués)"
```

---

### Task 6: Déclarer les scripts + bump de version dans `index.html`

**Files:**
- Modify: `index.html` (scripts ~124-127 ; toutes les occurrences `?v=81`)
- Test: `test/juice-play.test.js` (étendre)

**Interfaces:**
- Consumes: `juice-ui.js`, `juice.js`.
- Produces: chargement navigateur des deux modules (juice-ui AVANT juice, tous deux APRÈS sfx.js).

- [ ] **Step 1: Extend the test (failing)**

Dans `test/juice-play.test.js`, ajouter :

```js
test("index.html déclare juice-ui.js avant juice.js, après sfx.js, sans type=module", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  assert.match(html, /<script src="juice-ui\.js\?v=\d+"><\/script>/, "juice-ui.js non déclaré");
  assert.match(html, /<script src="juice\.js\?v=\d+"><\/script>/, "juice.js non déclaré");
  const iSfx = html.indexOf('src="sfx.js');
  const iUi = html.indexOf('src="juice-ui.js');
  const iJuice = html.indexOf('src="juice.js');
  assert.ok(iSfx > -1 && iUi > iSfx, "juice-ui.js doit être chargé APRÈS sfx.js");
  assert.ok(iJuice > iUi, "juice.js doit être chargé APRÈS juice-ui.js");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-force-exit test/juice-play.test.js`
Expected: FAIL — `juice-ui.js non déclaré`.

- [ ] **Step 3: Add the two script tags**

Dans `index.html`, juste après la ligne `<script src="finisher.js?v=81"></script>` (~126), ajouter :

```html
  <script src="juice-ui.js?v=81"></script>
  <script src="juice.js?v=81"></script>
```

- [ ] **Step 4: Bump the global asset version**

Dans `index.html`, remplacer **toutes** les occurrences de `?v=81` par `?v=82` (inclut les deux nouveaux scripts, `styles.css`, `sfx.js`, `fosse.jsx`, `campaign.jsx`, et tout le reste — le jeu utilise un numéro de version d'assets unique et global).

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test --test-force-exit test/juice-play.test.js`
Expected: PASS (5 tests). Vérifier aussi qu'aucun `?v=81` ne subsiste :

Run: `grep -c "v=81" index.html`
Expected: `0`

- [ ] **Step 6: Commit**

```bash
git add index.html test/juice-play.test.js
git commit -m "feat(juice): déclarer juice-ui/juice + bump cache-bust v82"
```

---

### Task 7: Vérification complète (tests + navigateur)

**Files:**
- Aucun (validation)

**Interfaces:**
- Consumes: tout le travail précédent.
- Produces: preuve que le juice fonctionne end-to-end.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS — toute la suite verte, dont `juice-ui`, `sfx-recipes`, `juice-play`, `juice-wiring`. (Le `--test-force-exit` est requis : `node --test` complet ne se termine jamais sinon.)

- [ ] **Step 2: Browser verification (Fosse)**

Invoquer la skill **`fractal-arena-web:verify`** (Playwright) pour lancer l'app, aller à la Fosse, lancer un combat gratuit et **observer** :
- chiffres de dégâts (crit plus gros + glow doré) ;
- gerbe d'étincelles au point d'impact ;
- screen-shake du board sur crit / gros coup uniquement (pas sur petit coup) ;
- son par coup / crit / spécial / soin / KO (audio activé dans les options) ;
- micro-gel (hit-stop) perceptible sur crit.

- [ ] **Step 3: Browser verification (Campagne + reduced-motion)**

- Lancer un combat de **Campagne** → constater le même rendu (module partagé OK).
- Activer `prefers-reduced-motion` (DevTools → Rendering → Emulate CSS prefers-reduced-motion: reduce) → relancer un combat : **plus** de shake/étincelles/hit-stop, mais chiffres + son toujours présents.

- [ ] **Step 4: Final commit (si ajustements de réglage)**

Si des valeurs ont été ajustées (intensités, durées, volumes) pendant la vérif :

```bash
git add -A
git commit -m "polish(juice): réglages après vérification navigateur"
```

---

## Self-Review (rempli par l'auteur du plan)

**Couverture du spec :**
- Module partagé `FA_JUICE` → Task 3 ; câblage Fosse+Campagne → Tasks 4-5. ✓
- Sons de combat (`FA_SFX`) → Task 2. ✓
- Hit-stop → Tasks 4-5 (`hitStopMs` + delay). ✓
- Emphase crit/KO (CSS) → Task 3. ✓
- Screen-shake crits + gros coups seulement → `shakeIntensity` (Task 1), petit coup = 0 (testé). ✓
- Impact/particules → `sparks` + `.jspark` (Task 3). ✓
- Suppression de la duplication `floatText`/`animHit`/`animLunge` → Tasks 4-5 (asserté au niveau source). ✓
- `prefers-reduced-motion` → gardes JS (Task 3) + `@media` CSS + `hitStopMs`=0. ✓
- Intégration `index.html` + cache-bust → Task 6. ✓
- Tests unitaires purs + vérif navigateur → Tasks 1/7. ✓
- PvP hors scope → non traité (conforme au spec). ✓

**Scan placeholders :** aucun TBD/TODO ; tout le code est fourni intégralement.

**Cohérence des types :** `FA_JUICE_UI.shakeIntensity(dmg,maxHp,crit)` / `particleSpec(kind,crit)` définis Task 1, consommés à l'identique Task 3. `FA_JUICE.hit/heal/ko/lunge/hitStopMs` définis Task 3, appelés à l'identique Tasks 4-5. `FA_SFX.has` défini Task 2, utilisé par les tests. Noms cohérents de bout en bout.
