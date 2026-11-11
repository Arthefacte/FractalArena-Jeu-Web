# Lot écran — la fusion de rang dit ce qu'elle produit

Décision du fondateur, 11/11/2026. Le serveur change en même temps (autre dépôt, lot
`fusion-rang-commune`) : la fusion de rang ne regarde plus la rareté et **produit toujours
une entité Commune**. L'écran doit le DIRE avant que le joueur paie 5 000 à 50 000 FA.

## La règle à afficher

Sélection de 3 entités de **même rang**, **rareté indifférente** (Commune, Rare, Épique,
Légendaire mélangées : permis). La carte produite :

- monte d'un **rang** (C→B→A→S), réussite garantie, coût inchangé ;
- **redevient Commune** — c'est le point neuf, il doit être écrit noir sur blanc ;
- garde **les stats de création du meilleur tirage des trois** (le `summon_roll_pct` le
  plus haut), niveau 1, sans talent ni équipement ;
- les trois sont consommées, relique et core détachés et rendus.

Raison : la rareté se regagne en travaillant la carte (montée de rareté au niveau 100),
le rang s'achète par la fusion. Fini les entités « Légendaires » aux stats de Commune.

## Ce qu'il faut changer (dépôt jeu web)

1. `forge-ui.js` — `rankSelToggle` (≈ ligne 118) : **retirer la condition de rareté**, ne
   garder que l'égalité de rang. Trois raretés différentes doivent être sélectionnables.
2. `screens.jsx` — `ForgeRangs`, `clickable()` (≈ ligne 672) : même correction. Le toast
   de refus (`toggle`) ne doit plus parler de rareté : garder `FG_RANK_SEL_MAX` pour la
   4ᵉ carte, et `FG_RANK_MISMATCH` pour un rang différent.
3. `forge-ui.js` — `rankFuseWarning` : ajouter au retour `targetRarity: "Common"` et
   `bestRollPct` (le maximum des `summon_roll_pct` des trois, `null` si aucun n'en a).
   La modale s'en sert ; rien d'autre ne doit changer de forme.
4. `screens.jsx` — la modale d'avertissement (≈ lignes 620-640, clés `FG_RANK_ALERT_*`) :
   elle doit afficher, AVANT le bouton de confirmation, une ligne dédiée, en clair :
   « La carte produite sera de rareté **Commune**, rang **X**, avec les stats de création
   du meilleur tirage des trois (YY %). » La ligne existante sur la qualité (`…_QUALITY`)
   est réécrite pour dire exactement ça, sans doublon.
5. `i18n.js` — réécrire FR/EN/ZH de :
   - `FG_RANK_HINT` : même rang, rareté indifférente, la carte produite repart Commune,
     garde le meilleur tirage des trois, le rang monte d'un cran ;
   - `FG_RANK_NONE`, `FG_RANK_MISSING`, `FG_RANK_MISMATCH` : plus de « même rareté » ;
   - `FG_RANK_ALERT_QUALITY` : la phrase du point 4.
   Aucun autre texte.

## Tests

`test/forge-fusion-rangs.test.js` :

- `rankSelToggle` : refuse un rang différent, **accepte** des raretés différentes,
  refuse une 4ᵉ, re-cliquer retire ;
- `rankFuseWarning` : renvoie `targetRarity === "Common"` et `bestRollPct` = max des trois
  (et `null` quand aucune n'a de tirage) ;
- garder verts les cas existants sur le coût et `rankFuseState`.

Suite complète verte (`node --test --test-force-exit test/*.test.js`) avant commit.
Le numéro de version ne se touche pas dans ce lot : le bump se fait au moment de livrer.

## Interdits

- **Ne touche pas** à la fusion de rareté (2 → 1), ni à la fusion de reliques/cores.
- Ne change ni les coûts, ni les seuils, ni le rendu des cartes.
- Aucun appel réseau ou endpoint nouveau.
- Ne fusionne pas : tu t'arrêtes à `git push`.
- Commit en français, auteur `Arthefacte <62467445+Arthefacte@users.noreply.github.com>`.
