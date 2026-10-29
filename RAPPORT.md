# Rapport — attaquer depuis le classement de l’Arène

Branche : `Arthefacte/classement-bouton-attaquer` — livraison vers `main`, sans fusion.

## Contrat serveur vérifié

Lecture de `C:/Users/PC/orca/workspaces/fractal-arena-server/classement-attaquable/pvp.js`, commit `52a1955` :

- `/pvp/ladder`, lignes 829–836 : chaque ligne publie `can_attack`, `attack_block` et l’identifiant public `player_id`, sans wallet.
- Raisons publiées : `toi`, `defense_tombee`, `plafond_couple`, sinon `null`.
- Racine, lignes 843–844 : `me_defense_down` et `pair_limit` (actuellement 2).
- `/pvp/defense/:wallet` et `/pvp/attack` résolvent déjà cet identifiant public avec `resoudreRef`.

Aucun fichier serveur modifié, aucun combat lancé en production.

## Avant / après

Avant : les 14 joueurs du classement de ligue étaient visibles, sans action permettant de les affronter.

Après :

- Chaque ligne `can_attack === true` propose **Attaquer** par le sélecteur commun `onPickOpponent(row, false)` ; aucun bouton sur la ligne `toi`.
- Une cible indisponible affiche **Défense à terre** ou **2 combats déjà faits en 24 h**, traduit en FR / EN / ZH. Le nombre provient de `pair_limit`, sans règle numérique recopiée dans le client.
- Si ma défense est tombée, le message existant explique le blocage global ; les verrous de sélection et d’attaque restent actifs.
- À la fermeture du rejeu, le rechargement commun existant actualise rangs et raisons de blocage. Aucune requête de classement dupliquée pendant le combat.
- Une défense relevée et confirmée entraîne la relecture du classement si son ancien drapeau global bloquait encore les attaques, sans boucle sur le timer.

`app.jsx` conserve les champs racine nécessaires ; le plafond du classement est prioritaire, avec repli sur cadence. Les cartes du panneau Adversaires, `/pvp/opponents` et les règles de ligue restent inchangées. Les lignes du classement peuvent revenir à la ligne pour accueillir l’action sur petit écran.

## Build et validation

- Aucune dépendance ajoutée ; `npm ci --no-audit --no-fund` réussi.
- `npm run build` réussi : 28 écrans régénérés ; modifications utiles dans `build/arene.js`, `build/app.js` et `build/sources.json`. Aucun fichier build édité à la main.
- `asset-hashes.js` régénéré à contenu identique ; `node tools/asset-hashes.mjs --check` réussi.
- Version de cache 427 → 428 dans les fichiers de livraison et les deux assertions de version existantes.
- Les autres adaptations de tests concernent uniquement les textes de source épinglés qui ont changé : résolution d’identifiant, origine du plafond et classe CSS des lignes.
- `npm test` : **1 353 tests, 1 347 réussis, 6 ignorés, 0 échec**. Aucun faux rouge SRI rencontré.
- **21 cas comportementaux supplémentaires** exécutés dans un harnais temporaire, sans ajout de test au dépôt : états du classement, sept blocages, double clic, parcours `player_id` jusqu’à l’attaque, rafraîchissement après rejeu, traductions avec plafond alternatif 7, relève et absence de boucle, transport des champs et garde de session.
- Ces vérifications comportementales utilisent un rendu React simulé, sans test navigateur.
- Revue indépendante terminée sans anomalie restante ; `git diff --check` propre.

Les modifications préexistantes de `BRIEF.md` et le dossier non suivi `mcp/` sont conservés hors commit.
