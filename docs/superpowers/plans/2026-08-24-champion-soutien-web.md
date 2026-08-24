# Champion de soutien — Plan d'implémentation web

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Interface du Champion de soutien dans `fractal-arena-web` : désignation dans l'écran Équipe, rangée « Champions alliés » en Campagne et Tour (emprunt = 1 des 3 slots), marquage du slot emprunté, commission affichée, compteur de points de lien, bandeau « ton champion a servi » à la connexion.

**Architecture:** Deux fichiers neufs — `champion-ui.js` (helpers purs testables en Node, patron `tour-ui.js`) et `champion.jsx` (composants `ChampionRow`, `ChampionTile`, `ChampionUsesModal`, exportés sur `window`) — plus le câblage dans `app.jsx` (state + actions API), `screens.jsx` (Équipe, Perso), `campaign.jsx` et `tour.jsx`. L'emprunt vit dans `g.championBorrow` (état de session, JAMAIS dans `g.selected` — les ids empruntés seraient purgés par `serverToState` et rejetés par `toggleSelect`/`validateEngage`).

**Tech Stack:** React sans bundler (`.jsx` racine → `npm run build` → `build/*.js`), `node --test` natif, i18n FR/EN/ZH via `window.FA_I18N`.

**Spec:** `fractal-arena-server/docs/superpowers/specs/2026-08-23-champion-soutien-design.md` (§8 Web) ; API livrée par la PR serveur #113 (mergée, en prod).

## Global Constraints

- **API en prod** (PR #113) : `GET /champions` (public) → `{ok, champions:[{owner_wallet, name, beast:{id,name,type,preset,rarity,rank,level,image_key}}]}` ; `POST /champion {beast_id}` (Bearer) ; `GET /champion` (Bearer) → `{ok, beast_id|null}` ; `GET /champion/uses` (Bearer) → `{ok, uses:[{day,mode,commission,points,created_at,borrower_name}], unseen}` ; `POST /champion/uses/seen` (Bearer). `/campaign/fight` : body + `champion_owner_wallet` + `champion_slot` avec `selected` de **2** ids ; `/tower/fight` : idem avec `beast_ids` de **2** ids. Réponse combat : `champion: {owner_wallet, commission, points, beast} | null`, `reward.lockedGain`/`rewards.fa` = part de l'emprunteur (déjà nette de commission). Erreur : 409 `champion_indisponible` → toast traduit + vider `championBorrow` + re-lister.
- **Slot fixe v1** : le champion occupe TOUJOURS le slot 2 (arrière) — constante `CHAMPION_SLOT = 2` dans `champion-ui.js`, envoyée telle quelle au serveur.
- **`g.selected` reste 100 % roster propre** : ne jamais y mettre un id emprunté (purge `app.jsx:121`, plafond `toggleSelect app.jsx:965-975`, pré-vol `tour-ui.js:77-86`).
- **`link_points` est SERVER-OWNED** : lu dans `serverToState` (`championPoints: save.link_points ?? 0`), JAMAIS ajouté à `stateToServer` (`app.jsx:139-164`) ni aux dépendances de l'autosave (`app.jsx:358-360`).
- **Nommage anti-collision** : `link.jsx`/vue `"lien"`/clés `LINK_*` = Totem Capitaine. Ici : préfixe i18n `CHAMP_`, state `championPoints`/`championBorrow`/`championsList`/`championBeastId`/`championUses`.
- Actions API : patron du dépôt — `API_URL` obligatoire, aucune URL en dur, header `Authorization: Bearer` (règles verrouillées par les tests wiring), montants en `%d FA` dans i18n rendus via `<FaText>` (jamais « FA » en clair à côté d'un nombre).
- i18n : toute clé en FR/EN/ZH, placeholders `%s`/`%d` ordonnés, `I18N.t()` sans `|| "repli"` ; thème « **louer la puissance** » (jamais « mercenaire »), « **entité** » (jamais « bête »).
- Cartes : rareté/niveau en jauge dans le corps, JAMAIS sur la vignette (`test/card-badges.test.js` — badge/coche sur l'art autorisés).
- Mobile : conteneurs de grille en `minmax(0,1fr)` ; si des tuiles portent un `flex` inline, passer le conteneur en `grid` (leçon `mobile.css:283-287`) ; classe dédiée `.champ-row` plutôt que de l'inline pour tout ce qui doit être surchargé en mobile.
- **Rituel de bump v199 → v200 aux 5 endroits** (Task 8 seulement, une fois tout le reste vert) : `index.html` (`?v=200` partout), `data.js:29` `FA_ASSET_V`, `sw-policy.js:10` `fa-v200`, `test/account-wiring.test.js:154+170` (2 littéraux), `manifest.webmanifest:15-19` (icônes). Puis `npm run build` et suite complète.
- Tests : `node --test --test-force-exit test/<fichier>` ; suite complète = `npm test`.
- Commits : message court + corps, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` ; le commit de bump porte `(v200)`.
- **Décisions v1 actées** (à signaler à la PR) : (a) slot champion fixe en position 2 ; (b) l'auto-combat de Tour CONSERVE le champion actif (2 plus en forme + champion) mais ne prolonge pas le run (`pickFittest3` → null = arrêt, comme avant) ; (c) le compteur de points de lien est un affichage seul (aucun achat par points en v1 — pas d'endpoint serveur) ; (d) l'aperçu idle du champion (avant combat) affiche une barre de vie pleine (la projection serveur n'expose pas les stats brutes — les vrais PV arrivent avec les events).

---

### Task 1: Helpers purs — `champion-ui.js`

**Files:**
- Create: `champion-ui.js` (racine)
- Modify: `tour-ui.js:77-86` (`validateEngage` — paramètre `expectedCount` rétrocompatible)
- Test: `test/champion-ui.test.js`, `test/tour-ui.test.js` (non-régression)

**Interfaces:**
- Consumes: rien (pur).
- Produces: `window.FA_CHAMPION_UI = { CHAMPION_SLOT, requiredOwnCount(hasChampion) → 2|3, championRunState(rosterState, beastId) → {hpFrac, dead}, aggregateUsesByDay(uses) → [{day, fights, commission, points, names}] }` ; `tour-ui.js` : `validateEngage(selectedIds, roster, rosterState, expectedCount = 3)`.

- [ ] **Step 1: Créer la branche**

```bash
cd "C:\Users\PC\Documents\Arthefacte Games\Fractal Arena\fractal-arena-web"
git checkout -b champion-soutien-web origin/main
git add docs/superpowers/plans/2026-08-24-champion-soutien-web.md
git commit -m "docs: plan d implementation web du champion de soutien"
```

- [ ] **Step 2: Tests purs (échouent d'abord)**

`test/champion-ui.test.js` :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
globalThis.window = globalThis.window || {};
require("../champion-ui.js");
const CU = window.FA_CHAMPION_UI;

test("CHAMPION_SLOT fixe a 2, requiredOwnCount 2 avec champion sinon 3", () => {
  assert.equal(CU.CHAMPION_SLOT, 2);
  assert.equal(CU.requiredOwnCount(true), 2);
  assert.equal(CU.requiredOwnCount(false), 3);
});

test("championRunState : absent = plein, hp_frac repris, mort detectee", () => {
  assert.deepEqual(CU.championRunState({}, "x"), { hpFrac: 1, dead: false });
  assert.deepEqual(CU.championRunState({ x: { hp_frac: 0.4 } }, "x"), { hpFrac: 0.4, dead: false });
  assert.deepEqual(CU.championRunState({ x: { hp_frac: 0, dead: true } }, "x"), { hpFrac: 0, dead: true });
  assert.deepEqual(CU.championRunState(null, "x"), { hpFrac: 1, dead: false });
});

test("aggregateUsesByDay : agrege par jour, jours recents d abord, 3 noms max", () => {
  const uses = [
    { day: "2026-08-23", commission: 5, points: 2, borrower_name: "Alice" },
    { day: "2026-08-24", commission: 0, points: 2, borrower_name: "Bob" },
    { day: "2026-08-24", commission: 12, points: 0, borrower_name: "Carol" },
    { day: "2026-08-24", commission: 3, points: 2, borrower_name: "Bob" },
    { day: "2026-08-24", commission: 1, points: 0, borrower_name: "Dave" },
    { day: "2026-08-24", commission: 1, points: 0, borrower_name: "Eve" },
  ];
  const agg = CU.aggregateUsesByDay(uses);
  assert.equal(agg.length, 2);
  assert.equal(agg[0].day, "2026-08-24");
  assert.deepEqual({ f: agg[0].fights, c: agg[0].commission, p: agg[0].points }, { f: 5, c: 17, p: 4 });
  assert.deepEqual(agg[0].names, ["Bob", "Carol", "Dave"]);   // distincts, 3 max
  assert.deepEqual({ f: agg[1].fights, c: agg[1].commission }, { f: 1, c: 5 });
  assert.deepEqual(CU.aggregateUsesByDay([]), []);
});
```

Dans `test/tour-ui.test.js`, AJOUTER (sans toucher au reste) :

```js
test("validateEngage : accepte expectedCount 2 pour un slot champion", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const TU = window.FA_TOUR_UI;
  assert.equal(TU.validateEngage(["a", "b"], roster, {}, 2).ok, true);
  assert.equal(TU.validateEngage(["a", "b"], roster, {}).ok, false);      // defaut 3 inchange
  assert.equal(TU.validateEngage(["a", "b", "c"], roster, {}).ok, true);
});
```

- [ ] **Step 3: Vérifier l'échec**

Run: `node --test --test-force-exit test/champion-ui.test.js` → FAIL (`Cannot find module`)
Run: `node --test --test-force-exit test/tour-ui.test.js` → FAIL (le nouveau test)

- [ ] **Step 4: Implémenter**

`champion-ui.js` :

```js
/* ==== FRACTAL ARENA — Champion de soutien : helpers purs ====
   Spec serveur : fractal-arena-server/docs/superpowers/specs/2026-08-23-champion-soutien-design.md
   Testable en Node (globalThis.window = {}) comme tour-ui.js. */
(function () {
  // v1 : le champion emprunte occupe TOUJOURS le slot 2 (arriere).
  const CHAMPION_SLOT = 2;

  function requiredOwnCount(hasChampion) { return hasChampion ? 2 : 3; }

  // Etat du champion dans le run de Tour : suivi par SON id dans roster_state
  // (le serveur applique l attrition au snapshot comme aux autres entites).
  function championRunState(rosterState, beastId) {
    const st = (rosterState || {})[beastId];
    if (!st) return { hpFrac: 1, dead: false };
    const hpFrac = typeof st.hp_frac === "number" ? st.hp_frac : 1;
    return { hpFrac, dead: !!st.dead || hpFrac <= 0 };
  }

  // Agregat pour le bandeau « ton champion a servi » : une ligne par jour.
  function aggregateUsesByDay(uses) {
    const map = new Map();
    for (const u of uses || []) {
      const k = String(u.day).slice(0, 10);
      const a = map.get(k) || { day: k, fights: 0, commission: 0, points: 0, names: [] };
      a.fights += 1;
      a.commission += u.commission || 0;
      a.points += u.points || 0;
      if (u.borrower_name && !a.names.includes(u.borrower_name) && a.names.length < 3) a.names.push(u.borrower_name);
      map.set(k, a);
    }
    return [...map.values()].sort((x, y) => (x.day < y.day ? 1 : -1));
  }

  window.FA_CHAMPION_UI = { CHAMPION_SLOT, requiredOwnCount, championRunState, aggregateUsesByDay };
})();
```

`tour-ui.js` — signature de `validateEngage` : remplacer la constante `3` par le paramètre :

```js
function validateEngage(selectedIds, roster, rosterState, expectedCount = 3) {
  // ... corps existant : remplacer les comparaisons a 3 par expectedCount
  //     (longueur, Set distinct). Le reste (present dans roster, pas mort) inchange.
}
```

- [ ] **Step 5: Vérifier le passage**

Run: `node --test --test-force-exit test/champion-ui.test.js test/tour-ui.test.js` → PASS

- [ ] **Step 6: Commit**

```bash
git add champion-ui.js tour-ui.js test/champion-ui.test.js test/tour-ui.test.js
git commit -m "feat(champion): helpers purs web — slot fixe, etat de run, agregat par jour"
```

---

### Task 2: i18n — clés `CHAMP_*` FR/EN/ZH

**Files:**
- Modify: `i18n.js` (nouveau groupe `// Champion de soutien` après le groupe Tour, ~ligne 960)
- Test: `test/champion-i18n.test.js` (clone de `test/tour-i18n.test.js`)

**Interfaces:**
- Produces: les clés ci-dessous, consommées par les Tasks 4-7.

- [ ] **Step 1: Test (échoue d'abord)**

`test/champion-i18n.test.js` — cloner la structure EXACTE de `test/tour-i18n.test.js` (table `KEYS`, test « présente et non vide en FR/EN/ZH », test « placeholders == nbArgs, aucun % dans une clé 0-arg ») avec cette table :

```js
const KEYS = [
  ["CHAMP_ROW_TITLE", 0],        // « Champions alliés »
  ["CHAMP_RENT", 1],             // « Louer la puissance de %s »
  ["CHAMP_ACTIVE", 1],           // « Champion actif : %s » (pastille au-dessus du bouton combat)
  ["CHAMP_CLEAR", 0],            // « Retirer le champion »
  ["CHAMP_EMPTY", 0],            // « Aucun champion disponible pour l instant »
  ["CHAMP_NEED2", 0],            // « Selectionne 2 entites — le champion occupe le 3e slot »
  ["CHAMP_BORROWED_TAG", 1],     // « Prete par %s » (liseré du slot)
  ["CHAMP_DESIGNATE", 0],        // « Designer champion »
  ["CHAMP_IS", 0],               // « Champion »
  ["CHAMP_DESIGNATED_OK", 1],    // toast « %s est ton champion »
  ["CHAMP_COMMISSION_ROW", 1],   // « Commission versee a %s » (modale de resultat)
  ["CHAMP_COMMISSION_GAIN", 1],  // « +%d FA de commission » (recap auto Tour)
  ["CHAMP_USES_TITLE", 0],       // « Ton champion a servi »
  ["CHAMP_USES_LINE", 3],        // « %s combat(s) — commission %d FA · +%d points de lien »
  ["CHAMP_USES_BY", 1],          // « avec %s » (noms des emprunteurs)
  ["CHAMP_POINTS", 0],           // « Points de lien »
  ["CHAMP_POINTS_DESC", 0],      // description du panneau Perso
  ["CHAMP_ERR_champion_indisponible", 0],  // « Ce champion n est plus disponible »
];
```

- [ ] **Step 2: Vérifier l'échec** — `node --test --test-force-exit test/champion-i18n.test.js` → FAIL

- [ ] **Step 3: Ajouter les clés dans `i18n.js`** (groupe commenté `// Champion de soutien — location de puissance`, wording FR ci-dessous, EN/ZH fidèles au thème cloud-mining « rent the power of… » / « 租用…的算力 ») :

```js
// Champion de soutien — location de puissance (jamais « mercenaire », jamais « bête »)
CHAMP_ROW_TITLE: { FR: "Champions alliés", EN: "Allied champions", ZH: "盟友冠军" },
CHAMP_RENT: { FR: "Louer la puissance de %s", EN: "Rent the power of %s", ZH: "租用 %s 的算力" },
CHAMP_ACTIVE: { FR: "Champion actif : %s", EN: "Active champion: %s", ZH: "已选冠军：%s" },
CHAMP_CLEAR: { FR: "Retirer le champion", EN: "Remove champion", ZH: "移除冠军" },
CHAMP_EMPTY: { FR: "Aucun champion disponible pour l'instant", EN: "No champion available yet", ZH: "暂无可用冠军" },
CHAMP_NEED2: { FR: "Sélectionne 2 entités — le champion occupe le 3e slot", EN: "Select 2 entities — the champion fills the 3rd slot", ZH: "选择 2 个实体——冠军占据第 3 个位置" },
CHAMP_BORROWED_TAG: { FR: "Prêté par %s", EN: "Lent by %s", ZH: "由 %s 出借" },
CHAMP_DESIGNATE: { FR: "Désigner champion", EN: "Set as champion", ZH: "设为冠军" },
CHAMP_IS: { FR: "Champion", EN: "Champion", ZH: "冠军" },
CHAMP_DESIGNATED_OK: { FR: "%s est ton champion", EN: "%s is now your champion", ZH: "%s 已成为你的冠军" },
CHAMP_COMMISSION_ROW: { FR: "Commission versée à %s", EN: "Commission paid to %s", ZH: "支付给 %s 的佣金" },
CHAMP_COMMISSION_GAIN: { FR: "+%d FA de commission", EN: "+%d FA commission", ZH: "+%d FA 佣金" },
CHAMP_USES_TITLE: { FR: "Ton champion a servi", EN: "Your champion was rented", ZH: "你的冠军被租用了" },
CHAMP_USES_LINE: { FR: "%s combat(s) — commission %d FA · +%d points de lien", EN: "%s fight(s) — %d FA commission · +%d link points", ZH: "%s 场战斗——佣金 %d FA · +%d 羁绊点" },
CHAMP_USES_BY: { FR: "avec %s", EN: "with %s", ZH: "与 %s" },
CHAMP_POINTS: { FR: "Points de lien", EN: "Link points", ZH: "羁绊点" },
CHAMP_POINTS_DESC: { FR: "Gagnés quand ton champion sert et quand tu loues celui des autres. Purement cosmétiques.", EN: "Earned when your champion serves and when you rent others'. Purely cosmetic.", ZH: "当你的冠军被租用或你租用他人冠军时获得。纯装饰用途。" },
CHAMP_ERR_champion_indisponible: { FR: "Ce champion n'est plus disponible", EN: "This champion is no longer available", ZH: "该冠军已不可用" },
```

- [ ] **Step 4: Vérifier le passage** — `node --test --test-force-exit test/champion-i18n.test.js test/i18n-cles-utilisees.test.js` → PASS

- [ ] **Step 5: Commit**

```bash
git add i18n.js test/champion-i18n.test.js
git commit -m "feat(champion): cles i18n CHAMP_* FR/EN/ZH — theme location de puissance"
```

---

### Task 3: State + actions API dans `app.jsx`

**Files:**
- Modify: `app.jsx` — `freshState()` (~166-215), `serverToState` (~87-137), objet `actions` (~473-2199, insérer près de `towerPrizes` ~2088), amorçage `useEffect` (~328-330), signatures `campaignFight` (~1925) et `towerFight` (~2002)
- Test: `test/champion-wiring.test.js`

**Interfaces:**
- Consumes: API prod (Global Constraints), `svOpts()` (`app.jsx:290-293`), `serverToState`.
- Produces (pour les Tasks 4-7) : state `championBeastId: null`, `championsList: []`, `championBorrow: null` (`{owner_wallet, name, beast}`), `championUses: {uses: [], unseen: 0}`, `championPoints: 0` ; actions `championGet()`, `championSet(beastId)`, `championsList()`, `championUses()`, `championUsesSeen()`, `championClearBorrow()` ; `campaignFight(worldIndex, floorIndex, selectedIds, posture, champion)` et `towerFight(selectedIds, posture, champion)` où `champion = g.championBorrow | null` (ajoute `champion_owner_wallet: champion.owner_wallet, champion_slot: 2` au body ; réponses enrichies `champion`).

- [ ] **Step 1: Test wiring (échoue d'abord)**

`test/champion-wiring.test.js` (patron `test/expeditions-wiring.test.js` avec son helper `bloc(marker, len)`) :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
function bloc(marker, len = 1600) {
  const i = SRC.indexOf(marker);
  assert.ok(i >= 0, "marqueur absent : " + marker);
  return SRC.slice(i, i + len);
}

test("actions champion : API_URL + Authorization, pas d URL en dur", () => {
  for (const m of ["async championGet", "async championSet", "async championUses", "async championUsesSeen"]) {
    const b = bloc(m);
    assert.match(b, /API_URL/, m);
    assert.match(b, /Authorization/, m);
    assert.ok(!/https?:\/\//.test(b), m + " : URL en dur interdite");
  }
  const pub = bloc("async championsList");   // GET /champions est public : pas de Bearer requis
  assert.match(pub, /API_URL/);
  assert.ok(!/https?:\/\//.test(pub));
});

test("campaignFight et towerFight envoient le champion emprunte (slot 2)", () => {
  const c = bloc("async campaignFight", 2400);
  assert.match(c, /champion_owner_wallet/);
  assert.match(c, /champion_slot/);
  const t = bloc("async towerFight", 2400);
  assert.match(t, /champion_owner_wallet/);
  assert.match(t, /champion_slot/);
});

test("championPoints vient de save.link_points et reste server-owned", () => {
  assert.match(SRC, /championPoints:\s*save\.link_points\s*\?\?\s*0/);
  const sts = SRC.slice(SRC.indexOf("function stateToServer"), SRC.indexOf("function stateToServer") + 1600);
  assert.ok(!sts.includes("link_points") && !sts.includes("championPoints"), "jamais renvoye au serveur");
});

test("freshState declare l etat champion, et championUses est amorce a la connexion", () => {
  for (const k of ["championBeastId: null", "championsList: []", "championBorrow: null", "championPoints: 0"]) {
    assert.ok(SRC.includes(k), k);
  }
  assert.match(SRC, /g\.authToken\)\s*actions\.championUses\(\)/);
});
```

- [ ] **Step 2: Vérifier l'échec** — `node --test --test-force-exit test/champion-wiring.test.js` → FAIL

- [ ] **Step 3: Implémenter dans `app.jsx`**

1. `freshState()` (à côté de `ticketsSilver: 0`, ~182) :

```js
championBeastId: null,          // ma designation (badge Equipe)
championsList: [],              // liste d emprunt (GET /champions)
championBorrow: null,           // {owner_wallet, name, beast} — l emprunt actif (session)
championUses: { uses: [], unseen: 0 },
championPoints: 0,              // save.link_points (server-owned)
```

2. `serverToState` (après `holderDays`, ~129) : `championPoints: save.link_points ?? 0,`

3. Actions (insérer après `towerPrizesSeen`, ~2101) — patron du dépôt :

```js
// ---- Champion de soutien (location de puissance) ----
async championGet() {
  const s = gRef.current;
  if (!s.authToken) return { ok: false };
  try {
    const r = await fetch(`${API_URL}/champion`, { headers: { "Authorization": `Bearer ${s.authToken}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, reason: d.error || "Erreur serveur" };
    setG((st) => ({ ...st, championBeastId: d.beast_id || null }));
    return { ok: true, beast_id: d.beast_id || null };
  } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
},
async championSet(beastId) {
  const s = gRef.current;
  if (!s.authToken) return { ok: false };
  try {
    const r = await fetch(`${API_URL}/champion`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
      body: JSON.stringify({ beast_id: beastId }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false, reason: d.error || "Erreur serveur" };
    setG((st) => ({ ...st, championBeastId: d.beast_id }));
    return { ok: true, beast_id: d.beast_id };
  } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
},
async championsList() {
  try {
    const r = await fetch(`${API_URL}/champions`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false };
    setG((st) => ({ ...st, championsList: d.champions || [] }));
    return { ok: true, champions: d.champions || [] };
  } catch (e) { return { ok: false }; }
},
championClearBorrow() { setG((st) => ({ ...st, championBorrow: null })); },
async championUses() {
  const s = gRef.current;
  if (!s.authToken) return { ok: false };
  try {
    const r = await fetch(`${API_URL}/champion/uses`, { headers: { "Authorization": `Bearer ${s.authToken}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return { ok: false };
    setG((st) => ({ ...st, championUses: { uses: d.uses || [], unseen: d.unseen || 0 } }));
    return { ok: true };
  } catch (e) { return { ok: false }; }
},
async championUsesSeen() {
  const s = gRef.current;
  if (!s.authToken) return { ok: false };
  try {
    await fetch(`${API_URL}/champion/uses/seen`, { method: "POST", headers: { "Authorization": `Bearer ${s.authToken}` } });
  } catch (e) {}
  setG((st) => ({ ...st, championUses: { ...st.championUses, unseen: 0 } }));
  return { ok: true };
},
```

4. `campaignFight` (~1925) : ajouter le 5e paramètre `champion` et étendre le body (`app.jsx:1929-1933`) :

```js
async campaignFight(worldIndex, floorIndex, selectedIds, posture, champion) {
  // ... inchangé jusqu'au body :
  body: JSON.stringify({
    world_index: worldIndex, floor_index: floorIndex, selected: selectedIds, posture,
    ...(champion ? { champion_owner_wallet: champion.owner_wallet, champion_slot: window.FA_CHAMPION_UI.CHAMPION_SLOT } : {}),
  }),
```

et dans le retour (~1959-1964), propager `champion: data.champion || null`.

5. `towerFight` (~2002) : même extension sur le body `beast_ids` (`:2006-2008`) avec le 3e paramètre `champion`, et propager `champion: data.champion || null` dans le retour (~2022-2026).

6. Amorçage (~328-330) : `useEffect(() => { if (g.authToken) actions.championUses(); }, [g.authToken]);`

- [ ] **Step 4: Vérifier le passage** — `node --test --test-force-exit test/champion-wiring.test.js test/expeditions-wiring.test.js test/account-wiring.test.js` → PASS

- [ ] **Step 5: Commit**

```bash
git add app.jsx test/champion-wiring.test.js
git commit -m "feat(champion): state + actions API — designation, liste, emprunt, notification"
```

---

### Task 4: Écran Équipe — désigner son champion

**Files:**
- Modify: `screens.jsx` — `Team()` (`:97-179`), grille `:160-176`
- Test: `test/champion-team.test.js`, `test/card-badges.test.js` (non-régression)

**Interfaces:**
- Consumes: `actions.championGet/championSet` (Task 3), clés `CHAMP_DESIGNATE/CHAMP_IS/CHAMP_DESIGNATED_OK` (Task 2), pattern badge « busy » (`screens.jsx:165-170`), bande `.relic-slot` (`RelicSlot :181`).
- Produces: badge « ★ » sur l'art de l'entité championne + bande cliquable « ☆ Désigner champion » / « ★ Champion » sous chaque carte.

- [ ] **Step 1: Test source (échoue d'abord)**

`test/champion-team.test.js` :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");
const TEAM = SRC.slice(SRC.indexOf("function Team("), SRC.indexOf("function RelicSlot"));

test("l ecran Equipe charge la designation et permet de designer", () => {
  assert.match(TEAM, /championGet\(\)/);
  assert.match(TEAM, /championSet\(/);
  assert.match(TEAM, /CHAMP_DESIGNATE/);
  assert.match(TEAM, /CHAMP_IS/);
  assert.match(TEAM, /championBeastId/);
});

test("pas de rarete/niveau ajoutes sur la vignette (seul un badge est permis)", () => {
  assert.ok(!/rar-tag|lvl-tag/.test(TEAM));
});
```

- [ ] **Step 2: Vérifier l'échec** — FAIL

- [ ] **Step 3: Implémenter dans `Team()`**

1. Au montage (avec les hooks existants de `Team`) :

```js
useEffect(() => { if (g.authToken) actions.championGet(); }, [g.authToken]);
```

2. Dans la grille (`:160-176`), pour chaque bête `b` : combiner le badge existant « busy » avec l'étoile champion (le badge busy garde la priorité visuelle), et ajouter la bande sous `TalentSlot` :

```jsx
const isChamp = g.championBeastId === b.id;
// badge sur l'art (autorisé par test/card-badges.test.js) :
badge={busy ? (/* badge expédition existant inchangé */) :
  isChamp ? (<div style={{ position: "absolute", top: 8, left: 8, fontSize: 16, textShadow: "0 0 8px var(--gold)" }}>★</div>) : null}
// bande d'action sous la carte (frère de <RelicSlot/> et <TalentSlot/>) :
<div className={cx("relic-slot", "mono")}
  style={{ cursor: "pointer", color: isChamp ? "var(--gold)" : "var(--text-dim)" }}
  onClick={async () => {
    if (isChamp) return;
    const r = await actions.championSet(b.id);
    if (r.ok) toast(I18N.t("CHAMP_DESIGNATED_OK", D.displayName(b)), "good");
    else toast(r.reason, "bad");
  }}>
  {isChamp ? "★ " + I18N.t("CHAMP_IS") : "☆ " + I18N.t("CHAMP_DESIGNATE")}
</div>
```

(adapter l'accès au nom à l'existant du fichier — `D.displayName(b)` est la convention du dépôt ; si `Team` utilise un autre helper de nom, reprendre le sien.)

- [ ] **Step 4: Vérifier** — `node --test --test-force-exit test/champion-team.test.js test/card-badges.test.js` → PASS

- [ ] **Step 5: Commit**

```bash
git add screens.jsx test/champion-team.test.js
git commit -m "feat(champion): ecran Equipe — designation du champion (badge + bande)"
```

---

### Task 5: Composants — `champion.jsx` + montage

**Files:**
- Create: `champion.jsx` (racine)
- Modify: `index.html` (2 balises script : `build/champion-ui.js` et `build/champion.js`, avant `build/app.js`, après `build/components.js` et `build/tour-ui.js` — même `?v=` que les balises voisines, le bump v200 viendra en Task 8)
- Modify: `app.jsx` — rendu de `ChampionUsesModal` à côté de `PrizeModal` (~2264-2273)
- Test: `test/champion-components.test.js`

**Interfaces:**
- Consumes: `Modal`, `FaText`, `cx` (`components.jsx`), `FA_CHAMPION_UI.aggregateUsesByDay`, clés `CHAMP_*`, patron tuile `TourBeastTile` (`tour.jsx:19-48`), patron `PrizeModal` (`arene.jsx:318-353`).
- Produces: `window.ChampionRow`, `window.ChampionTile`, `window.ChampionUsesModal` :
  - `ChampionRow({ champions, activeOwner, onPick(entry), onClear, runState })` — titre `CHAMP_ROW_TITLE`, grille `.champ-row` (`display:grid, gridTemplateColumns:"repeat(auto-fill, minmax(96px,1fr))", gap:8`), une `ChampionTile` par entrée, `CHAMP_EMPTY` si vide ; la tuile active porte un liseré `var(--elec)` et re-cliquer appelle `onClear`.
  - `ChampionTile({ entry, active, disabled, onClick, hpFrac })` — art 56×56 (même rendu que `TourBeastTile` : copier son accès à l'image), nom du PRÊTEUR (`entry.name`) en `mono` 10px, nom de l'entité + `LV n` dans le corps (jamais sur la vignette), `<Bar kind="hp" frac={hpFrac}>` si `hpFrac != null`, opacité 0.45 si `disabled`.
  - `ChampionUsesModal({ uses, onSeen })` — `<Modal accent="var(--gold)">`, titre `CHAMP_USES_TITLE`, une ligne par jour via `aggregateUsesByDay` : `<FaText text={I18N.t("CHAMP_USES_LINE", a.fights, a.commission, a.points)} />` + `<div className="muted mono">{I18N.t("CHAMP_USES_BY", a.names.join(", "))}</div>`, bouton OK → `onSeen()`.

- [ ] **Step 1: Test source (échoue d'abord)**

`test/champion-components.test.js` :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "champion.jsx"), "utf8");
const HTML = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const APP = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

test("champion.jsx exporte les 3 composants sur window", () => {
  assert.match(SRC, /window/);
  for (const c of ["ChampionRow", "ChampionTile", "ChampionUsesModal"]) assert.match(SRC, new RegExp(c));
});

test("les montants passent par FaText, l agregat par FA_CHAMPION_UI", () => {
  assert.match(SRC, /FaText/);
  assert.match(SRC, /aggregateUsesByDay/);
  assert.match(SRC, /CHAMP_USES_LINE/);
});

test("index.html charge champion-ui puis champion avant app", () => {
  const iUi = HTML.indexOf("build/champion-ui.js");
  const iCmp = HTML.indexOf("build/champion.js?");
  const iApp = HTML.indexOf("build/app.js");
  assert.ok(iUi > 0 && iCmp > 0 && iApp > 0);
  assert.ok(iUi < iCmp && iCmp < iApp, "ordre de chargement");
});

test("App monte ChampionUsesModal quand unseen > 0", () => {
  assert.match(APP, /ChampionUsesModal/);
  assert.match(APP, /championUses\.unseen/);
  assert.match(APP, /championUsesSeen/);
});
```

- [ ] **Step 2: Vérifier l'échec** — FAIL

- [ ] **Step 3: Implémenter**

`champion.jsx` (IIFE implicite au build ; en-tête et exports comme les autres fichiers) :

```jsx
/* ==== FRACTAL ARENA — Champion de soutien : composants ==== */
const { useState } = React;
const I18N = window.FA_I18N;
const CU = window.FA_CHAMPION_UI;
const { Modal, Bar, FaText, cx } = window;

function ChampionTile({ entry, active, disabled, onClick, hpFrac }) {
  const b = entry.beast;
  return (
    <div className={cx("panel", "oct")} onClick={disabled ? undefined : onClick}
      style={{ padding: 8, cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.45 : 1,
        border: active ? "1px solid var(--elec)" : "1px solid var(--line)", position: "relative" }}>
      {/* art 56x56 : REPRENDRE le rendu d'image de TourBeastTile (tour.jsx:19-48) tel quel */}
      <div className="mono" style={{ fontSize: 10, color: "var(--elec)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.name}</div>
      <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{b.name} · LV {b.level}</div>
      {hpFrac != null && <Bar kind="hp" frac={hpFrac} />}
    </div>
  );
}

function ChampionRow({ champions, activeOwner, onPick, onClear, runState }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div className="h2" style={{ fontSize: 13, color: "var(--elec)", marginBottom: 6 }}>{I18N.t("CHAMP_ROW_TITLE")}</div>
      {(!champions || champions.length === 0)
        ? <div className="muted mono" style={{ fontSize: 11 }}>{I18N.t("CHAMP_EMPTY")}</div>
        : <div className="champ-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
            {champions.map((entry) => {
              const active = activeOwner === entry.owner_wallet;
              const st = runState ? CU.championRunState(runState, entry.beast.id) : null;
              return <ChampionTile key={entry.owner_wallet} entry={entry} active={active}
                disabled={!!(st && st.dead)} hpFrac={st ? st.hpFrac : null}
                onClick={() => (active ? onClear() : onPick(entry))} />;
            })}
          </div>}
      {activeOwner && <button className="btn sm" style={{ marginTop: 6 }} onClick={onClear}>{I18N.t("CHAMP_CLEAR")}</button>}
    </div>
  );
}

function ChampionUsesModal({ uses, onSeen }) {
  const agg = CU.aggregateUsesByDay(uses);
  return (
    <Modal accent="var(--gold)" onClose={onSeen}>
      <div className="h2" style={{ color: "var(--gold)", marginBottom: 12 }}>⚔️ {I18N.t("CHAMP_USES_TITLE")}</div>
      {agg.map((a) => (
        <div key={a.day} className="panel oct" style={{ padding: 12, marginBottom: 8 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>{a.day}</div>
          <FaText text={I18N.t("CHAMP_USES_LINE", a.fights, a.commission, a.points)} />
          {a.names.length > 0 && <div className="muted mono" style={{ fontSize: 11 }}>{I18N.t("CHAMP_USES_BY", a.names.join(", "))}</div>}
        </div>
      ))}
      <button className="btn btn-gold block" onClick={onSeen}>OK</button>
    </Modal>
  );
}

Object.assign(window, { ChampionRow, ChampionTile, ChampionUsesModal });
```

(adapter à la lecture des voisins : la signature réelle de `Modal` — `arene.jsx:318-353` montre l'usage canonique — et le rendu d'art exact de `TourBeastTile`.)

`index.html` : ajouter, avec le `?v=` courant des balises voisines :

```html
<script src="build/champion-ui.js?v=199"></script>   <!-- avec les autres *-ui -->
<script src="build/champion.js?v=199"></script>      <!-- après components.js, avant app.js -->
```

`app.jsx` (~2264-2273, à côté du rendu `PrizeModal`) :

```jsx
{g.championUses.unseen > 0 && g.championUses.uses.length > 0 &&
  <window.ChampionUsesModal uses={g.championUses.uses} onSeen={() => actions.championUsesSeen()} />}
```

- [ ] **Step 4: Build + vérifier** — `npm run build` puis `node --test --test-force-exit test/champion-components.test.js test/precompile.test.js` → PASS

- [ ] **Step 5: Commit**

```bash
git add champion.jsx champion-ui.js index.html app.jsx build/ test/champion-components.test.js
git commit -m "feat(champion): composants ChampionRow/Tile/UsesModal + montage notification"
```

---

### Task 6: Emprunt en Campagne

**Files:**
- Modify: `campaign.jsx` — `CampaignCombat` (`:122-384`), `settle()`/`summary` (`:258-280`), `CampResultModal` (`:386-431`)
- Test: `test/champion-campaign.test.js`

**Interfaces:**
- Consumes: `ChampionRow` (Task 5), `actions.championsList/campaignFight(…, champion)/championClearBorrow` (Task 3), `FA_CHAMPION_UI.requiredOwnCount`, clés `CHAMP_*`.
- Produces: rangée « Champions alliés » dans le panneau d'actions, équipe = 2 propres + champion en slot 2, liseré + « Prêté par %s » sur la 3e carte du plateau, ligne commission dans la modale de résultat.

- [ ] **Step 1: Test source (échoue d'abord)**

`test/champion-campaign.test.js` :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "campaign.jsx"), "utf8");

test("CampaignCombat integre le champion : liste, rangee, envoi, erreur traduite", () => {
  assert.match(SRC, /championsList\(\)/);
  assert.match(SRC, /ChampionRow/);
  assert.match(SRC, /championBorrow/);
  assert.match(SRC, /requiredOwnCount/);
  assert.match(SRC, /CHAMP_ERR_champion_indisponible/);
  assert.match(SRC, /CHAMP_BORROWED_TAG/);
});

test("le resultat affiche la commission versee", () => {
  assert.match(SRC, /CHAMP_COMMISSION_ROW/);
});
```

- [ ] **Step 2: Vérifier l'échec** — FAIL

- [ ] **Step 3: Implémenter dans `CampaignCombat`**

1. En tête du composant (`:124-125`), la sélection devient consciente du champion :

```js
const champ = g.championBorrow;
const ownNeeded = window.FA_CHAMPION_UI.requiredOwnCount(!!champ);
const selectedBeasts = g.selected.map((id) => g.roster.find((b) => b.id === id)).filter(Boolean).slice(0, ownNeeded);
const ready = selectedBeasts.length === ownNeeded;
```

2. Charger la liste au montage : `useEffect(() => { actions.championsList(); }, []);`

3. Aperçu idle (`:148-153`) — le champion en 3e position, barre pleine (décision v1-d) :

```js
const previewTeam = champ ? [...selectedBeasts, champ.beast] : selectedBeasts;
setP1Meta(previewTeam.map(campMeta));
setP1Live(previewTeam.map((b, i) => (champ && i === 2)
  ? { hp: 1, maxHp: 1, alive: true }
  : { hp: D.eff(b, "hp"), maxHp: D.eff(b, "hp"), alive: true }));
```

(même construction dans `startFight` `:192` pour `setP1Meta`.) NB : `campMeta` doit tolérer la projection `{id,name,type,preset,rarity,rank,level,image_key}` — vérifier sa définition en tête de `campaign.jsx` ; si elle lit une propriété absente, la garder par `?? valeur neutre`.

4. `startFight` (`:171-183`) :

```js
const resp = await actions.campaignFight(worldIndex, floorIndex, g.selected.slice(0, ownNeeded), posture, champ);
if (!resp.ok) {
  setPlaying(false);
  if (resp.reason === "champion_indisponible") {
    toast(I18N.t("CHAMP_ERR_champion_indisponible"), "bad");
    actions.championClearBorrow();
    actions.championsList();
  } else {
    toast(resp.reason === "bete_en_expedition" ? I18N.t("EXP_ERR_bete_en_expedition") : resp.reason, "bad");
  }
  return;
}
```

5. Liseré du plateau — boucle p1 (`:315-317`) :

```jsx
{[0, 1, 2].map((i) => (
  <div key={i} style={champ && i === 2 ? { border: "1px solid var(--elec)", borderRadius: 8, position: "relative" } : undefined}>
    {champ && i === 2 && <div className="mono" style={{ fontSize: 9, color: "var(--elec)", textAlign: "center" }}>{I18N.t("CHAMP_BORROWED_TAG", champ.name)}</div>}
    <CampCombatCard side="p1" meta={p1Meta[i]} live={p1Live && p1Live[i]} cref={(el) => (p1Refs.current[i] = el)} />
  </div>
))}
```

6. Panneau d'actions (`:354-373`) — la rangée au-dessus de `PostureSelect`, et le message d'aide adapté :

```jsx
{!ready ? (
  <>
    <div className="mono" style={{ fontSize: 12, color: "var(--alert)", textAlign: "center" }}>{I18N.t(champ ? "CHAMP_NEED2" : "CAMP_NEED3")}</div>
    <button className="btn btn-elec block lg" onClick={() => actions.setView("team")}>{I18N.t("CAMP_GOTO_TEAM")}</button>
    <window.ChampionRow champions={g.championsList} activeOwner={champ && champ.owner_wallet}
      onPick={(e) => setG_via_actions(e)} onClear={() => actions.championClearBorrow()} />
  </>
) : (
  <>
    {/* bloc entrée gratuite + PostureSelect + bouton combat : inchangés */}
    <window.ChampionRow champions={g.championsList} activeOwner={champ && champ.owner_wallet}
      onPick={(e) => setG_via_actions(e)} onClear={() => actions.championClearBorrow()} />
  </>
)}
```

où `setG_via_actions(e)` = une action `championPickBorrow(entry)` à ajouter dans `app.jsx` (Task 3 l'a prévue sous le nom `championClearBorrow` ; ajouter ici son jumeau) :

```js
championPickBorrow(entry) { setG((st) => ({ ...st, championBorrow: entry })); },
```

(ajouter `championPickBorrow` au test wiring de la Task 3 est inutile — le test source de cette task le couvre via `ChampionRow`.)

7. Résultat — `settle()` (`:258-280`) : recopier `resp.champion` dans `summary` (`champion: sr.champion || null`) ; `CampResultModal` (`:386-431`), après les `CampResRow` existants (`:399-401`) :

```jsx
{data.champion && data.champion.commission > 0 &&
  <CampResRow label={I18N.t("CHAMP_COMMISSION_ROW", data.champion.owner_wallet && data.champion.beast ? (data.champion.beast.name || "") : "")}
    value={data.champion.commission} />}
```

NB : le pseudo du prêteur n'est pas dans la réponse serveur (`owner_wallet` seulement) — utiliser `g.championBorrow.name` capturé au moment du combat (le passer dans `summary.champion_name` depuis `settle()`), jamais le wallet brut.

- [ ] **Step 4: Build + vérifier** — `npm run build` puis `node --test --test-force-exit test/champion-campaign.test.js test/card-badges.test.js test/i18n-cles-utilisees.test.js` → PASS

- [ ] **Step 5: Commit**

```bash
git add campaign.jsx app.jsx build/ test/champion-campaign.test.js
git commit -m "feat(champion): emprunt en Campagne — rangee, slot marque, commission affichee"
```

---

### Task 7: Emprunt en Tour (+ auto-combat)

**Files:**
- Modify: `tour.jsx` — sélecteur (`:397-403`), `onFight` (`:274-292`), `onAuto` (`:305-352`), recap (`:459-478`)
- Test: `test/champion-tour.test.js`

**Interfaces:**
- Consumes: `ChampionRow` (avec `runState` pour l'attrition du champion), `actions.towerFight(ids, posture, champion)`, `TU.validateEngage(ids, roster, rosterState, expectedCount)`, `TU.pickFittest3`, clés `CHAMP_*`.
- Produces: rangée sous la grille de tuiles, combat manuel et auto avec champion, recap de commission.

- [ ] **Step 1: Test source (échoue d'abord)**

`test/champion-tour.test.js` :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "tour.jsx"), "utf8");

test("la Tour integre le champion : rangee, envoi, validation a 2, erreur traduite", () => {
  assert.match(SRC, /ChampionRow/);
  assert.match(SRC, /championsList\(\)/);
  assert.match(SRC, /championBorrow/);
  assert.match(SRC, /requiredOwnCount/);
  assert.match(SRC, /CHAMP_ERR_champion_indisponible/);
});

test("l auto-combat conserve le champion et cumule la commission", () => {
  const auto = SRC.slice(SRC.indexOf("function onAuto"), SRC.indexOf("function onAuto") + 4000);
  assert.match(auto, /championBorrow|champRef/);
  assert.match(SRC, /CHAMP_COMMISSION_GAIN/);
});
```

- [ ] **Step 2: Vérifier l'échec** — FAIL

- [ ] **Step 3: Implémenter dans `tour.jsx`**

1. En tête de `Tour()` : `const champ = g.championBorrow; const ownNeeded = window.FA_CHAMPION_UI.requiredOwnCount(!!champ);` + `useEffect(() => { actions.championsList(); }, []);`

2. Rangée sous la grille de tuiles (`:397-403`), avec l'état de run pour griser un champion mort ce run :

```jsx
<window.ChampionRow champions={g.championsList} activeOwner={champ && champ.owner_wallet}
  runState={curState /* le roster_state courant du run, déjà dans le composant */}
  onPick={(e) => actions.championPickBorrow(e)} onClear={() => actions.championClearBorrow()} />
{champ && <div className="mono" style={{ fontSize: 11, color: "var(--elec)" }}>{I18N.t("CHAMP_ACTIVE", champ.name)} · {I18N.t("CHAMP_NEED2")}</div>}
```

(reprendre le nom EXACT de la variable d'état de run utilisée par `view`/`TourBeastTile` dans le composant — le rapport d'exploration la nomme `curState` dans `onAuto` `:318`.)

3. `onFight` (`:274-292`) :

```js
const ids = g.selected.slice(0, ownNeeded);
const v = TU.validateEngage(ids, g.roster, curState, ownNeeded);
if (!v.ok) { /* gestion existante inchangée */ return; }
const resp = await actions.towerFight(ids, posture, champ);
if (!resp.ok && resp.reason === "champion_indisponible") {
  toast(I18N.t("CHAMP_ERR_champion_indisponible"), "bad");
  actions.championClearBorrow(); actions.championsList();
  return;
}
```

4. `onAuto` (`:305-352`) — le champion suit, se désactive s'il meurt ou disparaît, la commission se cumule :

```js
// dans la boucle, à la place de l'appel existant :
const fittest = TU.pickFittest3(g.roster, curState);
if (!fittest) break;                          // règle inchangée : le champion ne prolonge pas le run
let curChamp = champRef.current;              // champRef = useRef(g.championBorrow) posé au lancement
if (curChamp && window.FA_CHAMPION_UI.championRunState(curState, curChamp.beast.id).dead) {
  curChamp = null; champRef.current = null;   // champion tombé ce run : on continue sans lui
}
const ids = curChamp ? fittest.slice(0, 2) : fittest;
const r = await actions.towerFight(ids, posture, curChamp);
if (!r.ok && r.reason === "champion_indisponible") { curChamp = null; champRef.current = null; continue; }
// recap : if (r.champion && r.champion.commission > 0) recap.commission += r.champion.commission;
```

5. Recap auto (`:459-478`) : si `autoRecap.commission > 0`, une ligne `<FaText text={I18N.t("CHAMP_COMMISSION_GAIN", autoRecap.commission)} />` — NB : c'est la commission VERSÉE au prêteur (info), les FA du recap sont déjà nets.

- [ ] **Step 4: Build + vérifier** — `npm run build` puis `node --test --test-force-exit test/champion-tour.test.js test/tour-ui.test.js test/tour-i18n.test.js` → PASS

- [ ] **Step 5: Commit**

```bash
git add tour.jsx build/ test/champion-tour.test.js
git commit -m "feat(champion): emprunt en Tour — rangee, attrition du slot, auto-combat"
```

---

### Task 8: Perso (points de lien) + bump v200 + PR

**Files:**
- Modify: `screens.jsx` — `Perso()` (~1072-1139, panneau après le badge holder `:1123-1131`)
- Modify: `index.html`, `data.js:29`, `sw-policy.js:10`, `manifest.webmanifest:15-19`, `test/account-wiring.test.js:154+170` (rituel v199 → v200)
- Test: `test/champion-perso.test.js` + suite complète

**Interfaces:**
- Consumes: `g.championPoints` (Task 3), clés `CHAMP_POINTS`/`CHAMP_POINTS_DESC`, gabarit du panneau badge holder (`screens.jsx:1123-1131`).

- [ ] **Step 1: Test (échoue d'abord)**

`test/champion-perso.test.js` :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const SRC = fs.readFileSync(path.join(__dirname, "..", "screens.jsx"), "utf8");
const PERSO = SRC.slice(SRC.indexOf("function Perso("), SRC.length);

test("l ecran Perso affiche le compteur de points de lien", () => {
  assert.match(PERSO, /CHAMP_POINTS/);
  assert.match(PERSO, /championPoints/);
});
```

- [ ] **Step 2: Vérifier l'échec** — FAIL

- [ ] **Step 3: Panneau dans `Perso()`** (entre le badge holder `:1131` et `<QuizPrestige/>` `:1134`) :

```jsx
<div className="panel oct" style={{ border: "1px solid var(--line)", padding: 20, marginTop: 16 }}>
  <div className="flex between center">
    <span className="h2">🔗 {I18N.t("CHAMP_POINTS")}</span>
    <span className="pill">{g.championPoints}</span>
  </div>
  <div className="muted mono" style={{ fontSize: 11, marginTop: 6 }}>{I18N.t("CHAMP_POINTS_DESC")}</div>
</div>
```

- [ ] **Step 4: Rituel de bump v199 → v200 (les 5 endroits)**

1. `index.html` : TOUTES les occurrences `?v=199` → `?v=200` (y compris les 2 balises champion ajoutées en Task 5).
2. `data.js:29` : `window.FA_ASSET_V = "200";`
3. `sw-policy.js:10` : `const CACHE = "fa-v200";`
4. `test/account-wiring.test.js` : les DEUX littéraux `"199"` (lignes ~154 et ~170) → `"200"`.
5. `manifest.webmanifest:15-19` : les 5 icônes `?v=199` → `?v=200`.

Puis : `npm run build`

- [ ] **Step 5: Suite COMPLÈTE**

Run: `npm test`
Expected: tout vert (~709+ tests) — en particulier `account-wiring`, `asset-cache-bust`, `sw-policy`, `precompile`, `card-badges`, `i18n-cles-utilisees`, et les 8 fichiers `champion-*`.

- [ ] **Step 6: Commit + PR**

```bash
git add -A
git commit -m "Champion de soutien — interface complete (v200)"   # corps : résumé + Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>
git push -u origin champion-soutien-web
```

Ouvrir la PR (base `main`) : résumé de l'UI, les 4 décisions v1 (slot fixe 2, auto-combat conserve le champion sans prolonger le run, points = affichage seul, aperçu idle barre pleine), rappel : **validation finale par le fondateur sur téléphone en PROD après merge** (pas de localhost pour du rendu mobile). Après merge : vérifier les assets sur URLs NUES (jamais `?x=`), et ne JAMAIS requêter `?v=200` avant la fin du run GitHub Pages (cache Cloudflare empoisonné 4 h).

---

## Self-review (fait à l'écriture du plan)

- Spec §8 : badge Équipe + geste de désignation (T4), rangée « Champions alliés » Campagne/Tour (T6/T7), marquage du slot emprunté — liseré + pseudo (T6.5, T7 tuile active), compteur de points Perso (T8), i18n FR/EN/ZH « entité »/« louer la puissance » (T2). §6 notification agrégée par jour (T5 modale + T3 amorçage). §11 tests web : composition pure (T1), pas d'appel `/champions` hors Campagne/Tour (fetch uniquement au montage de ces écrans, T6/T7), rituel de bump (T8).
- Titres achetables par points : hors v1 (pas d'endpoint serveur) — décision v1-c.
- Points de friction du rapport traités : ids empruntés hors `g.selected` (state `championBorrow` séparé), `validateEngage` étendu (T1), `pickFittest3` contourné par slice (T7), collision `LINK_*` évitée (préfixe `CHAMP_`), purge `serverToState` sans impact (le champion n'est jamais dans `selected`).
