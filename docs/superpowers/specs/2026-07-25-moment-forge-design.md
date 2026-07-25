# Moment Forge — cinématique de fusion et d'invocation

**Date** : 2026-07-25 · **Statut** : design approuvé (brainstorm des 18 et 25 juillet 2026)
**Roadmap** : esthétique #5, volet 1 (le volet 2 « fond blockchain vivante » fera l'objet d'une spec séparée).
**Base** : `origin/main` v87 (branche `moment-forge`). Indépendant de la PR #51 (juice de combat).

## But

Faire de chaque fusion et de chaque invocation un « moment » : une courte cinématique canvas
plein écran dans le thème forge du jeu (octogonal, cyan / orange-Bitcoin / or), dont l'intensité
et la durée montent avec la qualité du résultat. Le résultat textuel (toast) et la carte révélée
restent la source de vérité — la cinématique est un habillage robuste, jamais bloquant.

## Portée

- **Fusion créatures** (`ForgeFusion.doFuse`, screens.jsx) : succès **et** échec.
- **Summon créature** (`ForgeSummon.doSummon`, screens.jsx) : toujours une naissance (gacha
  sans échec) ; l'intensité est pilotée par le **rang C/B/A/S** (`r.beast.rank`, refonte v83).
- **Hors portée v1** : le summon de reliques (rareté) — le moteur le permettra (`tier`
  générique) mais on ne le branche pas ; le fond vivant (volet 2).

### Décisions actées

1. **Toutes les qualités jouent la cinématique**, y compris rang C / Common : version courte
   (~0,8 s) pour ne pas ralentir les tirages en série ; la durée et l'intensité montent avec le
   tier jusqu'à ~2 s plein feu (rang S / fusion Legendary).
2. Le beat « échec » n'existe que pour la **fusion ratée** (matériaux consumés, rien ne naît).
3. La carte du summon est révélée **après** la cinématique (`setLast` dans `onDone`).

## Architecture

Pattern éprouvé du repo : module pur testable node + couche canvas (cf. `totem-cine.js`,
`forge-ui.js` + `test/forge-ui.test.js`).

### `forge-cine-ui.js` → `window.FA_FORGE_CINE_UI` (module pur)

IIFE classique (pas ESM), aucun DOM / aléa / horloge. Expose :

- `DUR = { fuse_fail: 1000, tier: [800, 1200, 1600, 2000] }` — durées ms par niveau 0–3.
- `tierIndex(tier)` — normalise `'C'|'B'|'A'|'S'` et `'Common'|'Rare'|'Epic'|'Legendary'`
  vers 0–3 (inconnu → 0).
- `forgeVals(t, { mode, success, tier, premium })` — `t` ∈ [0,1] normalisé ; retourne l'état
  exact du rendu : phase (`strike` → `shockwave` → `crystallize` → `burst` ; ou `sparks` →
  `ashes` pour l'échec), intensité (nombre d'éclats, rayon d'onde, force du flash — croissance
  **monotone** par tier), teinte (couleur passée par l'appelant), accent or si `premium`.

### `forge-cine.js` → `window.FA_FORGE_CINE` (canvas)

Overlay canvas singleton plein écran (modèle `totem-cine.js`), script classique non-module.

- API : `play({ mode: 'fuse'|'summon', success, tier, color, premium, onDone })`.
- L'appelant fournit `color` (résolue depuis `D.RANK_COLORS[rank]` ou
  `D.RARITY_COLORS[rarity]`) — le module cinématique ne dépend pas de `data.js`.
- Garanties : `onDone` appelé **exactement une fois** dans tous les cas (fin normale, erreur,
  reduced-motion, double `play`) ; tout le rendu sous try/catch → en cas d'erreur, teardown et
  `onDone` immédiat ; `prefers-reduced-motion` → pas de canvas, `onDone` immédiat ;
  un `play` pendant une cinématique en cours coupe la première (son `onDone` est appelé).
- Skippable : clic/tap pendant la cinématique → saut à la fin (utile en tirages en série).

### Sons — `sfx.js` (`FA_SFX`)

Trois recettes procédurales CSP-safe, jouées par `forge-cine.js` (silencieux si module absent) :

- `forge_strike` — frappe grave + métal, au départ.
- `forge_born` — carillon dont la richesse monte avec le tier, au moment du burst.
- `forge_fizzle` — retombée mate, échec de fusion.

### Intégration — `screens.jsx`

- `doFuse` : à la réponse, `FA_FORGE_CINE.play({ mode:'fuse', success:r.success,
  tier:r.result?.rarity, color:D.RARITY_COLORS[...], premium:r.result?.premium,
  onDone: () => toast(...) })`.
- `doSummon` (créatures) : `play({ mode:'summon', success:true, tier:r.beast.rank||'C',
  color:D.RANK_COLORS[...], onDone: () => { setLast(r.beast); toast(...); } })`.
- Repli : si `window.FA_FORGE_CINE` est absent, comportement actuel inchangé (toast direct).
- `index.html` : charger `forge-cine-ui.js` puis `forge-cine.js` (scripts classiques),
  bump cache-busting global → **v88**.

## Gestion d'erreurs

Aucun chemin d'échec de la cinématique ne doit perdre le résultat du joueur : le toast et
`setLast` vivent dans `onDone`, et `onDone` est garanti. Erreur de rendu = cinématique sautée,
jamais d'exception propagée vers `doFuse`/`doSummon`.

## Tests

- `test/forge-cine-ui.test.js` (node) : durées par tier, `tierIndex` (rangs + raretés +
  inconnus), intensité **strictement croissante** par tier à phase égale, pureté (mêmes entrées
  → mêmes sorties), bornes `t` 0 et 1.
- `test/forge-cine.test.js` (node, niveau source comme les tests totem/cine existants) :
  présence des garanties dans le source (`onDone` unique, try/catch, reduced-motion),
  branchement dans `screens.jsx` et `index.html` (scripts + v88), recettes SFX présentes.
- Vérification navigateur Playwright : summon rang C (court) et fusion échec, capture d'écran.

## Critères de succès

1. Chaque fusion et chaque summon joue sa cinématique, teintée et calibrée par tier.
2. Un tirage rang C reste quasi instantané (~0,8 s, skippable au clic).
3. Reduced-motion, erreur de rendu ou module absent → l'expérience actuelle (toast + carte).
4. `node --test` passe ; aucun changement serveur.
