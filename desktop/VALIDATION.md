# Validation du milestone 1

Date : 18 octobre 2026. Windows x64 ; écran 3440 × 1440, échelle 100 %.

## Périmètre livré

Tout le changement versionné est sous `desktop/`. Le client web et sa version restent inchangés. Tauri 2.12.4 / CLI 2.12.3, Rust 1.95.0. Aucun travail du milestone 2 n'est implémenté ; la migration est décrite dans le README.

## Observations sur l'exécutable release

L'exécutable a été lancé sur cette machine. Les captures des deux WebView2 de l'application montrent l'accueil Fractal Arena (emblème 3D, titre orange/cyan, bouton « Jouer maintenant », langues) et la barre locale sombre, avec le nom du jeu et les commandes. Le jeu occupe 1280 × 760 et la barre 1280 × 40. Au rechargement, la cinématique d'introduction du jeu apparaît aussi. Aucun compte ni portefeuille n'a été créé pendant la recette.

Vérifications effectuées par Playwright connecté au port de diagnostic WebView2 de ce processus :

- F11 : passage de 1280 × 760 à 3440 × 1440, puis retour aux dimensions et coordonnées initiales.
- Agrandir/restaurer : vue du jeu 3440 × 1352 (hors barre locale et barre des tâches), puis retour à 1280 × 760.
- F5 : nouvelle origine temporelle de page, donc rechargement effectif.
- « Réduire dans la barre », puis deuxième lancement : le second processus sort avec le code 0 ; les deux vues initiales restent dans la même instance.
- Outils développeur du jeu : ouverture confirmée par une cible `devtools://` séparée ; raccourci Ctrl+Shift+I envoyé également.
- L'ouverture d'une URL Unisat avec `window.open` ne remplace pas le jeu et ne crée aucune nouvelle webview de jeu. Le traitement est confié à l'ouvreur système côté Rust ; la page du navigateur externe n'a pas été observée.
- Ctrl+Q ferme les vues et termine le processus, y compris avec les devtools ouverts.
- Après fermeture en mode agrandi, `window-state.json` contient la taille normale 1280 × 800, la position (1080, 296) et `maximized: true`.
- Tentative du jeu d'appeler `chrome_action` : refus ACL. Une action `hide` envoyée à `game_action` est également refusée.

Les captures locales sont dans `desktop/qa/` (ignoré par Git). Le port de diagnostic a été activé uniquement par variable d'environnement dans le processus de recette ; l'application distribuée ne l'active pas.

## Temps de démarrage

Premier lancement avec un nouveau profil de données WebView2, sans instance du jeu active : **19 074 ms** entre l'entrée Rust et l'événement de fin de chargement de la page distante. Ce chiffre inclut le réseau et n'est pas une mesure après redémarrage de Windows. Il ne garantit pas la fin du chargement de tous les modèles 3D et appels API. Une fenêtre du processus a été détectée à 720 ms ; ce signal seul ne mesure pas le moment où le jeu devient jouable.

## Tests

- `npm test` dans `desktop` : 3 tests passent.
- `cargo test --release --locked` : 2 tests passent.
- `cargo fmt --check` : passe.
- `cargo build --release --locked` : passe.
- Suite web sur un snapshot isolé du même commit, avec fins de ligne LF et Babel 7.29.0 : **1 169 passent, 6 ignorés, 0 échec** (1 175 au total).

Le checkout Windows d'origine présente un échec préexistant dans `test/react-production.test.js` : Git a converti les fichiers vendus React en CRLF alors que les empreintes SRI de `index.html` correspondent aux blobs LF. La normalisation CRLF → LF restitue exactement les blobs Git. Aucun fichier web n'a été corrigé ou réécrit. Babel, absent au départ de ce worktree, a été installé uniquement dans `desktop/qa/node_modules` et fourni aux tests via `NODE_PATH`.

La console de la page distante peut signaler que son CSP bloque le transport HTTP IPC initial de Tauri ; Tauri utilise ensuite son transport WebView2 de repli, et les commandes ont été exécutées pendant la recette. La page émet aussi son avertissement existant sur `frame-ancestors` dans une balise meta. Aucun assouplissement du CSP du jeu n'a été ajouté.

## Limites de la recette

Le service natif `computer-use` a expiré sur `list_apps`, y compris après réinitialisation. Le rendu et les commandes des WebView2 ont été vérifiés directement ; **le déplacement à la souris, le redimensionnement par les bords et les clics/menu du tray restent à confirmer manuellement**. Les gestionnaires correspondants sont implémentés. Aucun installeur n'a été installé sur cette machine pendant la recette.

WebView2 ne réutilise pas les extensions du navigateur : le parcours nécessitant l'extension Unisat demande une intégration ou un ajustement web ultérieur. Le jeu distant reste nécessaire au lancement. Les installeurs sont non signés.

## Installeurs produits

Commande : `npm run tauri build` depuis `desktop/` — succès, deux bundles.

| Format | Chemin relatif à `desktop/` | Taille exacte | Taille |
| --- | --- | ---: | ---: |
| NSIS | `src-tauri/target/release/bundle/nsis/Fractal Arena_0.1.0_x64-setup.exe` | 2 735 205 octets | 2,608 Mio |
| MSI | `src-tauri/target/release/bundle/msi/Fractal Arena_0.1.0_x64_fr-FR.msi` | 4 177 920 octets | 3,984 Mio |

SHA-256 NSIS : `00BAB6732EA137B50D3DCBF628C1A10D70326D201739D73BA306615ED2CF76CE`.
SHA-256 MSI : `F3ECE6F8798E5030E7BE54EE29BAB4C47DA88FC55F3E50C725F9D60D4D3B699C`.

Les artefacts locaux de compilation ne sont pas versionnés. Ils sont reproductibles avec les lockfiles ; le binaire release se trouve à `src-tauri/target/release/fractal-arena-desktop.exe`.

## Contrôle du binaire final packagé

Après production des installeurs, le binaire final a été relancé : restauration en mode agrandi confirmée, puis retour à la géométrie normale 1280 × 800 et à la position sauvegardée. F11 et F5 ont été revérifiés. Ctrl+Shift+I a créé une cible DevTools (son apparition dépassait le délai initial d'une seconde du test). Le bouton de fermeture local a ensuite fermé le jeu et les devtools, sans processus Fractal Arena restant.

WebView2 a émis à cette fermeture un message de nettoyage `Failed to unregister class Chrome_WidgetWin_0`, code 1412 ; aucun échec de démarrage ni processus résiduel n'a été constaté.
