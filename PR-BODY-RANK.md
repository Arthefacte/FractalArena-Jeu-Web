L'écran de la fusion de rang annonce ce que la carte produite sera, avant que le joueur paie.

**Ce qui change à l'écran**
- Sélection : 3 entités de **même rang**, **rareté indifférente**. Le refus « même rareté » disparaît, un toast ne parle plus que du rang.
- La modale d'avertissement affiche, en clair : « la carte produite sera de rareté **Commune**, rang **X**, avec les stats de création du meilleur tirage des trois ». Le texte sur la qualité qui « ne redescend jamais » est remplacé — il n'a plus de sens.
- Aides FR / EN / ZH réécrites en conséquence (`FG_RANK_HINT`, `FG_RANK_NONE`, `FG_RANK_MISSING`, `FG_RANK_MISMATCH`, `FG_RANK_ALERT_QUALITY`).

**Pourquoi** : le serveur (PR #317, dépôt FractalArena) ne produit plus d'entité étiquetée Légendaire avec des stats de Commune — la rareté redevient Commune et se regagne en travaillant la carte. Cette PR fait dire la même chose à l'interface.

**Tests** : `forge-fusion-rangs.test.js` mis à jour (raretés mélangées acceptées, `rankFuseWarning` expose `targetRarity` et `bestRollPct`). Suite complète verte.

Aucun coût, aucun seuil, aucun rendu de carte ne change.