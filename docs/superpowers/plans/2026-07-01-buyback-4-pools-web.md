# Buyback à 4 pools — Client web — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre le client web au modèle serveur « 4 pools de buyback » : ticker 4 jauges depuis `pools[]`, défaite « 100 % → rachat », leaderboard `[Gains, Rachat]`, nettoyage i18n, retrait du leg `/burn/status`.

**Architecture:** Repo sans bundler — JSX transpilé **in-browser** par Babel Standalone ; vanilla-JS (`data.js`, `i18n.js`) chargés en `<script>` exposant `window.FA_*`. On modifie 5 fichiers + `index.html` (cache-buster). Les `.jsx` ne sont pas Node-testables → vérif par revue ; le testable (`i18n.js` clés) est couvert par un test `node:test`.

**Tech Stack:** React (global, via Babel in-browser), vanilla JS, tests `node:test`.

## Global Constraints

- **Repo :** `fractal-arena-web`, worktree `.claude/worktrees/buyback-4pools-web`, branche `feat/buyback-4-pools-web` (base `origin/main` @ f54feda). Déployé sur GitHub Pages / fractalarena.com depuis `origin/main`.
- **Déployer AVANT le serveur** (PR #39). Le client prod actuel lit l'ancienne forme de `/buyback/status` et appelle `/burn/status`.
- **Contrat API consommé :** `GET /buyback/status` → `{ status, buyback: { buyback_wallet, countdown_hours, pools: [ {tier, total, threshold, total_bought, ...}, ×4 ] } }`. `/burn/status` supprimé (404). Leaderboard `board` : `liquidity`/`airdrop`/`burned` ne sont plus valides (fallback serveur → `wins`).
- **Labels :** « Rachat » (FR) / « Buyback » (EN) / « 回购 » (ZH). Pool label = « Rachat · <seuil> ».
- **Tests :** `node --test "test/**/*.test.js"` (41 verts actuels). Pas de `package.json`.
- **Cache-buster :** `?v=56` est **global uniforme** dans `index.html` → bump **tout** en `?v=57`.

## File Structure

- `i18n.js` — clés (vanilla, testable).
- `buyback.jsx` — ticker 4 jauges.
- `leaderboard.jsx` — onglets éco.
- `data.js` + `app.jsx` + `fosse.jsx` — affichage défaite.
- `index.html` — cache-buster.
- `test/buyback-i18n.test.js` — nouveau test des clés i18n.

---

### Task 1: `i18n.js` — clés buyback 4 pools

**Files:**
- Modify: `i18n.js:77-79` (LB_TAB_*), `i18n.js:244-247` (RES_*/BB_LIQ), `i18n.js:248` (BB_BOUGHT orphelin), `i18n.js:260` (FG_SUB)
- Test: `test/buyback-i18n.test.js` (créer)

**Interfaces:**
- Produces: clés i18n `LB_TAB_BUYBACK`, `BB_POOL_LABEL`, `RES_BUYBACK` (nouvelles) ; suppression de `LB_TAB_BURNED`, `LB_TAB_LIQUIDITY`, `LB_TAB_AIRDROP`, `RES_POOL`, `RES_BURN`, `BB_LIQ`, `BB_BOUGHT`. Consommées par Tasks 2-4.

- [ ] **Step 1: Écrire le test des clés**

Créer `test/buyback-i18n.test.js` :
```js
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const T = window.FA_I18N.T;

test("nouvelles clés présentes en FR/EN/ZH", () => {
  for (const k of ["LB_TAB_BUYBACK", "BB_POOL_LABEL", "RES_BUYBACK"]) {
    assert.ok(T[k], `${k} manquante`);
    for (const lang of ["FR", "EN", "ZH"]) assert.ok(T[k][lang], `${k}.${lang} manquante`);
  }
});

test("clés retirées absentes", () => {
  for (const k of ["LB_TAB_BURNED", "LB_TAB_LIQUIDITY", "LB_TAB_AIRDROP", "RES_POOL", "RES_BURN", "BB_LIQ", "BB_BOUGHT"]) {
    assert.ok(!T[k], `${k} devrait être supprimée`);
  }
});

test("BB_POOL_LABEL contient un placeholder %s", () => {
  assert.ok(/%s/.test(T.BB_POOL_LABEL.FR));
});

test("FG_SUB ne mentionne plus l'ancien split 70/30", () => {
  assert.ok(!/70%|Reward Pool|Mega buyback/.test(T.FG_SUB.FR));
});
```

- [ ] **Step 2: Lancer — échec attendu**

Run: `node --test test/buyback-i18n.test.js`
Expected: FAIL (nouvelles clés absentes, anciennes présentes).

- [ ] **Step 3: Onglets leaderboard (i18n.js:77-79)**

Remplacer :
```js
    LB_TAB_BURNED: { FR: "Mega buyback", EN: "Mega buyback", ZH: "超级回购" },
    LB_TAB_LIQUIDITY: { FR: "Pool", EN: "Pool", ZH: "流动性" },
    LB_TAB_AIRDROP: { FR: "Airdrop", EN: "Airdrop", ZH: "空投" },
```
par :
```js
    LB_TAB_BUYBACK: { FR: "Rachat", EN: "Buyback", ZH: "回购" },
```

- [ ] **Step 4: Défaite + ticker (i18n.js:244-248)**

Remplacer :
```js
    RES_POOL: { FR: "Pool liquidité", EN: "Liquidity pool", ZH: "流动性池" },
    RES_BURN: { FR: "Rachat", EN: "Buyback", ZH: "回购" },
    BB_RESERVE:    { FR: "Buyback", EN: "Buyback", ZH: "回购" },
    BB_LIQ:        { FR: "Mega buyback", EN: "Mega buyback", ZH: "超级回购" },
    BB_BOUGHT:     { FR: "Racheté à vie",      EN: "Bought back for life", ZH: "永久回购" },
```
par :
```js
    RES_BUYBACK:   { FR: "Rachat", EN: "Buyback", ZH: "回购" },
    BB_RESERVE:    { FR: "Buyback", EN: "Buyback", ZH: "回购" },
    BB_POOL_LABEL: { FR: "Rachat · %s", EN: "Buyback · %s", ZH: "回购 · %s" },
```
(`BB_BOUGHT` était orpheline — supprimée. `BB_RESERVE`/`BB_BOUGHT_SUB`/`BB_PROOF` conservées.)

- [ ] **Step 5: BB_TICK_TITLE (i18n.js:251-253) + FG_SUB (i18n.js:260)**

Remplacer les 3 langues de `BB_TICK_TITLE` (i18n.js:251-253) par :
```js
    BB_TICK_TITLE: { FR: "100% de chaque mise et de chaque forge rachète FRACTALARENA sur le marché, puis le verrouille à vie.",
                     EN: "100% of every bet and forge buys FRACTALARENA on the market, then locks it for life.",
                     ZH: "每次下注和锻造的 100% 都会在市场上回购 FRACTALARENA，然后永久锁定。" },
```

Remplacer `FG_SUB` (i18n.js:260) :
```js
    FG_SUB: { FR: "70% du coût → Reward Pool · 30% → Mega buyback", EN: "70% of fee → Reward Pool · 30% → Mega buyback", ZH: "费用 70% → 奖励池 · 30% → 超级回购" },
```
par :
```js
    FG_SUB: { FR: "100% du coût → rachat", EN: "100% of fee → buyback", ZH: "费用 100% → 回购" },
```

- [ ] **Step 6: Lancer**

Run: `node --test test/buyback-i18n.test.js`
Expected: PASS. Puis suite complète `node --test "test/**/*.test.js"` → aucun test cassé (les tests i18n existants ne référencent pas les clés retirées ; si l'un le fait, le corriger).

- [ ] **Step 7: Commit**

```bash
git add i18n.js test/buyback-i18n.test.js
git commit -m "feat(i18n): clés buyback 4 pools (LB_TAB_BUYBACK/BB_POOL_LABEL/RES_BUYBACK)"
```

---

### Task 2: `buyback.jsx` — ticker 4 jauges

**Files:**
- Modify: `buyback.jsx:1-6` (commentaire d'en-tête), `buyback.jsx:43-93` (`BuybackTicker`)

**Interfaces:**
- Consumes: `GET /buyback/status` → `buyback.pools[]` ; clés `BB_POOL_LABEL`, `BB_RESERVE`, `BB_BOUGHT_SUB`, `BB_PROOF`, `BB_TICK_TITLE` (Task 1). `TickerRow` + `buybackFraction` (inchangés).

- [ ] **Step 1: Réécrire l'en-tête (buyback.jsx:2-5)**

Remplacer les lignes 2-5 :
```js
// Ticker économie — deux jauges empilées sous le header :
//   🔒 Liquidité verrouillée (burn = LP-lock)   ← /burn/status
//   💰 Réserve de rachat (buyback)              ← /buyback/status
// Preuve = page d'adresse du wallet dédié de chaque jambe (pas un txid de swap épars).
```
par :
```js
// Ticker économie — 4 jauges de rachat (pools 5k/10k/25k/50k) sous le header ← /buyback/status.
// Preuve = page d'adresse du wallet de rachat partagé (pas un txid de swap épars).
```

- [ ] **Step 2: Réécrire `BuybackTicker` (buyback.jsx:43-93)**

Remplacer entièrement la fonction `BuybackTicker` par :
```js
function BuybackTicker() {
  const [bb, setBb] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      const rb = await fetch(API_URL + "/buyback/status").then((r) => r.json()).catch(() => null);
      if (!alive) return;
      if (rb && rb.buyback && Array.isArray(rb.buyback.pools)) setBb(rb.buyback);
    }
    load();
    const id = setInterval(load, 60000); // rafraîchit chaque minute
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Rien tant que les pools ne sont pas chargés — pas de bandeau vide.
  if (!bb || !bb.pools || !bb.pools.length) return null;

  const I = window.FA_I18N;
  const totalBought = bb.pools.reduce((s, p) => s + (p.total_bought || 0), 0);
  const last = bb.pools.length - 1;
  return (
    <div className="bb-ticker" title={I.t("BB_TICK_TITLE")}>
      {bb.pools.map((p, i) => (
        <TickerRow
          key={p.tier}
          kind="buy"
          icon={i === 0 ? "💰" : ""}
          label={I.t("BB_POOL_LABEL", bbFmt(p.tier))}
          total={p.total}
          threshold={p.threshold}
          wallet={i === 0 ? bb.buyback_wallet : null}
          proofLabel={I.t("BB_PROOF")}
          sub={i === last ? I.t("BB_BOUGHT_SUB", bbFmt(totalBought)) : null}
        />
      ))}
    </div>
  );
}
```
(Le wallet-preuve et l'icône 💰 ne s'affichent que sur la 1re rangée ; le sous-texte cumul sur la dernière. `TickerRow` et `buybackFraction` restent inchangés. La classe CSS `bb-row liq` devient inutilisée — non retirée, inoffensive.)

- [ ] **Step 3: Vérifier (revue JSX — pas de test Node possible)**

Relire le diff : JSX valide, plus aucune référence à `burn`/`/burn/status`/`BB_LIQ`. `grep -n "burn\|/burn/status\|BB_LIQ" buyback.jsx` → aucune occurrence.

- [ ] **Step 4: Commit**

```bash
git add buyback.jsx
git commit -m "feat(buyback): ticker 4 jauges depuis pools[], retrait leg /burn/status"
```

---

### Task 3: `leaderboard.jsx` — onglets éco `[Gains, Rachat]`

**Files:**
- Modify: `leaderboard.jsx:8-11` (`SECTIONS`)

**Interfaces:**
- Consumes: clé `LB_TAB_BUYBACK` (Task 1).

- [ ] **Step 1: Remplacer `SECTIONS.eco` (leaderboard.jsx:10)**

Remplacer :
```js
  eco: [["earned", "LB_TAB_EARNED"], ["burned", "LB_TAB_BURNED"], ["liquidity", "LB_TAB_LIQUIDITY"], ["airdrop", "LB_TAB_AIRDROP"]],
```
par :
```js
  eco: [["earned", "LB_TAB_EARNED"], ["buyback", "LB_TAB_BUYBACK"]],
```

- [ ] **Step 2: Vérifier**

`grep -n "burned\|liquidity\|airdrop\|LB_TAB_BURNED\|LB_TAB_LIQUIDITY\|LB_TAB_AIRDROP" leaderboard.jsx` → aucune occurrence. Le rendu des onglets/lignes est générique (itère `SECTIONS[section]`), rien d'autre à changer.

- [ ] **Step 3: Commit**

```bash
git add leaderboard.jsx
git commit -m "feat(leaderboard): onglets éco [Gains, Rachat] (retrait burned/liquidity/airdrop)"
```

---

### Task 4: Affichage défaite — « 100 % → rachat »

**Files:**
- Modify: `data.js:99` (retrait `DEFEAT_POOL_RATIO`), `app.jsx:576` + `app.jsx:611-616` (calcul pool/burn), `fosse.jsx:463-466` (lignes RES)

**Interfaces:**
- Consumes: clé `RES_BUYBACK` (Task 1).

- [ ] **Step 1: `data.js` — retirer la constante (ligne 99)**

Supprimer la ligne :
```js
    DEFEAT_POOL_RATIO: 0.667,
```
(Vérifier la virgule de la ligne précédente/suivante pour garder l'objet `D.ECON` valide.)

- [ ] **Step 2: `app.jsx` — branche défaite (611-616)**

Remplacer :
```js
          } else if (!free) {
            const pool = Math.floor(betAmount * D.ECON.DEFEAT_POOL_RATIO);
            const burn = betAmount - pool;
            summary.pool = pool; summary.burn = burn;
            session.net -= betAmount;
          }
```
par :
```js
          } else if (!free) {
            // Mise perdue : 100 % → rachat (réparti côté serveur dans les 4 pools).
            session.net -= betAmount;
          }
```

- [ ] **Step 3: `app.jsx` — initialiseur `summary` (ligne 576)**

Retirer `pool: 0, burn: 0, ` de l'objet `summary` (désormais inutilisés) :
```js
      const summary = { payout: 0, net: 0, xp: 0, milestone: false, luckyBonus: 0, insuranceUsed: false, betAmount, levelUps: [], rarityUps: [] };
```

- [ ] **Step 4: `fosse.jsx` — 2 lignes → 1 (463-466)**

Remplacer :
```js
              <>
                <ResRow label={I18N.t("RES_POOL")} value={fmt(data.pool)} color="var(--elec)" />
                <ResRow label={I18N.t("RES_BURN")} value={fmt(data.burn)} color="var(--alert)" />
              </>
```
par :
```js
              <ResRow label={I18N.t("RES_BUYBACK")} value={fmt(data.betAmount)} color="var(--alert)" />
```

- [ ] **Step 5: Vérifier**

`grep -rn "DEFEAT_POOL_RATIO\|summary\.pool\|summary\.burn\|data\.pool\|data\.burn\|RES_POOL\|RES_BURN" --include=*.js --include=*.jsx .` (repo-wide, hors node_modules) → aucune occurrence. (Revue JSX pour `app.jsx`/`fosse.jsx`.)

- [ ] **Step 6: Commit**

```bash
git add data.js app.jsx fosse.jsx
git commit -m "feat(défaite): affichage 100% → rachat (retrait split pool/burn)"
```

---

### Task 5: `index.html` — bump cache-buster `?v=57`

**Files:**
- Modify: `index.html` (toutes les occurrences `?v=56`)

- [ ] **Step 1: Bump global**

Remplacer **toutes** les occurrences de `?v=56` par `?v=57` dans `index.html` (CSS + tous les `<script>`). C'est un bump de version global (convention du repo : une version = un déploiement) — nécessaire car Babel in-browser + cache navigateur.

- [ ] **Step 2: Vérifier**

`grep -c "?v=56" index.html` → 0. `grep -c "?v=57" index.html` → même nombre qu'avant (toutes migrées).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "chore: bump cache-buster ?v=57"
```

---

## Self-Review (couverture spec)

- **Ticker 4 jauges (layout A)** : Task 2 (`pools.map`, wallet+cumul groupés). ✓
- **Retrait leg `/burn/status`** : Task 2. ✓
- **Défaite 1 ligne 100 %** : Task 4 (data.js + app.jsx + fosse.jsx). ✓
- **Leaderboard [Gains, Rachat]** : Task 3. ✓
- **Forge `FG_SUB` 100 %** : Task 1 (Step 5). ✓
- **i18n nettoyage + nouvelles clés** : Task 1. ✓
- **Cache-buster ?v=57** : Task 5. ✓
- **Décisions d'affichage validées** : défaite = 100 % mise (Task 4), sous-texte = somme total_bought (Task 2), jauge = total/seuil sans rebours individuel (Task 2 réutilise `TickerRow`). ✓

## Limite de vérification (repo sans build)

Les `.jsx` (buyback/leaderboard/app/fosse) ne sont pas Node-testables (Babel in-browser, pas de `package.json`). Vérif = revue de diff + `grep` de non-régression. Le testable (`i18n.js`) est couvert par `test/buyback-i18n.test.js`. Validation visuelle finale = charger la page (hors scope du plan ; à faire avant déploiement).
