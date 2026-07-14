# Icônes de nav 3D — prompts Meshy « à la griffe Fractal Arena »

**Date :** 2026-07-13 · **Statut :** ✅ **LIVRÉ (14/07)** — 13 GLB générés (Meshy), bakés en PNG 256px, intégrés à la nav (icône + label dé-emojifié + pulsation lumineuse). Vérifié navigateur desktop+mobile, tests 89/89. Reste : commit + déploiement GitHub Pages.

Objectif : remplacer les **13 emojis de nav** (aujourd'hui collés dans les chaînes i18n `NAV_*`, ex. `NAV_TEAM: "🦸 Équipe"`) par des **icônes 3D** générées via Meshy, dans le même pipeline que les reliques (Meshy → gltf-transform → .glb meshopt).

## La Griffe Fractal Arena (bloc signature réutilisable)
Encode l'identité : palette cyan `#00F0FF` / orange-Bitcoin `#F7931A` / or `#FFE600` / navy quasi-noir, biseau octogonal, traces de circuit émissives, fini PBR des reliques.

```
Fractal Arena signature style: a single centered hero object, cyberpunk crypto-mining artifact, dark anodized gunmetal and matte-black body with fine brushed-metal microtexture, sharp octagonal beveled edges, inlaid glowing circuit traces emitting electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, thin molten-gold (#FFE600) edge highlights, crystalline faceted glass inserts, holographic rim light, subtle emissive glow, high-contrast readable silhouette, symmetrical, isometric 3/4 hero angle, clean game-ready topology, PBR materials, neutral dark background, no text, no letters.
```

## Réglages Meshy
- Art Style : **Realistic** (PBR activé) · Symmetry : **On**
- **Negative prompt :** `text, letters, watermark, multiple objects, cluttered background, flat 2D, low detail, blurry, extra floating shapes, photo background`

## Les 13 prompts (sujet FA + griffe)

**1 — Équipe**
```
A tight triangular squad emblem: three interlocking hexagonal creature-sigil plates locked into a central glowing command core, energy conduits linking the three plates. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**2 — La Fosse**
```
Two crossed angular energy blades plunged into a hexagonal grated combat pit ring, bright sparks bursting at the crossing point. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**3 — Arène (PvP)**
```
A dueling VS emblem: two angular cyber-gladiator helmets facing off across a central lightning bolt, framed by a broken laurel wreath made of circuitry. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**4 — Campagne**
```
A half-unrolled holographic tactical map scroll with a glowing waypoint route and node markers, hardened metal roller edges. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**5 — Tour infinie**
```
An ascending spiral tower of stacked octagonal blockchain blocks, each block thinner toward the top, crowned by a vertical beacon of light. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**6 — Quêtes**
```
A floating bounty seal shaped as a target reticle with a glowing objective diamond locked in the center crosshair, notched octagonal frame. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**7 — Forge**
```
A heavy anvil struck by a floating hammer, molten Bitcoin-orange sparks flying, a glowing crucible seam splitting the anvil body. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**8 — Marché**
```
Two interlocking circular exchange arrows looping around an upright crypto coin, a small trading-terminal chip at the base. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**9 — Wallet**
```
A sleek hardware-wallet vault card with a thick beveled shell and a recessed slot holding a glowing Bitcoin sigil. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**10 — Boosts**
```
A lightning-bolt energy cartridge / power capsule, glowing cyan charge coursing through transparent inner cells, charged metal terminals at both ends. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**11 — Perso (vanity)**
```
An ornate regal crown fused with a stylized cyber battle-mask, etched filigree circuitry, a single central gem. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**12 — Classement**
```
A three-step victory podium of ascending luminous bars topped by a small ranked obelisk trophy, glowing rank notches on each step. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

**13 — Options**
```
A precision gear meshed with a slider control and a small hex bolt, compact mechanical settings module. Fractal Arena signature style: single centered hero object, dark anodized gunmetal and matte-black body, sharp octagonal beveled edges, glowing circuit traces in electric cyan (#00F0FF) with Bitcoin-orange (#F7931A) accents, molten-gold (#FFE600) edge highlights, crystalline facets, holographic rim light, symmetrical, isometric 3/4 angle, clean game-ready PBR topology, neutral dark background, no text.
```

## Notes pipeline (dette reliques)
- **Discipline low-poly** : 13 GLB rendus petits en nav → décimer fort via gltf-transform. Rappel : une relique ambre a fini à **1,87 M tris** — à ne pas reproduire ×13. Textures **1024** (pas 2048) suffisent à cette taille.
- **meshopt** exige `setMeshoptDecoder` côté loader, sinon repli primitif (cf. `project-relics-3d-assets`).
- **Silhouettes distinctes** : la griffe unifie matière/couleur/glow ; garder chaque forme lisible d'un coup d'œil (pas de socle octogonal identique pour tous).

## Intégration RÉALISÉE (14/07)
**Décision d'archi : bake statique, PAS de 3D vivant dans la nav.** 13 canvas WebGL simultanés = trop lourd + plafond ~16 contextes navigateur. On rend chaque GLB **une seule fois** en PNG transparent (angle 3/4 hero, ou frontal pour les blasons plats) → la nav affiche un simple `<img>`. Les `.glb` ne partent donc JAMAIS au client (888 Ko de PNG au lieu de ~650 Mo de GLB bruts).

- **Baker** : `_bake/bake.html` (rendu three+meshopt, éclairage griffe, normalisation, orientation adaptative : objets « plaque » min/max<0.4 → face large vers caméra) + `_bake/bake.mjs` (sert la racine, Playwright screenshot le canvas → `assets/nav-icons/{clé}.png`). Rendu suréchantillonné (pixelRatio 2) capturé en **256px** (net + léger). Réutilisable : recopier les GLB Meshy dans `_bake/raw/{clé}.glb` puis `NODE_PATH="$(npm root -g)" node _bake/bake.mjs`.
- **Dé-emojifié** les 13 `NAV_*` dans `i18n.js` (FR/EN/ZH) → labels propres.
- `Nav()` (app.jsx) rend `<img class="nav-icon" src="assets/nav-icons/{k}.png?v=74"> <span class="nav-label">{label}</span>`. La clé de vue = le nom de fichier (⚠️ `arene`/`perso`, pas `arena`/`vanity`).
- **CSS** (`styles.css`) : `.nav-tab` en `inline-flex` (icône+label), `.nav-icon` 24px + **pulsation lumineuse lente** (`@keyframes navIconPulse` 3.6s, glow cyan qui respire ; plus intense/rapide sur `.on` et au hover ; coupée en `prefers-reduced-motion`). Mobile (`mobile.css`) : `.nav-tab` en colonne (icône 26px au-dessus du label), barre basse native.
- Cache-bust `?v=74` (37 assets dans index.html).
- Vérif : `_bake/verify-nav.mjs` (13/13 img chargées, labels sans emoji, capture nav).

## Offres en attente (à décider avec le user)
- Negative prompts **affinés par icône** (Arène / Perso dérapent facilement).
- **Variante « rareté » de la griffe** (Epic violet #B026FF / Legendary orange-fusion) pour états premium.

## Reste de la roadmap esthétique (5 idées, #1 ✅ livrée)
1. ~~**Icônes maison**~~ ✅ **FAIT (14/07)** · 2. Rareté-comme-matière · 3. Identité visuelle par type de créature (HASH/MINING/LEDGER/NETWORK/BLOCK/GENESIS) · 4. Juice de combat · 5. Fond « blockchain vivante » + moment Forge signature.
