# Juice de combat — design

**Date :** 2026-07-18 · **Statut :** design validé, spec en revue
**Roadmap esthétique :** direction #4 (juice de combat). Voir `docs/aesthetics/2026-07-13-meshy-nav-icons-griffe.md` pour l'ensemble des 5 directions (#1 icônes livrée).

## Objectif

Rendre le combat « ressenti » : chaque coup doit claquer (son + impact visuel), les crits et les KO doivent être des moments. Le tout **client-side, purement cosmétique**, rejoué sur les events de combat déjà produits par le serveur — **aucun changement serveur**, et respect de l'[invariant EV de la Fosse] (pas de buff de combat, seulement du feedback).

## Contexte / base existante

Le combat (Fosse `fosse.jsx`, Campagne `campaign.jsx`) rejoue une séquence d'events serveur (`round`/`atk`/`sp`/`crit`/`miss`/`heal`/`down`/`win`/`lose`) via un stepper `setTimeout`. Effets déjà présents :

- Chiffres de dégâts flottants colorés (`.dmg-float`), crit or / sp forge / atk rouge / soin vert.
- Shake + flash de la carte touchée (`.shake`, `.flash`), lunge de l'attaquant (`.lunge-l/-r`).
- Log de combat coloré.
- Finisher canvas de fin de combat (`FA_FINISHER`), win/lose.
- Moteur SFX procédural Web Audio (`FA_SFX`), **CSP-safe** (aucun fichier média).

**Manques comblés par ce design :**
1. Le combat est **muet** : `FA_SFX` ne joue que sur clics UI + victoire/défaite. Aucun son par coup/crit/spécial/soin/KO.
2. Pas de **screen-shake** global, seule la carte tremble.
3. Pas de **hit-stop** (micro-gel) sur crit.
4. Pas d'**impact/particules** au point de contact.
5. Crit / KO peu emphatiques.
6. `floatText`/`animHit`/`animLunge` sont **dupliqués** entre `fosse.jsx` et `campaign.jsx`.

## Architecture retenue

**Module partagé impératif `FA_JUICE`** (nouveau `juice.js`, hors React, modèle `FA_FINISHER`/`FA_SFX`). Il centralise l'effet complet d'un event de combat ; `fosse.jsx` et `campaign.jsx` remplacent leurs 3 helpers dupliqués par des appels au module. DRY, réglage à un seul endroit, cohérent Fosse+Campagne, extensible à l'arène PvP ensuite.

Alternatives écartées : (B) enrichir en place dans chaque fichier → double le travail, dérive ; (C) canvas particulaire plein écran → trop lourd sur mobile, surdimensionné pour de petites gerbes (candidat upgrade futur).

## Composants

### 1. `juice.js` → `window.FA_JUICE`
API impérative, tout en `try/catch` silencieux, no-op si élément absent, jamais bloquant pour la boucle :

- `hit(cardEl, { dmg, kind, crit, boardEl })` — `kind ∈ {atk, sp}`. Produit : chiffre flottant (emphase `.crit` si crit), flash+shake de `cardEl`, **gerbe d'étincelles** (~6–8 divs CSS positionnés au point d'impact, teinte selon `kind`, auto-détruits), **screen-shake de `boardEl`** (intensité via `shakeIntensity(dmg, crit)` — **seulement crit / gros coup**, rien sur petit coup), et déclenche le son (`crit` → `FA_SFX crit`, `sp` → `special`, sinon `hit`).
- `heal(cardEl, { amount })` — chiffre vert + halo doux + son `heal`.
- `ko(cardEl)` — **moment KO** : flash blanc bref + éclats + son `ko`, avant le grisage `.dead` existant.
- Respecte `prefers-reduced-motion` : conserve chiffres + son, coupe shake/particules/hit-stop.

**Fonctions pures exportées pour test :** `shakeIntensity(dmg, crit)` (→ 0 pour petit coup, palier montant sinon), `particleSpec(kind)` (nombre + couleur + spread des étincelles).

### 2. Sons de combat (`sfx.js`)
Nouvelles recettes procédurales, ultra-courtes (cadence combat ~165 ms), volume calé sous le master 0.22 existant :
- `hit` — impact mat très court.
- `crit` — claquement brillant + composante sub.
- `special` — sweep magique.
- `heal` — blip montant doux.
- `ko` — down grave.

### 3. Hit-stop
Sur event `crit` (et gros coup), le stepper de `fosse.jsx`/`campaign.jsx` ajoute ~80–90 ms au `delay` avant le pas suivant → micro-gel qui fait claquer le crit. Modification d'une ligne dans le `switch`, désactivée sous `prefers-reduced-motion`.

### 4. Emphase crit / KO (CSS, `styles.css`)
- `.dmg-float.crit` : plus gros, glow doré, léger ring d'éclats.
- Screen-shake : classe `.arena-shake` sur le board, intensité via `--shake`, keyframes GPU (transform).
- KO burst : keyframes flash + shatter.

### 5. Intégration
- `index.html` : charger `juice.js` après `sfx.js`, cache-bust `?v=N` (aligné avec le bump global).
- `fosse.jsx` + `campaign.jsx` : supprimer les 3 helpers dupliqués ; ajouter un `boardRef` sur le `.panel.oct` de l'arène ; dans le `switch`, `atk`/`sp`/`crit` → `FA_JUICE.hit`, `heal` → `FA_JUICE.heal`, `down` → `FA_JUICE.ko`.
- `arene-battle.jsx` (PvP) : **hors scope** de départ (rendu plus cinématique) ; le module reste réutilisable pour l'y brancher ensuite.

## Flux de données

Event serveur → stepper (`stepBattle`) → appel `FA_JUICE.*(cardEl, {...ev, boardEl})` → le module orchestre chiffre + carte + particules + shake + son + (hit-stop géré par le delay du stepper). Aucun état applicatif ni serveur modifié ; `p1Live/p2Live` restent gérés par le composant comme aujourd'hui.

## Erreurs / robustesse

- Tout `FA_JUICE.*` en `try/catch`, no-op si `cardEl`/`boardEl` null. L'échec d'un effet ne casse jamais la progression du combat (contrat calqué sur `FA_FINISHER`).
- `FA_SFX` déjà tolérant (no-op si audio indisponible / désactivé via options.sound).
- `prefers-reduced-motion` : chemin dégradé explicite (numbers + son seulement).

## Tests

- **Unitaires node** (`test/`) : `shakeIntensity` (petit coup → 0, crit → palier max, monotonie), `particleSpec` (kind → couleur/compte attendus). Modèle `finisher-ui`.
- **Navigateur** (skill `fractal-arena-web:verify`, Playwright) : lancer un combat Fosse → constater impacts + screen-shake sur crit + sons ; vérifier le mode `prefers-reduced-motion` (pas de shake/particules, chiffres + son présents) ; vérifier la Campagne partage bien le même rendu.

## Décisions tranchées

- **Screen-shake sur crits + gros coups uniquement** (pas chaque impact) — plus classe, évite la nausée.
- **PvP hors scope** de la première itération.
- **Aucun changement serveur** ; juice = feedback pur, pas de buff (invariant EV Fosse préservé).

## Hors scope

Arène PvP, refonte du finisher, particules canvas plein écran, juice hors combat (forge/marché).
