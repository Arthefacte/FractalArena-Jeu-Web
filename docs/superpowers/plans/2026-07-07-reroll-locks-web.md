# Reroll avec verrous de stats (web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer les verrous de reroll (serveur PR#49, déployé) dans l'onglet Forge → Reroll : 5 toggles 🔒 (max 2), coût affiché ×1.5/verrou, verrous envoyés au serveur et visualisés dans l'aperçu avant/après.

**Architecture:** Dépôt zero-build (React via Babel in-browser, modules purs sur `window`). Helpers purs dans `forge-ui.js` (toggle, coût, diff avec flag `locked`), clés i18n `FG_LOCK_*`/erreurs, `actions.reroll(id, locks)` dans `app.jsx`, UI dans `ForgeReroll`/`RerollPreviewModal` (`screens.jsx`), cache-bust v62→v63.

**Tech Stack:** React (Babel Standalone), IIFE `window.FA_FORGE_UI`, tests `node:test` sans dépendance, serveur prod Railway.

## Global Constraints

- Dépôt : `C:\Users\PC\Documents\Arthefacte Games\Fractal Arena\fractal-arena-web`, branche **`feat/reroll-locks-web`** depuis `origin/main` (worktree recommandé, ex. `../wt-reroll-locks-web`). Ce plan est commité en préambule.
- Contrat serveur (déployé, PR#49) : `POST /forge/reroll` body `{ wallet, beast_id, locks?: string[] }` — `locks` ⊆ `["hp","atk","def","spd","mag"]`, ≤ 2, sans doublon. Réponse : `{ status:"ok", pending:true, cost, locks, next_reroll_cost, old_stats, new_stats, … }`. Erreurs : 400 `{error:"locks_invalide"}`, 400 `{error:"budget_insuffisant"}`, `{status:"insufficient_balance"}`.
- Constantes miroir : `MAX_REROLL_LOCKS = 2`, `REROLL_LOCK_MULT = 1.5`.
- ⚠️ `next_reroll_cost` serveur N'INCLUT PAS le multiplicateur de verrous — l'affichage client doit multiplier par `1.5^nb_verrous` (arrondi `Math.round` sur le produit). Le serveur reste la vérité au débit.
- Le coût de base affiché avant le 1er essai (`D.FORGE.REROLL_BASE[rarity] × (1 + 0.5 × reroll_count)`, screens.jsx:315) est une approximation PRÉEXISTANTE (le serveur compte les essais, pas les confirms) — HORS PÉRIMÈTRE : on multiplie simplement ce montant par `1.5^verrous`.
- Convention modules purs : IIFE + `window.FA_FORGE_UI` ; convention JSX : imports `window` en tête, patterns existants de `ForgeReroll`.
- i18n : clé → `{ FR, EN, ZH }` ; piège `t()` : jamais de `%` dans un template sans argument.
- Cache-bust : TOUS les `?v=62` de `index.html` → `?v=63` (aucun v62 restant).
- Tests : `node --test` depuis la racine web (se termine normalement sur CE dépôt).
- Commits en français terminés par `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 0 (préambule) : branche + plan

- [ ] **Step 1: Worktree + commit du plan**

```bash
cd "C:\Users\PC\Documents\Arthefacte Games\Fractal Arena\fractal-arena-web"
git fetch origin
git worktree add "../wt-reroll-locks-web" -b feat/reroll-locks-web origin/main
mkdir -p "../wt-reroll-locks-web/.superpowers/sdd"
cp docs/superpowers/plans/2026-07-07-reroll-locks-web.md "../wt-reroll-locks-web/docs/superpowers/plans/"
cd "../wt-reroll-locks-web"
git add docs/superpowers/plans/2026-07-07-reroll-locks-web.md
git commit -m "docs(forge): plan web reroll avec verrous

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 1: Helpers purs — `forge-ui.js` (toggle, coût, diff avec verrous)

**Files:**
- Modify: `forge-ui.js` (IIFE entière — 20 lignes actuellement)
- Test: `test/forge-ui.locks.test.js` (nouveau ; `test/forge-ui.test.js` existant ne doit pas casser)

**Interfaces:**
- Consumes: rien.
- Produces (ajouts à `window.FA_FORGE_UI`, `rerollDiff` conservé compatible) :
  - `MAX_REROLL_LOCKS = 2`, `REROLL_LOCK_MULT = 1.5`, `LOCKABLE = [{ stat:"hp", key:"base_hp", label:"HP" }, …]` (5 entrées, ordre hp/atk/def/spd/mag).
  - `toggleLock(locks, stat)` → nouveau tableau avec `stat` ajouté/retiré ; retourne **`null`** si l'ajout dépasserait `MAX_REROLL_LOCKS` (l'UI toast le refus).
  - `withLockCost(cost, nLocks)` → `Math.round(cost * Math.pow(REROLL_LOCK_MULT, nLocks))`.
  - `rerollDiff(oldStats, newStats, locks?)` → chaque row gagne `locked: bool` (`locks` en noms courts ; défaut `[]` → tous `false`, rétro-compatible).

- [ ] **Step 1: Écrire le test qui échoue**

```js
// test/forge-ui.locks.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../forge-ui.js");
const F = window.FA_FORGE_UI;

test("constantes miroir serveur", () => {
  assert.strictEqual(F.MAX_REROLL_LOCKS, 2);
  assert.strictEqual(F.REROLL_LOCK_MULT, 1.5);
  assert.deepStrictEqual(F.LOCKABLE.map((l) => l.stat), ["hp", "atk", "def", "spd", "mag"]);
  assert.deepStrictEqual(F.LOCKABLE.map((l) => l.key), ["base_hp", "base_atk", "base_def", "base_spd", "base_mag"]);
});

test("toggleLock : ajoute, retire, refuse le 3e verrou (null), n'altère pas l'entrée", () => {
  const l0 = [];
  const l1 = F.toggleLock(l0, "spd");
  assert.deepStrictEqual(l1, ["spd"]);
  assert.deepStrictEqual(l0, [], "immutabilité");
  const l2 = F.toggleLock(l1, "hp");
  assert.deepStrictEqual(l2, ["spd", "hp"]);
  assert.strictEqual(F.toggleLock(l2, "atk"), null, "3e verrou refusé");
  assert.deepStrictEqual(F.toggleLock(l2, "spd"), ["hp"], "retrait");
});

test("withLockCost : ×1.5^n arrondi sur le produit", () => {
  assert.strictEqual(F.withLockCost(1000, 0), 1000);
  assert.strictEqual(F.withLockCost(1000, 1), 1500);
  assert.strictEqual(F.withLockCost(1000, 2), 2250);
  assert.strictEqual(F.withLockCost(2250, 2), 5063, "round(2250×2.25)=5062.5→5063 (parité serveur)");
});

test("rerollDiff : flag locked par row, rétro-compatible sans 3e argument", () => {
  const o = { base_hp: 90, base_atk: 14, base_def: 4, base_spd: 11, base_mag: 16 };
  const n = { base_hp: 80, base_atk: 20, base_def: 8, base_spd: 11, base_mag: 16 };
  const rows = F.rerollDiff(o, n, ["spd", "mag"]);
  assert.deepStrictEqual(rows.map((r) => r.locked), [false, false, false, true, true]);
  assert.strictEqual(rows[0].dir, "down");
  const legacy = F.rerollDiff(o, n);
  assert.deepStrictEqual(legacy.map((r) => r.locked), [false, false, false, false, false]);
  assert.deepStrictEqual(legacy.map((r) => r.key), ["base_hp", "base_atk", "base_def", "base_spd", "base_mag"]);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/forge-ui.locks.test.js`
Expected: FAIL — `F.MAX_REROLL_LOCKS` undefined.

- [ ] **Step 3: Implémenter (remplacer l'IIFE de `forge-ui.js`)**

```js
/* FRACTAL ARENA — Forge : helpers purs (testables Node) */
(function () {
  const KEYS = [
    { stat: "hp",  key: "base_hp",  label: "HP" },
    { stat: "atk", key: "base_atk", label: "ATK" },
    { stat: "def", key: "base_def", label: "DEF" },
    { stat: "spd", key: "base_spd", label: "SPD" },
    { stat: "mag", key: "base_mag", label: "MAG" },
  ];
  // Verrous de reroll (miroir serveur forge.js — PR#49) : max 2, surcoût ×1.5/verrou.
  const MAX_REROLL_LOCKS = 2;
  const REROLL_LOCK_MULT = 1.5;

  // Ajoute/retire un verrou (immutable). Retourne null si l'ajout dépasserait le max.
  function toggleLock(locks, stat) {
    const L = Array.isArray(locks) ? locks : [];
    if (L.includes(stat)) return L.filter((s) => s !== stat);
    if (L.length >= MAX_REROLL_LOCKS) return null;
    return [...L, stat];
  }

  // Coût affiché avec verrous : arrondi sur le PRODUIT (parité formule serveur).
  function withLockCost(cost, nLocks) {
    return Math.round(cost * Math.pow(REROLL_LOCK_MULT, nLocks || 0));
  }

  function rerollDiff(oldStats, newStats, locks) {
    const o = oldStats || {}, n = newStats || {}, L = Array.isArray(locks) ? locks : [];
    return KEYS.map(({ stat, key, label }) => {
      const from = Number(o[key]) || 0;
      const to = Number(n[key]) || 0;
      const dir = to > from ? "up" : to < from ? "down" : "same";
      return { key, label, from, to, dir, locked: L.includes(stat) };
    });
  }

  window.FA_FORGE_UI = { rerollDiff, toggleLock, withLockCost, MAX_REROLL_LOCKS, REROLL_LOCK_MULT, LOCKABLE: KEYS };
})();
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test test/forge-ui.locks.test.js test/forge-ui.test.js`
Expected: PASS (nouveaux + anciens — `rerollDiff` reste rétro-compatible, l'ancien test ne connaît pas `locked` et ne doit pas casser ; s'il échoue sur un `deepStrictEqual` strict des rows, adapter L'ANCIEN test en ajoutant `locked:false` aux attendus et le noter au rapport).

- [ ] **Step 5: Commit**

```bash
git add forge-ui.js test/forge-ui.locks.test.js test/forge-ui.test.js
git commit -m "feat(forge): helpers verrous de reroll — toggle immutable, coût ×1.5^n, diff avec flag locked

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: i18n — libellés verrous + erreurs (FR/EN/ZH)

**Files:**
- Modify: `i18n.js` (insérer dans l'objet `T`, après le bloc `TAL_*` existant, avant le `};` de `T`)
- Test: `test/forge-locks-i18n.test.js` (nouveau)

**Interfaces:**
- Consumes: rien.
- Produces: clés `FG_LOCK_HINT`, `FG_LOCK_MAX`, `FG_LOCK_TAG`, `FG_ERR_LOCKS`, `FG_ERR_BUDGET` dans les 3 langues.

- [ ] **Step 1: Écrire le test qui échoue**

```js
// test/forge-locks-i18n.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = window.FA_I18N;

const LANGS = ["FR", "EN", "ZH"];
const KEYS = ["FG_LOCK_HINT", "FG_LOCK_MAX", "FG_LOCK_TAG", "FG_ERR_LOCKS", "FG_ERR_BUDGET"];

test("i18n verrous de reroll : 5 clés non vides dans les 3 langues", () => {
  for (const k of KEYS) {
    assert.ok(T[k], `clé manquante : ${k}`);
    for (const l of LANGS) assert.ok(typeof T[k][l] === "string" && T[k][l].length > 0, `${k}.${l} vide`);
  }
});

test("i18n verrous : pas de % dans les templates sans argument (piège fmt)", () => {
  // Aucune de ces clés ne prend d'argument → aucun % toléré.
  for (const k of KEYS) for (const l of LANGS) assert.ok(!T[k][l].includes("%"), `${k}.${l} contient %`);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/forge-locks-i18n.test.js`
Expected: FAIL — `clé manquante : FG_LOCK_HINT`.

- [ ] **Step 3: Insérer le bloc dans `T` (après le bloc `TAL_*`)**

```js
    // ---- Forge : verrous de reroll ----
    FG_LOCK_HINT:  { FR: "Verrouille jusqu'à 2 stats : elles ne bougeront pas (surcoût ×1.5 par verrou).", EN: "Lock up to 2 stats: they won't change (×1.5 cost per lock).", ZH: "最多锁定 2 项属性：锁定后不会改变（每个锁定费用 ×1.5）。" },
    FG_LOCK_MAX:   { FR: "2 verrous maximum", EN: "2 locks maximum", ZH: "最多锁定 2 项" },
    FG_LOCK_TAG:   { FR: "verrouillée", EN: "locked", ZH: "已锁定" },
    FG_ERR_LOCKS:  { FR: "Verrous invalides", EN: "Invalid locks", ZH: "锁定无效" },
    FG_ERR_BUDGET: { FR: "Stats trop concentrées dans les verrous — libère une stat", EN: "Too much budget locked — free up a stat", ZH: "锁定的属性占比过高——请解锁一项" },
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test test/forge-locks-i18n.test.js`
Expected: PASS (2 tests). Puis non-régression i18n : `node --test test/talents-i18n.test.js test/fosse-i18n.test.js` → PASS.

- [ ] **Step 5: Commit**

```bash
git add i18n.js test/forge-locks-i18n.test.js
git commit -m "feat(forge): i18n verrous de reroll FR/EN/ZH

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: `actions.reroll(id, locks)` — envoi des verrous + mapping d'erreurs (`app.jsx`)

**Files:**
- Modify: `app.jsx` — méthode `reroll` de l'objet `actions` (vers app.jsx:689-707 ; la localiser par `"${API_URL}/forge/reroll"`)

**Interfaces:**
- Consumes: clés i18n `FG_ERR_LOCKS`/`FG_ERR_BUDGET` (Task 2), contrat serveur (Global Constraints).
- Produces: `actions.reroll(id, locks = [])` → `Promise<{ ok, reason?, preview? }>` ; `preview` enrichi de `locks` (renvoyés par le serveur) et `cost` (coût réellement débité). La signature reste rétro-compatible (appel existant sans 2ᵉ argument).

- [ ] **Step 1: Modifier la méthode**

Dans la méthode `reroll` existante :

1. Signature : `async reroll(id)` → `async reroll(id, locks = [])`.
2. Body du fetch : `JSON.stringify({ wallet: s.wallet, beast_id: id })` → `JSON.stringify({ wallet: s.wallet, beast_id: id, locks })`.
3. Après le check `insufficient_balance` existant, mapper les nouvelles erreurs AVANT le fallback générique :

```js
      if (data.error === "locks_invalide") return { ok: false, reason: I18N.t("FG_ERR_LOCKS") };
      if (data.error === "budget_insuffisant") return { ok: false, reason: I18N.t("FG_ERR_BUDGET") };
```

(les insérer entre le check `insufficient_balance` et le check `data.status !== "ok"` génériques — adapter à la structure exacte du code en place sans rien réordonner d'autre).
4. Dans l'objet `preview` retourné, ajouter `locks: Array.isArray(data.locks) ? data.locks : []` et `cost: data.cost` aux champs existants (`old_stats`, `new_stats`, `next_reroll_cost`, …).

- [ ] **Step 2: Vérification syntaxique**

Run: `npx --yes @babel/cli --presets @babel/preset-react --out-file NUL app.jsx` (pattern validé sur ce dépôt)
Expected: exit 0. Puis `node --test` (non-régression des suites pures).

- [ ] **Step 3: Commit**

```bash
git add app.jsx
git commit -m "feat(forge): actions.reroll transmet les verrous + erreurs locks_invalide/budget_insuffisant mappées

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: UI — toggles 🔒 dans `ForgeReroll`, aperçu verrouillé, cache-bust v63

**Files:**
- Modify: `screens.jsx` — `ForgeReroll` (vers screens.jsx:309-366) et `RerollPreviewModal` (vers screens.jsx:280-307)
- Modify: `index.html` — bump global `?v=62` → `?v=63`

**Interfaces:**
- Consumes: `window.FA_FORGE_UI.{LOCKABLE, toggleLock, withLockCost, rerollDiff, MAX_REROLL_LOCKS}` (Task 1), `actions.reroll(id, locks)` (Task 3), clés i18n (Task 2), `D.eff` (stats affichées), patterns existants (`.pill`, `toast`, `cx`).
- Produces: UI complète des verrous. Aucun nouveau fichier, aucun nouveau CSS.

- [ ] **Step 1: État + toggles dans `ForgeReroll`**

Dans `ForgeReroll` (screens.jsx:309) :

1. Ajouter l'état et le reset à la sélection :

```jsx
  const [locks, setLocks] = useState([]);
```

et dans le `onClick` des cartes (ligne ~360), remplacer `onClick={() => setSel(sel === b.id ? null : b.id)}` par :

```jsx
  onClick={() => { setSel(sel === b.id ? null : b.id); setLocks([]); }}
```

2. Coût avec verrous (remplace la déclaration `cost` ligne ~315) :

```jsx
  const F = window.FA_FORGE_UI;
  const baseCost = beast ? Math.round(D.FORGE.REROLL_BASE[beast.rarity] * (1 + 0.5 * beast.reroll_count)) : 0;
  const cost = F.withLockCost(baseCost, locks.length);
```

(`balOk` continue de comparer à `cost`.)

3. Rangée de toggles sous l'en-tête, visible seulement quand une bête est sélectionnée — insérer juste après le `</div>` de l'en-tête (après la ligne ~356), avant le message `!balOk` :

```jsx
      {beast && (
        <div className="flex wrap center" style={{ gap: 6, marginBottom: 10 }}>
          <span className="mono muted" style={{ fontSize: 11 }}>{I18N.t("FG_LOCK_HINT")}</span>
          {F.LOCKABLE.map(({ stat, key, label }) => {
            const on = locks.includes(stat);
            return (
              <span key={stat} className="pill" onClick={() => {
                  const next = F.toggleLock(locks, stat);
                  if (next === null) { toast(I18N.t("FG_LOCK_MAX"), "bad"); return; }
                  setLocks(next);
                }}
                style={{ cursor: "pointer", userSelect: "none", border: on ? "1px solid var(--gold)" : undefined, color: on ? "var(--gold)" : undefined }}>
                {on ? "🔒" : "🔓"} {label} {D.eff(beast, key.replace("base_", ""))}
              </span>
            );
          })}
        </div>
      )}
```

⚠️ Vérifier la signature réelle de `D.eff` (data.js:184) : elle prend `(beast, "hp"|"atk"|…)` — si c'est une autre forme, utiliser `beast[key]` (base stat brute) à la place et le noter au rapport.

4. Passer les verrous aux essais — dans `doReroll` et `onAgain`, remplacer `await actions.reroll(sel)` par `await actions.reroll(sel, locks)`.

- [ ] **Step 2: Aperçu avec rows verrouillées (`RerollPreviewModal`)**

1. Ligne ~283 : `const rows = F.rerollDiff(preview.old_stats, preview.new_stats);` → `const rows = F.rerollDiff(preview.old_stats, preview.new_stats, preview.locks);`
2. Dans le rendu des rows (ligne ~293-297), préfixer le label des rows verrouillées et griser :

```jsx
        {rows.map((r) => [
          <span key={r.key + "l"} className="mono" style={{ fontSize: 13, opacity: r.locked ? 0.6 : 1 }}>{r.locked ? "🔒 " : ""}{r.label}</span>,
          <span key={r.key + "f"} className="mono" style={{ fontSize: 13, textAlign: "right", color: "var(--text-dim)" }}>{r.from}</span>,
          <span key={r.key + "t"} className="mono" style={{ fontSize: 13, textAlign: "right", color: r.locked ? "var(--text-dim)" : color(r.dir), opacity: r.locked ? 0.6 : 1 }}>{r.to} {r.locked ? "=" : arrow(r.dir)}</span>,
        ])}
```

3. Bouton « relancer » (ligne ~302) : le libellé doit inclure le surcoût des verrous actifs — `RerollPreviewModal` reçoit `preview` qui porte `locks` ; remplacer `I18N.t("REROLL_AGAIN", preview.next_reroll_cost || 0)` par :

```jsx
  {I18N.t("REROLL_AGAIN", F.withLockCost(preview.next_reroll_cost || 0, (preview.locks || []).length))}
```

- [ ] **Step 3: Cache-bust v63**

```bash
sed -i "s/?v=62/?v=63/g" index.html
git grep -c "?v=63" index.html && ! git grep -q "?v=62" index.html && echo "BUMP OK"
```
Expected: `BUMP OK` (35 occurrences attendues : 33 + les 2 scripts talents).

- [ ] **Step 4: Vérifications**

Run: `npx --yes @babel/cli --presets @babel/preset-react --out-file NUL screens.jsx` → exit 0.
Run: `node --test` → toutes les suites passent.

- [ ] **Step 5: Commit**

```bash
git add screens.jsx index.html
git commit -m "feat(forge): toggles de verrous dans ForgeReroll + aperçu verrouillé + cache-bust v63

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Vérification navigateur E2E + PR

**Files:** aucune création attendue (corrections éventuelles uniquement).

**Interfaces:** consomme tout ; produit la preuve visuelle + la PR `feat/reroll-locks-web` → `main` sur `Arthefacte/FractalArena-Jeu-Web`.

- [ ] **Step 1: Vérification E2E**

REQUIRED SUB-SKILL : la skill `verify` du dépôt (`.claude/skills/verify/SKILL.md`) documente le lancement et TOUS les pièges (seed localStorage avec wallet factice + `options.anim:false`, tutoriel désactivé, clics via `el.click()`, croix Modal `.btn.ghost.sm`, Escape pour la modale cadeau).

À vérifier (screenshots) :
1. Forge → Reroll : sélection d'une bête → la rangée 🔓 HP/ATK/DEF/SPD/MAG apparaît, coût de base affiché.
2. Toggle 2 verrous → pills passent 🔒/doré, coût ×2.25 affiché sur le bouton ; 3ᵉ toggle → toast « 2 verrous maximum », état inchangé.
3. Re-toggle (retrait) → coût redescend ; changement de bête sélectionnée → verrous reset à [].
4. Clic reroll sans wallet/token → toast « Wallet requis » (garde client) — le flux serveur réel n'est pas automatisable sans credentials ; le contrat est couvert par les tests serveur de la PR#49.
5. i18n EN et ZH : hint + labels traduits.
6. Console : aucune nouvelle erreur.

- [ ] **Step 2: PR**

```bash
git push -u origin feat/reroll-locks-web
gh pr create --repo Arthefacte/FractalArena-Jeu-Web --base main --head feat/reroll-locks-web \
  --title "feat(forge): verrous de stats au reroll (UI web du serveur PR#49)" \
  --body "## Résumé
- forge-ui.js : toggleLock (max 2, immutable), withLockCost (×1.5^n, parité arrondi serveur), rerollDiff avec flag locked
- ForgeReroll : rangée de toggles 🔒 par stat (reset au changement de bête), coût dynamique, refus du 3e verrou
- RerollPreviewModal : stats verrouillées 🔒 grisées, bouton relancer avec surcoût inclus
- actions.reroll(id, locks) + erreurs locks_invalide/budget_insuffisant mappées i18n
- i18n FR/EN/ZH, cache-bust v63

## Tests
- node --test : suites forge-ui.locks + forge-locks-i18n + non-régression
- Vérif navigateur E2E (toggles, coûts, refus 3e verrou, reset, i18n, garde sans wallet)

⚠️ Le serveur (PR#49) est déjà en prod — merge web sans contrainte d'ordre.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Expected: PR créée. **Ne pas merger sans accord du user** (déploiement GitHub Pages).
