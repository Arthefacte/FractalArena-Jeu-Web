# Panneau Talents web — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer côté client les talents par palier (serveur déployé, PR#48) : panneau de choix/respec sur chaque bête de l'écran Équipe, descriptions i18n FR/EN/ZH dérivées du catalogue calibré, action `chooseTalent` vers `POST /talents/choose`.

**Architecture:** Le dépôt est zero-build (JSX transpilé par Babel Standalone dans le navigateur, modules purs exposés sur `window`). On ajoute deux modules JS purs testables (`talents-data.js` miroir du catalogue serveur, `talents-ui.js` helpers déblocage/coût/descriptions), un bloc de clés i18n `TAL_*`, une action `chooseTalent` dans `app.jsx`, et un composant `TalentSlot` dans `screens.jsx` calqué sur `RelicSlot` (bande sous la carte → `Modal`). Aucun nouveau CSS.

**Tech Stack:** React via Babel Standalone (in-browser), modules IIFE sur `window`, tests `node:test` + `node:assert` (aucune dépendance npm), serveur prod Railway (`https://fractal-arena-server-production.up.railway.app`).

## Global Constraints

- Dépôt cible : `C:\Users\PC\Documents\Arthefacte Games\Fractal Arena\fractal-arena-web` (branche de travail `feat/talents-web` depuis `main`, à créer avant la Task 1 — via la skill using-git-worktrees si exécution isolée).
- **Source de vérité des valeurs** : `fractal-arena-server/talents-data.js` (magnitudes calibrées §9.2). JAMAIS les valeurs indicatives de la spec §5 (`fractal-arena-server/docs/superpowers/specs/2026-07-05-talents-paliers-design.md`).
- Le multiplicateur de rareté (`Common 1.0 / Rare 1.3 / Epic 1.6 / Legendary 2.0`) s'applique aux **magnitudes** uniquement, **jamais aux seuils de condition** (`below`/`above`/`n`/`rounds`/`after`/`afterRound`/`perRoundCap`/`decay`/`chance` de `led_*` debuffs… voir la table `DESC_ARGS` de la Task 2 qui encode talent par talent ce qui scale).
- Règle de déblocage d'un palier `k` ∈ {"25","50","75"} : `rarity !== "Common"` **OU** `level >= Number(k)` (miroir de `syncTalentSlots`, `fractal-arena-server/data.node.js:286-296`). Le serveur ne backfill les slots que paresseusement — le client dérive l'état lui-même et n'exige PAS la présence de `beast.talents[k]`.
- Contrat serveur `POST /talents/choose` : body `{ beast_id, tier, talent_id }`, header `Authorization: Bearer <token>` (PAS de wallet dans le body). Succès : `{ status:"ok", …, cost, respec_free_used, creatures }`. Erreurs : `tier_invalide`/`talent_invalide`/`deja_choisi`/`solde_insuffisant` (400), `palier_verrouille` (403), `joueur_introuvable`/`bete_introuvable` (404).
- Convention modules purs : IIFE, `globalThis.window` stubbable, export `window.FA_XXX` (patron : `forge-ui.js`).
- Convention JSX : imports depuis `window` en tête de fichier, exports via `Object.assign(window, {…})` en fin (README §Babel scopes).
- i18n : objet `T` clé → `{ FR, EN, ZH }`, appel `window.FA_I18N.t(key, ...args)`. **PIÈGE** : `t()` n'applique `fmt` (remplacement `%s`/`%d`/`%%`) que si `args.length > 0` — un template SANS argument ne doit JAMAIS contenir `%s`, `%d` ni `%%`.
- Ordre des `%s` dans un template = ordre du tableau `DESC_ARGS[id]` (remplacement séquentiel) — identique dans les 3 langues.
- Cache-bust : tous les `?v=61` de `index.html` passent à `?v=62` (Task 5).
- Tests : `node --test` depuis la racine du dépôt web (se termine normalement — le piège `--test-force-exit` ne concerne que le dépôt serveur).
- Commits fréquents, messages en français, se terminant par `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Miroir du catalogue — `talents-data.js`

**Files:**
- Create: `talents-data.js` (racine du dépôt web)
- Test: `test/talents-data.test.js`

**Interfaces:**
- Consumes: rien (module autonome).
- Produces: `window.FA_TALENTS = { TALENTS, TALENT_LIST, talentsFor(type, tier), TALENT_RARITY_MULT, TIER_KEYS, RESPEC_COST, scaled(base, rarity) }` — mêmes noms et mêmes valeurs que `fractal-arena-server/talents-data.js`.

- [ ] **Step 1: Écrire le test qui échoue**

```js
// test/talents-data.test.js
const test = require("node:test");
const assert = require("node:assert");

globalThis.window = {};
require("../talents-data.js");
const TAL = window.FA_TALENTS;

const TYPES = ["HASH", "NETWORK", "LEDGER", "GENESIS", "MINING", "BLOCK"];

test("catalogue : 36 talents, ids uniques", () => {
  assert.strictEqual(TAL.TALENT_LIST.length, 36);
  const ids = new Set(TAL.TALENT_LIST.map((t) => t.id));
  assert.strictEqual(ids.size, 36);
  for (const t of TAL.TALENT_LIST) assert.strictEqual(TAL.TALENTS[t.id], t);
});

test("catalogue : 2 options exactement par type × palier", () => {
  for (const type of TYPES) {
    for (const tier of [25, 50, 75]) {
      const opts = TAL.talentsFor(type, tier);
      assert.strictEqual(opts.length, 2, `${type} L${tier}`);
      for (const t of opts) { assert.strictEqual(t.type, type); assert.strictEqual(t.tier, tier); }
    }
  }
});

test("constantes : paliers, coûts de respec, multiplicateurs de rareté", () => {
  assert.deepStrictEqual(TAL.TIER_KEYS, ["25", "50", "75"]);
  assert.deepStrictEqual(TAL.RESPEC_COST, { "25": 500, "50": 1500, "75": 4000 });
  assert.deepStrictEqual(TAL.TALENT_RARITY_MULT, { Common: 1.0, Rare: 1.3, Epic: 1.6, Legendary: 2.0 });
});

test("scaled : applique le mult de rareté, fallback 1.0", () => {
  assert.strictEqual(TAL.scaled(0.2, "Legendary"), 0.4);
  assert.strictEqual(TAL.scaled(0.2, "Common"), 0.2);
  assert.strictEqual(TAL.scaled(0.2, "Inconnu"), 0.2);
});

test("valeurs calibrées : échantillon anti-dérive vs serveur (§9.2)", () => {
  // Sentinelles des valeurs recalibrées en passe 2 — si le serveur rechange, ce test rappelle de resynchroniser.
  assert.deepStrictEqual(TAL.TALENTS.hash_cadence.p, { stat: "spd", per: 0.32, cap: 1.10 });
  assert.deepStrictEqual(TAL.TALENTS.net_execution.p, { below: 0.50, mult: 2.50 });
  assert.deepStrictEqual(TAL.TALENTS.led_malediction.p, { stat: "atk", mult: 0.05 });
  assert.deepStrictEqual(TAL.TALENTS.gen_apogee.p, { afterRound: 5, mult: 0.05 });
  assert.deepStrictEqual(TAL.TALENTS.gen_renaissance.p, { hpFrac: 0.03 });
  assert.deepStrictEqual(TAL.TALENTS.blk_forteresse.p, { frac: 0.05, team: true, below: 0.50 });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/talents-data.test.js`
Expected: FAIL — `Cannot find module '../talents-data.js'`

- [ ] **Step 3: Écrire `talents-data.js` (miroir strict du serveur)**

```js
/* ============================================================
   FRACTAL ARENA — Talents par palier : CATALOGUE (miroir serveur).
   Miroir de fractal-arena-server/talents-data.js — LE SERVEUR FAIT FOI.
   Magnitudes = valeur Commun ; le mult de rareté scale la PART BONUS,
   jamais les seuils de condition. Ne modifier qu'en resynchronisant
   depuis le serveur (test sentinelle : test/talents-data.test.js).
   ============================================================ */
(() => {
  const TALENT_RARITY_MULT = { Common: 1.0, Rare: 1.3, Epic: 1.6, Legendary: 2.0 };
  const TIER_KEYS = ["25", "50", "75"];
  const RESPEC_COST = { "25": 500, "50": 1500, "75": 4000 };

  function scaled(base, rarity) {
    const m = Object.hasOwn(TALENT_RARITY_MULT, rarity) ? TALENT_RARITY_MULT[rarity] : 1.0;
    return base * m;
  }

  const TALENT_LIST = [
    // ---- HASH — burst / tempo ----
    { id: "hash_surchauffe",  type: "HASH", tier: 25, hook: "setup",  kind: "first_hit_crit",     p: {} },
    { id: "hash_cadence",     type: "HASH", tier: 25, hook: "crit",   kind: "crit_stack_stat",    p: { stat: "spd", per: 0.32, cap: 1.10 } },
    { id: "hash_momentum",    type: "HASH", tier: 50, hook: "kill",   kind: "on_kill_buff",       p: { stat: "atk", mult: 0.20, rounds: 2 } },
    { id: "hash_faille",      type: "HASH", tier: 50, hook: "dmgmod", kind: "crit_ignore_def",    p: { frac: 0.20 } },
    { id: "hash_rupture",     type: "HASH", tier: 75, hook: "dmgmod", kind: "team_atk_enemy_low", p: { below: 0.50, mult: 0.11 } },
    { id: "hash_surcadence",  type: "HASH", tier: 75, hook: "crit",   kind: "crit_count_bonus",   p: { after: 3, bonus: 0.35 } },
    // ---- NETWORK — assassin / exécution ----
    { id: "net_predateur",    type: "NETWORK", tier: 25, hook: "dmgmod", kind: "dmg_vs_low_hp",      p: { below: 0.35, mult: 0.65 } },
    { id: "net_celerite",     type: "NETWORK", tier: 25, hook: "setup",  kind: "opener_spd_decay",   p: { start: 0.06, decay: 0.06 } },
    { id: "net_mise_a_mort",  type: "NETWORK", tier: 50, hook: "onhit",  kind: "execute_rebound",    p: { below: 0.15, frac: 0.20 } },
    { id: "net_insaisissable",type: "NETWORK", tier: 50, hook: "kill",   kind: "on_kill_dodge",      p: { chance: 0.20, rounds: 1 } },
    { id: "net_execution",    type: "NETWORK", tier: 75, hook: "dmgmod", kind: "dmg_vs_low_hp",      p: { below: 0.50, mult: 2.50 } },
    { id: "net_chaine",       type: "NETWORK", tier: 75, hook: "kill",   kind: "on_kill_extra_action", p: { perRoundCap: 1 } },
    // ---- LEDGER — mage / contrôle ----
    { id: "led_focalisation", type: "LEDGER", tier: 25, hook: "dmgmod", kind: "mag_if_untouched",   p: { mult: 0.06 } },
    { id: "led_corrosion",    type: "LEDGER", tier: 25, hook: "onhit",  kind: "debuff_target_stat", p: { stat: "def", per: 0.075, cap: 0.22, chance: 1.0 } },
    { id: "led_resonance",    type: "LEDGER", tier: 50, hook: "dmgmod", kind: "every_n_rounds_dmg", p: { n: 3, mult: 0.25 } },
    { id: "led_brouillage",   type: "LEDGER", tier: 50, hook: "onhit",  kind: "debuff_target_stat", p: { stat: "spd", per: 0.20, cap: 0.20, chance: 0.22 } },
    { id: "led_surcharge",    type: "LEDGER", tier: 75, hook: "dmgmod", kind: "stat_when_self_hp",  p: { stats: { mag: 0.11 }, below: 0.50 } },
    { id: "led_malediction",  type: "LEDGER", tier: 75, hook: "setup",  kind: "curse_strongest",    p: { stat: "atk", mult: 0.05 } },
    // ---- GENESIS — scaling / comeback ----
    { id: "gen_croissance",   type: "GENESIS", tier: 25, hook: "round", kind: "round_stack_all",    p: { per: 0.008, cap: 0.10 } },
    { id: "gen_adaptation",   type: "GENESIS", tier: 25, hook: "onhit", kind: "def_vs_last_attacker_type", p: { mult: 0.10 } },
    { id: "gen_second_souffle", type: "GENESIS", tier: 50, hook: "round", kind: "regen_below",      p: { below: 0.40, frac: 0.055 } },
    { id: "gen_elan",         type: "GENESIS", tier: 50, hook: "dmgmod", kind: "atk_per_ally",      p: { per: 0.06 } },
    { id: "gen_renaissance",  type: "GENESIS", tier: 75, hook: "lethal", kind: "revive_once",       p: { hpFrac: 0.03 } },
    { id: "gen_apogee",       type: "GENESIS", tier: 75, hook: "round", kind: "late_all_stats",     p: { afterRound: 5, mult: 0.05 } },
    // ---- MINING — endurance / attrition ----
    { id: "min_tenacite",     type: "MINING", tier: 25, hook: "dmgmod", kind: "dmg_in_above_hp",    p: { above: 0.60, reduce: 0.05 } },
    { id: "min_recuperation", type: "MINING", tier: 25, hook: "round",  kind: "regen_below",        p: { below: 1.01, frac: 0.006 } },
    { id: "min_roc",          type: "MINING", tier: 50, hook: "onhit",  kind: "immune_first_debuff", p: {} },
    { id: "min_contrepoids",  type: "MINING", tier: 50, hook: "dmgmod", kind: "stat_when_self_hp",  p: { stats: { def: 0.05, atk: 0.025 }, below: 0.50 } },
    { id: "min_inebranlable", type: "MINING", tier: 75, hook: "lethal", kind: "anti_oneshot",       p: { above: 0.30 } },
    { id: "min_attrition",    type: "MINING", tier: 75, hook: "dmgmod", kind: "dmg_out_per_round",  p: { per: 0.007 } },
    // ---- BLOCK — forteresse / riposte ----
    { id: "blk_riposte",      type: "BLOCK", tier: 25, hook: "onhit",  kind: "reflect",             p: { frac: 0.03, team: false } },
    { id: "blk_blindage",     type: "BLOCK", tier: 25, hook: "dmgmod", kind: "dmg_in_early_rounds", p: { rounds: 3, reduce: 0.045 } },
    { id: "blk_provocation",  type: "BLOCK", tier: 50, hook: "target", kind: "taunt",               p: { bias: 2.5 } },
    { id: "blk_endurance",    type: "BLOCK", tier: 50, hook: "dmgmod", kind: "stat_when_self_hp",   p: { stats: { def: 0.11 }, below: 0.40 } },
    { id: "blk_rempart",      type: "BLOCK", tier: 75, hook: "lethal", kind: "survive_lethal_once", p: {} },
    { id: "blk_forteresse",   type: "BLOCK", tier: 75, hook: "onhit",  kind: "reflect",             p: { frac: 0.05, team: true, below: 0.50 } },
  ];

  const TALENTS = {};
  for (const t of TALENT_LIST) TALENTS[t.id] = t;

  function talentsFor(type, tier) {
    return TALENT_LIST.filter((t) => t.type === type && t.tier === (tier | 0));
  }

  window.FA_TALENTS = { TALENTS, TALENT_LIST, talentsFor, TALENT_RARITY_MULT, TIER_KEYS, RESPEC_COST, scaled };
})();
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test test/talents-data.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Vérifier byte-à-byte la fidélité des 36 entrées au serveur**

Run (compare les `p` de chaque talent aux valeurs du serveur — script jetable, ne pas committer) :
```bash
node -e "
globalThis.window = {};
require('./talents-data.js');
const W = window.FA_TALENTS;
const S = require('C:/Users/PC/Documents/Arthefacte Games/Fractal Arena/fractal-arena-server/talents-data.js');
const diff = S.TALENT_LIST.filter((s, i) => JSON.stringify(s) !== JSON.stringify(W.TALENT_LIST[i]));
console.log(diff.length === 0 && S.TALENT_LIST.length === W.TALENT_LIST.length ? 'MIROIR OK' : 'DIVERGENCE : ' + JSON.stringify(diff.map(d => d.id)));
"
```
Expected: `MIROIR OK`. Si divergence : corriger `talents-data.js` web depuis le serveur (le serveur fait foi).

- [ ] **Step 6: Commit**

```bash
git add talents-data.js test/talents-data.test.js
git commit -m "feat(talents): miroir client du catalogue serveur (36 talents calibrés)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Helpers purs — `talents-ui.js` (déblocage, coût, arguments de description)

**Files:**
- Create: `talents-ui.js` (racine du dépôt web)
- Test: `test/talents-ui.test.js`

**Interfaces:**
- Consumes: `window.FA_TALENTS` (Task 1 — `TIER_KEYS`, `RESPEC_COST`, `TALENT_RARITY_MULT`).
- Produces: `window.FA_TALENTS_UI = { tierUnlocked(beast, tierKey), slotState(beast), chooseCost(beast, tierKey), pct(x), descArgs(talent, rarity), talentDesc(talent, rarity, tFn) }` :
  - `tierUnlocked(beast, tierKey)` → bool.
  - `slotState(beast)` → `[{ key: "25"|"50"|"75", unlocked: bool, chosen: string|null }]` (3 entrées, ordre 25/50/75).
  - `chooseCost(beast, tierKey)` → `{ cost: number, freeRespec: bool }` (cost 0 si slot vide ou respec gratuit armé).
  - `pct(x)` → nombre en pourcentage arrondi à 1 décimale (0.075 → 7.5 ; 1.10 → 110).
  - `descArgs(talent, rarity)` → tableau d'arguments (nombres) pour le template `TAL_<id>_D`.
  - `talentDesc(talent, rarity, tFn)` → string (appelle `tFn("TAL_" + id + "_D", ...descArgs)`).

- [ ] **Step 1: Écrire le test qui échoue**

```js
// test/talents-ui.test.js
const test = require("node:test");
const assert = require("node:assert");

globalThis.window = {};
require("../talents-data.js");
require("../talents-ui.js");
const TAL = window.FA_TALENTS;
const TUI = window.FA_TALENTS_UI;

test("tierUnlocked : niveau OU rareté > Common (miroir syncTalentSlots serveur)", () => {
  assert.strictEqual(TUI.tierUnlocked({ level: 24, rarity: "Common" }, "25"), false);
  assert.strictEqual(TUI.tierUnlocked({ level: 25, rarity: "Common" }, "25"), true);
  assert.strictEqual(TUI.tierUnlocked({ level: 74, rarity: "Common" }, "75"), false);
  // Tout cycle de rareté implique d'avoir passé L100 → tous les paliers débloqués même à L1.
  assert.strictEqual(TUI.tierUnlocked({ level: 1, rarity: "Rare" }, "75"), true);
});

test("slotState : 3 entrées ordonnées, chosen depuis beast.talents (absent toléré)", () => {
  const b = { level: 60, rarity: "Common", talents: { "25": "hash_surchauffe", "50": null } };
  assert.deepStrictEqual(TUI.slotState(b), [
    { key: "25", unlocked: true, chosen: "hash_surchauffe" },
    { key: "50", unlocked: true, chosen: null },
    { key: "75", unlocked: false, chosen: null },
  ]);
  // Bête d'avant la feature : pas de champ talents du tout — le client dérive quand même.
  assert.deepStrictEqual(TUI.slotState({ level: 30, rarity: "Common" }), [
    { key: "25", unlocked: true, chosen: null },
    { key: "50", unlocked: false, chosen: null },
    { key: "75", unlocked: false, chosen: null },
  ]);
});

test("chooseCost : 1er choix gratuit, respec payant, respec_free armé", () => {
  assert.deepStrictEqual(TUI.chooseCost({ talents: { "25": null } }, "25"), { cost: 0, freeRespec: false });
  assert.deepStrictEqual(TUI.chooseCost({}, "25"), { cost: 0, freeRespec: false });
  assert.deepStrictEqual(TUI.chooseCost({ talents: { "25": "hash_cadence" } }, "25"), { cost: 500, freeRespec: false });
  assert.deepStrictEqual(TUI.chooseCost({ talents: { "75": "net_chaine" } }, "75"), { cost: 4000, freeRespec: false });
  assert.deepStrictEqual(TUI.chooseCost({ talents: { "50": "min_roc" }, respec_free: true }, "50"), { cost: 0, freeRespec: true });
});

test("pct : pourcentage arrondi à 1 décimale", () => {
  assert.strictEqual(TUI.pct(0.075), 7.5);
  assert.strictEqual(TUI.pct(1.10), 110);
  assert.strictEqual(TUI.pct(0.32 * 1.3), 41.6);
});

test("descArgs : couvre les 36 talents, magnitudes scalées, seuils fixes", () => {
  for (const t of TAL.TALENT_LIST) {
    assert.ok(Array.isArray(TUI.descArgs(t, "Common")), `descArgs manquant pour ${t.id}`);
  }
  // Magnitude scalée par la rareté (per, cap de Cadence), seuils jamais scalés.
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.hash_cadence, "Common"), [32, 110]);
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.hash_cadence, "Legendary"), [64, 220]);
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.net_execution, "Common"), [250, 50]);
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.net_execution, "Legendary"), [500, 50]); // below fixe
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.gen_apogee, "Rare"), [5, 6.5]);          // afterRound fixe
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.hash_momentum, "Rare"), [26, 2]);        // rounds fixe
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.led_brouillage, "Legendary"), [22, 40]); // chance fixe, per scalé
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.min_contrepoids, "Common"), [50, 5, 2.5]);
  assert.deepStrictEqual(TUI.descArgs(TAL.TALENTS.hash_surchauffe, "Common"), []);
});

test("talentDesc : délègue au template i18n avec les args", () => {
  const calls = [];
  const fakeT = (key, ...args) => { calls.push([key, args]); return "X"; };
  TUI.talentDesc(TAL.TALENTS.hash_cadence, "Rare", fakeT);
  assert.deepStrictEqual(calls, [["TAL_hash_cadence_D", [41.6, 143]]]);
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/talents-ui.test.js`
Expected: FAIL — `Cannot find module '../talents-ui.js'`

- [ ] **Step 3: Écrire `talents-ui.js`**

```js
/* ============================================================
   FRACTAL ARENA — Talents : helpers UI purs (testables en node).
   - Déblocage des paliers : miroir de syncTalentSlots (data.node.js
     serveur) — le serveur ne backfill que paresseusement, le client
     dérive l'état sans exiger beast.talents.
   - descArgs : arguments numériques des templates TAL_<id>_D.
     Le mult de rareté scale les MAGNITUDES, jamais les seuils
     (below/above/n/rounds/after/afterRound/perRoundCap/decay,
     ni chance des debuffs LEDGER) — sémantique engine.node.js.
   ============================================================ */
(() => {
  const TAL = window.FA_TALENTS;

  function rarityMult(rarity) {
    return Object.hasOwn(TAL.TALENT_RARITY_MULT, rarity) ? TAL.TALENT_RARITY_MULT[rarity] : 1.0;
  }

  function tierUnlocked(beast, tierKey) {
    if (!beast) return false;
    if (beast.rarity && beast.rarity !== "Common") return true;
    return (beast.level | 0) >= Number(tierKey);
  }

  function slotState(beast) {
    return TAL.TIER_KEYS.map((key) => ({
      key,
      unlocked: tierUnlocked(beast, key),
      chosen: (beast && beast.talents && typeof beast.talents === "object" && beast.talents[key]) || null,
    }));
  }

  function chooseCost(beast, tierKey) {
    const chosen = beast && beast.talents && typeof beast.talents === "object" && beast.talents[tierKey];
    if (!chosen) return { cost: 0, freeRespec: false };
    if (beast.respec_free === true) return { cost: 0, freeRespec: true };
    return { cost: TAL.RESPEC_COST[tierKey], freeRespec: false };
  }

  // 0.075 → 7.5 ; 1.10 → 110 (1 décimale max, sans zéro traînant).
  function pct(x) { return Math.round(x * 1000) / 10; }

  // Un entry par talent : (p, m) → args du template TAL_<id>_D, dans l'ordre des %s.
  const DESC_ARGS = {
    hash_surchauffe:  () => [],
    hash_cadence:     (p, m) => [pct(p.per * m), pct(p.cap * m)],
    hash_momentum:    (p, m) => [pct(p.mult * m), p.rounds],
    hash_faille:      (p, m) => [pct(p.frac * m)],
    hash_rupture:     (p, m) => [pct(p.below), pct(p.mult * m)],
    hash_surcadence:  (p, m) => [p.after, pct(p.bonus * m)],
    net_predateur:    (p, m) => [pct(p.mult * m), pct(p.below)],
    net_celerite:     (p, m) => [pct(p.start * m), pct(p.decay)],
    net_mise_a_mort:  (p, m) => [pct(p.below), pct(p.frac * m)],
    net_insaisissable:(p, m) => [pct(p.chance * m), p.rounds],
    net_execution:    (p, m) => [pct(p.mult * m), pct(p.below)],
    net_chaine:       (p) => [p.perRoundCap],
    led_focalisation: (p, m) => [pct(p.mult * m)],
    led_corrosion:    (p, m) => [pct(p.per * m), pct(p.cap * m)],
    led_resonance:    (p, m) => [p.n, pct(p.mult * m)],
    led_brouillage:   (p, m) => [pct(p.chance), pct(p.per * m)],
    led_surcharge:    (p, m) => [pct(p.below), pct(p.stats.mag * m)],
    led_malediction:  (p, m) => [pct(p.mult * m)],
    gen_croissance:   (p, m) => [pct(p.per * m), pct(p.cap * m)],
    gen_adaptation:   (p, m) => [pct(p.mult * m)],
    gen_second_souffle:(p, m) => [pct(p.below), pct(p.frac * m)],
    gen_elan:         (p, m) => [pct(p.per * m)],
    gen_renaissance:  (p, m) => [pct(p.hpFrac * m)],
    gen_apogee:       (p, m) => [p.afterRound, pct(p.mult * m)],
    min_tenacite:     (p, m) => [pct(p.reduce * m), pct(p.above)],
    min_recuperation: (p, m) => [pct(p.frac * m)],
    min_roc:          () => [],
    min_contrepoids:  (p, m) => [pct(p.below), pct(p.stats.def * m), pct(p.stats.atk * m)],
    min_inebranlable: (p) => [pct(p.above)],
    min_attrition:    (p, m) => [pct(p.per * m)],
    blk_riposte:      (p, m) => [pct(p.frac * m)],
    blk_blindage:     (p, m) => [pct(p.reduce * m), p.rounds],
    blk_provocation:  () => [],
    blk_endurance:    (p, m) => [pct(p.below), pct(p.stats.def * m)],
    blk_rempart:      () => [],
    blk_forteresse:   (p, m) => [pct(p.below), pct(p.frac * m)],
  };

  function descArgs(talent, rarity) {
    const fn = DESC_ARGS[talent.id];
    return fn ? fn(talent.p, rarityMult(rarity)) : [];
  }

  function talentDesc(talent, rarity, tFn) {
    return tFn("TAL_" + talent.id + "_D", ...descArgs(talent, rarity));
  }

  window.FA_TALENTS_UI = { tierUnlocked, slotState, chooseCost, pct, descArgs, talentDesc };
})();
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test test/talents-ui.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add talents-ui.js test/talents-ui.test.js
git commit -m "feat(talents): helpers UI purs — déblocage des paliers, coût de respec, args de description

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: i18n — 36 noms + 36 descriptions + chrome UI (FR/EN/ZH)

**Files:**
- Modify: `i18n.js` (ajouter le bloc `TAL_*` dans l'objet `T`, juste avant la fermeture `};` de `T` — après le bloc `ROOM_*`, vers `i18n.js:522`)
- Test: `test/talents-i18n.test.js`

**Interfaces:**
- Consumes: `window.FA_TALENTS` (liste des ids), `window.FA_TALENTS_UI.descArgs` (test de cohérence des placeholders).
- Produces: clés `TAL_<id>` (nom) et `TAL_<id>_D` (description template) pour les 36 talents + clés chrome : `TAL_TITLE`, `TAL_TIER`, `TAL_TIER_LOCKED`, `TAL_PICK_FREE`, `TAL_RESPEC_COST`, `TAL_RESPEC_FREE`, `TAL_NONE_UNLOCKED`, `TAL_ERR_LOCKED`, `TAL_ERR_ALREADY`, `TAL_ERR_BALANCE`.

- [ ] **Step 1: Écrire le test qui échoue**

```js
// test/talents-i18n.test.js
const test = require("node:test");
const assert = require("node:assert");

globalThis.window = {};
require("../talents-data.js");
require("../talents-ui.js");
require("../i18n.js");
const TAL = window.FA_TALENTS;
const TUI = window.FA_TALENTS_UI;
const { T, t } = window.FA_I18N;

const LANGS = ["FR", "EN", "ZH"];
const CHROME_KEYS = [
  "TAL_TITLE", "TAL_TIER", "TAL_TIER_LOCKED", "TAL_PICK_FREE", "TAL_RESPEC_COST",
  "TAL_RESPEC_FREE", "TAL_NONE_UNLOCKED", "TAL_ERR_LOCKED", "TAL_ERR_ALREADY", "TAL_ERR_BALANCE",
];

function assertKey(key) {
  assert.ok(T[key], `clé manquante : ${key}`);
  for (const l of LANGS) {
    assert.ok(typeof T[key][l] === "string" && T[key][l].length > 0, `${key}.${l} vide`);
  }
}

test("i18n : nom + description pour chacun des 36 talents, 3 langues", () => {
  for (const tal of TAL.TALENT_LIST) {
    assertKey("TAL_" + tal.id);
    assertKey("TAL_" + tal.id + "_D");
  }
});

test("i18n : clés chrome du panneau, 3 langues", () => {
  for (const key of CHROME_KEYS) assertKey(key);
});

test("i18n : nombre de %s/%d des descriptions == descArgs, dans les 3 langues", () => {
  for (const tal of TAL.TALENT_LIST) {
    const nArgs = TUI.descArgs(tal, "Common").length;
    for (const l of LANGS) {
      const tpl = T["TAL_" + tal.id + "_D"][l];
      const n = (tpl.match(/%[sd]/g) || []).length;
      assert.strictEqual(n, nArgs, `TAL_${tal.id}_D.${l} : ${n} placeholders, ${nArgs} args`);
      // PIÈGE fmt : t() ne remplace %% que si args.length > 0 — interdit dans les templates sans arg.
      if (nArgs === 0) assert.ok(!tpl.includes("%"), `TAL_${tal.id}_D.${l} sans arg ne doit pas contenir %`);
    }
  }
});

test("i18n : rendu bout-en-bout d'une description scalée", () => {
  window.FA_I18N.setLang("FR");
  const s = TUI.talentDesc(TAL.TALENTS.hash_cadence, "Legendary", t);
  assert.ok(s.includes("64"), s);   // per 0.32 × 2.0 → 64
  assert.ok(s.includes("220"), s);  // cap 1.10 × 2.0 → 220
  assert.ok(s.includes("%"), s);    // %% rendu en %
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `node --test test/talents-i18n.test.js`
Expected: FAIL — `clé manquante : TAL_hash_surchauffe`

- [ ] **Step 3: Ajouter le bloc `TAL_*` dans `i18n.js`**

Insérer dans l'objet `T`, après le bloc `ROOM_*` (dernier bloc existant, vers la ligne 522) et avant le `};` :

```js
    // ---- Talents par palier ----
    TAL_TITLE:         { FR: "Talents", EN: "Talents", ZH: "天赋" },
    TAL_TIER:          { FR: "Niv. %s", EN: "Lv. %s", ZH: "%s 级" },
    TAL_TIER_LOCKED:   { FR: "Verrouillé — atteins le niveau %s", EN: "Locked — reach level %s", ZH: "未解锁 — 需要 %s 级" },
    TAL_PICK_FREE:     { FR: "Premier choix gratuit", EN: "First pick is free", ZH: "首次选择免费" },
    TAL_RESPEC_COST:   { FR: "Changer : %s FA", EN: "Change: %s FA", ZH: "更换：%s FA" },
    TAL_RESPEC_FREE:   { FR: "Respec gratuit (montée de rareté)", EN: "Free respec (rarity up)", ZH: "免费重置（稀有度提升）" },
    TAL_NONE_UNLOCKED: { FR: "Premier talent au niveau 25", EN: "First talent at level 25", ZH: "25 级解锁首个天赋" },
    TAL_ERR_LOCKED:    { FR: "Palier verrouillé", EN: "Tier locked", ZH: "层级未解锁" },
    TAL_ERR_ALREADY:   { FR: "Talent déjà actif", EN: "Talent already active", ZH: "该天赋已激活" },
    TAL_ERR_BALANCE:   { FR: "Solde FA insuffisant", EN: "Insufficient FA balance", ZH: "FA 余额不足" },
    // HASH — burst / tempo
    TAL_hash_surchauffe:    { FR: "Surchauffe", EN: "Overheat", ZH: "过热" },
    TAL_hash_surchauffe_D:  { FR: "Le premier coup du combat est un critique garanti.", EN: "The first hit of the battle is a guaranteed critical.", ZH: "战斗中的第一击必定暴击。" },
    TAL_hash_cadence:       { FR: "Cadence", EN: "Cadence", ZH: "节奏" },
    TAL_hash_cadence_D:     { FR: "Chaque critique : +%s %% SPD (cumulable, plafond +%s %%).", EN: "Each critical: +%s%% SPD (stacks, cap +%s%%).", ZH: "每次暴击：+%s%% 速度（可叠加，上限 +%s%%）。" },
    TAL_hash_momentum:      { FR: "Momentum", EN: "Momentum", ZH: "势头" },
    TAL_hash_momentum_D:    { FR: "Après un kill : +%s %% ATK pendant %s tours.", EN: "After a kill: +%s%% ATK for %s turns.", ZH: "击杀后：+%s%% 攻击，持续 %s 回合。" },
    TAL_hash_faille:        { FR: "Faille", EN: "Breach", ZH: "破绽" },
    TAL_hash_faille_D:      { FR: "Les critiques ignorent %s %% de la DEF de la cible.", EN: "Criticals ignore %s%% of the target's DEF.", ZH: "暴击无视目标 %s%% 防御。" },
    TAL_hash_rupture:       { FR: "Point de rupture", EN: "Breaking Point", ZH: "临界点" },
    TAL_hash_rupture_D:     { FR: "PV totaux adverses sous %s %% : toute l'équipe inflige +%s %% de dégâts.", EN: "Enemy total HP below %s%%: the whole team deals +%s%% damage.", ZH: "敌方总生命低于 %s%% 时：全队伤害 +%s%%。" },
    TAL_hash_surcadence:    { FR: "Surcadence", EN: "Overclock", ZH: "超频" },
    TAL_hash_surcadence_D:  { FR: "Au-delà de %s critiques dans le combat : +%s %% de chance de critique.", EN: "After %s criticals in a battle: +%s%% critical chance.", ZH: "单场战斗暴击超过 %s 次后：暴击率 +%s%%。" },
    // NETWORK — assassin / exécution
    TAL_net_predateur:      { FR: "Prédateur", EN: "Predator", ZH: "捕食者" },
    TAL_net_predateur_D:    { FR: "+%s %% dégâts contre les cibles sous %s %% PV.", EN: "+%s%% damage against targets below %s%% HP.", ZH: "+%s%% 伤害（目标生命低于 %s%%）。" },
    TAL_net_celerite:       { FR: "Célérité", EN: "Celerity", ZH: "迅捷" },
    TAL_net_celerite_D:     { FR: "Commence le combat avec +%s %% SPD, puis −%s %% par tour.", EN: "Starts the battle with +%s%% SPD, decaying −%s%% per turn.", ZH: "战斗开始时 +%s%% 速度，每回合递减 %s%%。" },
    TAL_net_mise_a_mort:    { FR: "Mise à mort", EN: "Deathblow", ZH: "致命一击" },
    TAL_net_mise_a_mort_D:  { FR: "Si l'attaque laisse la cible sous %s %% PV : réinflige %s %% des dégâts.", EN: "If an attack leaves the target below %s%% HP: deals %s%% of the damage again.", ZH: "若攻击使目标生命低于 %s%%：追加造成 %s%% 的伤害。" },
    TAL_net_insaisissable:  { FR: "Insaisissable", EN: "Elusive", ZH: "无影" },
    TAL_net_insaisissable_D:{ FR: "Après un kill : %s %% d'esquive pendant %s tour.", EN: "After a kill: %s%% dodge for %s turn.", ZH: "击杀后：%s%% 闪避，持续 %s 回合。" },
    TAL_net_execution:      { FR: "Exécution", EN: "Execution", ZH: "处决" },
    TAL_net_execution_D:    { FR: "+%s %% dégâts contre les cibles sous %s %% PV.", EN: "+%s%% damage against targets below %s%% HP.", ZH: "+%s%% 伤害（目标生命低于 %s%%）。" },
    TAL_net_chaine:         { FR: "Chaîne", EN: "Chain", ZH: "连锁" },
    TAL_net_chaine_D:       { FR: "Un kill accorde une action supplémentaire immédiate (%s par tour max).", EN: "A kill grants an immediate extra action (%s per turn max).", ZH: "击杀后立即获得一次额外行动（每回合最多 %s 次）。" },
    // LEDGER — mage / contrôle
    TAL_led_focalisation:   { FR: "Focalisation", EN: "Focus", ZH: "专注" },
    TAL_led_focalisation_D: { FR: "+%s %% MAG si elle n'a pas été touchée au tour précédent.", EN: "+%s%% MAG if not hit during the previous turn.", ZH: "若上回合未被击中：+%s%% 魔力。" },
    TAL_led_corrosion:      { FR: "Corrosion", EN: "Corrosion", ZH: "腐蚀" },
    TAL_led_corrosion_D:    { FR: "Chaque attaque réduit la DEF de la cible de %s %% (cumulable, plafond %s %%).", EN: "Each attack reduces the target's DEF by %s%% (stacks, cap %s%%).", ZH: "每次攻击降低目标 %s%% 防御（可叠加，上限 %s%%）。" },
    TAL_led_resonance:      { FR: "Résonance", EN: "Resonance", ZH: "共鸣" },
    TAL_led_resonance_D:    { FR: "Tous les %s tours, la prochaine attaque inflige +%s %% de dégâts.", EN: "Every %s turns, the next attack deals +%s%% damage.", ZH: "每 %s 回合，下一次攻击伤害 +%s%%。" },
    TAL_led_brouillage:     { FR: "Brouillage", EN: "Jamming", ZH: "干扰" },
    TAL_led_brouillage_D:   { FR: "%s %% de chance de réduire la SPD de la cible de %s %% à l'impact.", EN: "%s%% chance to reduce the target's SPD by %s%% on hit.", ZH: "命中时有 %s%% 几率降低目标 %s%% 速度。" },
    TAL_led_surcharge:      { FR: "Surcharge arcanique", EN: "Arcane Overload", ZH: "奥术过载" },
    TAL_led_surcharge_D:    { FR: "Sous %s %% PV : +%s %% MAG.", EN: "Below %s%% HP: +%s%% MAG.", ZH: "生命低于 %s%% 时：+%s%% 魔力。" },
    TAL_led_malediction:    { FR: "Malédiction", EN: "Curse", ZH: "诅咒" },
    TAL_led_malediction_D:  { FR: "La plus forte unité adverse subit −%s %% ATK pendant tout le combat.", EN: "The strongest enemy unit suffers −%s%% ATK for the whole battle.", ZH: "敌方最强单位全场 −%s%% 攻击。" },
    // GENESIS — scaling / comeback
    TAL_gen_croissance:     { FR: "Croissance", EN: "Growth", ZH: "成长" },
    TAL_gen_croissance_D:   { FR: "+%s %% à toutes les stats par tour (plafond +%s %%).", EN: "+%s%% to all stats each turn (cap +%s%%).", ZH: "每回合全属性 +%s%%（上限 +%s%%）。" },
    TAL_gen_adaptation:     { FR: "Adaptation", EN: "Adaptation", ZH: "适应" },
    TAL_gen_adaptation_D:   { FR: "−%s %% dégâts subis face au type du dernier attaquant.", EN: "−%s%% damage taken from the type of the last attacker.", ZH: "受到与上一攻击者同类型的伤害 −%s%%。" },
    TAL_gen_second_souffle: { FR: "Second souffle", EN: "Second Wind", ZH: "重振" },
    TAL_gen_second_souffle_D:{ FR: "Sous %s %% PV : régénère %s %% PV max par tour.", EN: "Below %s%% HP: regenerates %s%% max HP per turn.", ZH: "生命低于 %s%% 时：每回合回复 %s%% 最大生命。" },
    TAL_gen_elan:           { FR: "Élan", EN: "Rally", ZH: "士气" },
    TAL_gen_elan_D:         { FR: "+%s %% ATK par allié encore en vie.", EN: "+%s%% ATK per ally still alive.", ZH: "每有一名存活队友：+%s%% 攻击。" },
    TAL_gen_renaissance:    { FR: "Renaissance", EN: "Rebirth", ZH: "重生" },
    TAL_gen_renaissance_D:  { FR: "La première fois qu'elle tombe à 0 PV : revient avec %s %% PV (une fois par combat).", EN: "The first time it drops to 0 HP: revives with %s%% HP (once per battle).", ZH: "首次生命归零时：以 %s%% 生命复活（每场一次）。" },
    TAL_gen_apogee:         { FR: "Apogée", EN: "Apex", ZH: "巅峰" },
    TAL_gen_apogee_D:       { FR: "Après le tour %s : +%s %% à toutes les stats.", EN: "After turn %s: +%s%% to all stats.", ZH: "第 %s 回合后：全属性 +%s%%。" },
    // MINING — endurance / attrition
    TAL_min_tenacite:       { FR: "Ténacité", EN: "Tenacity", ZH: "坚韧" },
    TAL_min_tenacite_D:     { FR: "−%s %% dégâts subis tant qu'elle est au-dessus de %s %% PV.", EN: "−%s%% damage taken while above %s%% HP.", ZH: "受到伤害 −%s%%（生命高于 %s%% 时）。" },
    TAL_min_recuperation:   { FR: "Récupération", EN: "Recovery", ZH: "恢复" },
    TAL_min_recuperation_D: { FR: "Régénère %s %% PV max à chaque tour.", EN: "Regenerates %s%% max HP every turn.", ZH: "每回合回复 %s%% 最大生命。" },
    TAL_min_roc:            { FR: "Roc", EN: "Bedrock", ZH: "磐石" },
    TAL_min_roc_D:          { FR: "Immunise contre le premier affaiblissement de stat reçu.", EN: "Immune to the first stat debuff received.", ZH: "免疫受到的第一个属性削弱。" },
    TAL_min_contrepoids:    { FR: "Contrepoids", EN: "Counterweight", ZH: "制衡" },
    TAL_min_contrepoids_D:  { FR: "Sous %s %% PV : +%s %% DEF et +%s %% ATK.", EN: "Below %s%% HP: +%s%% DEF and +%s%% ATK.", ZH: "生命低于 %s%% 时：+%s%% 防御和 +%s%% 攻击。" },
    TAL_min_inebranlable:   { FR: "Inébranlable", EN: "Unshakable", ZH: "不动如山" },
    TAL_min_inebranlable_D: { FR: "Au-dessus de %s %% PV : ne peut pas être abattue en un seul coup (reste à 1 PV).", EN: "Above %s%% HP: cannot be killed in a single hit (survives at 1 HP).", ZH: "生命高于 %s%% 时：无法被一击击杀（保留 1 点生命）。" },
    TAL_min_attrition:      { FR: "Attrition", EN: "Attrition", ZH: "磨耗" },
    TAL_min_attrition_D:    { FR: "+%s %% dégâts infligés par tour écoulé (plafond +100 %%).", EN: "+%s%% damage dealt per elapsed turn (cap +100%%).", ZH: "每经过一回合伤害 +%s%%（上限 +100%%）。" },
    // BLOCK — forteresse / riposte
    TAL_blk_riposte:        { FR: "Riposte", EN: "Retaliation", ZH: "反击" },
    TAL_blk_riposte_D:      { FR: "Renvoie %s %% des dégâts subis à l'attaquant.", EN: "Reflects %s%% of damage taken back to the attacker.", ZH: "将受到伤害的 %s%% 反弹给攻击者。" },
    TAL_blk_blindage:       { FR: "Blindage", EN: "Plating", ZH: "装甲" },
    TAL_blk_blindage_D:     { FR: "−%s %% dégâts subis pendant les %s premiers tours.", EN: "−%s%% damage taken during the first %s turns.", ZH: "受到伤害 −%s%%（前 %s 回合）。" },
    TAL_blk_provocation:    { FR: "Provocation", EN: "Taunt", ZH: "嘲讽" },
    TAL_blk_provocation_D:  { FR: "Attire les attaques ennemies sur elle (protège l'arrière-garde).", EN: "Draws enemy attacks to itself (protects the back line).", ZH: "吸引敌方攻击（保护后排）。" },
    TAL_blk_endurance:      { FR: "Endurance", EN: "Endurance", ZH: "耐力" },
    TAL_blk_endurance_D:    { FR: "Sous %s %% PV : +%s %% DEF.", EN: "Below %s%% HP: +%s%% DEF.", ZH: "生命低于 %s%% 时：+%s%% 防御。" },
    TAL_blk_rempart:        { FR: "Dernier rempart", EN: "Last Bastion", ZH: "最后壁垒" },
    TAL_blk_rempart_D:      { FR: "La première fois qu'un coup serait fatal : survit avec 1 PV (une fois par combat).", EN: "The first time a hit would be fatal: survives at 1 HP (once per battle).", ZH: "首次受到致命一击时：以 1 点生命存活（每场一次）。" },
    TAL_blk_forteresse:     { FR: "Forteresse", EN: "Fortress", ZH: "堡垒" },
    TAL_blk_forteresse_D:   { FR: "Sous %s %% PV : renvoie en plus %s %% des dégâts subis à toute l'équipe adverse.", EN: "Below %s%% HP: additionally reflects %s%% of damage taken to the whole enemy team.", ZH: "生命低于 %s%% 时：额外将受到伤害的 %s%% 反弹给敌方全队。" },
```

- [ ] **Step 4: Vérifier que les tests passent**

Run: `node --test test/talents-i18n.test.js`
Expected: PASS (4 tests). Si le test des placeholders échoue sur une langue : corriger le template (ordre/nombre de `%s` = tableau `descArgs`).

- [ ] **Step 5: Lancer toute la suite (non-régression i18n existante)**

Run: `node --test`
Expected: PASS (tous les tests du dépôt, y compris les tests i18n préexistants)

- [ ] **Step 6: Commit**

```bash
git add i18n.js test/talents-i18n.test.js
git commit -m "feat(talents): i18n FR/EN/ZH — 36 noms + descriptions dérivées du catalogue calibré

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Action `chooseTalent` dans `app.jsx`

**Files:**
- Modify: `app.jsx` — ajouter la méthode dans l'objet `actions`, juste après `relicEquip` (vers `app.jsx:790`)

**Interfaces:**
- Consumes: `API_URL` (`app.jsx:16`), `gRef`/`setG`/`svOpts()`/`serverToState()` (déjà dans `app.jsx`), `window.FA_I18N` (constante `I18N` déjà importée dans `app.jsx`).
- Produces: `actions.chooseTalent(beastId, tier, talentId)` → `Promise<{ ok: boolean, reason?: string, cost?: number }>`. Adopte `data.creatures` immédiatement ; re-fetch `/save` complet si `cost > 0` (le respec débite le solde FA).

- [ ] **Step 1: Ajouter la méthode**

Dans l'objet `actions` de `app.jsx`, immédiatement après la méthode `relicEquip` (même style, même gestion d'erreur) :

```js
    // Talents : choix / respec d'un talent de palier. Le serveur renvoie creatures
    // directement ; un respec payant change aussi le solde → re-fetch /save complet.
    async chooseTalent(beastId, tier, talentId) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/talents/choose`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ beast_id: beastId, tier: tier | 0, talent_id: talentId }),
        });
        const data = await resp.json();
        if (data.status !== "ok") {
          const map = { palier_verrouille: "TAL_ERR_LOCKED", deja_choisi: "TAL_ERR_ALREADY", solde_insuffisant: "TAL_ERR_BALANCE" };
          return { ok: false, reason: map[data.error] ? I18N.t(map[data.error]) : (data.error || "Erreur serveur") };
        }
        if (Array.isArray(data.creatures)) setG((st) => ({ ...st, roster: data.creatures }));
        if (data.cost > 0) {
          const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
          if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        }
        return { ok: true, cost: data.cost };
      } catch (e) {
        return { ok: false, reason: "Erreur réseau" };
      }
    },
```

Note d'implémentation : vérifier que `I18N` est bien visible à cet endroit d'`app.jsx` (il l'est dans `reroll` — même portée). Si le nom local diffère (ex. `const I18N = window.FA_I18N;` en tête), réutiliser exactement le nom existant.

- [ ] **Step 2: Vérification syntaxique**

`app.jsx` n'est pas testable en node (JSX transpilé au runtime). Contrôle statique minimal :

Run: `npx --yes @babel/cli --presets @babel/preset-react --out-file /dev/null app.jsx 2>&1 | tail -n 2 || node -e "console.log('babel indisponible — vérification différée au test navigateur (Task 6)')"`
Expected: pas d'erreur de syntaxe (ou message de report à la Task 6 si babel indisponible hors-ligne). La vérification fonctionnelle réelle a lieu en Task 6.

- [ ] **Step 3: Commit**

```bash
git add app.jsx
git commit -m "feat(talents): action chooseTalent — POST /talents/choose, adoption creatures + resync solde si respec payant

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Composant `TalentSlot` + branchement écran Équipe + `index.html`

**Files:**
- Modify: `screens.jsx` — ajouter `TalentSlot` juste après `RelicSlot` (qui se termine vers `screens.jsx:121`) ; rendre `<TalentSlot beast={b} />` sous `<RelicSlot beast={b} />` dans `Team()` (vers `screens.jsx:64`)
- Modify: `index.html` — 2 nouvelles balises script + bump global `?v=61` → `?v=62`

**Interfaces:**
- Consumes: `actions.chooseTalent` (Task 4), `window.FA_TALENTS` (Task 1), `window.FA_TALENTS_UI` (Task 2), clés i18n `TAL_*` (Task 3), `Modal`/`cx`/`useFA`/`D`/`I18N` (déjà importés en tête de `screens.jsx` — réutiliser les mêmes noms locaux que `RelicSlot`).
- Produces: composant `TalentSlot({ beast })` rendu sous chaque carte de l'écran Équipe. Pas d'export global nécessaire si `Team` et `TalentSlot` vivent dans le même fichier.

- [ ] **Step 1: Ajouter le composant `TalentSlot` dans `screens.jsx`**

Juste après la fonction `RelicSlot` (adapter les noms d'imports en tête de fichier UNIQUEMENT s'ils diffèrent — copier le style exact de `RelicSlot` : `useFA`, `toast`, `busy`, classes CSS) :

```jsx
/* --- Bande talents sous la carte : 3 paliers L25/50/75, 1 choix parmi 2 --- */
function TalentSlot({ beast }) {
  const { actions, toast } = useFA();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const TAL = window.FA_TALENTS, TUI = window.FA_TALENTS_UI;
  const slots = TUI.slotState(beast);
  const nUnlocked = slots.filter((sl) => sl.unlocked).length;
  const nChosen = slots.filter((sl) => sl.unlocked && sl.chosen).length;

  const pick = async (tierKey, talentId) => {
    if (busy) return;
    setBusy(true);
    const r = await actions.chooseTalent(beast.id, Number(tierKey), talentId);
    setBusy(false);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t("TAL_TITLE") + " ✓", "good");
  };

  return (
    <>
      {/* Bande calquée sur RelicSlot : la classe .relic-slot n'a PAS de règle CSS,
          le rendu vient du style inline — copier className+style de RelicSlot tels quels. */}
      <div className="relic-slot mono" onClick={() => setOpen(true)} title={I18N.t("TAL_TITLE")}
           style={{ cursor: "pointer", fontSize: 11, padding: "4px 8px", border: "1px solid var(--line)", borderRadius: 8, display: "flex", gap: 6, alignItems: "center" }}>
        {nUnlocked === 0
          ? <span className="muted">✦ {I18N.t("TAL_NONE_UNLOCKED")}</span>
          : <span>✦ {I18N.t("TAL_TITLE")} {nChosen}/{nUnlocked}</span>}
      </div>
      {open && (
        <Modal onClose={() => setOpen(false)} accent={D.RARITY_COLORS[beast.rarity]} wide>
          <h3>{I18N.t("TAL_TITLE")} — {D.displayName(beast)}</h3>
          {slots.map(({ key, unlocked, chosen }) => {
            const { cost, freeRespec } = TUI.chooseCost(beast, key);
            return (
              <div key={key} className="panel" style={{ marginBottom: 8, opacity: unlocked ? 1 : 0.55 }}>
                <div className="flex between center">
                  <b>{I18N.t("TAL_TIER", key)}</b>
                  {!unlocked && <span className="muted">{I18N.t("TAL_TIER_LOCKED", key)}</span>}
                  {unlocked && !chosen && <span className="muted">{I18N.t("TAL_PICK_FREE")}</span>}
                  {unlocked && chosen && (freeRespec
                    ? <span className="muted">{I18N.t("TAL_RESPEC_FREE")}</span>
                    : <span className="muted">{I18N.t("TAL_RESPEC_COST", cost)}</span>)}
                </div>
                {unlocked && (
                  <div className="flex wrap" style={{ gap: 6, marginTop: 6 }}>
                    {TAL.talentsFor(beast.type, Number(key)).map((t) => {
                      const on = chosen === t.id;
                      return (
                        <button key={t.id} disabled={busy || on}
                                className={cx("btn sm", on && "on")}
                                onClick={() => pick(key, t.id)}
                                style={{ flex: 1, minWidth: 150, textAlign: "left" }}>
                          <b>{I18N.t("TAL_" + t.id)}</b>{on ? " ✓" : ""}
                          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                            {TUI.talentDesc(t, beast.rarity, I18N.t)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Modal>
      )}
    </>
  );
}
```

- [ ] **Step 2: Rendre le slot dans `Team()`**

Dans la boucle des cartes de `Team()` (vers `screens.jsx:64`), ajouter la ligne sous `RelicSlot` :

```jsx
        <CreatureCard beast={b} selectable selected={…} onClick={() => toggle(b)} showXp />
        <RelicSlot beast={b} />
        <TalentSlot beast={b} />
```

(Ne toucher à rien d'autre dans la boucle — la ligne `<TalentSlot beast={b} />` est le seul ajout.)

- [ ] **Step 3: Brancher les scripts dans `index.html` + cache-bust**

1. Ajouter, dans le bloc des modules JS purs, juste après la ligne `forge-ui.js` (vers `index.html:81`) :

```html
    <script src="talents-data.js?v=62"></script>
    <script src="talents-ui.js?v=62"></script>
```

2. Bumper TOUS les `?v=61` existants en `?v=62` :

Run: `git grep -c "?v=61" index.html` (compter), puis remplacer :
```bash
sed -i "s/?v=61/?v=62/g" index.html
git grep -c "?v=62" index.html && ! git grep -q "?v=61" index.html && echo "BUMP OK"
```
Expected: `BUMP OK` (plus aucun `?v=61`).

- [ ] **Step 4: Suite de tests complète**

Run: `node --test`
Expected: PASS (aucune régression — les JSX ne sont pas couverts par node, vérifiés en Task 6)

- [ ] **Step 5: Commit**

```bash
git add screens.jsx index.html
git commit -m "feat(talents): panneau TalentSlot sous chaque carte (écran Équipe) + branchement scripts v62

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Vérification navigateur bout-en-bout + PR

**Files:**
- Aucune création attendue (corrections éventuelles uniquement).

**Interfaces:**
- Consumes: tout le travail des Tasks 1-5.
- Produces: preuve visuelle (screenshot) + PR GitHub `feat/talents-web` → `main` sur `Arthefacte/fractal-arena-web`.

- [ ] **Step 1: Servir le site en local**

REQUIRED SUB-SKILL à ce stade : utiliser la skill `verify` (qui pilote l'app réelle). À défaut :

Run: `npx --yes serve -l 8123 .` (ou `python -m http.server 8123`) depuis la racine du dépôt web, puis ouvrir `http://localhost:8123`.

- [ ] **Step 2: Vérifier le chargement sans erreur console**

Ouvrir la console navigateur. Expected : aucune erreur Babel/JS ; `window.FA_TALENTS.TALENT_LIST.length === 36` et `window.FA_TALENTS_UI` défini (taper dans la console).

- [ ] **Step 3: Vérifier le panneau à froid (sans wallet)**

L'écran Équipe (roster de démo/starter) doit afficher la bande « ✦ Premier talent au niveau 25 » sous chaque bête < L25, et « ✦ Talents 0/N » pour les bêtes ≥ L25. Ouvrir la modale : paliers verrouillés grisés avec « Verrouillé — atteins le niveau X », paliers débloqués avec 2 options nommées + descriptions chiffrées (vérifier qu'un talent Rare affiche des valeurs ×1.3 vs Common). Basculer la langue EN puis ZH : noms + descriptions traduits.

- [ ] **Step 4: Vérifier le flux authentifié (wallet + serveur prod)**

Avec un wallet connecté possédant une bête ≥ L25 : choisir un talent (1er choix) → toast succès, option cochée ✓, `cost` 0. Rechoisir l'autre option → le libellé « Changer : 500 FA » est visible avant clic, le solde FA diminue de 500 après (resync `/save`), et le talent actif change. Si aucune bête éligible n'est disponible sur le wallet de test, documenter dans la PR que le flux payant a été vérifié via la réponse serveur uniquement.

- [ ] **Step 5: Screenshot + PR**

```bash
git push -u origin feat/talents-web
gh pr create --repo Arthefacte/fractal-arena-web --base main --head feat/talents-web \
  --title "feat(talents): panneau Talents par palier (UI web du serveur PR#48)" \
  --body "## Résumé
- Miroir client du catalogue calibré (talents-data.js, 36 talents, test sentinelle anti-dérive)
- Helpers purs talents-ui.js : déblocage L25/50/75 (miroir syncTalentSlots), coût de respec, descriptions scalées par rareté
- i18n FR/EN/ZH : 36 noms + 36 descriptions dérivées des valeurs calibrées (jamais de la spec §5) + chrome du panneau
- actions.chooseTalent → POST /talents/choose (Bearer), adoption creatures + resync /save si respec payant
- TalentSlot sous chaque carte de l'écran Équipe (patron RelicSlot), cache-bust v62

## Tests
- node --test : suites talents-data / talents-ui / talents-i18n + non-régression
- Vérif navigateur : chargement, modale, verrouillage par niveau, choix + respec, 3 langues

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Expected: PR créée. **Ne pas merger** — laisser la décision au user (le merge sur `main` déploie en prod via GitHub Pages).

- [ ] **Step 6: Rapport final**

Résumer au user : ce qui est vérifié (avec la sortie de `node --test` et le screenshot), le lien de la PR, et rappeler que le merge déploie sur fractalarena.com.
