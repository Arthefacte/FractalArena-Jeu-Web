# Tour infinie (client web) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onglet « Tour » sur fractalarena.com : lancer/abandonner un run hebdo, engager 3 bêtes (PV persistés, morts définitives), rejouer le combat, encaisser les paliers, voir le top 50 — 100 % serveur-autoritaire (routes `/tower/*` LIVE, PR serveur #50 + #53).

**Architecture:** Logique pure dans `tour-ui.js` (IIFE `window.FA_TOUR_UI`, testable node) ; écran `tour.jsx` (`window.Tour`) calqué sur la campagne (sélection = `g.selected` global via `actions.toggleSelect`, `PostureSelect` partagé, rejeu via `window.AreneBattle` réutilisé tel quel) ; 5 actions `tower*` dans `app.jsx` sur le patron `campaignFight` (delta `setG`, jamais de re-fetch inutile). Le leaderboard consomme les lignes enrichies serveur `{rank, name, wallet_short, value}` — zéro logique de nom côté client.

**Tech Stack:** React 18 UMD + Babel standalone (JSX transpilé au runtime, pas de build), modules purs en `<script src>`, tests `node:test` sans aucune dépendance npm, i18n FR/EN/ZH via `window.FA_I18N`.

## Global Constraints

- Dépôt : `C:\Users\PC\Documents\Arthefacte Games\Fractal Arena\fractal-arena-web`, branche **`feat/tour-infinie-web`** depuis `origin/main` (worktree `../wt-tour-web`). Spec serveur qui fait foi : `fractal-arena-server/docs/superpowers/specs/2026-07-07-tour-infinie-design.md` (§8 pour le client).
- **Dépendance serveur** : la PR serveur **#53** (leaderboard Tour enrichi) doit être mergée/déployée avant le merge de cette PR web. Contrat API complet en tête de la Task 3.
- **Serveur-autoritaire** : le client n'envoie que `beast_ids` (3 ids, l'ordre = formation Avant/Milieu/Arrière) + `posture`. Aucun calcul de combat, de récompense ou de nom de joueur côté client.
- Modules purs : IIFE + `window.FA_XXX`, chargés en `<script src>` AVANT les `.jsx` ; les `.jsx` déclarent leurs imports en tête (`const { … } = window;`) et exportent en fin via `Object.assign(window, {…})`.
- **PIÈGE i18n `fmt`** : `t(key)` sans args ne formate PAS — un template 0-arg ne doit contenir ni `%s`/`%d` ni `%%` ; un template avec args doit avoir exactement autant de `%s`/`%d` que d'args (vérifié par le test i18n).
- **Piège scope Babel partagé** : les `.jsx` partagent le scope global — ne jamais redéclarer un nom déjà pris (`fmtFreeCountdown`, `campMeta`…) ; préfixer les helpers locaux (`Tour*`, `tour*`).
- Cache-bust : tout nouveau fichier entre avec le `?v` cible ; au moment de la PR, bump global `?v=64` → `?v=65` dans `index.html` (une passe sed, zéro résidu).
- Solde : si un débit local est nécessaire, miroir EXACT de `deductBalance` serveur : liquide d'abord, puis verrouillé.
- Tests : `node --test` (racine) — le dépôt web se termine normalement (le piège `--test-force-exit` ne concerne que le serveur).
- Commits en français `type(scope): description`, terminés par `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- **Ne pas merger la PR sans accord du user** (merge sur `main` = déploiement GitHub Pages → fractalarena.com).

---

### Task 0 (préambule) : branche + plan

- [ ] **Step 1: Worktree + commit du plan**

```bash
cd "C:\Users\PC\Documents\Arthefacte Games\Fractal Arena\fractal-arena-web"
git fetch origin
git worktree add "../wt-tour-web" -b feat/tour-infinie-web origin/main
cp docs/superpowers/plans/2026-07-08-tour-infinie-web.md "../wt-tour-web/docs/superpowers/plans/"
cd "../wt-tour-web"
git add docs/superpowers && git commit -m "docs(tour): plan client web tour infinie

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

Tout le travail suivant se fait dans `C:\Users\PC\Documents\Arthefacte Games\Fractal Arena\wt-tour-web`.

---

### Task 1: Logique pure — `tour-ui.js`

**Files:**
- Create: `tour-ui.js`
- Test: `test/tour-ui.test.js`

**Interfaces:**
- Consumes: rien (module autonome ; les fractions `hp_frac` viennent du `roster_state` serveur).
- Produces (`window.FA_TOUR_UI`) :
  - `ENTRY_COST = 2000` ; `TIERS` — miroir EXACT de la table serveur (`tower.js` §5).
  - `tiersView(bestFloor, claimed)` → `TIERS.map` + `{ reached: bool, claimed: bool }`.
  - `hpFracOf(rosterState, id)` → `0..1` (absent = 1 ; clamp).
  - `isDeadInRun(rosterState, id)` → bool (`dead` ou `hp_frac ≤ 0`).
  - `rosterRunView(roster, rosterState)` → `[{ beast, hpFrac, dead }]` (ordre du roster conservé).
  - `aliveCount(roster, rosterState)` → nombre de vivantes.
  - `validateEngage(selectedIds, roster, rosterState)` → `{ ok: true }` ou `{ ok: false, reason: "need3" | "unknown" | "dead" }` (pré-vol client, le serveur revalide).
  - `nextTier(bestFloor)` → premier palier `floor > bestFloor` ou `null` (affichage « prochain palier »).

- [ ] **Step 1: Écrire le test qui échoue**

```js
// test/tour-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../tour-ui.js");
const TU = globalThis.window.FA_TOUR_UI;

test("TIERS : miroir serveur — somme 6500 FA, 2 silver, 2 gold, étages 5..50", () => {
  assert.strictEqual(TU.ENTRY_COST, 2000);
  assert.strictEqual(TU.TIERS.length, 10);
  assert.deepStrictEqual(TU.TIERS.map((t) => t.floor), [5, 10, 15, 20, 25, 30, 35, 40, 45, 50]);
  assert.strictEqual(TU.TIERS.reduce((s, t) => s + t.fa, 0), 6500);
  assert.strictEqual(TU.TIERS.reduce((s, t) => s + t.silver, 0), 2);
  assert.strictEqual(TU.TIERS.reduce((s, t) => s + t.gold, 0), 2);
  assert.strictEqual(TU.TIERS[0].fa, 100);
  assert.strictEqual(TU.TIERS[9].fa, 1500);
});

test("tiersView : reached/claimed dérivés", () => {
  const v = TU.tiersView(23, [5, 10]);
  assert.strictEqual(v.length, 10);
  assert.deepStrictEqual(v.filter((t) => t.reached).map((t) => t.floor), [5, 10, 15, 20]);
  assert.deepStrictEqual(v.filter((t) => t.claimed).map((t) => t.floor), [5, 10]);
  // claimed_tiers null/undefined toléré (score vierge serveur)
  assert.strictEqual(TU.tiersView(0, null).filter((t) => t.reached).length, 0);
});

test("hpFracOf / isDeadInRun : absent = vivante 100 %, clamp, dead", () => {
  const rs = { a: { hp_frac: 0.42 }, b: { hp_frac: 0, dead: true }, c: { hp_frac: 1.7 }, d: { hp_frac: -0.3 } };
  assert.strictEqual(TU.hpFracOf(rs, "a"), 0.42);
  assert.strictEqual(TU.hpFracOf(rs, "zzz"), 1);
  assert.strictEqual(TU.hpFracOf(null, "zzz"), 1);
  assert.strictEqual(TU.hpFracOf(rs, "c"), 1, "clamp haut");
  assert.strictEqual(TU.hpFracOf(rs, "d"), 0, "clamp bas");
  assert.strictEqual(TU.isDeadInRun(rs, "b"), true);
  assert.strictEqual(TU.isDeadInRun(rs, "d"), true, "hp_frac ≤ 0 = morte même sans flag dead");
  assert.strictEqual(TU.isDeadInRun(rs, "a"), false);
  assert.strictEqual(TU.isDeadInRun(rs, "zzz"), false);
});

test("rosterRunView / aliveCount", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const rs = { b: { hp_frac: 0, dead: true }, c: { hp_frac: 0.5 } };
  const v = TU.rosterRunView(roster, rs);
  assert.deepStrictEqual(v.map((x) => x.beast.id), ["a", "b", "c"], "ordre du roster conservé");
  assert.strictEqual(v[0].hpFrac, 1);
  assert.strictEqual(v[1].dead, true);
  assert.strictEqual(v[2].hpFrac, 0.5);
  assert.strictEqual(TU.aliveCount(roster, rs), 2);
  assert.strictEqual(TU.aliveCount(roster, {}), 3);
});

test("validateEngage : 3 distinctes, existantes, vivantes", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const rs = { d: { hp_frac: 0, dead: true } };
  assert.deepStrictEqual(TU.validateEngage(["a", "b", "c"], roster, rs), { ok: true });
  assert.strictEqual(TU.validateEngage(["a", "b"], roster, rs).reason, "need3");
  assert.strictEqual(TU.validateEngage(["a", "a", "b"], roster, rs).reason, "need3");
  assert.strictEqual(TU.validateEngage(["a", "b", "zzz"], roster, rs).reason, "unknown");
  assert.strictEqual(TU.validateEngage(["a", "b", "d"], roster, rs).reason, "dead");
});

test("nextTier : premier palier au-dessus du meilleur étage", () => {
  assert.strictEqual(TU.nextTier(0).floor, 5);
  assert.strictEqual(TU.nextTier(5).floor, 10);
  assert.strictEqual(TU.nextTier(23).floor, 25);
  assert.strictEqual(TU.nextTier(50), null);
  assert.strictEqual(TU.nextTier(99), null);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/tour-ui.test.js`
Expected: FAIL — `Cannot read properties of undefined` (FA_TOUR_UI non défini).

- [ ] **Step 3: Implémenter `tour-ui.js`**

```js
/* ============================================================
   FRACTAL ARENA — Tour infinie : helpers purs (testables Node)
   Miroir d'affichage du serveur (tower.js) — le serveur fait foi
   pour toute décision (validation, paliers, PV). PIÈGE : garder
   TIERS/ENTRY_COST identiques au serveur (test anti-dérive Task 5).
   ============================================================ */
(function () {
  const ENTRY_COST = 2000; // re-run payant, 100 % → Buyback Reserve
  const TIERS = [
    { floor: 5,  fa: 100,  silver: 0, gold: 0 },
    { floor: 10, fa: 150,  silver: 1, gold: 0 },
    { floor: 15, fa: 250,  silver: 0, gold: 0 },
    { floor: 20, fa: 350,  silver: 0, gold: 1 },
    { floor: 25, fa: 500,  silver: 0, gold: 0 },
    { floor: 30, fa: 650,  silver: 1, gold: 0 },
    { floor: 35, fa: 800,  silver: 0, gold: 0 },
    { floor: 40, fa: 1000, silver: 0, gold: 1 },
    { floor: 45, fa: 1200, silver: 0, gold: 0 },
    { floor: 50, fa: 1500, silver: 0, gold: 0 },
  ];

  function tiersView(bestFloor, claimed) {
    const c = Array.isArray(claimed) ? claimed : [];
    const best = bestFloor | 0;
    return TIERS.map((t) => ({ ...t, reached: t.floor <= best, claimed: c.includes(t.floor) }));
  }

  function hpFracOf(rosterState, id) {
    const st = rosterState && rosterState[id];
    if (!st || typeof st.hp_frac !== "number") return 1;
    return Math.max(0, Math.min(1, st.hp_frac));
  }

  function isDeadInRun(rosterState, id) {
    const st = rosterState && rosterState[id];
    return !!(st && (st.dead || st.hp_frac <= 0));
  }

  function rosterRunView(roster, rosterState) {
    return (roster || []).map((b) => ({ beast: b, hpFrac: hpFracOf(rosterState, b.id), dead: isDeadInRun(rosterState, b.id) }));
  }

  function aliveCount(roster, rosterState) {
    return (roster || []).reduce((n, b) => n + (isDeadInRun(rosterState, b.id) ? 0 : 1), 0);
  }

  // Pré-vol client (confort UX) — le serveur revalide tout (betes_invalides).
  function validateEngage(selectedIds, roster, rosterState) {
    const ids = Array.isArray(selectedIds) ? selectedIds : [];
    if (ids.length !== 3 || new Set(ids).size !== 3) return { ok: false, reason: "need3" };
    const byId = new Set((roster || []).map((b) => b.id));
    for (const id of ids) {
      if (!byId.has(id)) return { ok: false, reason: "unknown" };
      if (isDeadInRun(rosterState, id)) return { ok: false, reason: "dead" };
    }
    return { ok: true };
  }

  function nextTier(bestFloor) {
    const best = bestFloor | 0;
    return TIERS.find((t) => t.floor > best) || null;
  }

  window.FA_TOUR_UI = { ENTRY_COST, TIERS, tiersView, hpFracOf, isDeadInRun, rosterRunView, aliveCount, validateEngage, nextTier };
})();
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test test/tour-ui.test.js`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add tour-ui.js test/tour-ui.test.js
git commit -m "feat(tour): helpers purs — paliers, PV de run, validation d'engagement

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: i18n — bloc `TOUR_*` + `NAV_TOUR` (FR/EN/ZH)

**Files:**
- Modify: `i18n.js` (ajouter le bloc dans l'objet `T`, juste après le bloc des clés `CAMP_*`)
- Test: `test/tour-i18n.test.js`

**Interfaces:**
- Consumes: `window.FA_I18N` (`T`, `t`).
- Produces: les clés listées ci-dessous, consommées par `tour.jsx` (Task 4) et la nav (Task 3).

- [ ] **Step 1: Écrire le test qui échoue**

```js
// test/tour-i18n.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;
const LANGS = ["FR", "EN", "ZH"];

// [clé, nb d'args attendus]
const KEYS = [
  ["NAV_TOUR", 0],
  ["TOUR_TITLE", 0], ["TOUR_SUB", 0],
  ["TOUR_WEEK_ENDS", 1], ["TOUR_BEST", 1], ["TOUR_FLOOR", 1],
  ["TOUR_NO_RUN", 0], ["TOUR_FREE_BADGE", 0],
  ["TOUR_START_FREE", 0], ["TOUR_START_PAID", 1], ["TOUR_START_TITLE", 0],
  ["TOUR_START_FREE_LINE", 0], ["TOUR_START_COST_LINE", 1],
  ["TOUR_START_CONFIRM", 0], ["TOUR_CANCEL", 0],
  ["TOUR_NEED3", 0], ["TOUR_GOTO_TEAM", 0], ["TOUR_FIGHT", 1],
  ["TOUR_ABANDON", 0], ["TOUR_ABANDON_TITLE", 0], ["TOUR_ABANDON_DESC", 0], ["TOUR_ABANDON_CONFIRM", 0],
  ["TOUR_ALIVE", 1], ["TOUR_DEAD_TAG", 0],
  ["TOUR_RUN_OVER", 0], ["TOUR_VICTORY", 0], ["TOUR_DEFEAT", 0],
  ["TOUR_TIER_REACHED", 1], ["TOUR_TIERS_TITLE", 0], ["TOUR_REWARDS", 0], ["TOUR_CONTINUE", 0],
  ["TOUR_LB_TITLE", 0], ["TOUR_LB_EMPTY", 0],
  ["TOUR_LOADING", 0], ["TOUR_ERROR", 0], ["TOUR_LOGIN", 0],
  ["TOUR_ERR_ACTIVE", 0], ["TOUR_ERR_NORUN", 0], ["TOUR_ERR_BALANCE", 0], ["TOUR_ERR_BEASTS", 0], ["TOUR_ERR_GENERIC", 0],
];

test("tour : toutes les clés présentes et non vides dans les 3 langues", () => {
  for (const [key] of KEYS) {
    assert.ok(T[key], `clé manquante : ${key}`);
    for (const l of LANGS) assert.ok(typeof T[key][l] === "string" && T[key][l].length > 0, `${key}.${l} vide`);
  }
});

test("tour : nombre de %s/%d conforme au nombre d'args, pas de % dans les 0-arg", () => {
  for (const [key, argc] of KEYS) {
    for (const l of LANGS) {
      const tpl = T[key][l];
      const n = (tpl.match(/%[sd]/g) || []).length;
      assert.strictEqual(n, argc, `${key}.${l} : ${n} placeholders, ${argc} attendus`);
      if (argc === 0) assert.ok(!tpl.includes("%"), `${key}.${l} : % interdit dans un template 0-arg`);
    }
  }
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/tour-i18n.test.js`
Expected: FAIL — `clé manquante : NAV_TOUR`.

- [ ] **Step 3: Ajouter le bloc dans `i18n.js`**

Dans l'objet `T`, après la dernière clé `CAMP_*`, insérer :

```js
  // ---- Tour infinie ----
  NAV_TOUR: { FR: "🗼 Tour", EN: "🗼 Tower", ZH: "🗼 高塔" },
  TOUR_TITLE: { FR: "La Tour infinie", EN: "The Infinite Tower", ZH: "无尽之塔" },
  TOUR_SUB: {
    FR: "Grimpe le plus haut possible avec tout ton roster — les PV persistent entre les étages, les morts sont définitives pour le run.",
    EN: "Climb as high as you can with your whole roster — HP carries over between floors, deaths are final for the run.",
    ZH: "带上你的全部战兽尽力攀登——生命值在层与层之间保留，阵亡在本次挑战中不可复活。",
  },
  TOUR_WEEK_ENDS: { FR: "Reset dans %s", EN: "Resets in %s", ZH: "%s后重置" },
  TOUR_BEST: { FR: "Meilleur étage : %d", EN: "Best floor: %d", ZH: "最高层数：%d" },
  TOUR_FLOOR: { FR: "Étage %d", EN: "Floor %d", ZH: "第%d层" },
  TOUR_NO_RUN: { FR: "Aucun run en cours cette semaine.", EN: "No run in progress this week.", ZH: "本周暂无进行中的挑战。" },
  TOUR_FREE_BADGE: { FR: "1 run gratuit disponible", EN: "1 free run available", ZH: "1次免费挑战可用" },
  TOUR_START_FREE: { FR: "▶ Lancer le run gratuit", EN: "▶ Start free run", ZH: "▶ 开始免费挑战" },
  TOUR_START_PAID: { FR: "▶ Nouveau run — %s FA", EN: "▶ New run — %s FA", ZH: "▶ 新挑战 — %s FA" },
  TOUR_START_TITLE: { FR: "Lancer un run", EN: "Start a run", ZH: "开始挑战" },
  TOUR_START_FREE_LINE: { FR: "Ton run gratuit de la semaine est disponible.", EN: "Your free weekly run is available.", ZH: "你本周的免费挑战可用。" },
  TOUR_START_COST_LINE: {
    FR: "Coût : %s FA — 100 pour cent vers la Buyback Reserve.",
    EN: "Cost: %s FA — 100 percent to the Buyback Reserve.",
    ZH: "费用：%s FA——全额进入回购储备。",
  },
  TOUR_START_CONFIRM: { FR: "Lancer", EN: "Start", ZH: "开始" },
  TOUR_CANCEL: { FR: "Annuler", EN: "Cancel", ZH: "取消" },
  TOUR_NEED3: { FR: "Sélectionne 3 bêtes vivantes (l'ordre = la formation).", EN: "Select 3 living beasts (order = formation).", ZH: "请选择3只存活的战兽（顺序即阵型）。" },
  TOUR_GOTO_TEAM: { FR: "Modifier l'équipe", EN: "Edit team", ZH: "编辑队伍" },
  TOUR_FIGHT: { FR: "⚔️ Combattre l'étage %d", EN: "⚔️ Fight floor %d", ZH: "⚔️ 挑战第%d层" },
  TOUR_ABANDON: { FR: "Abandonner le run", EN: "Abandon run", ZH: "放弃挑战" },
  TOUR_ABANDON_TITLE: { FR: "Abandonner ce run ?", EN: "Abandon this run?", ZH: "放弃本次挑战？" },
  TOUR_ABANDON_DESC: {
    FR: "Les paliers déjà payés restent acquis. Le roster repartira au complet au prochain run.",
    EN: "Tiers already paid are kept. Your roster starts fresh on the next run.",
    ZH: "已发放的奖励保留。下次挑战时战兽状态将完全恢复。",
  },
  TOUR_ABANDON_CONFIRM: { FR: "Oui, abandonner", EN: "Yes, abandon", ZH: "确认放弃" },
  TOUR_ALIVE: { FR: "%d vivantes", EN: "%d alive", ZH: "存活 %d" },
  TOUR_DEAD_TAG: { FR: "MORTE", EN: "DEAD", ZH: "阵亡" },
  TOUR_RUN_OVER: {
    FR: "Run terminé — moins de 3 bêtes vivantes. Reviens plus fort !",
    EN: "Run over — fewer than 3 beasts alive. Come back stronger!",
    ZH: "挑战结束——存活战兽不足3只。变强后再来！",
  },
  TOUR_VICTORY: { FR: "Étage franchi !", EN: "Floor cleared!", ZH: "通关本层！" },
  TOUR_DEFEAT: { FR: "Défaite…", EN: "Defeat…", ZH: "战败……" },
  TOUR_TIER_REACHED: { FR: "Palier étage %d", EN: "Floor %d tier", ZH: "第%d层奖励" },
  TOUR_TIERS_TITLE: { FR: "Paliers de la semaine", EN: "Weekly tiers", ZH: "每周奖励" },
  TOUR_REWARDS: { FR: "Récompenses", EN: "Rewards", ZH: "奖励" },
  TOUR_CONTINUE: { FR: "Continuer", EN: "Continue", ZH: "继续" },
  TOUR_LB_TITLE: { FR: "Top 50 de la semaine", EN: "This week's top 50", ZH: "本周前50名" },
  TOUR_LB_EMPTY: { FR: "Personne n'a encore grimpé cette semaine.", EN: "Nobody has climbed yet this week.", ZH: "本周还没有人攀登。" },
  TOUR_LOADING: { FR: "Chargement…", EN: "Loading…", ZH: "加载中……" },
  TOUR_ERROR: { FR: "Erreur de chargement.", EN: "Loading error.", ZH: "加载失败。" },
  TOUR_LOGIN: { FR: "Connecte ton wallet pour grimper la Tour.", EN: "Connect your wallet to climb the Tower.", ZH: "连接钱包以攀登高塔。" },
  TOUR_ERR_ACTIVE: { FR: "Un run est déjà en cours.", EN: "A run is already in progress.", ZH: "已有进行中的挑战。" },
  TOUR_ERR_NORUN: { FR: "Aucun run en cours.", EN: "No run in progress.", ZH: "暂无进行中的挑战。" },
  TOUR_ERR_BALANCE: { FR: "Solde insuffisant.", EN: "Insufficient balance.", ZH: "余额不足。" },
  TOUR_ERR_BEASTS: { FR: "Sélection invalide : 3 bêtes vivantes distinctes requises.", EN: "Invalid selection: 3 distinct living beasts required.", ZH: "选择无效：需要3只不同的存活战兽。" },
  TOUR_ERR_GENERIC: { FR: "Erreur serveur.", EN: "Server error.", ZH: "服务器错误。" },
```

(Note : `TOUR_START_COST_LINE` écrit « 100 pour cent » en toutes lettres — le PIÈGE `fmt` interdit `%%` conjugué au comptage strict des placeholders du test.)

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test test/tour-i18n.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add i18n.js test/tour-i18n.test.js
git commit -m "feat(tour): i18n FR/EN/ZH du bloc TOUR_* + onglet NAV_TOUR

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Actions `tower*` + câblage nav dans `app.jsx`

**Files:**
- Modify: `app.jsx` — (a) destructuration `window` ligne 7, (b) bloc d'actions après `campaignFight` (~ligne 1061), (c) `VIEWS` (~ligne 1160), (d) `tabs` de `Nav()` (~ligne 1243)

**Interfaces:**
- Consumes: routes serveur LIVE —
  - `POST /tower/start` (Bearer, body `{}`) → `{ status:"ok", free_used, cost, run:{ floor, roster_state } }` ; 400 `run_actif` / `solde_insuffisant`.
  - `POST /tower/fight` (Bearer, body `{ beast_ids:[3], posture }`) → `{ status:"ok", won, floor|null, best_floor, rewards:{fa,silver,gold,tiers[]}, run_over, roster_state, events, enemy }` ; 400 `pas_de_run` / `betes_invalides`.
  - `POST /tower/abandon` (Bearer) → `{ status:"ok" }` ; 400 `pas_de_run`.
  - `GET /tower/state` (Bearer) → `{ week_key, week_ends_at, run|null, score:{ best_floor, claimed_tiers, free_run_used, runs_paid } }`.
  - `GET /tower/leaderboard` (public) → `{ week_key, week_ends_at, top:[{ rank, name, wallet_short, value }] }` (forme PR #53).
- Produces (consommé par `tour.jsx`, Task 4) :
  - `actions.towerState()` → `{ ok, weekKey, weekEndsAt, run, score }` | `{ ok:false, reason }` (reason = code d'erreur serveur brut ou `"auth"`/`"Erreur réseau"`).
  - `actions.towerStart()` → `{ ok, freeUsed, cost, run }` | `{ ok:false, reason }` — applique le débit local (liquide puis verrouillé).
  - `actions.towerFight(selectedIds, posture)` → `{ ok, won, floor, bestFloor, rewards, runOver, rosterState, events, enemy }` | `{ ok:false, reason }` — crédite le delta local (FA liquides + tickets).
  - `actions.towerAbandon()` → `{ ok }` | `{ ok:false, reason }`.
  - `actions.towerLeaderboard()` → `{ ok, weekKey, weekEndsAt, top }` | `{ ok:false }`.
  - Onglet `tour` dans la nav + `tour: Tour` dans `VIEWS`.

- [ ] **Step 1: Imports et nav**

(a) Ligne 7, ajouter `Tour` à la destructuration :

```js
const { Team, Fosse, Arene, Forge, Wallet, Boosts, Perso, Options, ChatFab, RoomFab, Leaderboard, Quests, Campaign, Tour, LoginGate, TutorialGate, Link, Cinematique } = window;
```

(c) Dans `VIEWS` (~ligne 1160), ajouter `tour: Tour` :

```js
  const VIEWS = { team: Team, fosse: Fosse, arene: Arene, campaign: Campaign, tour: Tour, quests: Quests, forge: Forge, wallet: Wallet, boosts: Boosts, perso: Perso, leaderboard: Leaderboard, options: Options, lien: Link };
```

(d) Dans `tabs` de `Nav()` (~ligne 1243-1246), insérer `["tour", "NAV_TOUR"]` après la campagne :

```js
  const tabs = [
    ["team", "NAV_TEAM"], ["fosse", "NAV_FOSSE"], ["arene", "NAV_ARENE"], ["campaign", "NAV_CAMPAIGN"], ["tour", "NAV_TOUR"], ["quests", "NAV_QUESTS"], ["forge", "NAV_FORGE"],
    ["wallet", "NAV_WALLET"], ["boosts", "NAV_BOOSTS"], ["perso", "NAV_PERSO"], ["leaderboard", "NAV_LEADERBOARD"], ["options", "NAV_OPTIONS"],
  ];
```

- [ ] **Step 2: Bloc d'actions**

Dans l'objet `actions`, juste après la fermeture de `campaignFight` (~ligne 1061), insérer :

```js
    // ---- Tour infinie (serveur-autoritaire, routes /tower/*) ----
    // reason = code serveur brut ("run_actif", "solde_insuffisant", "pas_de_run",
    // "betes_invalides") ou "auth"/"Erreur réseau" — mappé en i18n par tour.jsx.
    async towerState() {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/tower/state`, { headers: { "Authorization": `Bearer ${s.authToken}` } });
        const data = await resp.json();
        if (!resp.ok) return { ok: false, reason: data.error || "Erreur serveur" };
        return { ok: true, weekKey: data.week_key, weekEndsAt: data.week_ends_at, run: data.run, score: data.score };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async towerStart() {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/tower/start`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` }, body: "{}",
        });
        const data = await resp.json();
        if (!resp.ok || data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        if ((data.cost || 0) > 0) {
          // Miroir EXACT de deductBalance serveur : liquide d'abord, puis verrouillé.
          setG((st) => {
            const dl = Math.min(data.cost, st.liquid);
            return { ...st, liquid: st.liquid - dl, locked: st.locked - (data.cost - dl) };
          });
        }
        return { ok: true, freeUsed: !!data.free_used, cost: data.cost || 0, run: data.run };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async towerFight(selectedIds, posture) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/tower/fight`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ beast_ids: selectedIds, posture: posture || "equilibre" }),
        });
        const data = await resp.json();
        if (!resp.ok || data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const rw = data.rewards || { fa: 0, silver: 0, gold: 0, tiers: [] };
        if ((rw.fa || 0) > 0 || (rw.silver || 0) > 0 || (rw.gold || 0) > 0) {
          // Paliers crédités serveur en FA LIQUIDES (contrairement à la campagne) + tickets.
          setG((st) => ({
            ...st,
            liquid: st.liquid + (rw.fa || 0),
            ticketsSilver: st.ticketsSilver + (rw.silver || 0),
            ticketsGold: st.ticketsGold + (rw.gold || 0),
          }));
        }
        return {
          ok: true, won: !!data.won, floor: data.floor, bestFloor: data.best_floor || 0,
          rewards: rw, runOver: !!data.run_over, rosterState: data.roster_state || {},
          events: data.events || [], enemy: data.enemy || [],
        };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async towerAbandon() {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/tower/abandon`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` }, body: "{}",
        });
        const data = await resp.json();
        if (!resp.ok || data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async towerLeaderboard() {
      try {
        const resp = await fetch(`${API_URL}/tower/leaderboard`);
        const data = await resp.json();
        if (!resp.ok) return { ok: false };
        return { ok: true, weekKey: data.week_key, weekEndsAt: data.week_ends_at, top: data.top || [] };
      } catch (e) { return { ok: false }; }
    },
```

- [ ] **Step 3: Vérification statique**

`app.jsx` est transpilé au runtime (pas de `node --check` possible). Vérifier : (1) aucune virgule manquante entre les actions (le bloc est inséré ENTRE deux propriétés de l'objet `actions`), (2) `node --test` toujours vert (aucun test ne charge app.jsx, non-régression des modules purs).

Run: `node --test`
Expected: PASS (suite complète, y compris tour-ui et tour-i18n).

- [ ] **Step 4: Commit**

```bash
git add app.jsx
git commit -m "feat(tour): actions tower* (state/start/fight/abandon/leaderboard) + onglet nav

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Écran `tour.jsx` + montage `index.html` (bump v65)

**Files:**
- Create: `tour.jsx`
- Modify: `index.html` — script `tour-ui.js` après `talents-ui.js` (~ligne 83), script `tour.jsx` après `campaign.jsx` (~ligne 104), puis bump global `?v=64` → `?v=65`

**Interfaces:**
- Consumes: `window.FA_TOUR_UI` (Task 1), clés `TOUR_*` (Task 2), `actions.tower*` (Task 3), composants partagés `Modal`, `SectionHead`, `PostureSelect`, `Bar`, `AreneBattle` (rejeu, format d'events identique arène/campagne), `actions.toggleSelect` / `g.selected` (sélection globale, ordre = formation), `FA_ARENE_UI.fmtCountdown` (échéance hebdo « 3j 14h »).
- Produces: `window.Tour` (monté par `VIEWS.tour`, Task 3).

- [ ] **Step 1: Écrire `tour.jsx`**

```jsx
/* ============================================================
   FRACTAL ARENA — Tour infinie (endgame hebdomadaire).
   Serveur-autoritaire intégral : le client envoie 3 IDs (ordre =
   formation) + posture, et rejoue les events renvoyés (AreneBattle).
   PV du run (hp_frac) = état LOCAL du run serveur, jamais g.roster.
   ============================================================ */
const { useState, useEffect } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { useFA, cx, fmt, rarityLabel, Bar, Modal, SectionHead, PostureSelect, AreneBattle } = window;
const TU = window.FA_TOUR_UI, TAU = window.FA_ARENE_UI;

const TOUR_ERRK = {
  run_actif: "TOUR_ERR_ACTIVE", pas_de_run: "TOUR_ERR_NORUN",
  solde_insuffisant: "TOUR_ERR_BALANCE", betes_invalides: "TOUR_ERR_BEASTS",
};
function tourErr(code) { return I18N.t(TOUR_ERRK[code] || "TOUR_ERR_GENERIC"); }

/* Tuile roster : art + nom + barre de PV du RUN + sélection (ordre = formation). */
function TourBeastTile({ beast, hpFrac, dead, selIdx, onToggle }) {
  const rc = D.RARITY_COLORS[beast.rarity];
  const POS = ["AV", "MI", "AR"];
  return (
    <button className="panel oct" disabled={dead} onClick={onToggle}
      style={{
        border: "1px solid " + (selIdx >= 0 ? "var(--elec)" : "var(--line)"),
        padding: 8, textAlign: "center", cursor: dead ? "not-allowed" : "pointer",
        opacity: dead ? 0.45 : 1, position: "relative",
      }}>
      {selIdx >= 0 && (
        <span className="mono" style={{ position: "absolute", top: 4, left: 4, fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "var(--elec)", color: "#03121a", fontWeight: 700 }}>
          {POS[selIdx]}
        </span>
      )}
      <div style={{ position: "relative", width: 56, height: 56, margin: "0 auto", borderRadius: 8, overflow: "hidden", background: "#0b1020", border: "1px solid " + rc }}>
        {D.ART[beast.image_key] && <img src={D.ART[beast.image_key]} alt="" draggable="false" style={{ width: "100%", height: "100%", objectFit: "cover", filter: dead ? "grayscale(1)" : "none" }} />}
        {dead && <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 22 }}>☠</span>}
      </div>
      <div className="mono" style={{ fontSize: 10, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text-dim)" }}>
        {D.displayName(beast)} · LV{beast.level}
      </div>
      <div style={{ marginTop: 3 }}><Bar frac={dead ? 0 : hpFrac} kind="hp" /></div>
      <div className="mono" style={{ fontSize: 9, color: dead ? "var(--alert)" : "var(--text)" }}>
        {dead ? I18N.t("TOUR_DEAD_TAG") : Math.round(hpFrac * 100) + "%"}
      </div>
    </button>
  );
}

/* Bandeau des 10 paliers de la semaine (✓ = payé). */
function TourTierBand({ score }) {
  const tiers = TU.tiersView(score.best_floor, score.claimed_tiers);
  return (
    <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 12 }}>
      <div className="h2" style={{ fontSize: 13, color: "var(--gold)", marginBottom: 8 }}>🏆 {I18N.t("TOUR_TIERS_TITLE")}</div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
        {tiers.map((t) => (
          <div key={t.floor} className="oct-sm" style={{
            flex: "none", minWidth: 74, padding: "8px 6px", textAlign: "center",
            border: "1px solid " + (t.claimed ? "rgba(0,240,120,0.5)" : "var(--line-soft)"),
            background: t.claimed ? "rgba(0,240,120,0.07)" : "rgba(255,255,255,0.02)",
            opacity: t.claimed ? 1 : t.reached ? 0.9 : 0.55,
          }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{I18N.t("TOUR_FLOOR", t.floor)}</div>
            <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: t.claimed ? "var(--success)" : "var(--text)" }}>{fmt(t.fa)} FA</div>
            <div style={{ fontSize: 10, minHeight: 14 }}>
              {t.silver > 0 && <span style={{ color: "var(--elec)" }}>🎟×{t.silver}</span>}
              {t.gold > 0 && <span style={{ color: "var(--gold)" }}>🎟×{t.gold}</span>}
              {t.claimed && <span style={{ color: "var(--success)", marginLeft: 3 }}>✓</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* Top 50 de la semaine — lignes enrichies serveur {rank, name, wallet_short, value}. */
function TourLeaderboard() {
  const { g, actions } = useFA();
  const [st, setSt] = useState({ loading: true, top: [], error: false });
  useEffect(() => {
    let alive = true;
    actions.towerLeaderboard().then((r) => {
      if (!alive) return;
      if (r.ok) setSt({ loading: false, top: r.top, error: false });
      else setSt({ loading: false, top: [], error: true });
    });
    return () => { alive = false; };
  }, []);
  const myShort = g.wallet ? g.wallet.slice(0, 6) + "…" + g.wallet.slice(-4) : "";
  return (
    <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 12 }}>
      <div className="h2" style={{ fontSize: 13, color: "var(--elec)", marginBottom: 8 }}>🗼 {I18N.t("TOUR_LB_TITLE")}</div>
      {st.loading && <div className="muted mono" style={{ fontSize: 12, padding: 8 }}>{I18N.t("TOUR_LOADING")}</div>}
      {st.error && <div className="muted mono" style={{ fontSize: 12, padding: 8, color: "var(--alert)" }}>{I18N.t("TOUR_ERROR")}</div>}
      {!st.loading && !st.error && (
        <div className="lb-list">
          {st.top.length === 0 && <div className="muted mono" style={{ fontSize: 12, padding: 8 }}>{I18N.t("TOUR_LB_EMPTY")}</div>}
          {st.top.map((row) => (
            <div key={row.rank} className={cx("lb-row", row.wallet_short === myShort && "mine", row.rank <= 3 && "top" + row.rank)}>
              <span className="lb-rank">#{row.rank}</span>
              <span className="lb-name">{row.name}</span>
              <span className="lb-val">{I18N.t("TOUR_FLOOR", row.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* Modale de départ (gratuit ou 2000 FA). */
function TourStartModal({ score, balance, busy, onConfirm, onClose }) {
  const free = !score.free_run_used;
  const cost = free ? 0 : TU.ENTRY_COST;
  const canPay = balance >= cost;
  return (
    <Modal onClose={onClose} accent="var(--elec)">
      <div className="h1" style={{ fontSize: 22, textAlign: "center", margin: "4px 0 12px" }}>{I18N.t("TOUR_START_TITLE")}</div>
      <div className="mono" style={{ fontSize: 13, textAlign: "center", color: free ? "var(--success)" : "var(--text-dim)", marginBottom: 16 }}>
        {free ? I18N.t("TOUR_START_FREE_LINE") : I18N.t("TOUR_START_COST_LINE", fmt(cost))}
      </div>
      {!free && !canPay && <div className="mono" style={{ fontSize: 12, textAlign: "center", color: "var(--alert)", marginBottom: 12 }}>{I18N.t("TOUR_ERR_BALANCE")}</div>}
      <div className="flex gap8">
        <button className="btn ghost block" style={{ flex: 1 }} onClick={onClose} disabled={busy}>{I18N.t("TOUR_CANCEL")}</button>
        <button className="btn btn-elec block" style={{ flex: 1 }} onClick={onConfirm} disabled={busy || (!free && !canPay)}>{I18N.t("TOUR_START_CONFIRM")}</button>
      </div>
    </Modal>
  );
}

/* Modale de résultat post-rejeu : victoire/défaite, paliers payés, run over. */
function TourResultModal({ result, onClose }) {
  const { won, rewards, runOver, floor } = result;
  return (
    <Modal onClose={onClose} accent={won ? "var(--success)" : "var(--alert)"}>
      <div className="h1" style={{ fontSize: 26, textAlign: "center", color: won ? "var(--success)" : "var(--alert)", margin: "4px 0 12px" }}>
        {won ? I18N.t("TOUR_VICTORY") : I18N.t("TOUR_DEFEAT")}
      </div>
      {rewards.tiers.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          <div className="h2" style={{ fontSize: 13, color: "var(--gold)" }}>{I18N.t("TOUR_REWARDS")}</div>
          {rewards.tiers.map((f) => (
            <div key={f} className="flex between center" style={{ padding: "8px 12px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line-soft)" }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("TOUR_TIER_REACHED", f)}</span>
              <span className="mono" style={{ fontSize: 14, fontWeight: 700, color: "var(--success)" }}>
                +{fmt((TU.TIERS.find((t) => t.floor === f) || { fa: 0 }).fa)} FA
              </span>
            </div>
          ))}
          {rewards.silver > 0 && <div className="mono" style={{ fontSize: 12, color: "var(--elec)", textAlign: "center" }}>+{rewards.silver} 🎟 Silver</div>}
          {rewards.gold > 0 && <div className="mono" style={{ fontSize: 12, color: "var(--gold)", textAlign: "center" }}>+{rewards.gold} 🎟 Gold</div>}
        </div>
      )}
      {runOver ? (
        <div className="mono" style={{ fontSize: 13, textAlign: "center", color: "var(--alert)", padding: "8px 0" }}>{I18N.t("TOUR_RUN_OVER")}</div>
      ) : won ? (
        <div className="mono" style={{ fontSize: 13, textAlign: "center", color: "var(--text-dim)", padding: "4px 0" }}>{I18N.t("TOUR_FLOOR", floor)} →</div>
      ) : null}
      <button className="btn btn-elec block lg" style={{ marginTop: 14 }} onClick={onClose}>{I18N.t("TOUR_CONTINUE")}</button>
    </Modal>
  );
}

function Tour() {
  const { g, actions, toast } = useFA();
  const [st, setSt] = useState({ loading: true, error: false, weekKey: "", weekEndsAt: 0, run: null, score: null });
  const [busy, setBusy] = useState(false);
  const [posture, setPosture] = useState("equilibre");
  const [showStart, setShowStart] = useState(false);
  const [showAbandon, setShowAbandon] = useState(false);
  const [battle, setBattle] = useState(null);   // { events, p1Team, p2Team, won, floorFought }
  const [result, setResult] = useState(null);   // TourResultModal (affichée à la fermeture du rejeu)
  const [, setTick] = useState(0);

  async function refresh() {
    const r = await actions.towerState();
    if (r.ok) setSt({ loading: false, error: false, weekKey: r.weekKey, weekEndsAt: r.weekEndsAt, run: r.run, score: r.score });
    else if (r.reason !== "auth") setSt((s) => ({ ...s, loading: false, error: true }));
    else setSt((s) => ({ ...s, loading: false }));
  }
  useEffect(() => { setSt((s) => ({ ...s, loading: true })); refresh(); }, [g.wallet, g.authToken]);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 30000); return () => clearInterval(id); }, []);

  if (!g.wallet || !g.authToken) {
    return (
      <div className="container">
        <SectionHead eyebrow="🗼 ENDGAME" title={I18N.t("TOUR_TITLE")} sub={I18N.t("TOUR_SUB")} />
        <div className="muted mono" style={{ textAlign: "center", padding: 24 }}>{I18N.t("TOUR_LOGIN")}</div>
      </div>
    );
  }
  if (st.loading) return <div className="container"><div className="muted mono" style={{ textAlign: "center", padding: 40 }}>{I18N.t("TOUR_LOADING")}</div></div>;
  if (st.error || !st.score) return <div className="container"><div className="muted mono" style={{ textAlign: "center", padding: 40, color: "var(--alert)" }}>{I18N.t("TOUR_ERROR")}</div></div>;

  const run = st.run;
  const rosterState = run ? run.roster_state : {};
  const view = TU.rosterRunView(g.roster, rosterState);
  const alive = TU.aliveCount(g.roster, rosterState);
  const engage = TU.validateEngage(g.selected, g.roster, rosterState);
  const selectedBeasts = g.selected.map((id) => g.roster.find((b) => b.id === id)).filter(Boolean);

  async function onStart() {
    if (busy) return;
    setBusy(true);
    const r = await actions.towerStart();
    setBusy(false);
    setShowStart(false);
    if (!r.ok) { toast(tourErr(r.reason), "bad"); refresh(); return; }
    setSt((s) => ({
      ...s, run: r.run,
      score: { ...s.score, free_run_used: true, runs_paid: s.score.runs_paid + (r.cost > 0 ? 1 : 0) },
    }));
  }

  async function onFight() {
    if (busy || !run) return;
    if (!engage.ok) { toast(I18N.t("TOUR_NEED3"), "bad"); return; }
    setBusy(true);
    const r = await actions.towerFight(g.selected.slice(0, 3), posture);
    setBusy(false);
    if (!r.ok) { toast(tourErr(r.reason), "bad"); refresh(); return; }
    setBattle({ events: r.events, p1Team: selectedBeasts, p2Team: r.enemy, won: r.won, floorFought: run.floor });
    setResult({ won: r.won, rewards: r.rewards, runOver: r.runOver, floor: r.floor });
    setSt((s) => ({
      ...s,
      run: r.runOver ? null : { floor: r.floor, roster_state: r.rosterState },
      score: {
        ...s.score,
        best_floor: Math.max(s.score.best_floor, r.bestFloor),
        claimed_tiers: Array.from(new Set([...(s.score.claimed_tiers || []), ...r.rewards.tiers])),
      },
    }));
  }

  async function onAbandon() {
    if (busy) return;
    setBusy(true);
    const r = await actions.towerAbandon();
    setBusy(false);
    setShowAbandon(false);
    if (!r.ok) { toast(tourErr(r.reason), "bad"); }
    refresh();
  }

  return (
    <div className="container wide">
      <SectionHead eyebrow="🗼 ENDGAME" title={I18N.t("TOUR_TITLE")} sub={I18N.t("TOUR_SUB")} />

      <div className="flex between center wrap" style={{ marginBottom: 14, gap: 10 }}>
        <span className="pill" style={{ color: "var(--gold)" }}>{I18N.t("TOUR_BEST", st.score.best_floor)}</span>
        <span className="pill mono" style={{ color: "var(--text-dim)" }}>{st.weekKey} · {I18N.t("TOUR_WEEK_ENDS", TAU.fmtCountdown(st.weekEndsAt - Date.now()))}</span>
        {!st.score.free_run_used && <span className="pill" style={{ color: "var(--success)" }}>{I18N.t("TOUR_FREE_BADGE")}</span>}
      </div>

      <div style={{ display: "grid", gap: 14, marginBottom: 14 }}>
        <TourTierBand score={st.score} />
      </div>

      {!run ? (
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 24, textAlign: "center", marginBottom: 14 }}>
          <div className="mono" style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 14 }}>{I18N.t("TOUR_NO_RUN")}</div>
          <button className="btn btn-fire lg" onClick={() => setShowStart(true)} disabled={busy}>
            {!st.score.free_run_used ? I18N.t("TOUR_START_FREE") : I18N.t("TOUR_START_PAID", fmt(TU.ENTRY_COST))}
          </button>
        </div>
      ) : (
        <div className="panel oct" style={{ border: "1px solid var(--elec)", padding: 18, marginBottom: 14 }}>
          <div className="flex between center wrap" style={{ marginBottom: 12, gap: 10 }}>
            <span className="h2" style={{ fontSize: 18, color: "var(--elec)" }}>{I18N.t("TOUR_FLOOR", run.floor)}</span>
            <span className="pill mono" style={{ fontSize: 11 }}>{I18N.t("TOUR_ALIVE", alive)}</span>
            <button className="btn ghost sm" onClick={() => setShowAbandon(true)} disabled={busy}>{I18N.t("TOUR_ABANDON")}</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8, marginBottom: 14 }}>
            {view.map(({ beast, hpFrac, dead }) => (
              <TourBeastTile key={beast.id} beast={beast} hpFrac={hpFrac} dead={dead}
                selIdx={g.selected.indexOf(beast.id)}
                onToggle={() => actions.toggleSelect(beast.id)} />
            ))}
          </div>

          <div className="flex between center wrap" style={{ gap: 12 }}>
            <PostureSelect value={posture} onChange={setPosture} disabled={busy} />
            {engage.ok
              ? <button className="btn btn-fire lg" onClick={onFight} disabled={busy}>{I18N.t("TOUR_FIGHT", run.floor)}</button>
              : <span className="mono" style={{ fontSize: 12, color: "var(--alert)" }}>{I18N.t("TOUR_NEED3")}</span>}
          </div>
        </div>
      )}

      <TourLeaderboard />

      {showStart && (
        <TourStartModal score={st.score} balance={g.liquid + g.locked} busy={busy}
          onConfirm={onStart} onClose={() => setShowStart(false)} />
      )}
      {showAbandon && (
        <Modal onClose={() => setShowAbandon(false)} accent="var(--alert)">
          <div className="h1" style={{ fontSize: 20, textAlign: "center", margin: "4px 0 10px" }}>{I18N.t("TOUR_ABANDON_TITLE")}</div>
          <div className="mono" style={{ fontSize: 12, textAlign: "center", color: "var(--text-dim)", marginBottom: 16 }}>{I18N.t("TOUR_ABANDON_DESC")}</div>
          <div className="flex gap8">
            <button className="btn ghost block" style={{ flex: 1 }} onClick={() => setShowAbandon(false)} disabled={busy}>{I18N.t("TOUR_CANCEL")}</button>
            <button className="btn btn-fire block" style={{ flex: 1 }} onClick={onAbandon} disabled={busy}>{I18N.t("TOUR_ABANDON_CONFIRM")}</button>
          </div>
        </Modal>
      )}
      {battle && (
        <AreneBattle events={battle.events} p1Team={battle.p1Team} p2Team={battle.p2Team} won={battle.won}
          opponentName={I18N.t("TOUR_FLOOR", battle.floorFought)} p1Posture={posture} p2Posture="equilibre"
          onClose={() => setBattle(null)} />
      )}
      {!battle && result && <TourResultModal result={result} onClose={() => setResult(null)} />}
    </div>
  );
}

Object.assign(window, { Tour });
```

Notes d'implémentation : (1) le rejeu `AreneBattle` s'affiche D'ABORD ; `TourResultModal` n'apparaît qu'à sa fermeture (`!battle && result`). (2) `balance` de la modale de départ = `liquid + locked` (le serveur débite liquide puis verrouillé). (3) Les PV de run affichés viennent de `run.roster_state` — jamais recalculés. (4) `g.selected` est partagé avec la Fosse/Campagne : c'est voulu (une seule équipe active dans tout le jeu).

- [ ] **Step 2: Monter dans `index.html`**

Après `<script src="talents-ui.js?v=64"></script>` (~ligne 83) :

```html
  <script src="tour-ui.js?v=64"></script>
```

Après `<script type="text/babel" src="campaign.jsx?v=64"></script>` (~ligne 104) :

```html
  <script type="text/babel" src="tour.jsx?v=64"></script>
```

(Les deux entrent en `v=64` puis sont bumpées avec tout le reste au step suivant.)

- [ ] **Step 3: Bump cache-bust v64 → v65**

```bash
sed -i "s/?v=64/?v=65/g" index.html
grep -c "?v=64" index.html   # attendu : 0
grep -c "?v=65" index.html   # attendu : ≥ 35 (tous les css/js/jsx, dont tour-ui.js et tour.jsx)
```

- [ ] **Step 4: Suite complète**

Run: `node --test`
Expected: PASS — aucune régression.

- [ ] **Step 5: Commit**

```bash
git add tour.jsx index.html
git commit -m "feat(tour): écran Tour infinie — run, attrition, paliers, top 50 (v65)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Anti-dérive serveur, E2E navigateur, PR

**Files:**
- Aucun nouveau fichier committé (script de vérification jetable).

**Interfaces:** consomme tout ; produit la PR.

- [ ] **Step 1: Anti-dérive TIERS/ENTRY_COST vs serveur (script jetable, NE PAS committer)**

```bash
node -e "
globalThis.window = {};
require('./tour-ui.js');
const TU = window.FA_TOUR_UI;
const SRV = require('C:/Users/PC/Documents/Arthefacte Games/Fractal Arena/fractal-arena-server/tower.js');
const assert = require('assert');
assert.strictEqual(TU.ENTRY_COST, SRV.ENTRY_COST, 'ENTRY_COST diverge');
assert.deepStrictEqual(TU.TIERS, SRV.TIERS, 'TIERS diverge');
console.log('ANTI-DERIVE OK : ENTRY_COST=' + TU.ENTRY_COST + ', ' + TU.TIERS.length + ' paliers identiques');
"
```

Expected: `ANTI-DERIVE OK …`. (Pré-requis : `main` local du serveur à jour. Si le require échoue sur des dépendances serveur, comparer à la main les deux tables — elles sont courtes.)

- [ ] **Step 2: E2E navigateur**

Utiliser le skill `verify` (ou `run`) : servir le worktree en local (`npx serve` ou équivalent), puis vérifier :
1. Console sans erreur au chargement ; `window.FA_TOUR_UI` et `window.Tour` définis.
2. À froid (sans wallet) : l'onglet « 🗼 Tour » apparaît dans la nav, s'ouvre sur le message `TOUR_LOGIN`, le top 50 se charge (route publique).
3. Authentifié (wallet UniSat) : `GET /tower/state` OK → écran « aucun run » + bandeau paliers + compte à rebours ; lancer le run gratuit → roster à 100 % ; sélectionner 3 bêtes (badges AV/MI/AR) → combattre l'étage 1 → rejeu AreneBattle → modale de résultat → PV entamés visibles sur les tuiles.
4. Basculer FR/EN/ZH : aucun libellé brut `TOUR_*` à l'écran.
5. Screenshot de l'écran de run pour la PR.

⚠️ Le serveur de prod est la cible (CSP `connect-src` verrouillée sur Railway) — les combats de test consomment le run gratuit réel de la semaine du wallet de test ; re-run = 2 000 FA. À faire avec le wallet de dev.

- [ ] **Step 3: Push + PR (NE PAS merger)**

```bash
git push -u origin feat/tour-infinie-web
gh pr create --repo Arthefacte/FractalArena-Jeu-Web --base main --head feat/tour-infinie-web \
  --title "feat(tour): onglet Tour infinie — run hebdo, attrition, paliers, top 50 (v65)" \
  --body "## Résumé
- Nouvel onglet « 🗼 Tour » : lancer/abandonner un run hebdo (1 gratuit, re-run 2 000 FA), roster avec PV de run persistés (♥/☠), sélection 3 bêtes (ordre = formation) + posture, rejeu AreneBattle réutilisé, paliers payés affichés en direct, top 50 hebdo (lignes enrichies serveur)
- tour-ui.js pur (window.FA_TOUR_UI) + tests node ; i18n FR/EN/ZH TOUR_* ; 5 actions tower* dans app.jsx (patron campaignFight, deltas locaux miroir deductBalance)
- Cache-bust v64 → v65

## Dépendance
- PR serveur #53 (leaderboard Tour enrichi) mergée/déployée AVANT ce merge

## Tests
- node --test : suite complète verte (tour-ui, tour-i18n inclus)
- Anti-dérive TIERS/ENTRY_COST vs serveur : OK
- E2E navigateur : cf. screenshots

Spec : fractal-arena-server/docs/superpowers/specs/2026-07-07-tour-infinie-design.md (§8)

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Expected: PR créée. **Ne pas merger sans accord du user** (GitHub Pages déploie `main` sur fractalarena.com). Au merge : rappel — le prompt chatbot serveur couvre déjà la Tour (fait dans la PR serveur #50).
