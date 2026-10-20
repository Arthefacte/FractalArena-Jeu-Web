# Correctif de nuit — Fractal Arena (19/10/2026)

Tu corriges UN constat bloquant de l'audit du 19/10. Tu travailles dans un worktree dédié, déjà sur `origin/main`.

**Méthode imposée**
1. Lis le constat ci-dessous et **vérifie-le dans le code** avant de toucher quoi que ce soit. Si le constat est faux, arrête et dis-le.
2. Écris d'abord un **test qui échoue** et qui reproduit le défaut.
3. Corrige au plus petit diff possible. Pas de refactor, pas de nettoyage opportuniste, aucun autre fichier que ceux nécessaires.
4. `npm test` doit être vert (si des fichiers `vendor/react*.js` sortent un faux rouge SRI sous Windows : `perl -pi -e 's/\r\n/\n/g' vendor/react.production.min.js vendor/react-dom.production.min.js`, c'est un artefact CRLF, pas une régression).
5. Commit en français, message au format `fix(zone): ce que ça corrige`, corps expliquant le défaut ET le test.
6. `git push -u origin <ta branche>`, puis `gh pr create` vers `main` avec le constat cité (fichier:ligne), le correctif, et la preuve que le test échoue avant / passe après.

**Interdictions**
- Ne fusionne PAS la PR. Le fondateur relit demain matin.
- Ne touche à aucune autre branche, ne force-push rien, ne modifie pas la prod.
- Pas de dépendance nouvelle, pas de migration destructive.

Quand tu as fini : écris `RAPPORT.md` à la racine du worktree (constat, diff résumé, tests avant/après, numéro de PR) et termine ta réponse par 6 lignes max (PR, tests, ce qui reste).

## Constat BLOQUANT n°4 — palier LP : 50 000 FA affichés, 250 000 exigés

Le client annonce « dès 50 000 FA verrouillés tu portes le titre Market Maker » (`web/i18n.js:111` et `:115`), mais le serveur exige **250 000** (`lp.js:40-43`, `G1 min: 250_000`).

Pire : `web/test/lp-i18n.test.js:35-40` **fige le chiffre faux** en prétendant vérifier « les VRAIS seuils » — le test protège le mensonge.

**Attendu** : une seule source de vérité pour les seuils. Vérifie d'abord quel chiffre est le bon (regarde `lp.js` en entier, l'historique git des seuils, et si le palier G1 a été relevé volontairement) : si le serveur est la référence, corrige l'i18n et le test ; si c'est l'UI qui a raison, c'est le serveur qu'il faut aligner — mais alors dis-le dans la PR, c'est une décision produit.

Le test doit vérifier les seuils **contre le code serveur** ou contre une constante partagée, pas contre une chaîne recopiée à la main.
