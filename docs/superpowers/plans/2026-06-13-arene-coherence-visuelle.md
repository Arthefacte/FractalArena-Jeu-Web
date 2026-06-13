# Cohérence visuelle arène (rescale cosmétique) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher les stats de l'adversaire dans une fourchette crédible (85–100 % du joueur) sans rien changer au combat serveur ni à son issue.

**Architecture:** Une fonction pure `cosmeticEnemyScale(enemyTeam, playerTeam, rng)` calcule un facteur `K` par bête ennemie. `arena.jsx` applique ce K **uniquement à l'affichage** des cartes ennemies (stats + nombre HP du replay) ; la fraction de la barre HP, le combat serveur et les dégâts flottants restent réels.

**Tech Stack:** JS classique chargé en global (`window.FA_COSMETIC`), React via Babel standalone (pas d'ESM, pas de bundler), tests via `node --test` intégré (aucune dépendance).

---

## Structure des fichiers

- **Créer** `cosmetic.js` — fonction pure `cosmeticEnemyScale`, exposée en global navigateur (`window.FA_COSMETIC`) **et** exportée pour Node (`module.exports`). Une seule responsabilité : le calcul du facteur cosmétique.
- **Créer** `test/cosmetic.test.js` — tests Node de la fonction pure.
- **Modifier** `index.html` — charger `cosmetic.js` avant `arena.jsx` + bump cache `?v=24` → `?v=25`.
- **Modifier** `arena.jsx` — prop `scale` sur `CombatCard`, état `p2Scale`, calcul au début du combat, passage aux cartes ennemies.

---

## Task 1: Fonction pure `cosmeticEnemyScale`

**Files:**
- Create: `cosmetic.js`
- Test: `test/cosmetic.test.js`

- [ ] **Step 1: Écrire le test qui échoue**

Create `test/cosmetic.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");
const { cosmeticEnemyScale } = require("../cosmetic.js");

const beast = (over) => Object.assign(
  { base_hp: 600, base_atk: 90, base_def: 60, base_spd: 80, base_mag: 90, level: 1 }, over);
const rngMid = () => 0.5; // → cible = joueur × 0.925

test("ennemi plus faible → K>1, affiché ≈ 85–100% du joueur", () => {
  const player = [beast()];                  // total 920
  const enemy = [beast({ base_hp: 200, base_atk: 30, base_def: 20, base_spd: 25, base_mag: 30 })]; // 305
  const [k] = cosmeticEnemyScale(enemy, player, rngMid);
  assert.ok(k > 1, `k=${k}`);
  assert.ok(Math.abs(305 * k - 920 * 0.925) < 1, `affiche=${305 * k}`);
});

test("ennemi déjà ≥ joueur → K=1 (jamais de réduction)", () => {
  const [k] = cosmeticEnemyScale([beast({ base_hp: 2000 })], [beast()], rngMid);
  assert.strictEqual(k, 1);
});

test("profil préservé : ratio HP/ATK identique après scaling", () => {
  const [k] = cosmeticEnemyScale([beast({ base_hp: 200, base_atk: 40 })], [beast()], rngMid);
  assert.strictEqual((200 * k) / (40 * k), 200 / 40);
});

test("plafond ×12 : ennemi minuscule vs joueur énorme", () => {
  const player = [beast({ base_hp: 100000 })];
  const enemy = [beast({ base_hp: 1, base_atk: 1, base_def: 1, base_spd: 1, base_mag: 1 })];
  const [k] = cosmeticEnemyScale(enemy, player, rngMid);
  assert.strictEqual(k, 12);
});

test("enemyTotal=0 ou bête absente → K=1, pas de crash", () => {
  const player = [beast()];
  assert.deepStrictEqual(cosmeticEnemyScale([null], player, rngMid), [1]);
  assert.deepStrictEqual(
    cosmeticEnemyScale([beast({ base_hp: 0, base_atk: 0, base_def: 0, base_spd: 0, base_mag: 0 })], player, rngMid),
    [1]);
});

test("3v3 : un K par colonne", () => {
  const ks = cosmeticEnemyScale([beast(), beast(), beast()], [beast(), beast(), beast()], rngMid);
  assert.strictEqual(ks.length, 3);
});
```

- [ ] **Step 2: Lancer le test pour vérifier l'échec**

Run: `node --test test/cosmetic.test.js`
Expected: FAIL — `Cannot find module '../cosmetic.js'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

Create `cosmetic.js`:

```js
/* ============================================================
   FRACTAL ARENA — Rescale cosmétique des stats adverses (affichage arène)
   Pur, sans effet de bord. Global navigateur (window.FA_COSMETIC) + export Node.
   ============================================================ */
(function () {
  "use strict";

  function _levelMult(level) { return 1 + 0.03 * ((level || 1) - 1); }
  function _effTotal(b) {
    if (!b) return 0;
    const base = (b.base_hp || 0) + (b.base_atk || 0) + (b.base_def || 0) + (b.base_spd || 0) + (b.base_mag || 0);
    return base * _levelMult(b.level);
  }

  // Facteur cosmétique K par colonne i : remonte l'affichage de l'ennemi i vers
  // 85–100 % de la bête joueur i. Jamais de réduction (K>=1), plafonné (K<=12).
  // rng injectable pour les tests (défaut Math.random).
  function cosmeticEnemyScale(enemyTeam, playerTeam, rng) {
    rng = rng || Math.random;
    const out = [];
    const team = Array.isArray(enemyTeam) ? enemyTeam : [];
    for (let i = 0; i < team.length; i++) {
      const enemyTotal = _effTotal(team[i]);
      const playerTotal = _effTotal(playerTeam && playerTeam[i]);
      if (!(enemyTotal > 0) || !(playerTotal > 0)) { out.push(1); continue; }
      const target = playerTotal * (0.85 + rng() * 0.15); // 85–100 %
      let k = target / enemyTotal;
      if (k < 1) k = 1;     // jamais de réduction
      if (k > 12) k = 12;   // garde-fou anti-inflation
      out.push(k);
    }
    return out;
  }

  const api = { cosmeticEnemyScale };
  if (typeof window !== "undefined") window.FA_COSMETIC = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Lancer le test pour vérifier le succès**

Run: `node --test test/cosmetic.test.js`
Expected: PASS — `# pass 6`, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add cosmetic.js test/cosmetic.test.js
git commit -m "feat(arene): cosmeticEnemyScale — facteur cosmétique pur + tests"
```

---

## Task 2: Charger `cosmetic.js` dans la page + cache-bust

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Ajouter le script (avant les .jsx)**

Dans `index.html`, juste après la ligne `<script src="engine.js?v=24"></script>`, ajouter :

```html
  <script src="cosmetic.js?v=25"></script>
```

`cosmetic.js` est du JS classique : il doit être chargé **avant** `arena.jsx` (qui lit `window.FA_COSMETIC` au parse). Le placer dans le bloc « plain JS data/logic » garantit cet ordre.

- [ ] **Step 2: Bumper le cache de tous les assets**

Toujours dans `index.html`, remplacer **toutes** les occurrences de `?v=24` par `?v=25` (CSS + tous les scripts), y compris la ligne `cosmetic.js?v=25` déjà ajoutée (elle est déjà en v25). C'est la convention de cache-busting du repo à chaque déploiement.

- [ ] **Step 3: Vérification**

Run: `grep -c "?v=24" index.html`
Expected: `0` (plus aucune référence en v24).
Run: `grep -c "cosmetic.js?v=25" index.html`
Expected: `1`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "build(arene): charge cosmetic.js + bump cache v25"
```

---

## Task 3: Appliquer le facteur cosmétique aux cartes ennemies (`arena.jsx`)

**Files:**
- Modify: `arena.jsx` (lignes ~5, 38, 76, 81-84, 102, 186, 350)

> Pas de harness de test UI dans ce repo (React via Babel en navigateur). Cette tâche se vérifie **manuellement** dans le jeu (Step 6). Le cœur logique (le calcul de K) est déjà couvert par les tests de la Task 1.

- [ ] **Step 1: Exposer `cosmeticEnemyScale` dans `arena.jsx`**

Sous la ligne `const { useFA, cx, fmt, presetLabel, rarityLabel, Bar, Modal } = window;` (≈ ligne 6), ajouter :

```js
const { cosmeticEnemyScale } = window.FA_COSMETIC;
```

- [ ] **Step 2: Ajouter la prop `scale` à `CombatCard`**

Ligne ~38, remplacer la signature :

```js
function CombatCard({ meta, live, side, cref, oppMeta }) {
```

par :

```js
function CombatCard({ meta, live, side, cref, oppMeta, scale = 1 }) {
```

- [ ] **Step 3: Scaler le nombre HP affiché (la fraction de barre reste réelle)**

Ligne ~76, remplacer :

```jsx
            <span style={{ color: "var(--text)" }}>{live ? Math.max(0, Math.ceil(live.hp)) : meta.maxHp}/{live ? live.maxHp : meta.maxHp}</span>
```

par :

```jsx
            <span style={{ color: "var(--text)" }}>{Math.round((live ? Math.max(0, live.hp) : meta.maxHp) * scale)}/{Math.round((live ? live.maxHp : meta.maxHp) * scale)}</span>
```

> Ne PAS toucher à `const frac = ...` (ligne ~50) : la barre garde `live.hp / live.maxHp` réel → elle descend exactement comme avant.

- [ ] **Step 4: Scaler la ligne ATK/DEF/SPD/MAG**

Lignes ~81-84, remplacer :

```jsx
          <span>ATK {meta.atk}</span>
          <span>DEF {meta.def}</span>
          <span>SPD {meta.spd}</span>
          <span>MAG {meta.mag}</span>
```

par :

```jsx
          <span>ATK {Math.round(meta.atk * scale)}</span>
          <span>DEF {Math.round(meta.def * scale)}</span>
          <span>SPD {Math.round(meta.spd * scale)}</span>
          <span>MAG {Math.round(meta.mag * scale)}</span>
```

- [ ] **Step 5: État `p2Scale` + calcul au début du combat + passage à la carte p2**

(a) Sous `const [p2Meta, setP2Meta] = useState([null, null, null]);` (ligne ~102), ajouter :

```js
  const [p2Scale, setP2Scale] = useState([1, 1, 1]);
```

(b) Ligne ~186, remplacer :

```js
    setP2Meta(enemies.map(beastMeta));
```

par :

```js
    setP2Meta(enemies.map(beastMeta));
    setP2Scale(cosmeticEnemyScale(enemies, selectedBeasts));
```

(c) Ligne ~350 (carte du camp p2), ajouter la prop `scale` :

```jsx
                  <CombatCard key={i} side="p2" meta={p2Meta[i]} live={p2Live && p2Live[i]} oppMeta={p1Meta} scale={p2Scale[i] || 1} cref={(el) => (p2Refs.current[i] = el)} />
```

> La carte du joueur (p1, ligne ~331) ne reçoit PAS de `scale` → défaut `1`, stats joueur inchangées.

- [ ] **Step 6: Vérification manuelle dans le jeu**

1. Servir le client en local (ex. `python -m http.server` dans le repo, ou ouvrir via le serveur habituel) et ouvrir la page.
2. Lancer un combat d'arène.
3. Vérifier :
   - Les stats de la carte **adverse** (ATK/DEF/SPD/MAG + HP) sont du même ordre que les tiennes (≤ 100 %), profil crédible (HP toujours ~6-7× l'ATK).
   - La **barre HP adverse descend exactement comme avant** (vitesse/forme identiques).
   - **L'issue du combat est inchangée** (mêmes victoires/défaites, mêmes soldes) — le panneau résultat et le solde doivent être identiques à un combat équivalent avant la modif.
   - Pas d'erreur console (F12).

- [ ] **Step 7: Commit**

```bash
git add arena.jsx
git commit -m "feat(arene): applique le rescale cosmétique aux cartes adverses"
```

---

## Notes de déploiement

- Déploiement **client seul** (GitHub Pages) — aucun changement serveur, donc pas de contrainte d'ordre serveur→client cette fois.
- Le bump `?v=25` force le rechargement chez les joueurs (sinon ils gardent l'ancien `arena.jsx`/pas de `cosmetic.js` → erreur `window.FA_COSMETIC` undefined). Bien vérifier que **tous** les assets sont en v25 et que `cosmetic.js` est référencé.
