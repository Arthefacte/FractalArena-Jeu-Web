# Reliques 3D — art réel (client web) — Design

Date : 2026-07-03
Chantier : **A** (le Marché entre joueurs = chantier B, spec séparé)
Repo : `fractal-arena-web` (client, GitHub Pages → fractalarena.com)
Dépend de : reliques serveur #40 (déployé) + reliques client PR #31 (en attente)

## Objectif

Remplacer les icônes de reliques générées procéduralement (primitives Three.js) par de **vrais modèles 3D** issus d'un pipeline GPT Image 1.5 → Meshy image-to-3D. Livrer en live sur fractalarena.com **avec** la 3D (pas de sortie procédurale intermédiaire).

Non-objectif : le marché/échange de reliques entre joueurs (chantier B). Aucune mécanique de vente ici.

## Périmètre visuel

8 types de reliques, **1 modèle par type** (8 `.glb` au total). La rareté (Common/Rare/Epic/Legendary) reste une **surcouche matérielle** appliquée en Three.js (teinte + intensité de glow), pas un modèle dédié.

Direction artistique : **cristallin-tech** — gemme/cristal taillé fusionné avec circuiterie lumineuse / arêtes holographiques, palette Fractal Arena (orange `#F7931A`, cyan `#00F0FF`, fond `#05070f`, esprit Tron). Chaque prompt est **ancré sur la primitive actuelle** du type pour garder la silhouette reconnaissable et guider Meshy.

## Pipeline d'assets

```
GPT Image 1.5 (utilisateur)        Meshy image-to-3D (Claude, API)      GitHub Pages
──────────────────────────         ───────────────────────────────      ─────────────
8 images de réf              ─────► 8 .glb low-poly + Draco         ────► assets/relics/<type>.glb
art/relics/refs/<type>.png          décimés, < ~400KB pièce               (~2-3 MB total)
```

- **Utilisateur** : génère les 8 images (prompts en annexe), les dépose dans `art/relics/refs/` nommées par slug (`ruby_shard.png`, `sapphire_plate.png`, `quartz_lens.png`, `amber_cell.png`, `cobalt_spring.png`, `onyx_membrane.png`, `jade_circuit.png`, `prism_matrix.png`).
- **Claude** : lance Meshy image-to-3D (clé `HASHBYTE-RUNNER/.meshy_key`), récupère les `.glb`, les optimise (décimation low-poly + compression Draco) pour tenir sous ~400 KB/pièce, les commit dans `assets/relics/`.
- Hébergement : les `.glb` sont servis statiquement par GitHub Pages (même origine que le jeu, pas de souci CSP — Three est déjà chargé depuis unpkg).

## Intégration client — deux chemins de rendu

### Chemin 1 — Vignettes statiques (partout)
`relic-icons.js` (`window.FA_RELIC_ICON`) est refactoré pour charger les `.glb` au lieu des primitives :
- `GLTFLoader` charge chaque modèle **une seule fois** (préchargement au premier `get()` ou au boot), puis rend une vignette PNG mise en cache (`type|rarity|size → dataURL`), exactement comme aujourd'hui.
- **API inchangée** : `get(type, rarity, size) → dataURL | null`. Drop-in pour `RelicIcon` (composant `components.jsx`).
- Rareté = surcouche matérielle : teinte `emissive`/`color` + `emissiveIntensity` selon `RARITY_HEX`, appliquées aux matériaux du modèle chargé (le `.glb` fournit la forme, pas la couleur finale).
- Consommateurs (inchangés) : cartes d'inventaire, slot relique sur la bête, modale d'équipement, panneau de résultat de la Forge.

### Chemin 2 — Viewer interactif (`<RelicViewer>`)
Nouveau composant React (`relic-viewer.jsx`, chargé Babel) : canvas Three.js **live** (rotation auto + drag souris pour tourner), teinté par rareté.

Placements (les deux) :
1. **Invocation** — remplace l'icône statique 48px dans le panneau de résultat de `ForgeReliques` (`screens.jsx`). C'est le moment « waouh » de la forge.
2. **Détail depuis l'inventaire** — clic sur une carte de relique de l'inventaire → modale (`Modal` existant) affichant le `<RelicViewer>` en grand + nom, rareté, delta de stats.

Discipline GPU : `dispose()` strict de la géométrie, des matériaux, des textures et du `renderer` au démontage (`useEffect` cleanup). Réf. régression connue `fix/web-webgl-leak` — on réapplique la même rigueur. Un seul `RelicViewer` monté à la fois en pratique (un panneau de forge OU une modale).

## Robustesse — repli en cascade

Le chargement `.glb` est asynchrone. Ordre de repli, jamais d'écran vide :
1. `.glb` chargé → vignette/viewer du vrai modèle.
2. `.glb` pas encore prêt → **primitive Three.js actuelle** (on conserve `geoFor()` comme fallback intermédiaire).
3. WebGL indisponible → **pastille losange** colorée par rareté (repli existant).

Notification de disponibilité : quand un `.glb` finit de charger, `relic-icons.js` émet un event `window` (`fa:relic-model-ready`) ; `RelicIcon` s'y abonne et se re-rend pour passer de la primitive au vrai modèle. Même pattern handshake par events `window` que l'onboarding.

## Fichiers touchés / créés

| Fichier | Nature |
|---|---|
| `art/relics/refs/*.png` | **créé** (utilisateur) — 8 images source, non servies au jeu |
| `assets/relics/*.glb` | **créé** (Claude, via Meshy) — 8 modèles optimisés |
| `relic-icons.js` | **modifié** — GLTFLoader + cache + fallback primitive + event ready |
| `relic-viewer.jsx` | **créé** — composant viewer interactif |
| `components.jsx` | **modifié** — `RelicIcon` s'abonne à l'event ready |
| `screens.jsx` | **modifié** — viewer à l'invocation + modale de détail inventaire |
| `index.html` | **modifié** — `<script>` `relic-viewer.jsx` + cache-bust v60 |

## Tests

La 3D/WebGL n'est pas testable en `node:test`. On teste en **pur** ce qui a de la valeur :
- mapping `type → chemin d'asset` (`assets/relics/<type>.glb`) pour les 8 types ;
- mapping `rareté → couleur` (déjà couvert indirectement, on l'assoit) ;
- présence effective des 8 fichiers `.glb` sur disque (test de garde qui échoue si un asset manque).
- Vérif visuelle navigateur en fin de parcours (les deux chemins de rendu + les 3 replis).

Lancement : `node --test test/*.test.js` (⚠️ pas `test/` en dossier — casse sur Node v24).

## Déploiement

- On **empile sur la branche `feat/equipement-reliques-client` (PR #31)** : reliques + 3D partent live en un seul merge. Le launch attend donc les 8 images.
- Ordre : pas de changement serveur (art client only) → un seul push client.
- Cache-bust global → **v60** (les fichiers partagés changent, il faut forcer le rechargement).
- Rien n'est live tant que la PR n'est pas mergée (décision du merge = utilisateur).

## Séquencement global (rappel)

1. **Chantier A (ce spec)** — Reliques 3D. Livrable dès les 8 images déposées.
2. **Chantier B** — Marché entre joueurs (hôtel des ventes façon WoW). Sous-système serveur-autoritaire + éco (frais de mise + cut à la vente → sink pools, anti wash-trading). **Son propre spec/plan.** La roadmap prévoyait déjà un marketplace P2P (fee 2.5% → pool/burn) — point de départ pour B.

---

## Annexe — 8 prompts GPT Image 1.5

Consignes communes (à appliquer aux 8) : **un seul objet centré**, **objet entier dans le cadre** (non coupé), vue 3/4, **fond studio neutre uni** (gris clair, pas le fond sombre du jeu — meilleure extraction de géométrie par Meshy), éclairage studio doux **sans ombre portée dure** (l'ombre se fait « manger » comme de la géométrie), matériau PBR net, haute définition (PNG carré ~1024²+), pas de texte, pas de sol/décor.

⚠️ **Adapté image-to-3D** : matériau **OPAQUE, mat/satiné, facettes nettes** — surtout **pas de translucide / verre / lueur interne** (l'image-to-3D reconstruit très mal la transparence). Les circuits sont **gravés en surface**, pas des lueurs internes. Le **glow Tron et la teinte par rareté sont ajoutés au runtime en Three.js** — l'image source ne sert qu'à donner une **forme et un matériau propres**.

1. **ruby_shard** — « A single faceted octahedral crystal shard, solid opaque deep-red crystal with sharp clean facets, thin engraved circuit-line grooves along the edges, matte-satin finish, sci-fi Tron aesthetic, 3/4 view, centered, full object in frame, plain light-gray studio background, even soft lighting, no harsh shadows, PBR, high detail, one object. »
2. **sapphire_plate** — « A rectangular crystalline tablet/plate, solid opaque blue sapphire body with engraved circuit patterns on its face, beveled sharp edges, matte-satin finish, sci-fi Tron aesthetic, 3/4 view, centered, full object in frame, plain light-gray studio background, even soft lighting, no harsh shadows, PBR, high detail, one object. »
3. **quartz_lens** — « A rounded multi-faceted crystal orb (icosahedron), solid opaque pale-quartz crystal with clean facets and engraved circuit filaments on the surface, matte-satin finish, sci-fi Tron aesthetic, 3/4 view, centered, full object in frame, plain light-gray studio background, even soft lighting, no harsh shadows, PBR, high detail, one object. »
4. **amber_cell** — « A dodecahedral crystal cell, solid opaque warm-amber crystal with clean pentagonal facets and engraved circuit traces on the seams, matte-satin finish, sci-fi Tron aesthetic, 3/4 view, centered, full object in frame, plain light-gray studio background, even soft lighting, no harsh shadows, PBR, high detail, one object. »
5. **cobalt_spring** — « A toroidal ring device (torus), solid opaque cobalt-blue metallic-crystal body wrapped with raised tech coils and engraved circuit lines, matte-satin finish, sci-fi Tron aesthetic, 3/4 view, centered, full object in frame, plain light-gray studio background, even soft lighting, no harsh shadows, PBR, high detail, one object. »
6. **onyx_membrane** — « A sharp tetrahedral crystal, solid opaque glossy black onyx with clean flat facets and engraved circuit veins across the surfaces, satin finish, sci-fi Tron aesthetic, 3/4 view, centered, full object in frame, plain light-gray studio background, even soft lighting, no harsh shadows, PBR, high detail, one object. »
7. **jade_circuit** — « An interwoven torus-knot artifact, solid opaque green jade material with engraved circuit grooves following the knot's path, matte-satin finish, sci-fi Tron aesthetic, 3/4 view, centered, full object in frame, plain light-gray studio background, even soft lighting, no harsh shadows, PBR, high detail, one object. »
8. **prism_matrix** — « A hexagonal pyramidal prism (six-sided cone), solid opaque iridescent crystal with clean sharp facets and engraved circuit lines along the vertical edges, matte-satin finish, sci-fi Tron aesthetic, 3/4 view, centered, full object in frame, plain light-gray studio background, even soft lighting, no harsh shadows, PBR, high detail, one object. »
