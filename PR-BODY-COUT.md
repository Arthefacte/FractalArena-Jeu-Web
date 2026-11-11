Le prix de la fusion de rang était dans le bouton, et le bouton le mangeait.

**Le symptôme** (capture du 11/11) : trois cartes sélectionnées, le joueur lit « Fusionner — ». Aucun montant. Il découvre 5 000 FA dans la modale de confirmation, après avoir choisi.

**La cause** : `FG_RANK_BTN` valait « Fusionner  −%d FA », collé à trois pastilles dans une rangée `flex`. Sur mobile la largeur disponible ne suffisait pas : le libellé débordait et le montant disparaissait. Le prix n'était pas absent du code, il était illisible.

**Ce qui change** :
- le coût a **sa propre pastille**, « Coût : 5 000 FA », visible dès qu'un rang est choisi — et en rouge quand le solde ne suffit pas ;
- le bouton dit simplement « Fusionner » (plus de montant tronquable à l'intérieur) ;
- tant qu'aucune entité n'est sélectionnée, une ligne donne les **tarifs des trois paliers** (`C · B · A`, lus dans `D.FORGE.RANK_FUSE_COST`, jamais recopiés) — le joueur choisit son rang en connaissant le prix.

Aucun prix, aucun seuil, aucun calcul ne change : la même valeur, au même endroit logique, mais lisible avant le clic.

**Tests** : 1467 verts. Le garde-fou de fenêtre de lecture de `doRankFuse` passe de 6 000 à 9 000 caractères (il borne une tranche de fichier, il ne fige pas la taille d'un bloc), avec le motif écrit dans le test.