# Tour infinie — Auto-combat — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton « ⏩ Auto » dans la Tour infinie qui enchaîne les étages en engageant automatiquement les 3 bêtes les plus en forme, avec un log rapide, jusqu'à la fin naturelle du run.

**Architecture:** Boucle purement client par-dessus la route existante `POST /tower/fight` (Tour = 100 % serveur-autoritaire). Un helper pur `pickFittest3` (testable Node) décide de la rotation ; la boucle vit dans `tour.jsx` ; un throttle par wallet côté serveur borne la cadence et solde la dette « aucun rate-limit sur /tower ».

**Tech Stack:** React (JSX in-browser via Babel, pas de build), Node.js/Express + PostgreSQL (serveur), tests via `node:test`.

## Global Constraints

- **Deux dépôts.** Web : `fractal-arena-web`. Serveur : `fractal-arena-server`. Ne jamais mélanger les commits entre les deux.
- **Ordre de déploiement.** Le web (gestion du `429 trop_rapide`) doit partir **avant ou en même temps** que le serveur — jamais le serveur en avance sur un client qui ignore le 429.
- **i18n = 3 langues.** Toute clé nouvelle doit exister en `FR`, `EN`, `ZH` (test de parité `test/tour-i18n.test.js`). Nombre de `%d`/`%s` identique dans les 3 langues ; aucun `%` dans une clé 0-arg.
- **Helpers purs testables.** La logique de décision va dans `tour-ui.js` (module `window.FA_TOUR_UI`), pas dans le JSX. `tour.jsx` n'est pas testé unitairement — il se vérifie au navigateur.
- **`CHAT_SYSTEM_PROMPT` (`server.js`).** Toute PR serveur touchant une mécanique visible joueur met à jour ce prompt dans la même PR (règle CLAUDE.md serveur).
- **Ne pas toucher à l'équilibrage.** Aucune modif des `TIERS`, coûts, scaling, classement. L'auto ne fait que boucler `/tower/fight`.
- **Tests serveur :** `node --test test/tower.routes.test.js` (le run complet `node --test` ne se termine jamais → viser le fichier, ou `--test-force-exit`).

---

### Task 1 — Helper `pickFittest3` (web)

**Files:**
- Modify: `fractal-arena-web/tour-ui.js` (ajout dans l'IIFE `FA_TOUR_UI`, autour de la ligne 62 avant `window.FA_TOUR_UI = {...}`)
- Test: `fractal-arena-web/test/tour-ui.test.js`

**Interfaces:**
- Consumes: `isDeadInRun(rosterState, id)`, `hpFracOf(rosterState, id)` (déjà dans `FA_TOUR_UI`).
- Produces: `FA_TOUR_UI.pickFittest3(roster, rosterState) → string[3] | null` — renvoie les IDs des 3 bêtes vivantes au `hp_frac` le plus haut (ordre = décroissant, la plus en forme en premier ; départage stable par ordre du roster), ou `null` s'il reste moins de 3 vivantes.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à la fin de `fractal-arena-web/test/tour-ui.test.js` :

```js
test("pickFittest3 : 3 IDs vivants au hp_frac le plus haut, ordre décroissant", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }, { id: "e" }];
  const rs = {
    a: { hp_frac: 0.30 }, b: { hp_frac: 0.90 }, c: { hp_frac: 0.10 },
    d: { hp_frac: 0.60 }, e: { hp_frac: 1.0 },
  };
  assert.deepStrictEqual(TU.pickFittest3(roster, rs), ["e", "b", "d"]);
});

test("pickFittest3 : ignore les mortes, null si < 3 vivantes", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const rs = { b: { hp_frac: 0, dead: true } };
  assert.strictEqual(TU.pickFittest3(roster, rs), null, "2 vivantes → null");
  // roster vierge (aucun state) → 3 premiers
  assert.deepStrictEqual(TU.pickFittest3(roster, {}), ["a", "b", "c"]);
});

test("pickFittest3 : départage stable par ordre du roster à hp_frac égal", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const rs = { a: { hp_frac: 0.5 }, b: { hp_frac: 0.5 }, c: { hp_frac: 0.5 }, d: { hp_frac: 0.5 } };
  assert.deepStrictEqual(TU.pickFittest3(roster, rs), ["a", "b", "c"]);
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd fractal-arena-web && node --test test/tour-ui.test.js`
Expected: FAIL — `TU.pickFittest3 is not a function`

- [ ] **Step 3: Implémenter le helper**

Dans `fractal-arena-web/tour-ui.js`, juste avant la ligne `window.FA_TOUR_UI = { ... }` :

```js
  // Rotation auto (auto-combat) : les 3 vivantes au hp_frac le plus haut, la plus
  // en forme d'abord (front). Départage déterministe par ordre du roster (testable).
  // null si < 3 vivantes → signal d'arrêt de la boucle auto.
  function pickFittest3(roster, rosterState) {
    const list = roster || [];
    const alive = list.filter((b) => b && !isDeadInRun(rosterState, b.id));
    if (alive.length < 3) return null;
    const idx = new Map(list.map((b, i) => [b.id, i]));
    const sorted = alive.slice().sort((a, b) => {
      const d = hpFracOf(rosterState, b.id) - hpFracOf(rosterState, a.id);
      return d !== 0 ? d : idx.get(a.id) - idx.get(b.id);
    });
    return sorted.slice(0, 3).map((b) => b.id);
  }
```

Puis ajouter `pickFittest3` à l'export :

```js
  window.FA_TOUR_UI = { ENTRY_COST, TIERS, tiersView, hpFracOf, isDeadInRun, rosterRunView, aliveCount, validateEngage, nextTier, pickFittest3 };
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd fractal-arena-web && node --test test/tour-ui.test.js`
Expected: PASS (tous les tests, anciens + 3 nouveaux)

- [ ] **Step 5: Commit**

```bash
cd fractal-arena-web
git add tour-ui.js test/tour-ui.test.js
git commit -m "feat(tour): helper pickFittest3 pour la rotation auto-combat"
```

---

### Task 2 — Throttle serveur sur `/tower/fight` + prompt chat (serveur)

**Files:**
- Modify: `fractal-arena-server/tower.js` (fonction `setupTowerRoutes`, handler `app.post("/tower/fight", …)` vers la ligne 303)
- Modify: `fractal-arena-server/server.js` (`CHAT_SYSTEM_PROMPT`)
- Test: `fractal-arena-server/test/tower.routes.test.js`

**Interfaces:**
- Consumes: `req.authenticated_wallet` (posé par `requireWalletAuth`).
- Produces: `POST /tower/fight` renvoie `429 { error: "trop_rapide" }` si deux appels du même wallet sont espacés de moins de `MIN_FIGHT_INTERVAL_MS` (250 ms). La `Map` de timestamps est **une closure de `setupTowerRoutes`** → 1 par process en prod, 1 par instance de handlers en test (donc les tests existants qui construisent leurs propres handlers ne sont pas affectés).

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `fractal-arena-server/test/tower.routes.test.js` (après les tests de start) :

```js
test("fight : deuxième appel rapproché du même wallet → 429 trop_rapide", async () => {
  const state = makeState(); // pas de run actif : peu importe, le throttle agit avant la logique
  const h = handlers(state);
  const res1 = mockRes();
  await h["POST /tower/fight"](authReq({ beast_ids: ["a", "b", "c"] }), res1);
  // 1er appel : le throttle laisse passer (marque le timestamp), puis 400 pas_de_run
  assert.strictEqual(res1.body.error, "pas_de_run");
  const res2 = mockRes();
  await h["POST /tower/fight"](authReq({ beast_ids: ["a", "b", "c"] }), res2);
  assert.strictEqual(res2.statusCode, 429);
  assert.strictEqual(res2.body.error, "trop_rapide");
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd fractal-arena-server && node --test test/tower.routes.test.js`
Expected: FAIL — `res2.statusCode` vaut 400 (`pas_de_run`), pas 429.

- [ ] **Step 3: Implémenter le throttle**

Dans `fractal-arena-server/tower.js`, au tout début du corps de `function setupTowerRoutes(app, pool) {` (ligne 259) :

```js
  // Throttle anti-rafale par wallet sur /tower/fight (auto-combat) : borne la cadence
  // pour protéger la DB (chaque fight = transaction FOR UPDATE). Closure → état par
  // process en prod, par instance en test. Le client auto attend 350 ms → jamais bridé.
  const MIN_FIGHT_INTERVAL_MS = 250;
  const lastFightAt = new Map(); // wallet → ts
```

Puis, dans le handler `app.post("/tower/fight", …)`, juste après `const wallet = req.authenticated_wallet;` (avant la validation `beast_ids`) :

```js
      const nowTs = Date.now();
      const prevTs = lastFightAt.get(wallet);
      if (prevTs !== undefined && nowTs - prevTs < MIN_FIGHT_INTERVAL_MS) {
        return res.status(429).json({ error: "trop_rapide" });
      }
      lastFightAt.set(wallet, nowTs);
      if (lastFightAt.size > 500) { // purge paresseuse des entrées > 60 s
        for (const [w, t] of lastFightAt) if (nowTs - t > 60000) lastFightAt.delete(w);
      }
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd fractal-arena-server && node --test test/tower.routes.test.js`
Expected: PASS (le nouveau test + tous les tests routes existants — ils construisent chacun leurs handlers, donc gardent une `Map` vierge).

- [ ] **Step 5: Mettre à jour `CHAT_SYSTEM_PROMPT`**

Dans `fractal-arena-server/server.js`, repérer la section du prompt décrivant la Tour infinie et ajouter une phrase (ne pas inventer de chiffre) :

```
Dans la Tour infinie, un bouton « Auto » enchaîne automatiquement les étages en
engageant les créatures les plus en forme, jusqu'à la fin du run.
```

Vérifier qu'aucun coût/seuil n'a changé (rien à modifier d'autre : l'auto ne touche ni à l'entrée gratuite/2000 FA, ni aux paliers).

- [ ] **Step 6: Commit**

```bash
cd fractal-arena-server
git add tower.js server.js test/tower.routes.test.js
git commit -m "feat(tower): throttle /tower/fight par wallet + mention auto dans le prompt chat"
```

---

### Task 3 — Clés i18n de l'auto-combat (web)

**Files:**
- Modify: `fractal-arena-web/i18n.js` (bloc des clés `TOUR_*`, vers les lignes 546-569)
- Test: `fractal-arena-web/test/tour-i18n.test.js` (ajout des clés à `KEYS`)

**Interfaces:**
- Produces: clés `TOUR_AUTO` (0), `TOUR_AUTO_STOP` (0), `TOUR_AUTO_RUNNING` (0), `TOUR_AUTO_LOG_WIN` (1), `TOUR_AUTO_LOG_LOSS` (1), `TOUR_AUTO_RECAP_TITLE` (0), `TOUR_AUTO_RECAP_CLIMB` (2) — consommées par `tour.jsx` en Task 4.

- [ ] **Step 1: Écrire le test qui échoue**

Dans `fractal-arena-web/test/tour-i18n.test.js`, ajouter au tableau `KEYS` (après la ligne `TOUR_ABANDON...`) :

```js
  ["TOUR_AUTO", 0], ["TOUR_AUTO_STOP", 0], ["TOUR_AUTO_RUNNING", 0],
  ["TOUR_AUTO_LOG_WIN", 1], ["TOUR_AUTO_LOG_LOSS", 1],
  ["TOUR_AUTO_RECAP_TITLE", 0], ["TOUR_AUTO_RECAP_CLIMB", 2],
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd fractal-arena-web && node --test test/tour-i18n.test.js`
Expected: FAIL — `clé manquante : TOUR_AUTO`

- [ ] **Step 3: Ajouter les clés dans `i18n.js`**

Dans `fractal-arena-web/i18n.js`, juste après la ligne `TOUR_ABANDON_CONFIRM` (bloc TOUR) :

```js
    TOUR_AUTO: { FR: "⏩ Auto", EN: "⏩ Auto", ZH: "⏩ 自动" },
    TOUR_AUTO_STOP: { FR: "⏹ Stop", EN: "⏹ Stop", ZH: "⏹ 停止" },
    TOUR_AUTO_RUNNING: { FR: "Auto en cours…", EN: "Auto running…", ZH: "自动进行中…" },
    TOUR_AUTO_LOG_WIN: { FR: "Étage %d ✓", EN: "Floor %d ✓", ZH: "第%d层 ✓" },
    TOUR_AUTO_LOG_LOSS: { FR: "Étage %d ✗", EN: "Floor %d ✗", ZH: "第%d层 ✗" },
    TOUR_AUTO_RECAP_TITLE: { FR: "Run terminé", EN: "Run over", ZH: "挑战结束" },
    TOUR_AUTO_RECAP_CLIMB: { FR: "Étage %d → %d", EN: "Floor %d → %d", ZH: "第%d层 → 第%d层" },
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd fractal-arena-web && node --test test/tour-i18n.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd fractal-arena-web
git add i18n.js test/tour-i18n.test.js
git commit -m "feat(tour): clés i18n de l'auto-combat (FR/EN/ZH)"
```

---

### Task 4 — Boucle auto + UI dans `tour.jsx` (web)

**Files:**
- Modify: `fractal-arena-web/tour.jsx` (composant `Tour`, vers les lignes 166-317)
- Vérification: skill `fractal-arena-web:verify` (Playwright, navigateur réel) — `tour.jsx` n'a pas de test unitaire.

**Interfaces:**
- Consumes: `TU.pickFittest3` (Task 1), `TU.isDeadInRun`, `actions.towerFight` (renvoie `{ ok, won, floor, bestFloor, rewards:{fa,silver,gold,tiers}, runOver, rosterState }`, `reason:"trop_rapide"` sur 429), clés i18n (Task 3), `tourErr`, `D.displayName`, `Modal`, `toast`.
- Produces: comportement UI (bouton Auto, log, Stop, modale récap). Rien n'est réexporté.

- [ ] **Step 1: Ajouter l'état et les helpers de boucle**

Dans `function Tour()`, après la ligne `const [result, setResult] = useState(null);` (≈ ligne 174) :

```js
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoLog, setAutoLog] = useState([]);      // [{ floor, won, casualties:[nom], tiers:[floor] }]
  const [autoRecap, setAutoRecap] = useState(null); // { startFloor, bestFloor, tiers:[], silver, gold }
  const stopRef = React.useRef(false);
```

Puis, à côté des fonctions `onStart`/`onFight` (dans le corps de `Tour`), ajouter la boucle et ses utilitaires :

```js
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

  // Bêtes passées de vivantes à mortes entre deux états de run (pour le log).
  function newCasualties(prevState, nextState) {
    const names = [];
    for (const b of g.roster) {
      if (!TU.isDeadInRun(prevState, b.id) && TU.isDeadInRun(nextState, b.id)) names.push(D.displayName(b));
    }
    return names;
  }

  async function onAuto() {
    if (busy || autoRunning || !run) return;
    stopRef.current = false;
    setAutoRunning(true);
    setAutoLog([]);
    let curState = run.roster_state || {};
    let curFloor = run.floor;
    const startFloor = run.floor;
    const sessionTiers = []; let sSilver = 0, sGold = 0, sessionBest = 0;
    try {
      while (!stopRef.current) {
        const fittest = TU.pickFittest3(g.roster, curState);
        if (!fittest) break; // < 3 vivantes → run terminé
        const r = await actions.towerFight(fittest, posture);
        if (!r.ok) {
          if (r.reason === "trop_rapide") { await sleep(300); continue; } // throttle serveur : ré-attente
          toast(tourErr(r.reason), "bad");
          break;
        }
        const nextState = r.rosterState || {};
        const casualties = newCasualties(curState, nextState);
        setAutoLog((L) => [...L, { floor: curFloor, won: r.won, casualties, tiers: r.rewards.tiers }]);
        r.rewards.tiers.forEach((f) => sessionTiers.push(f));
        sSilver += r.rewards.silver || 0; sGold += r.rewards.gold || 0;
        if (r.won) sessionBest = Math.max(sessionBest, curFloor);
        setSt((s) => ({
          ...s,
          run: r.runOver ? null : { floor: r.floor, roster_state: nextState },
          score: {
            ...s.score,
            best_floor: Math.max(s.score.best_floor, r.bestFloor),
            claimed_tiers: Array.from(new Set([...(s.score.claimed_tiers || []), ...r.rewards.tiers])),
          },
        }));
        curState = nextState;
        curFloor = r.runOver ? curFloor : r.floor;
        if (r.runOver) break;
        if (stopRef.current) break;
        await sleep(350);
      }
    } finally {
      setAutoRunning(false);
      setAutoRecap({ startFloor, bestFloor: sessionBest, tiers: sessionTiers, silver: sSilver, gold: sGold });
    }
  }
```

- [ ] **Step 2: Ajouter le bouton Auto et le bloc log dans le panneau de run**

Dans le JSX du run actif (le `<div className="panel oct" style={{ border: "1px solid var(--elec)", …}}>` autour de la ligne 269), remplacer la rangée posture/combat (le `<div className="flex between center wrap" style={{ gap: 12 }}>` ≈ lignes 284-289) par :

```jsx
          {autoRunning ? (
            <div>
              <div className="flex between center" style={{ marginBottom: 8 }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--elec)" }}>{I18N.t("TOUR_AUTO_RUNNING")}</span>
                <button className="btn btn-fire sm" onClick={() => { stopRef.current = true; }}>{I18N.t("TOUR_AUTO_STOP")}</button>
              </div>
              <div className="mono" style={{ maxHeight: 180, overflowY: "auto", fontSize: 11, display: "flex", flexDirection: "column-reverse", gap: 2, background: "rgba(0,0,0,0.2)", padding: 8, border: "1px solid var(--line-soft)" }}>
                {autoLog.slice().reverse().map((e, i) => (
                  <div key={autoLog.length - i} style={{ color: e.won ? "var(--success)" : "var(--alert)" }}>
                    {I18N.t(e.won ? "TOUR_AUTO_LOG_WIN" : "TOUR_AUTO_LOG_LOSS", e.floor)}
                    {e.tiers.length > 0 && <span style={{ color: "var(--gold)" }}> 🏆</span>}
                    {e.casualties.length > 0 && <span style={{ color: "var(--text-dim)" }}> · {e.casualties.join(", ")} ☠</span>}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex between center wrap" style={{ gap: 12 }}>
              <PostureSelect value={posture} onChange={setPosture} disabled={busy} />
              <div className="flex gap8">
                {TU.pickFittest3(g.roster, rosterState) && (
                  <button className="btn btn-elec lg" onClick={onAuto} disabled={busy}>{I18N.t("TOUR_AUTO")}</button>
                )}
                {engage.ok
                  ? <button className="btn btn-fire lg" onClick={onFight} disabled={busy}>{I18N.t("TOUR_FIGHT", run.floor)}</button>
                  : <span className="mono" style={{ fontSize: 12, color: "var(--alert)" }}>{I18N.t("TOUR_NEED3")}</span>}
              </div>
            </div>
          )}
```

Désactiver aussi le bouton « Abandonner » pendant l'auto : dans le header du run (≈ ligne 273), remplacer `disabled={busy}` par `disabled={busy || autoRunning}` sur le bouton `TOUR_ABANDON`.

- [ ] **Step 3: Ajouter la modale récap de fin d'auto**

À côté des autres modales à la fin du `return` de `Tour` (après `{!battle && result && <TourResultModal … />}`, ≈ ligne 314) :

```jsx
      {autoRecap && (
        <Modal onClose={() => { setAutoRecap(null); refresh(); }} accent="var(--elec)">
          <div className="h1" style={{ fontSize: 22, textAlign: "center", margin: "4px 0 12px" }}>{I18N.t("TOUR_AUTO_RECAP_TITLE")}</div>
          <div className="mono" style={{ fontSize: 14, textAlign: "center", color: "var(--elec)", marginBottom: 12 }}>
            {I18N.t("TOUR_AUTO_RECAP_CLIMB", autoRecap.startFloor, Math.max(autoRecap.startFloor, autoRecap.bestFloor))}
          </div>
          {autoRecap.tiers.length > 0 && (
            <div className="mono" style={{ fontSize: 12, textAlign: "center", color: "var(--gold)", marginBottom: 8 }}>
              🏆 {autoRecap.tiers.map((f) => I18N.t("TOUR_FLOOR", f)).join(" · ")}
            </div>
          )}
          {(autoRecap.silver > 0 || autoRecap.gold > 0) && (
            <div className="mono" style={{ fontSize: 12, textAlign: "center", marginBottom: 8 }}>
              {autoRecap.silver > 0 && <span style={{ color: "var(--elec)" }}>+{autoRecap.silver} 🎟 </span>}
              {autoRecap.gold > 0 && <span style={{ color: "var(--gold)" }}>+{autoRecap.gold} 🎟</span>}
            </div>
          )}
          <button className="btn btn-elec block lg" style={{ marginTop: 10 }} onClick={() => { setAutoRecap(null); refresh(); }}>{I18N.t("TOUR_CONTINUE")}</button>
        </Modal>
      )}
```

- [ ] **Step 4: Vérifier au navigateur (Playwright)**

Invoquer le skill `fractal-arena-web:verify`. Scénario à dérouler :
1. Se connecter avec un état seedé (wallet + roster ≥ 3, run de Tour actif ou démarrable).
2. Démarrer un run, cliquer **⏩ Auto**.
3. Observer : le log défile (une ligne par étage, ✓/✗, 🏆 sur palier, ☠ sur perte), le bouton Abandonner est désactivé, la barre d'étage progresse.
4. Cliquer **⏹ Stop** → la boucle s'arrête à l'étage suivant, la modale récap s'affiche avec le bon écart d'étages.
5. Laisser un run aller jusqu'au bout (roster épuisé) → la boucle s'arrête seule, `run_over`, modale récap.
6. Vérifier qu'aucun `429`/erreur console ne casse la boucle (le délai 350 ms > 250 ms serveur).

Expected: enchaînement fluide, aucun blocage, récap cohérente, retour propre à l'état sans run après fermeture.

- [ ] **Step 5: Lancer la suite de tests web (non-régression)**

Run: `cd fractal-arena-web && node --test test/tour-ui.test.js test/tour-i18n.test.js`
Expected: PASS (Tasks 1 & 3 toujours vertes).

- [ ] **Step 6: Commit**

```bash
cd fractal-arena-web
git add tour.jsx
git commit -m "feat(tour): bouton auto-combat (rotation auto, log rapide, récap)"
```

---

## Self-Review

**Spec coverage :**
- §5 helper `pickFittest3` → Task 1. ✅
- §6 boucle auto (rotation, arrêt sur `null`/`run_over`, délai 350 ms, backoff 429) → Task 4 Step 1. ✅
- §7 throttle serveur → Task 2. ✅
- §8 UI log rapide + Stop + bouton Auto → Task 4 Steps 2. ✅
- §8 récap de session → Task 4 Step 3. ✅
- §9 i18n (FR/EN/ZH) → Task 3. ✅
- §10 ordre de déploiement + `CHAT_SYSTEM_PROMPT` → Global Constraints + Task 2 Step 5. ✅
- §11 hors périmètre (posture unique, pas d'anim, pas de config) → respecté (posture unique passée telle quelle, aucun `setBattle` en auto). ✅

**Placeholder scan :** aucun TBD/TODO ; tout le code est fourni.

**Type consistency :** `pickFittest3(roster, rosterState) → string[]|null` cohérent entre Task 1 (déf), Task 4 (usage). `actions.towerFight` renvoie `{ rosterState, rewards:{tiers,silver,gold}, runOver, floor, bestFloor, won }` — champs utilisés identiques à `onFight` existant (app.jsx:1120-1124). Clés i18n identiques entre Task 3 (déf) et Task 4 (usage) : `TOUR_AUTO`, `TOUR_AUTO_STOP`, `TOUR_AUTO_RUNNING`, `TOUR_AUTO_LOG_WIN/LOSS`, `TOUR_AUTO_RECAP_TITLE/CLIMB`. ✅
