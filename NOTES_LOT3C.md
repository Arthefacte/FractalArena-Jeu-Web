# Arène V2 — lot 3c : remplacer une entité dans l'Arène

## Périmètre

Client uniquement, branche `Arthefacte/arene-v2-remplacement`, base `origin/main`
`6d9f415` (v410). Aucun changement serveur, API ou migration. Le brief local
`BRIEF_ARENE_LOT3C.md` reste hors commit. Livraison en PR draft, sans fusion.

## Changements

- `replaceSelected(index, id)` remplace exactement Avant, Milieu ou Arrière et
  conserve les deux autres positions. Doublons, indices invalides, positions
  absentes et entités hors roster sont refusés sans modifier l'état. Seul
  `selected` change.
- Les trois emplacements restent visibles et cliquables avec zéro, une, deux ou
  trois entités sélectionnées. Le panneau présente les remplaçants par puissance
  décroissante, leurs niveau, rareté, PV et puissance, et la puissance de
  l'emplacement courant. Choisir remplace, ou ajoute via `toggleSelect` si la
  formation est incomplète, puis ferme le panneau. Annuler conserve la sélection.
- « Prendre mon top-3 » sélectionne atomiquement les trois entités les plus
  puissantes, dans l'ordre Avant/Milieu/Arrière. Disponible dans la formation et
  dans le bandeau de défense dépassée, il est désactivé avec moins de trois
  entités. Il ne navigue pas et ne poste pas la défense.
- Le bouton d'entrée « Choisir mes 3 entités » ouvre également le choix sur place.
  Le lien explicite vers l'onglet Équipe reste disponible.
- La pose reste désactivée tant que `selected.length !== 3`. Date, noms, PV,
  signalement `stale` et bandeau de puissance continuent de décrire exclusivement
  le snapshot de défense confirmé par le serveur.
- Libellés et parité des paramètres FR/EN/ZH, y compris Avant/Milieu/Arrière et
  les étiquettes accessibles des flèches. Aucune nouvelle requête pour ces gestes.

## Roster et puissance

L'onglet Équipe utilise directement `g.roster`, la collection active renvoyée par
le serveur. Il n'existe pas de filtre local `consumed` à recopier : les entités
fusionnées sont retirées de cette collection. La liste des remplaçants suit ce
même roster courant et exclut tous les identifiants déjà sélectionnés.

Le calcul existant `FA_EXPEDITIONS_UI.beastPower` correspond à celui de
`pvp.topThree` dans le dépôt serveur local : somme des cinq stats de base ×
facteur de niveau × poids de rareté. `FA_ARENE_UI.entityPower` le réutilise, et
`rankedRoster` trie une copie sans arrondir avant comparaison. Les égalités
conservent l'ordre du roster. L'affichage seul arrondit la puissance.

## Vérification

| Suite complète | Total | Réussis | Ignorés | Échecs |
| --- | ---: | ---: | ---: | ---: |
| Avant | 1 282 | 1 276 | 6 | 0 |
| Après | 1 312 | 1 306 | 6 | 0 |

30 nouveaux tests : 9 actions, 6 puissance/tri, 14 interactions du JSX avec les
vraies actions du store, 1 parité i18n. Les tests précédents de provenance et
d'entrée sont adaptés au choix local. Couverture des trois positions, refus,
annulation, formations incomplètes, retrait d'une entité du roster, top-3 avec
recoupement de la sélection, indisponibilité, absence de requêtes supplémentaires
et conservation de la défense postée.

- `npm run build` après les éditions : 28 écrans transpilés, 16 empreintes.
- `npm test` final : entièrement vert ; journaux
  `%TEMP%\arene-lot3c-baseline.log` et `%TEMP%\arene-lot3c-final.log`.
- `git diff --check` réussi ; revue indépendante sans défaut bloquant.
- `node_modules` existant réutilisé ; aucun `npm ci` local.
- Contrôle visuel non réalisé : l'outil Computer Use a expiré lors de
  l'inventaire (`computer-use request timed out: list_apps`) et n'a retourné
  aucun navigateur. Les interactions sont vérifiées par les tests de rendu JSX ;
  aucun test de navigateur ni d'API réelle n'est revendiqué.

## Version et livraison

Après actualisation et examen des versions distantes, le maximum est v410 :
version retenue **v411**. Les cinq marqueurs (`index.html`, `data.js`,
`manifest.webmanifest`, `sw-policy.js`, `version.json`) et les deux assertions
de `test/account-wiring.test.js` sont alignés. Les fichiers compilés sont inclus.
L'ajout à l'index suit le build. Le bump accompagne les modifications servies pour
respecter le contrôle de cache-busting par rapport au commit parent.

- Étape fonctionnelle validée : commit `8900f6c`
  (`feat(arene): remplacer la formation sur place et choisir le top-3 (v411)`).
- Contrôle de cache-busting rejoué contre le parent après commit : **2/2 réussis**.
- `git push -u origin Arthefacte/arene-v2-remplacement` effectué.
- PR [#316](https://github.com/Arthefacte/FractalArena-Jeu-Web/pull/316), base
  `main`, état **OPEN**, **isDraft: true**, avec compte avant/après et version.
- CI du commit fonctionnel : workflow `tests`, job `test` **SUCCESS**
  ([exécution](https://github.com/Arthefacte/FractalArena-Jeu-Web/actions/runs/40374550940)).
- Aucune fusion. Seul le brief utilisateur reste non suivi dans le worktree.
