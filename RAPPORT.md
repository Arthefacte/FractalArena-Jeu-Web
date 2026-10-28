# Rapport — le classement de l’Arène nomme sa ligue

Branche : `Arthefacte/arene-ligue-classement` — cible de la PR : `main`, sans fusion.

## Constat vérifié

Le serveur local `fractal-arena-server/ladder-unifie/pvp.js:793-824` expose déjà
`GET /pvp/ladder?wallet=…` : filtre `WHERE r.league = $1` et réponse
`{ ok: true, league, ladder, me_player_id }`. `app.jsx:2887-2900` conserve déjà
cette ligue dans `g.pvp.league`. Aucun changement serveur ni chargement supplémentaire.

## Avant / après

- Avant : « CLASSEMENT », puis « 4. Arthefacte.fb 1051 · 3-0 », sans ligue identifiable.
- Après, pour la ligue Argent et 14 lignes reçues : « CLASSEMENT · LIGUE ARGENT »,
  avec la ligue colorée, puis « Rang 4 sur 14 en Ligue Argent ».
- Chaque rang est précédé d’une pastille de la même couleur ; le surlignage du joueur reste présent.
- La position vient de `row.rank`, avec identification par `estMoi(row, g)` ; aucun résumé
  si sa ligne est absente. Une ligue absente ne produit pas de nom inventé.
- `AR2_LADDER` reste intact ; deux clés supplémentaires traduisent le suffixe et la position
  en FR / EN / ZH. Les noms et couleurs réutilisent les helpers existants.

Le dénominateur est la longueur de la liste reçue, conformément au brief. La route serveur
limite cette liste à 100 entrées : ce nombre ne prétend donc pas compter les joueurs au-delà
 de la liste. Les noms de ligue restent ceux du helper existant, y compris en EN / ZH.

## Fichiers et livraison

- Sources : `arene.jsx`, `i18n.js`.
- Pipeline `npm run build` exécuté : 28 écrans régénérés. Seuls `build/arene.js` et
  `build/sources.json` changent ; `build/app.js` est régénéré à l’identique.
- Cache v425 → v426 dans `index.html`, `data.js`, `sw-policy.js`,
  `manifest.webmanifest`, `version.json` et les assertions de `test/account-wiring.test.js`.
  Cet incrément est exigé par les tests du dépôt et permet la réception du nouvel affichage.
- Tests existants adaptés : `test/arene-i18n.test.js`, `test/arene-provenance.test.js`.
- Aucune nouvelle dépendance ; `leaderboard.jsx`, les règles de ligue et le serveur sont inchangés.
- `BRIEF.md`, déjà modifié à l’arrivée, est conservé hors commit. Aucun fichier `vendor/` modifié.

## Validation

- `npm ci --no-audit --no-fund` : réussi.
- `npm run build` : réussi, aucun fichier du build édité à la main.
- Tests Arène ciblés : 19/19 réussis.
- `npm test` : 1 341 tests, 1 335 réussis, 6 ignorés, 0 échec.
- Couverture : titre et couleur, rang serveur indépendant de l’index, effectif reçu,
  priorité de l’identifiant opaque et repli wallet, absence du joueur, liste vide,
  ligue absente, pastilles décoratives et surlignage conservé, paramètres FR / EN / ZH.
- `git diff --check` : aucune erreur.
