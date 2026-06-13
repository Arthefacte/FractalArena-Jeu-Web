# Arène — cohérence visuelle des stats adverses (rescale cosmétique)

Date : 2026-06-13
Repo : `fractal-arena-web` (client only)
Statut : design validé, en attente de relecture avant plan d'implémentation

## Problème

Dans l'arène, le calibrateur serveur (`engine.node.js → buildSequence`) génère un adversaire
dimensionné pour un **taux de victoire cible** (~84 % en moyenne, ~40 % des combats en bucket
« facile » à 93 %). Conséquence : sur une bonne partie des combats, les stats **réelles** de
l'ennemi sont nettement sous celles du joueur. Comme la carte de combat (`arena.jsx`) affiche
les stats effectives réelles (HP/ATK/DEF/SPD/MAG = base × niveau), le joueur voit une équipe
qui écrase visuellement un adversaire ridicule. Diagnostic confirmé par la prod : winrate réel
~81,5 % (168/38) = calibrateur sur sa cible ; bêtes du joueur légitimes (niveau ~13, non
gonflées). Ce n'est pas un plafond cassé — c'est le design farm assumé.

## Objectif

Rendre l'**affichage** de l'adversaire crédible (stats dans une fourchette comparable au
joueur) **sans** changer le combat ni son issue. Purement cosmétique, côté client.

Non-objectifs : modifier la difficulté, l'EV économique, le calcul serveur, les stats du
joueur. Pas de rééquilibrage gameplay.

## Design

### Facteur cosmétique `K` par bête ennemie

Fonction **pure** `cosmeticEnemyScale(enemyTeam, playerTeam)` → `number[]` (un K par colonne).

Pour chaque colonne `i` (ennemi `i` comparé à la bête joueur `i`) :

- `playerTotal_i` = somme des stats effectives de la bête joueur `i` (hp+atk+def+spd+mag).
- `enemyTotal_i` = somme des stats effectives réelles de l'ennemi `i`.
- `cible_i = playerTotal_i × rand(0.85, 1.0)` → l'ennemi *paraît* à 85–100 % du joueur,
  **jamais au-dessus**.
- `K_i = clamp(cible_i / enemyTotal_i, 1.0, 12)`.
  - Plancher `1.0` : on ne **réduit jamais** l'affichage d'un ennemi (cas combat « hard »
    où il est déjà à niveau → `K=1`, on n'y touche pas).
  - Plafond `12` : garde-fou anti-inflation absurde.
  - `enemyTotal_i <= 0` → `K_i = 1` (sécurité, pas de division par zéro).

Le **même `K_i`** est appliqué à HP, ATK, DEF, SPD, MAG → le *profil* de la bête est
préservé (HP reste ~6-7× l'ATK), donc la carte ressemble à une bête normale, juste plus forte.
Affichage = `round(stat_réelle × K_i)`.

### Points d'application (affichage uniquement)

1. **`beastMeta` de l'ennemi** (`arena.jsx`) : la ligne ATK/DEF/SPD/MAG + le `maxHp` montré
   en pré-combat utilisent les stats ×`K_i`.
2. **Nombre HP du replay** (`live.hp / live.maxHp` du côté `p2`) : multiplié par `K_i` à
   l'affichage, pour que la carte reste cohérente avec elle-même quand le combat démarre
   (pas de saut « gonflé → réel »).
   - La **fraction** de la barre reste `live.hp / live.maxHp` (invariante) → la barre descend
     exactement comme aujourd'hui.

`K` est calculé une fois par combat (au moment où le serveur renvoie `bet.enemy`) et conservé
le temps du combat (les K ne doivent pas être re-tirés à chaque frame de replay, sinon les
nombres « dansent »). Stocké à côté de `p2Meta` (ex. `p2Scale`, un tableau de 3 facteurs).

### Hors périmètre (laissé réel, par choix produit)

- Les **chiffres de dégâts flottants** sur l'ennemi restent **réels**. Micro-décalage assumé :
  la barre HP (gros nombres ×K) descend d'un montant qui ne colle pas pile au « -X » flottant.
  Upgrade possible plus tard (1 ligne) : multiplier le dégât flottant ennemi par `K_i`.
- Combat serveur, issue, pools, stats du joueur : inchangés.

## Architecture / isolation

- `cosmeticEnemyScale(enemyTeam, playerTeam)` : fonction pure, sans effet de bord, sortie
  déterministe **à `Math.random` près** (le jitter 0.85–1.0). Pour la testabilité, accepter
  un `rng = Math.random` injectable en paramètre optionnel.
- Aucune dépendance nouvelle. Vit dans `arena.jsx` (ou un petit util si déjà présent).
- Le reste de `arena.jsx` consomme un tableau `p2Scale` et applique `× K_i` aux endroits
  d'affichage listés. Aucune autre logique touchée.

## Tests

Fonction pure → tests unitaires (rng fixé pour déterminisme) :

1. Ennemi plus faible que le joueur → `K > 1`, stats affichées ≈ 85–100 % du joueur.
2. Ennemi déjà ≥ joueur → `K = 1` (jamais de réduction).
3. Profil préservé : ratio HP/ATK identique avant/après scaling.
4. Plafond : ennemi minuscule vs joueur énorme → `K` capé à 12 (pas d'inflation infinie).
5. `enemyTotal = 0` ou stats absentes → `K = 1`, pas de crash.
6. Longueurs : 3 v 3 attendu ; robustesse si une bête manque (K=1 pour cette colonne).

(Le client n'a pas de harness de test serveur ; prévoir un petit test Node autonome de la
fonction pure extraite, ou une vérification manuelle documentée si aucun runner n'existe côté
web.)

## Critères de succès

- Sur un combat « facile », la carte ennemie affiche des stats du même ordre que celles du
  joueur (≤ 100 %), profil crédible.
- L'issue du combat, les soldes et les logs sont **identiques** à avant (diff serveur nul).
- La barre HP descend exactement comme aujourd'hui ; aucun saut de nombre au démarrage.
