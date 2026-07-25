# Fond « blockchain vivante » — chaîne de blocs qui se mine

**Date** : 2026-07-25 · **Statut** : design approuvé (brainstorm du 25 juillet, visu validé sur
prototype Claude Design « Blockchain vivante animée », fichier `Fond Blockchain Vivante.dc.html`).
**Roadmap** : esthétique #5, volet 2 (le volet 1 « moment Forge » = PR #58).
**Base** : `origin/main` v87 (branche `chain-bg`, worktree `wt-chain-bg`). Indépendant de la PR #58.

## But

Donner vie au fond du jeu : une chaîne de blocs octogonaux « se mine » en continu derrière
l'UI, au niveau filigrane. Le fond actuel (`Ambient` dans app.jsx : `.app-bg` gradients +
`BACKGROUND.png` 5 % + 26 braises `.ember`) reste **intact** — la chaîne s'ajoute entre
`.app-bg` (z-index 0) et les braises (z-index 1).

## Comportement (validé sur le proto)

- Chaîne horizontale dans la bande basse (~y = 80 % de la hauteur), tête à ~86 % de la largeur.
- Blocs **minés** : octogones cyan sombre, numéro de bloc en petit hex au centre, reliés par des
  liens fins cyan ; fondu progressif vers la gauche (les vieux blocs s'effacent en sortant).
- Bloc **en cours de minage** (tête, à droite) : contour orange Bitcoin pulsé + halo, 2 rangées
  de paires hexadécimales qui défilent.
- Cycle de **8 s** en boucle : à t=0,74 le bloc est « trouvé » → flash radial discret (couleur
  d'**accent de l'écran courant**) + 8 étincelles ; à t=0,8→1 la chaîne glisse d'un cran vers la
  gauche (smoothstep) pendant qu'un nouveau bloc en minage entre par la droite. Le compteur de
  blocs avance de 1 par cycle (numéros affichés).
- **Opacité globale 0,1** (validée sur le proto avec UI par-dessus). Décisions actées : braises
  conservées par-dessus ; palette fixe cyan/orange, seul le **flash** prend `--accent`.

## Architecture

Pattern du repo (forge-cine) : module pur + couche canvas.

### `chain-bg-ui.js` → `window.FA_CHAIN_BG_UI` (module pur, IIFE, testable node)

Reprend tel quel l'état pur du proto :
- `cycleVals(t)` — t ∈ [0,1) → `{ pulse, hexTick, flash, spark, slide, mined }`
  (flash = gaussienne après t=0,74 ; spark ∈ -1|0..1 ; slide = smoothstep sur [0,8 ; 1]).
- `blockGeom(i)` — variations déterministes par angle d'or : `{ dy, scale, rot }`.
- `hexPair(i, tick)` — paire hex déterministe « aa »–« ff ».
Aucun DOM, aucun aléa, aucune horloge.

### `chain-bg.js` → `window.FA_CHAIN_BG` (canvas singleton)

- `mount()` **idempotent** : crée un canvas `position:fixed; inset:0; z-index:0;
  pointer-events:none; opacity:0.1`, l'ajoute au `body` (peint après `.app-bg`, sous les
  braises z-1), démarre la boucle. Rappeler `mount()` ne crée rien de plus.
- Dessin = celui du proto (liens → blocs → bloc entrant → flash/étincelles).
- **Perf (fond permanent)** : rAF **plafonné ~24 fps** ; `document.hidden` → pause totale de la
  boucle (`visibilitychange`), reprise au retour ; `dt` clampé (pas de saut après un onglet
  endormi) ; DPR plafonné à **1,5** ; densité auto (taille des blocs = f(hauteur), nombre =
  f(largeur) — rien à faire de spécial pour mobile).
- **Accent du flash** : lue via `getComputedStyle(document.body).getPropertyValue("--accent")`
  **une fois par cycle** (au franchissement de t=0,74), jamais à chaque frame ; repli `#00F0FF`.
- **reduced-motion** : `prefers-reduced-motion` → dessiner UNE frame statique (t=0,3, chaîne
  posée, pas de flash) et ne PAS boucler.
- **Robustesse** : tout le rendu sous try/catch → en cas d'erreur, arrêt de la boucle et retrait
  du canvas ; le fond statique existant reste (rien de l'existant n'est modifié). Aucun son.

### Intégration

- `app.jsx` (`Ambient`) : `useEffect(() => { window.FA_CHAIN_BG?.mount(); }, [])` — repli
  silencieux si le module manque. `.app-bg` et les braises inchangés.
- `index.html` : charger `chain-bg-ui.js` puis `chain-bg.js` (scripts classiques), bump **v89**.
- Aucune entrée CSP, aucun changement serveur.

## Tests

- `test/chain-bg-ui.test.js` (node) : bornes de `cycleVals` (flash nul avant 0,74, slide nul
  avant 0,8, slide→1 en fin de cycle, mined bascule à 0,74), pureté/déterminisme, `blockGeom`
  stable par index, `hexPair` = 2 chars hex.
- `test/chain-bg.test.js` (node, niveau source) : cap 24 fps, `visibilitychange`, reduced-motion,
  `mount` idempotent, pas de `Math.random`, angle d'or, try/catch + teardown.
- `test/chain-bg-wiring.test.js` : mount dans `Ambient` (app.jsx), scripts dans `index.html`,
  v89 partout, plus aucun v88/v87.
- Vérif navigateur : page proto `_chain-bg-proto.html` (chaîne seule + faux panneaux par-dessus).

## Critères de succès

1. La chaîne vit en continu derrière tous les écrans, au niveau filigrane (opacité 0,1),
   sans jamais gêner la lecture de l'UI ; le flash « bloc trouvé » prend l'accent de l'écran.
2. Onglet caché → 0 travail ; reduced-motion → image fixe ; module absent → fond actuel intact.
3. `node --test` passe ; aucun changement serveur.

## Hors portée

Particules de hash montantes (proposées par l'agent Design — refusées : les braises font déjà ce
travail) ; teinte contextuelle de toute la chaîne (seul le flash suit l'accent).
