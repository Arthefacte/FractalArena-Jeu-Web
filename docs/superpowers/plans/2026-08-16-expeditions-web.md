# Expéditions — Plan d'implémentation web (v157)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Écran Expéditions complet (4 vues + animation de lancement), pastille de retour, bloc « Forger avec des fragments » dans la Forge, entrée dans le sheet « Plus », i18n FR/EN/ZH — release v157.

**Architecture:** Un module pur `expeditions-ui.js` (`window.FA_EXPEDITIONS_UI`, miroir minoré du taux serveur), un écran React `expeditions.jsx` (état serveur via `GET /expeditions/state`, 4 vues internes dest/config/track/loot + overlay d'animation), 5 actions dans `app.jsx` (patron `relicSummon`), état `g.expeditions`/`g.expFragments`/`g.expFaWeek` alimenté par l'action `expeditionsState`.

**Tech Stack:** React (JSX précompilé Babel → `build/`, IIFE), `node:test`, i18n monofichier `i18n.js`.

**Spec:** `../fractal-arena-server/docs/superpowers/specs/2026-08-15-expeditions-design.md` (serveur #94 déployé — les routes font foi).

## Global Constraints

- Serveur = source de vérité : le taux local est un APERÇU (formule EXACTE du serveur : `base = round(110·P/(P+ref))`, refs blocs 400 / mines 700 / registre 1100 / reseau 1600 / genesis 2200 / coeur 3000, affinité +5 %/bête du type max +15, clamp [40, 98] ; P = Σ (base_hp+atk+def+spd+mag) × (1+0.03·(level−1)) × poids rareté {Common 1, Rare 1.5, Epic 2.5, Legendary 4}, arrondi). Le taux FIGÉ renvoyé par `/expeditions/start` remplace l'aperçu.
- Routes serveur (Bearer `g.authToken`) : `POST /expeditions/start` `{destination, beast_ids[3], mode:'prudente'|'risquee', duration_s:3600|7200|28800}` → `{ok, expedition}` ; `GET /expeditions/state` → `{ok, now, expeditions[], fragments:{C,B,A,S}, fa_week:{granted,cap,week_ends_in_s}}` ; `POST /expeditions/claim` `{id}` → `{ok, success, rewards:{xp,fa,frags:{C,B,A},ticket,dust}, level_events, fa_week}` ; `POST /expeditions/recall` `{id}` ; `POST /expeditions/craft-relic` `{rank}` → `{ok, relic, fragments_left}`. Erreurs snake_case : `bete_en_expedition` (409, + `beast_ids`), `destination_occupee`, `expedition_en_cours`, `deja_reclame`, `expedition_rappelee`, `expedition_non_rappelable`, `fragments_insuffisants` (+ `needed`/`have`), `betes_invalides`, `joueur_introuvable`.
- Jamais d'URL en dur dans les actions (`API_URL` seulement) ; retry 401 via `actions.authenticate` (patron `app.jsx:1359`).
- `I18N.t()` renvoie la clé si absente : JAMAIS `I18N.t("X") || "repli"` ; 3 langues FR/EN/ZH obligatoires ; `I18N.getLang()` (jamais `.lang`).
- CSS : piège `1fr` → `minmax(0,1fr)` sur toute grille contenant du nowrap ; `min-width:0` sur enfants flex/grid ; couleurs dérivées de données en style inline (convention du dépôt) ; animations transform/opacity seulement + repli `prefers-reduced-motion`.
- Release : bump `?v=156`→`?v=157` dans `index.html` (PAS `?v=1` ni `?v=74`), `data.js` `FA_ASSET_V="157"`, `sw-policy.js` `CACHE="fa-v157"` ; **`npm run build` après toute édition de .jsx** ; `npm test` complet à la fin.
- Commit final suffixé `(v157)` ; Co-Authored-By Claude.

---

### Task 1: Branche + module pur `expeditions-ui.js`

**Files:** Create `expeditions-ui.js`, Test `test/expeditions-ui.test.js`, Modify `index.html` (balise script bloc plain-JS).

**Interfaces — Produces:** `window.FA_EXPEDITIONS_UI = { WORLDS, DURATIONS, FRAGMENT_COSTS, beastPower, collectionPower, affinityBonus, previewSuccessRate(team, destKey), fmtCountdown(ms), statusOf(exp, now) }`.
- `WORLDS` : `[{ id:"blocs", type:"HASH", ref:400, i18nKey:"EXP_W_BLOCS", rgb:"0,240,255", color:"var(--elec)" }, …]` — 6 mondes dans l'ordre Campagne (mines: gold "255,199,68" MINING 700 · registre: forge "176,38,255" LEDGER 1100 · reseau: success "39,224,138" NETWORK 1600 · genesis: fire "247,147,26" GENESIS 2200 · coeur: alert "255,59,92" BLOCK 3000).
- `DURATIONS` : `[{ s:3600, i18nKey:"EXP_D_1H" }, { s:7200, i18nKey:"EXP_D_2H" }, { s:28800, i18nKey:"EXP_D_8H" }]`.
- `previewSuccessRate` : formule serveur exacte (constantes globales ci-dessus).
- `statusOf(exp, now)` : `"running"` si `ends_at` futur, sinon `"ready"` (exp = ligne de `/state`, `ends_at` ISO).
- `fmtCountdown(ms)` : `"H:MM:SS"` ou `"MM:SS"`, `"00:00"` si ≤0.

- [ ] Step 1 : `git checkout -b expeditions-web` dans fractal-arena-web + commit du plan.
- [ ] Step 2 : écrire `test/expeditions-ui.test.js` (patron `test/tour-ui.test.js` : `globalThis.window = {}; require("../expeditions-ui.js");`) — cas : puissance d'une bête connue (base 150, level 20, Epic → `150·1.57·2.5 = 588.75`) ; `previewSuccessRate` d'une équipe faible sur coeur = 40 (clamp) ; affinité 2×HASH sur blocs = 10 ; parité de bornes [40,98] ; `fmtCountdown(3661000) === "1:01:01"` ; `statusOf` running/ready. Vérifier l'échec.
- [ ] Step 3 : implémenter, vérifier le passage, ajouter `<script src="expeditions-ui.js?v=156"></script>` dans `index.html` près de `tour-ui.js` (le bump v157 viendra en Task 8). Commit.

### Task 2: i18n (toutes les clés, 3 langues)

**Files:** Modify `i18n.js`.

Clés (préfixe `EXP_`) : `NAV_EXPEDITIONS` (« Expéditions »/« Expeditions »/« 远征 »), `EXP_TITLE`, `EXP_SUB`, `EXP_W_BLOCS/MINES/REGISTRE/RESEAU/GENESIS/COEUR`, `EXP_D_1H/2H/8H`, `EXP_MODE_PRUDENT`, `EXP_MODE_RISKY`, `EXP_MODE_PRUDENT_SUB` (« Butin garanti »), `EXP_MODE_RISKY_SUB` (« Butin ×1,5 · échec possible »), `EXP_STATUS_FREE/RUNNING/READY`, `EXP_SUMMARY` (« %d en cours · %d à réclamer »), `EXP_SELECT_3`, `EXP_TEAM_WARN` (« Contient des bêtes de l'équipe active »), `EXP_POWER`, `EXP_AFFINITY`, `EXP_RATE`, `EXP_LAUNCH`, `EXP_FREE_ENTRY` (« Aucun coût d'entrée »),
`EXP_IN_EXPEDITION` (« En expédition »), `EXP_BACK_AT` (« Retour à %s »), `EXP_RECALL`, `EXP_RECALL_CONFIRM` (« Les bêtes reviennent immédiatement — AUCUN butin »), `EXP_RECALL_YES`, `EXP_CLAIM`, `EXP_VICTORY` (« La meute revient victorieuse »), `EXP_HARD_RETURN` (« Retour difficile »), `EXP_XP_EACH` (« +%d XP par bête »), `EXP_FA_LOCKED` (« +%d FA verrouillés »), `EXP_FA_CAP` (« plafond hebdo %d/%d »), `EXP_FRAGS` (« Fragments ×%d »), `EXP_TICKET` (« TICKET OR — fusion garantie »), `EXP_DUST` (« POUSSIÈRE DE FB — vrais sats on-chain »), `EXP_EXHAUSTED` (« Bêtes épuisées 30 min »),
`EXP_FORGE_TITLE` (« Forger avec des fragments »), `EXP_FORGE_BTN` (« Forger (%d fragments) »), `EXP_FORGE_RANK_%s` inutile — utiliser rang brut,
erreurs : `EXP_ERR_bete_en_expedition`, `EXP_ERR_destination_occupee`, `EXP_ERR_expedition_en_cours`, `EXP_ERR_deja_reclame`, `EXP_ERR_expedition_rappelee`, `EXP_ERR_expedition_non_rappelable`, `EXP_ERR_fragments_insuffisants`, `EXP_ERR_betes_invalides`, `EXP_ERR_generic`.

- [ ] Step 1 : ajouter le bloc dans `i18n.js` (section commentée `// ---- Expéditions ----`), FR/EN/ZH partout.
- [ ] Step 2 : `node --test --test-force-exit test/i18n-*.test.js` → PASS. Commit.

### Task 3: Actions `app.jsx` + état

**Files:** Modify `app.jsx`, Test `test/expeditions-wiring.test.js`.

- État : dans `freshState()` ajouter `expeditions: [], expFragments: { C:0,B:0,A:0,S:0 }, expFaWeek: null, expNowOffset: 0`.
- Actions (dans `actions`, patron `relicSummon`/`claimQuest`) :
  - `async expeditionsState()` — GET avec Bearer ; si ok : `setG(s => ({ ...s, expeditions: data.expeditions, expFragments: data.fragments, expFaWeek: data.fa_week, expNowOffset: data.now - Date.now() }))`. Silencieux sur erreur (retourne `{ok:false}`).
  - `async expeditionsStart({ destination, beast_ids, mode, duration_s })` — POST ; 401→retry ; erreurs → `{ ok:false, reason: data.error }` ; ok → rafraîchit via `expeditionsState()` puis `{ ok:true, expedition: data.expedition }`.
  - `async expeditionsClaim(id)` — POST ; ok → re-fetch `/save/:wallet` avec `svOpts()` (XP/FA/tickets ont bougé) + `expeditionsState()` ; retourne `{ ok:true, success, rewards, fa_week }`.
  - `async expeditionsRecall(id)` — POST ; ok → `expeditionsState()`.
  - `async expeditionsCraftRelic(rank)` — POST ; ok → re-fetch `/save` (equipment) + `expeditionsState()` (fragments) ; retourne `{ ok:true, relic }`.
- Amorçage : dans l'effet qui suit l'authentification (là où le state serveur est chargé), appeler `actions.expeditionsState()` une fois si `authToken`.
- [ ] Step 1 : test wiring (patron `test/quiz-wiring.test.js`) : chaque bloc `async expeditions` contient `Authorization`, `API_URL`, pas d'URL en dur ; `expeditionsClaim` contient `401` et `svOpts`. Vérifier l'échec.
- [ ] Step 2 : implémenter. `npm run build`. Tests → PASS. Commit.

### Task 4: Écran `expeditions.jsx` — vues Destinations + Configuration

**Files:** Create `expeditions.jsx`, Modify `app.jsx` (destructure `:7`, `VIEWS`, `tabs`), `index.html` (balise `build/expeditions.js` avant `build/app.js`), `styles.css` (accent + styles écran).

Structure du composant :
```jsx
const I18N = window.FA_I18N;
const XU = window.FA_EXPEDITIONS_UI;
function Expeditions() {
  const { g, actions, toast } = useFA();
  const [view, setView] = useState("dest");        // dest | config | track | loot
  const [selWorld, setSelWorld] = useState(null);
  const [sel, setSel] = useState([]);              // beast_ids
  const [dur, setDur] = useState(7200);
  const [mode, setMode] = useState("prudente");
  const [busyLaunch, setBusyLaunch] = useState(false);
  const [fx, setFx] = useState(null);              // {world} pendant l'animation
  const [loot, setLoot] = useState(null);          // résultat du claim
  const [confirmRecall, setConfirmRecall] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick(n => n+1), 1000); return () => clearInterval(t); }, []);
  useEffect(() => { if (g.authToken) actions.expeditionsState(); }, [g.authToken]);
  const now = Date.now() + (g.expNowOffset || 0);
  const byDest = {}; (g.expeditions || []).forEach(e => { byDest[e.destination] = e; });
  const busyIds = new Set((g.expeditions || []).flatMap(e => e.beast_ids || []));
  …
}
Object.assign(window, { Expeditions });
```
- **Vue destinations** : `SectionHead` (`EXP_TITLE`/`EXP_SUB`) + résumé `EXP_SUMMARY(running, ready)` + jauge FA hebdo (`Bar frac={granted/cap}`) + grille des 6 mondes (`.grid-cards`) : carte par monde (glyphe type, nom i18n, chip d'affinité colorée inline via `w.color`/`w.rgb`), état libre (→ config), en cours (compte à rebours `XU.fmtCountdown(new Date(e.ends_at) - now)`, → track), prête (halo fire, `EXP_STATUS_READY`, → loot/claim).
- **Vue config** : retour ←, monde sélectionné en tête ; grille du roster (`g.roster`, cartes compactes : `D.displayName(b)`, niveau, type ; grisée si `busyIds.has(b.id)` avec tag `EXP_IN_EXPEDITION` ; sélection max 3, bordure fire) ; toggles durée (3 boutons) et mode (2 boutons avec sous-titres) ; panneau récap : puissance `XU.collectionPower(team)`, affinité `+X %`, taux `XU.previewSuccessRate(team, selWorld)` coloré (≥75 success, ≥55 gold, sinon alert), avertissement `EXP_TEAM_WARN` si `g.selected` ∩ sel, note `EXP_FREE_ENTRY` ; bouton LANCER désactivé tant que `sel.length !== 3` :
```jsx
async function launch() {
  if (busyLaunch) return; setBusyLaunch(true);
  const r = await actions.expeditionsStart({ destination: selWorld, beast_ids: sel, mode, duration_s: dur });
  setBusyLaunch(false);
  if (!r.ok) { toast(expErr(r.reason), "bad"); return; }
  setFx({ world: selWorld });               // l'overlay ramène sur "dest" à la fin (Task 5)
}
```
  avec `const EXP_ERRK = { bete_en_expedition:"EXP_ERR_bete_en_expedition", … }` et `expErr(code)` façon `tourErr`.
- Early-returns canoniques : pas de wallet → panneau connecte-toi (copier `tour.jsx:237`).
- Câblage : `app.jsx:7` ajouter `Expeditions` ; `VIEWS` `expeditions: Expeditions` ; `tabs` ajouter `["expeditions","NAV_EXPEDITIONS"]` après `["tour","NAV_TOUR"]` ; `styles.css` `body[data-view="expeditions"] { --accent: var(--sunset); }` + styles `.exp-*` nécessaires (cartes monde, roster compact) ; `index.html` balise script.
- [ ] Step 1 : test wiring `test/expeditions-screen.test.js` : `expeditions.jsx` existe, `Object.assign(window, { Expeditions })`, `VIEWS` contient `expeditions:`, `tabs` contient `NAV_EXPEDITIONS`, `index.html` charge `build/expeditions.js`, `styles.css` a `data-view="expeditions"`. Vérifier l'échec.
- [ ] Step 2 : implémenter vues dest+config (track/loot = placeholders internes provisoires). `npm run build`. Tests PASS. Commit.

### Task 5: Vues Suivi + Butin + animation de lancement

**Files:** Modify `expeditions.jsx`, `styles.css`.

- **Vue track** : temps restant géant vivant (`XU.fmtCountdown`), heure de retour (`new Date(e.ends_at)` locale), barre de progression (`(now-started_at)/(ends_at-started_at)`), mode/durée/taux figé (`e.success_rate` %), équipage (cartes mini depuis `g.roster` par `e.beast_ids`), bouton « Rappeler » ghost danger → confirmation 2 temps (`EXP_RECALL_CONFIRM` puis `EXP_RECALL_YES`) → `actions.expeditionsRecall(e.id)` → retour dest.
- **Vue loot** : déclenchée par claim :
```jsx
async function claim(e) {
  const r = await actions.expeditionsClaim(e.id);
  if (!r.ok) { toast(expErr(r.reason), "bad"); return; }
  setLoot({ ...r, world: e.destination }); setView("loot");
}
```
  Affiche `EXP_VICTORY` ou `EXP_HARD_RETURN` (échec Risquée : bandeau `EXP_EXHAUSTED`), lignes : XP/bête, FA verrouillés + jauge plafond (`r.fa_week`), fragments par rang (couleur `D.RANK_COLORS`), Ticket Or (mise en valeur), Poussière de FB (bloc ultra-rare, seulement si `rewards.dust`). Bouton retour → dest.
- **Animation de lancement** (port du proto, simplifiée mais fidèle : ~2,2 s, skippable au tap, transform/opacity only) : overlay plein écran rendu quand `fx` non nul — phases pilotées par classes CSS + timers : (1) anneau hexagonal aux couleurs du monde (`fx.world` → `w.rgb`) qui s'ouvre (`faRingOpen`-like), filaments, (2) les 3 cartes se dressent puis sont aspirées avec traînée de particules, (3) flash + onde hexagonale, (4) stamp du nom du monde + micro-shake, puis `setFx(null); setView("dest"); setSel([])` et pulse de la carte « en cours » (`justLaunched`). `prefers-reduced-motion` (via `window.matchMedia`) → pas d'overlay, transition directe avec toast sobre. Un tap sur l'overlay → fin immédiate.
- [ ] Step 1 : implémenter, `npm run build`, tests (précompile + i18n) PASS. Commit.

### Task 6: Pastille « expédition prête »

**Files:** Modify `app.jsx` (Nav), `mobile.css`.

- Dans `Nav()` : `const expReadyCount = (g.expeditions || []).filter(e => new Date(e.ends_at).getTime() <= Date.now() + (g.expNowOffset || 0)).length;` + un `useEffect` interval 30 s qui force un re-render (`useState` compteur) pour que la pastille apparaisse sans navigation.
- Sur l'entrée du sheet `expeditions` : `{k === "expeditions" && expReadyCount > 0 && <span className="fa-sheet-dot" aria-hidden="true" />}` ; sur le slot `☰` (`MnavSlot` du sheet) : passer `badge={expReadyCount}` (le composant accepte déjà `badge`).
- `mobile.css` : `.fa-sheet-item { position: relative; }` + `.fa-sheet-dot { position:absolute; top:6px; right:6px; width:8px; height:8px; border-radius:50%; background: var(--fire); animation: faQuizDot 1.6s infinite; }` (réutiliser la keyframe existante de la pastille quiz).
- Rafraîchissement de fond : `actions.expeditionsState()` est déjà appelée à l'amorçage (Task 3) et à chaque visite de l'écran ; les `ends_at` connus suffisent à faire vivre la pastille sans poll réseau.
- [ ] Step 1 : implémenter + `npm run build` + tests PASS. Commit.

### Task 7: Forge — bloc « Forger avec des fragments »

**Files:** Modify `screens.jsx` (`ForgeReliques`, insertion entre `summon-grid` et l'inventaire).

```jsx
{/* Forger avec des fragments d'expédition */}
<div className="panel oct" style={{ padding: 22, marginTop: 26 }}>
  <h3 style={{ marginTop: 0 }}>{I18N.t("EXP_FORGE_TITLE")}</h3>
  {["C","B","A","S"].map((rk) => {
    const have = (g.expFragments && g.expFragments[rk]) || 0;
    const need = XU.FRAGMENT_COSTS[rk];             // {C:100,B:250,A:600,S:1000}
    return (
      <div key={rk} style={{ display:"grid", gridTemplateColumns:"28px minmax(0,1fr) auto", gap:10, alignItems:"center", marginBottom:10 }}>
        <b style={{ color: D.RANK_COLORS[rk] }}>{rk}</b>
        <Bar frac={Math.min(1, have/need)} kind="xp" />
        <button className="btn sm" disabled={have < need || crafting}
          onClick={() => doCraft(rk)}>{have}/{need}</button>
      </div>
    );
  })}
</div>
```
`doCraft(rk)` → `actions.expeditionsCraftRelic(rk)` ; succès → même cinématique que l'invocation (`FA_FORGE_CINE.play({ mode:"summon", success:true, tier: r.relic.rarity, … })`) + toast ; `fragments_insuffisants` → `EXP_ERR_fragments_insuffisants`. `const XU = window.FA_EXPEDITIONS_UI;` en tête de `screens.jsx` s'il n'y est pas.
- [ ] Step 1 : implémenter + `npm run build` + tests PASS. Commit.

### Task 8: Icône nav + release v157 + PR

**Files:** Create `assets/nav-icons/expeditions.png`, Modify `index.html`/`data.js`/`sw-policy.js`.

- [ ] Step 1 : générer `assets/nav-icons/expeditions.png` avec Python/PIL en copiant les dimensions d'une icône existante (lire `assets/nav-icons/tour.png` pour taille/palette) : glyphe portail hexagonal orange (#F7931A) sur fond transparent, trait simple cohérent avec les autres.
- [ ] Step 2 : bump — `index.html` `?v=156`→`?v=157` partout (PAS `?v=1` ni `?v=74`, la balise `expeditions-ui.js?v=156` de Task 1 passe à 157 avec les autres) ; `data.js` `FA_ASSET_V="157"` ; `sw-policy.js` `CACHE="fa-v157"`.
- [ ] Step 3 : `npm run build` puis `npm test` COMPLET → tout vert (630+ tests).
- [ ] Step 4 : commit `« Expeditions : ecran idle 4 vues + forge de fragments + pastille (v157) »`, push, `gh pr create` (corps : routes consommées, ordre serveur→web respecté — serveur #94 déjà en prod, captures des 4 vues optionnelles).
