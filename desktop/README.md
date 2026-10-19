# Fractal Arena — Windows / milestone 1

Application Tauri 2 (Rust + WebView2), indépendante du build web. Le jeu se met à jour depuis son site ; une connexion est nécessaire. Aucun client de jeu n'est embarqué.

## Construire et lancer

Prérequis : Windows 10/11, Node/npm, Rust stable MSVC, Visual Studio Build Tools avec C++ et Windows SDK, WebView2 Runtime. WiX/NSIS sont téléchargés par la CLI au premier packaging si nécessaire.

```powershell
cd desktop
npm ci
npm run tauri dev
# Exécutable release et deux installeurs :
npm run tauri build
# Compilation Rust indépendante :
cd src-tauri
cargo build --release --locked
```

Exécutable : `src-tauri/target/release/fractal-arena-desktop.exe`.
Installeurs : `src-tauri/target/release/bundle/nsis/` et `bundle/msi/`.
Le paquet NSIS installe pour l'utilisateur courant. Les paquets ne sont pas signés : prévoir un certificat de signature pour la distribution publique. Le bootstrapper WebView2 n'est utilisé que si le runtime est absent.

## Comportement

- Premier lancement centré, 1280 × 800 unités logiques ; minimum 960 × 600.
- Taille, position et état agrandi conservés dans `%APPDATA%/com.fractalarena.desktop/window-state.json`. Un lancement affiche toujours la fenêtre, même après une réduction dans le tray.
- Barre sombre locale : glisser pour déplacer, double-cliquer pour agrandir/restaurer, boutons réduire/agrandir/quitter. Le bouton « Réduire dans la barre » masque explicitement la fenêtre.
- Clic gauche sur le tray : masquer/afficher ; clic droit : ouvrir, réduire dans la barre, quitter.
- Fermer, Alt+F4, Ctrl+Q ou « Quitter » terminent l'application et retirent le tray.
- Relancer l'exécutable réactive l'instance existante.
- F5 recharge le jeu ; F11 bascule le plein écran ; Ctrl+Shift+I ouvre les outils de développement du jeu, y compris en release.
- Les liens hors de l'origine du jeu et les nouvelles fenêtres s'ouvrent dans le navigateur système. Seuls HTTP(S) et mailto sont transmis au système ; les protocoles exécutables/fichiers sont refusés.

## Architecture et limites

`src-tauri/src/main.rs` contient l'unique constante `GAME_URL` et le point de substitution `game_source()`. L'origine des permissions distantes et du script de raccourcis est dérivée de cette constante.

Une fenêtre native contient deux webviews sœurs : `chrome` (barre locale) et `game` (page distante de premier niveau). Il n'y a pas d'iframe : la protection anti-clickjacking du jeu reste active. La géométrie normale est conservée par `window_state.rs`, indépendamment du nombre de webviews et du plein écran. Une position dont la barre de titre serait hors des moniteurs disponibles est recentrée. Les dimensions des vues suivent le redimensionnement et le DPI ; en plein écran, le jeu occupe toute la fenêtre.

L'API multi-webview nécessite actuellement le feature Tauri `unstable`. Les versions effectivement vérifiées sont verrouillées par `Cargo.lock` et `package-lock.json`. Les permissions sont attachées aux webviews individuellement, jamais à leur fenêtre partagée. Le jeu ne reçoit que quatre commandes de contrôle, sans accès aux fichiers, au shell ou aux API système générales. Le routage des liens est contrôlé en Rust. Le script injecté ajoute uniquement les raccourcis, sans réécrire le DOM ou les fichiers du client.

WebView2 possède son propre profil de session : les cookies du navigateur habituel et ses extensions (dont l'extension portefeuille Unisat) ne sont pas partagés. Une connexion dépendant d'une extension nécessitera un parcours web adapté ou une intégration dédiée ; ce milestone ne modifie pas ce parcours.

Le compteur `startup.txt` dans le répertoire de logs Tauri mesure le délai entre l'entrée Rust et le premier événement de chargement de page. Il ne prouve pas que tous les modèles 3D et données du jeu sont chargés. Les mesures et observations de livraison sont consignées dans `VALIDATION.md`.

## Vérification

```powershell
cd desktop
npm test
cd src-tauri
cargo test --release --locked
cargo fmt --check
```

Tests unitaires : origine de navigation exacte (schéma, port, identifiants, domaines trompeurs), quatre raccourcis, absence d'interception de la saisie, rejet des événements synthétiques et des sous-cadres.

Recette manuelle : lancer sans état sauvegardé ; déplacer/redimensionner, fermer et relancer ; agrandir/restaurer ; F5/F11 et outils développeur ; ouvrir un lien externe ; tester les deux menus du tray, relancer depuis le tray, vérifier qu'un deuxième lancement conserve un seul processus ; terminer par la croix et vérifier l'absence de processus/tray résiduel.

## Passage au milestone 2 (non implémenté)

1. Définir un export reproductible du client (`index.html`, `build/`, `assets/` et dépendances) vers un dossier dédié sous `desktop/`, sans dépendre de fichiers hors du paquet.
2. Remplacer la source de `game_source()` par `WebviewUrl::App`, et adapter l'autorisation d'origine/navigation ainsi que le script de raccourcis à l'origine locale Tauri.
3. Définir avec l'API le contrat de synchronisation : authentification depuis l'origine locale, CORS/CSP, cache versionné, reprise après coupure, résolution des conflits. Ne pas promettre de transactions hors ligne avant ce contrat.
4. Séparer les mises à jour du client embarqué des données serveur ; prévoir signature et distribution des mises à jour desktop.
5. Tester démarrage sans réseau, reconnexion, migration du profil et cohérence des données. Les intégrations portefeuille devront faire l'objet d'une validation séparée.

Références techniques : [webviews Tauri](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewBuilder.html), [capabilities](https://v2.tauri.app/security/capabilities/), [tests WebView2](https://playwright.dev/docs/webview2).
