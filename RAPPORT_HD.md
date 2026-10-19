# Logo 3D en pleine qualité dans l'app PC — rapport

Branche `Arthefacte/app-pc-native`, base `origin/main` (369), version de livraison **371**.
Rien n'est fusionné dans `main` : les fichiers HD sont livrés, mais un visiteur web ne
reçoit aucun octet de plus tant que l'app ne les demande pas (mesuré plus bas).

## 1. Le GLB retenu

| Source | Octets | Triangles | Pourquoi |
|---|---|---|---|
| `Emblem_optimise_12Mo.glb` (Downloads) | 12 553 232 | 466 014 | **retenu** — c'est le modèle d'origine : la matière (fissures, lave, éclairs) est dans les 466 014 triangles |
| `assets/emblem.glb` (servi au web) | 1 795 328 | 60 000 | version allégée pour le mobile |
| `assets/logo3d.glb` | 1 507 744 | 40 000 | encore plus léger |

Le rendu est fait **hors ligne**, une fois : le poids du GLB ne part donc jamais au
client, seule la bande WebP est servie. Copie de travail : `_bake/raw/boot-emblem.glb`
(non versionné, `.gitignore`).

### Les « 7 pièces » n'existent pas — mesure

`_bake/probe-parts.mjs` charge chaque GLB dans la page de bake et lit `window.__parts` :

| GLB | 3×3×1 | 2×2×2 | 7×1×1 |
|---|---|---|---|
| emblem-12Mo | **9** | 8 | 7 |
| emblem.glb | **9** | 8 | 7 |
| logo3d.glb | **9** | 8 | 7 |

Aucun GLB ne « contient » 7 pièces : le découpage est une grille, et la grille livrée
est 3×3×1 → 9 blocs pour les trois sources. Le commit d'origine de l'animation (v80) le
dit d'ailleurs : « découpé en 9 blocs ». Les 7 du brief viennent d'un commentaire périmé
dans `_bake/bake-assemble-frag.mjs`. J'ai gardé **9 blocs** : c'est le découpage que les
joueurs voient depuis la v80, et changer de découpage aurait changé l'animation, pas sa
définition. C'est le seul endroit où je m'écarte de la lettre du brief, et c'est
volontaire.

## 2. Ce qui est produit

| Fichier | Dimensions | Images | Octets | Perte mesurée |
|---|---|---|---|---|
| `assets/boot-strip.webp` (web, inchangé) | 220×7040 | 32 | 675 934 | écart max 2/255 |
| `assets/boot-strip-hd.webp` (**nouveau**) | 440×14080 | 32 | **3 342 884** | écart max **0/255**, p99.9 **0**, 0 alpha aberrant |
| `assets/emblem-spin.webp` (web, inchangé) | 384×384 | 132 | 522 418 | — |
| `assets/emblem-spin-hd.webp` (**nouveau**) | 768×768 | 132 | **1 726 692** | — |

- `assets/boot-strip-hd.json` porte le même schéma que `boot-strip.json`
  (images, cellule, largeur, hauteur, octets, sha256, perteMax, centile999,
  partAuDessus8, pixelsVus, encodage, source).
- Rendu : viewport 640, `deviceScaleFactor: 2`, canvas 600 px CSS (1200 px réels),
  réduction à 440 dans la page (`drawImage`, `imageSmoothingQuality: high`).
- Contrôle : la bande livrée est **re-décodée par ffmpeg** (`-pix_fmt rgba`), chaque
  cellule est comparée à son PNG source de 440 px, pixel par pixel. 1 904 019 pixels
  comparés, 4 291 181 pixels transparents (alpha < 8) écartés de la mesure de couleur —
  leur alpha, lui, est vérifié : 0 écart > 8.
- Pourquoi sans perte : à 4:2:0, les mêmes 32 images en WebP avec perte donnent
  670 Ko / 876 Ko / 1 126 Ko / 1 469 Ko (q82 → q100) mais **11 à 30 % des pixels à plus
  de 8/255** — des franges de chroma sur les éclairs cyan et la lave orange, exactement
  le défaut qu'on corrige. Sans perte : 3 265 Ko et un écart nul. Mesure complète
  reproductible avec `node _bake/bake-hd-encode.mjs --essai 82 90 95 lossless`.

### Le flou, chiffré

À taille d'affichage égale (400×400, ce que l'écran demande pour une boîte de 200 px à
2×), énergie de contour (|Laplacien| moyen sur les pixels visibles) :

- ancienne bande 220 px agrandie : **9,16**
- nouvelle bande 440 px réduite : **28,46** → **×3,11** de détail conservé

## 3. Ce qui est branché

- `desktop/src-tauri/src/main.rs` : `game_source()` charge `{GAME_URL}?app=pc`.
  `GAME_URL` reste la source unique (origine, portée des permissions, test
  `only_exact_game_origin_is_embedded` inchangé et vert).
- `app-mode.js` (nouveau, chargé juste après le `<link rel=preload>`) : sans `?app=pc`
  il ne fait **rien** ; avec, il pose `document.documentElement.dataset.app = "pc"`,
  `window.__FA_APP_PC = true`, et repointe le preload sur la bande HD.
- `boot-emblem-hd.js` (nouveau, chargé juste après `#boot-emblem`) : remplace le `src`
  avant le premier rendu ; `onerror` → retour à la SD (repli 404 silencieux).
- `cinematique.jsx` : `EMBLEM_SPIN` prend `emblem-spin-hd.webp` seulement si
  `dataset.app === "pc"` ; l'`<img>` du repli retombe sur la SD si la HD est absente.
  `build/cinematique.js` régénéré par `npm run build`.
- Les deux scripts sont **externalisés**, pas en ligne : `test/csp-inline.test.js`
  interdit tout `<script>` sans `src` (première version refusée, corrigée).

### Requêtes réellement émises (mesure, pas intention)

`node _bake/verify-app-pc.mjs` sert le jeu en local et compte les requêtes :

| Page | Bandes demandées | Octets |
|---|---|---|
| `/` (visiteur web) | `boot-strip.webp` (660 Ko), `emblem-spin.webp` (510 Ko) | **1 198 352** |
| `/?app=pc` (app PC) | + `boot-strip-hd.webp` (3265 Ko), `emblem-spin-hd.webp` (1686 Ko) | 5 745 510 |

Le web est identique à l'octet près. Limite connue, dite franchement : dans l'app, la
bande **SD (660 Ko) est aussi demandée** — le preload part avant que `app-mode.js`
puisse le reprendre. Sur un vrai réseau la requête de l'image est remplacée dans les
millisecondes (annulée), mais sur localhost elle se termine et la mesure la compte
pleine. Supprimer ce résidu demanderait de retirer le `<link rel=preload>` du balisage,
donc de changer ce que reçoit un visiteur web sans JS : refusé.

## 4. Tests

| Suite | Résultat |
|---|---|
| `npm test` (web) | **1176 tests : 1170 passés, 0 échec, 6 ignorés** |
| `npm test` (desktop, node) | **3 passés, 0 échec** |
| `cargo test` (src-tauri) | **2 passés, 0 échec** |

Ajouts dans `test/asset-budget.test.js` :
- plafonds déclarés : `boot-strip-hd.webp` 3 600 Ko (mesuré 3 265), `emblem-spin-hd.webp`
  1 900 Ko (mesuré 1 686), avec la raison écrite à côté ;
- nouveau cas « les bandes HD du logo ne partent que vers l'app PC » : métadonnées
  cohérentes avec le fichier, `perteMax` à 0, balisage statique toujours en SD, aucune
  mention de la HD dans `index.html`, ordre des scripts (app-mode après le preload,
  avant la cinématique ; boot-emblem-hd après l'image), garde `?app=pc` et repli 404
  présents dans les deux fichiers, séquence HD de la cinématique derrière
  `dataset.app === 'pc'`.

## 5. App reconstruite

`npm run tauri build` dans `desktop/` — deux bundles, aucune erreur :

- `desktop/src-tauri/target/release/bundle/nsis/Fractal Arena_0.1.0_x64-setup.exe` (2 875 452 o)
- `desktop/src-tauri/target/release/bundle/msi/Fractal Arena_0.1.0_x64_fr-FR.msi` (4 444 160 o)

## 6. Ce qui reste incertain

1. **La bande SD demandée en plus dans l'app** (660 Ko), voir plus haut. Le web, lui, est
   mesuré identique.
2. **Le poids sans perte** : 3 265 Ko pour la bande HD. C'est le prix d'un écart nul ;
   une variante avec perte tiendrait en 900 Ko mais salit précisément ce qu'on répare.
   Si le budget réseau de l'app devient contraint, c'est le levier à rouvrir
   (`--essai` dans `_bake/bake-hd-encode.mjs`).
3. **Le rendu dans la vraie fenêtre Tauri** n'a pas été observé à l'œil : le fichier est
   vérifié au pixel, le câblage est vérifié au niveau des requêtes, mais l'app elle-même
   charge la prod (`fractalarena.com`) où ce code n'est pas encore déployé. La preuve
   visuelle devra se faire après fusion.
4. **Le « 7 » du brief** : mesure ci-dessus, 9 blocs partout, 7 seulement en grille 7×1×1.
5. Détail d'environnement, pas de dépôt : `vendor/react.production.min.js` arrivait en
   CRLF dans ce checkout Windows, ce qui faisait échouer le test SRI. Réécrit en LF
   depuis le blob git (aucun changement de contenu pour git). Sur un CI Linux, le
   problème n'existe pas.
6. `npm run build` a emprunté une jonction `node_modules` vers le worktree `boot-rapide`
   (dépendances dev absentes ici). Non versionné.

## 7. Fichiers ajoutés pour reproduire

| Fichier | Rôle |
|---|---|
| `_bake/bake-fragments-hd.html` | même scène que `bake-fragments.html`, résolution paramétrée |
| `_bake/bake-hd.mjs` | capture 32 images (viewport 640 / DPR 2 → 440), assemble `strip.png` |
| `_bake/bake-hd-encode.mjs` | encodage WebP + mesure d'écart cellule par cellule (ffmpeg) |
| `_bake/bake-spin-hd.mjs` | copie de `bake-spin.mjs`, sortie `emblem-spin-hd.webp`, 768 px |
| `_bake/probe-parts.mjs` | quel GLB donne combien de pièces, pour quelle grille |
| `_bake/verify-app-pc.mjs` | compte les requêtes avec et sans `?app=pc` |

Les originaux (`bake-fragments.html`, `bake-assemble-frag.mjs`, `bake-spin.mjs`,
`make-boot-strip.mjs`) n'ont pas été modifiés : la chaîne SD reste reproductible telle
quelle.
