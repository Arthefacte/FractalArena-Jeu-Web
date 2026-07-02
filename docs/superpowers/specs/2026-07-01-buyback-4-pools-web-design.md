# Buyback à 4 pools — Client web (Design)

**Date :** 2026-07-01
**Statut :** validé (design issu du brainstorm serveur, Section 3 « affichage web » + carte du repo)
**Portée :** `fractal-arena-web` (client). Miroir du refactor serveur PR #39 (4 pools indépendants).

## Contexte

Le serveur (PR #39) remplace l'économie 4-tranches par **4 pools de buyback indépendants** (seuils 5k/10k/25k/50k, 25 % chacun). Il retire les routes `/burn/status`+`/burn/confirm`, change la forme de `GET /buyback/status` (objet unique → **tableau `pools[]`**), retire `fee_split` de la quote forge, et réduit le leaderboard à un board `buyback`. Le client doit être mis à jour **et déployé AVANT le serveur** (le client prod actuel lit l'ancienne forme).

## Contrat serveur consommé

`GET /buyback/status` renvoie :
```json
{
  "status": "ok",
  "buyback": {
    "buyback_wallet": "bc1q…",
    "countdown_hours": 24,
    "pools": [
      { "tier": 5000, "total": 3800, "threshold": 5000, "buyback_count": 0,
        "total_bought": 12000, "threshold_reached": false,
        "threshold_reached_at": null, "countdown_ends_at": null,
        "ready_to_buyback": false, "last_buyback": null },
      { "tier": 10000, ... }, { "tier": 25000, ... }, { "tier": 50000, ... }
    ]
  }
}
```
`/burn/status` n'existe plus (404). Le leaderboard `GET /leaderboard?board=…` n'accepte plus `liquidity`/`airdrop`/`burned` (fallback serveur → `wins`).

## Changements (6 fichiers)

### 1. `buyback.jsx` — ticker 4 jauges (layout A)
- **Retirer** le leg `/burn/status` : supprimer le `fetch(API_URL + "/burn/status")`, l'état `burn`, et le bloc `TickerRow kind="liq"`.
- Le leg buyback consomme `GET /buyback/status` → `data.buyback.pools` (tableau de 4). Rendre **une `TickerRow` par pool** (layout A) :
  ```
  💰 Réserve de rachat                    [preuve]
   Rachat · 5 000     ▓▓▓▓▓▓▓░░  3 800 / 5 000
   Rachat · 10 000    ▓▓▓░░░░░░  2 100 / 10 000
   Rachat · 25 000    ▓▓░░░░░░░  4 900 / 25 000
   Rachat · 50 000    ▓░░░░░░░░  4 200 / 50 000
          · 142 300 FA rachetés depuis le lancement (cumul 4 pools)
  ```
  - Label par pool : `I.t("BB_POOL_LABEL", fmt(tier))` → « Rachat · 5 000 » (nouvelle clé).
  - Fraction/jauge : `buybackFraction(pool.total, pool.threshold)` (helper existant, réutilisé).
  - Wallet partagé : affiché **une seule fois** (`buyback_wallet`), pas par pool.
  - Sous-texte cumul : `BB_BOUGHT_SUB` avec `sum(pools[].total_bought)`.
- `buybackFraction` (helper pur) et la structure `TickerRow` restent inchangés en forme.

### 2. Défaite — 1 ligne « 100 % → rachat »
- `data.js` : retirer `DEFEAT_POOL_RATIO` (constante `D.ECON`).
- `app.jsx` (`resolveFight`, branche défaite) : retirer le calcul `pool`/`burn` (`Math.floor(betAmount * DEFEAT_POOL_RATIO)`), ne garder que `session.net -= betAmount`. Retirer `pool`/`burn` de l'objet `summary` (ou les laisser à 0 si d'autres lecteurs existent — à vérifier ; par défaut on les retire).
- `fosse.jsx` (`ResultModal`, branche défaite) : remplacer les 2 lignes `RES_POOL` + `RES_BURN` par **1 seule** `ResRow` « Rachat » = `fmt(betAmount)` (100 % de la mise, nouvelle clé `RES_BUYBACK`). La branche insurance (`RES`… 🛡) reste inchangée.

### 3. Leaderboard
- `leaderboard.jsx` : `SECTIONS.eco` → `[["earned", "LB_TAB_EARNED"], ["buyback", "LB_TAB_BUYBACK"]]` (retrait de `burned`/`liquidity`/`airdrop`). Le reste (rendu générique des onglets/lignes) inchangé.

### 4. Forge — libellé `fee_split`
- `FG_SUB` (i18n) : « 70 % du coût → Reward Pool · 30 % → Mega buyback » → « **100 % → rachat** ». (Aucun code ne lit `fee_split` de la quote ; c'est un libellé statique rendu dans `screens.jsx`.)

### 5. i18n (`i18n.js`) — nettoyage clés (FR/EN/ZH)
- **Retirer** : `LB_TAB_BURNED`, `LB_TAB_LIQUIDITY`, `LB_TAB_AIRDROP`, `RES_POOL`, `RES_BURN`, `BB_LIQ`.
- **Ajouter** : `LB_TAB_BUYBACK` (« Rachat » / « Buyback » / « 回购 »), `BB_POOL_LABEL` (« Rachat · %s » / « Buyback · %s » / « 回购 · %s »), `RES_BUYBACK` (« Rachat » / « Buyback » / « 回购 »).
- **Ajuster** : `FG_SUB` (ci-dessus) ; `BB_TICK_TITLE` (« une partie de chaque mise… » → « 100 % de chaque mise et forge rachète… »).
- **Vérifier** `BB_BOUGHT` (clé orpheline détectée) : la retirer si non référencée après les changements.
- Garder `BB_RESERVE`, `BB_BOUGHT_SUB`, `BB_PROOF`.

### 6. `index.html` — cache-buster
- Bumper `?v=56` → `?v=57` sur les fichiers modifiés (`buyback.jsx`, `leaderboard.jsx`, `app.jsx`, `data.js`, `i18n.js`, `screens.jsx`, `fosse.jsx`). (Nécessaire : Babel in-browser, pas de bundler ; le cache navigateur sert l'ancienne version sinon.)

## Non concerné (à ne PAS toucher)
- `/stats` : le client ne l'appelle nulle part.
- `WL_REWARD_POOL` / `WL_DEP_INFO` (adresse de dépôt on-chain), `PE_BADGE_HINT` (LP DEX), `AR2_PRIZE` (prize pool PvP) — « pool » sans rapport avec l'économie buyback.
- `cinematique.jsx` / trap `import()` Babel : non concerné.

## Build & tests
- Pas de bundler : JSX transpilé **in-browser** par Babel Standalone ; vanilla-JS (`data.js`, `i18n.js`) chargés en `<script>` classiques exposant `window.FA_*`. Ordre des `<script type="text/babel">` dans `index.html` significatif (scopes Babel isolés, communication via `window.*`).
- Tests : runner `node:test` (pas de `package.json`), `node --test "test/**/*.test.js"` (41 verts actuels). Les `.jsx` ne sont pas Node-`require`-ables (Babel requis) → tester au niveau **clés i18n** (présence `LB_TAB_BUYBACK`/`BB_POOL_LABEL`/`RES_BUYBACK`, absence des clés retirées) et **helpers purs** (`buybackFraction`, testable comme `forge-ui.js`).

## Décisions d'affichage (défauts, à valider en relecture)
1. Défaite : la ligne unique montre **100 % de la mise perdue** (le split 25 %/pool est un détail backend, non affiché au joueur). *(défaut : oui)*
2. Ticker : le sous-texte « rachetés depuis le lancement » = **somme** des `total_bought` des 4 pools. *(défaut : oui)*
3. Chaque jauge affiche `total / seuil` + barre de remplissage ; pas de compte à rebours individuel par pool (garder compact). *(défaut : oui)*

## Ordre de déploiement (rappel)
**web (ce chantier) → serveur (PR #39) → migration one-shot → drop ex-tables.** Ce client doit partir en prod **avant** le serveur.
