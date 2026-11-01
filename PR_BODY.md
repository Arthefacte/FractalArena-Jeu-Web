**Le fondateur a raison sur la chronologie** : la pastille marchait avant le salon commun (29/10) et s'est cassee avec lui.

Deux numerotations coexistent depuis #279 : `id` (une table par famille, valeurs qui se recouvrent) et `seq` (la sequence partagee qui ordonne la piece). Le curseur « dernier message lu » etait stocke dans `ui_state.room_seen_id`, dont la fusion serveur est un MAX. Des `id` de table (728, 770) y ont ete ecrits avant la bascule : ces nombres ne redescendent jamais, et face a des `seq` plus petits (655 aujourd'hui) ils font passer TOUT le salon pour deja lu.

Consequence exacte du symptome : on ferme le jeu, les gens parlent, on rouvre -> les messages arrives pendant la fermeture sont sous le curseur, donc comptes vus avant d'etre affiches : aucune pastille. Elle ne se rallumait que pour un message recu page ouverte, ce qui donnait l'impression d'un caprice.

**Correctif** : le curseur vit dans une cle NEUVE, en `seq` uniquement —
- `fa_room_seq_seen:<wallet>` cote navigateur, `ui_state.room_seen_seq` cote compte (PR serveur #298, cle acceptee en MAX_INT) ;
- `room_seen_id` n'est plus lu ni ecrit par le client, et n'est plus jamais melange avec des `seq` ;
- premier demarrage sur le nouveau curseur : la piece telle qu'elle est devient « lue » (pas de « 9+ » gratuit au deploiement), et le message suivant rallume ;
- le compteur, l'avancement du curseur et l'ouverture du panneau passent tous par `msgCursor()` (`seq`, repli `id` seulement pour un vieux cache).

Version 438 -> 439. Tests : 1377 dont 1371 pass / 0 fail (2 nouveaux contrats : plus aucune lecture de `room_seen_id`, et recalage au premier chargement).