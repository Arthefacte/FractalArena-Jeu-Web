# BRIEF — En-tête mobile : montants compacts + nom du jeu entier

Repo : `C:/Users/PC/orca/workspaces/fractal-arena-web/entete-mobile-logo`
Branche : `Arthefacte/entete-mobile-logo` (partie de `origin/main`, v401)

## Ce qui est DÉJÀ fait (ne pas le refaire)

Les trois fichiers suivants ont été copiés dans ce worktree et contiennent le correctif complet :

- `app.jsx` — composant `ChipAmount` (montant compact + montant EXACT au clic) et fonction `abbr()` ; les trois chips du header (liquidité, FB, verrouillé) l'utilisent ; le caret des pools écoute l'événement `fa:toggle-pools` ; le tiroir « Plus » porte les outils du bandeau (quiz, support, salon, caret) avec les états écoutés par événements.
- `mobile.css` — les outils quittent `.hdr-mtools` en portrait (reviennent en paysage), le nom du jeu revient, taille du titre pilotée par la place disponible, rangée de chips qui passe à la ligne sous 380 px, `mobile.css` porte aussi `.chip-exact`.
- `styles.css` — styles de la bulle `.chip-exact` et de `.chip-amount-wrap`.

## Ce que tu dois FAIRE, dans cet ordre

1. **Vérifie que ça compile et que la suite passe AVANT de bump.** PowerShell, donc :
   ```
   $env:NODE_ENV=""
   npm run build 2>&1 | Select-Object -Last 6
   npm test 2>&1 | Select-Object -Last 25
   ```
   Note le nombre exact de tests passés/échoués. Si un test échoue, NE CORRIGE PAS les tests pour les faire passer : dis-moi lequel et pourquoi (test ou code ?). Écris le log complet dans `C:\Users\PC\AppData\Local\Temp\entete-mobile-suite.log`.

2. **Ajoute un test de non-régression** dans `test/` (nouveau fichier `test/entete-mobile.test.js`, style des autres tests du dépôt : `node:test`, lecture des fichiers par `fs.readFileSync`) qui vérifie, dans la SOURCE **et** dans le bundle committé :
   - `app.jsx` contient `function abbr(` et le composant `ChipAmount` rend `.chip-exact` ;
   - `mobile.css` masque `.hdr-mtools` en portrait (`.hdr-mtools { display: none; }`) ;
   - `build/app.js` contient `chip-exact` (le bundle porte bien le composant).
   Le test doit échouer sur `origin/main` et passer ici — prouve-le en rejouant la même extraction depuis `git show origin/main:app.jsx`.

3. **Bump de version** : lis le numéro libre avec `git show origin/main:version.json` juste avant de bumper, puis passe au numéro SUIVANT libre (les sessions parallèles prennent le même compteur). Fichiers à modifier ensemble : `index.html` (tous les `?v=NNN`), `data.js` (`FA_ASSET_V`), `manifest.webmanifest`, `sw-policy.js` (`fa-vNNN`), `version.json`, et `test/account-wiring.test.js` (les littéraux). Puis `npm run build` **une seule fois**, et `git add` APRÈS le build (sinon les artefacts régénérés restent hors du commit et la CI tombe).

4. **Commit + push + PR** :
   ```
   git add -A
   git commit -F <fichier-message>
   git push -u origin Arthefacte/entete-mobile-logo
   gh pr create --repo Arthefacte/FractalArena-Jeu-Web --base main --head Arthefacte/entete-mobile-logo --title "..." --body-file <fichier>
   ```
   Le corps de la PR s'écrit avec `write_file` dans `C:/Users/PC/AppData/Local/Temp/pr-entete.md` puis `--body-file` (jamais de backticks dans un argument shell).

5. **Attends la CI** (`gh pr checks <n> --repo Arthefacte/FractalArena-Jeu-Web --watch`) et rapporte : numéro de PR, URL, nombre de tests, état CI. **NE FUSIONNE PAS** : la fusion est un déploiement et c'est le fondateur qui valide.

## Contenu de la PR à raconter (une phrase par point, pour un joueur)

- Le logo 3D n'est plus mangé par le bandeau de liquidité : les outils (quiz, support, salon) sont passés dans le tiroir « Plus ».
- Le nom du jeu réapparaît dans l'en-tête mobile, entier à toutes les largeurs (320 → 430 px).
- Les montants s'abrègent (`1,25 M`, `10,5 k`) et le montant exact s'affiche au clic.

## Interdits

- Ne pas merger. Ne pas toucher à `origin/main`. Ne pas supprimer de worktree.
- Ne pas modifier les fichiers de test existants pour les faire passer.
- Aucun secret, aucune clé dans le code ou le commit.
