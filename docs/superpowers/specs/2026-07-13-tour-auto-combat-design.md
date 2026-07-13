# Tour infinie — Auto-combat (enchaînement d'étages)

**Date :** 2026-07-13
**Dépôts :** `fractal-arena-web` (principal) + `fractal-arena-server` (garde de débit)
**Statut :** design validé, prêt pour plan d'implémentation

## 1. Objectif

Ajouter un bouton **⏩ Auto** dans la Tour infinie qui enchaîne automatiquement les
étages jusqu'à la fin naturelle du run, en gérant la rotation du roster à la place
du joueur. Objectif : supprimer le clic répétitif d'un endgame où un run peut faire
40+ étages, sans changer l'équilibrage ni les récompenses.

## 2. Contexte technique

La Tour est **100 % serveur-autoritaire** (`tower.js`) :

- Un étage = un `POST /tower/fight` avec `{ beast_ids:[3], posture }`.
- Le serveur génère les ennemis (scaling absolu), résout le combat (`ENG.runBattle`),
  renvoie `{ won, floor, best_floor, rewards, run_over, roster_state, events, enemy }`.
- L'**attrition** reporte les `hp_frac` d'un étage au suivant via `roster_state` ;
  le run s'arrête quand `aliveCount < 3` (`run_over: true`).
- Le client (`tour.jsx`) ne fait que rejouer `events` dans `AreneBattle`.

Conséquence : l'auto-combat est **une boucle client** par-dessus la route existante.
Aucune nouvelle route, aucun changement d'économie/paliers/classement.

## 3. Décisions retenues

| Sujet | Décision |
|---|---|
| Gestion du roster | **Rotation auto** : à chaque étage, engager les 3 bêtes vivantes au `hp_frac` le plus haut. |
| Affichage pendant l'auto | **Log rapide** : pas d'animation `AreneBattle`, une ligne par étage, délai ~350 ms, bouton Stop. |
| Sur étage perdu (run pas fini) | **Continuer** tant qu'il reste ≥3 vivantes (l'auto ressaie avec les suivantes les plus en forme). |
| Garde serveur | **Oui, même cycle** : throttle par wallet sur `/tower/fight`. Solde la dette « aucun rate-limit sur /tower ». |
| Posture | La **posture courante** de l'UI s'applique à tous les étages de l'auto. |

## 4. Terminaison (invariant)

La boucle se termine **toujours** :

- Les `hp_frac` ne font que **baisser** (aucun soin entre étages).
- Le mur d'étage **croît** : `towerWallMult(n) = 1,05^(n-26)` après l'étage 26.
- Donc l'attrition finit par faire tomber le roster sous 3 vivantes → `run_over`.

Pas de garde-fou anti-boucle-infinie nécessaire côté logique ; le bouton **Stop** et
le `run_over` sont les deux seules sorties.

## 5. Composant 1 — Helper pur (`tour-ui.js`)

Ajouter à `FA_TOUR_UI` une fonction pure, testable en Node comme ses voisines :

```js
// Renvoie les 3 IDs vivants au hp_frac le plus haut (ordre = formation AV/MI/AR),
// ou null s'il reste < 3 vivantes. Départage stable par ordre du roster.
function pickFittest3(roster, rosterState) { ... }
```

- Exclut les bêtes mortes (`isDeadInRun`).
- Trie par `hpFracOf` décroissant ; départage par index roster (déterministe → testable).
- Renvoie `null` si `aliveCount < 3` (signal d'arrêt pour la boucle).

**Tests (`test/tour-ui.test.js`) :** roster plein → 3 plus hauts ; une bête à 100 %
mais 2 autres mortes → `null` ; départage stable ; ignore les IDs absents du roster.

## 6. Composant 2 — Boucle auto (`tour.jsx`)

État React additionnel dans `Tour()` :

- `autoRunning` (bool) — pilote l'affichage log vs combat manuel.
- `autoLog` (array) — lignes `{ floor, won, casualties:[names], tiers:[floors] }`.
- Un `useRef` `stopRef` — drapeau d'arrêt lu dans la boucle (évite les stale closures).

`onAuto()` :

```
autoRunning = true ; stopRef = false ; autoLog = []
boucle:
  si stopRef → break
  fittest = TU.pickFittest3(g.roster, runState)   // runState = roster_state courant
  si !fittest → break   // < 3 vivantes, run fini
  r = await actions.towerFight(fittest, posture)
  si !r.ok → toast(err) ; break
  autoLog.push({ floor, won:r.won, casualties, tiers:r.rewards.tiers })
  màj st.run / st.score  (même logique que onFight, SANS setBattle)
  si r.runOver → break
  si stopRef → break
  await delay(350ms)
fin de boucle:
  autoRunning = false
  afficher la modale récap (étage max, paliers gagnés cette session, roster final)
```

Points clés :

- **On ne met jamais `battle`** pendant l'auto → aucune animation `AreneBattle`.
- `casualties` = bêtes passées à `dead:true` dans ce `roster_state` par rapport au précédent.
- La rotation utilise le **`roster_state` renvoyé par le serveur** (source de vérité de
  l'attrition), jamais `g.roster` seul.
- Le `429` du throttle serveur (voir §7) est traité comme une erreur transitoire :
  petite ré-attente puis reprise (backoff simple, 1-2 essais) avant d'abandonner.

## 7. Composant 3 — Garde de débit serveur (`tower.js`)

Throttle **par wallet** sur `POST /tower/fight` :

- Map en mémoire `wallet → last_fight_ts`.
- Si `now - last < MIN_INTERVAL` (≈250 ms) → `429 { error: "trop_rapide" }`.
- Sinon on met à jour le timestamp et on poursuit.

Justification : le délai client (350 ms) gère le confort ; ce garde protège la DB
(chaque fight = transaction `FOR UPDATE` sur `player_saves`) si un client retire son
délai. Léger, en mémoire, sans dépendance. Nettoyage paresseux des entrées anciennes.

**Test (`test/tower.routes.test.js`) :** deux `/tower/fight` rapprochés → le second `429`.

## 8. UI — Log rapide

Pendant `autoRunning`, le panneau de run (`tour.jsx`) affiche à la place du bloc
posture/combat :

- Un **journal défilant** (auto-scroll) : `Étage 12 ✓` / `Étage 13 ✗ · Aïko ☠`,
  paliers surlignés en or quand `tiers.length`.
- Un bouton **⏹ Stop** (met `stopRef = true` ; la boucle sort à la prochaine vérif).
- Le bouton **⏩ Auto** apparaît à côté de « Combattre l'étage N » quand un run est
  actif et que `pickFittest3` renvoie 3 bêtes.

À la fin : réutiliser/adapter `TourResultModal` en **récap de session** (étage de départ
→ étage max, total paliers/tickets gagnés pendant l'auto, roster final avec ☠).

## 9. i18n

Nouvelles clés (`test/tour-i18n.test.js` vérifie la parité **FR/EN/ZH**) :
`TOUR_AUTO`, `TOUR_AUTO_STOP`, `TOUR_AUTO_RUNNING`, `TOUR_AUTO_LOG_WIN`,
`TOUR_AUTO_LOG_LOSS`, `TOUR_AUTO_RECAP_TITLE`, `TOUR_AUTO_RECAP_CLIMB`.

## 10. Process / déploiement

- **Ordre de déploiement coordonné** : le throttle serveur renvoie `429` sur un code
  que le client doit savoir gérer → déployer le **web (gestion 429) avant ou en même
  temps** que le serveur, jamais le serveur seul en avance sur un client qui ignore le 429.
- **`CHAT_SYSTEM_PROMPT`** (`server.js`) : ajouter une phrase mentionnant l'existence de
  l'auto-combat dans la Tour (règle CLAUDE.md serveur — toute mécanique visible joueur).
  Aucun coût/seuil nouveau à documenter.

## 11. Hors périmètre (YAGNI)

- Pas de choix de posture par étage (posture unique pour toute la session).
- Pas d'anim accélérée `AreneBattle` (mode vitesse écarté).
- Pas de stratégie de rotation configurable (heuristique fixe « plus en forme »).
- Pas de persistance serveur de l'état « auto en cours » (purement client, éphémère).
