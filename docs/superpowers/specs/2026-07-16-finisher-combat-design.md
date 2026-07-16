# Finisher de fin de combat — design

Date : 2026-07-16
Statut : validé, prêt pour plan d'implémentation
Roadmap : idée #6 du chantier esthétique (après #5 « boot de marque », v80)

## Intention

Donner une conclusion aux combats. Aujourd'hui un combat se rejoue pendant 7 à 12 s
puis une modale de résultat apparaît sèchement. Le finisher est la cinématique courte
(~800 ms) qui s'intercale entre les deux : l'écran se fracture à la victoire, se
« dé-mine » à la défaite.

Style signature « griffe » : cyan `--elec` / orange-BTC `--fire` / or / navy, thème
crypto-blockchain. Le finisher lit `--accent` (livré au #4) et prend donc l'humeur de
l'écran sans code dédié.

## Décisions

**Le finisher précède la modale.** Il ne la remplace ni ne l'habille. La modale porte
les gains (payout, XP, level-ups, rareté) et reste intacte. Ce chaînage est déjà
démontré dans le code par `tour.jsx:398-403` (replay → modale).

**Purement procédural, zéro asset.** Overlay 2D dessiné en canvas, aux couleurs de
`--accent`. Écartés : réutiliser le socle Three.js de `totem-cine.js` (allume WebGL sur
chaque fin de combat, et montre l'emblème — la marque, pas le combat) ; baker une
séquence 3D façon boot (326 Ko pour 32 frames, et il en faudrait deux). Motifs : un
finisher joue sur un écran que le joueur connaît déjà, donc fracturer *cet écran-là*
raconte quelque chose que l'emblème ne raconte pas ; aucun Ko, aucun bake, aucun WebGL
sur un moment qui se répète ; si le rendu déçoit on jette ~80 lignes, pas une chaîne
d'outillage. Three.js et le bake restent ouverts pour l'idée #8.

**Aucun dispositif d'échappement** (pas de skip, pas de dégressivité, pas de toggle
dédié). Les deux boucles de farm du jeu bypassent déjà tout résultat : la Fosse en mode
Loop (`fosse.jsx:296`, `if (!isLoopRun) setResult(...)`) et la Tour en auto (récap
agrégé, aucun `setBattle`/`setResult`). Le joueur qui enchaîne est donc déjà hors de ce
flux. Sur un combat qu'on a choisi de regarder jouer 7-12 s, 800 ms de conclusion n'est
pas une taxe. Le toggle `options.sound` existant couvre déjà le son.

## Architecture

Deux nouveaux fichiers, sur le modèle de `totem-cine.js` (API impérative hors React,
singleton) et de la convention de testabilité du repo (`tour-ui.js`, `loop.js`).

### `finisher-ui.js` — timeline pure, testable

Aucun DOM, aucun accès global. Exporté sur `window` comme les autres `.js` du repo.

```js
finisherVals(t, { win })  // t en secondes depuis le début → état à cet instant
```

Retourne un objet de valeurs dérivées (opacité du flash, énergie 0→1, positions et
rotations des éclats, désalignement/désaturation des blocs, avancement du scramble).
Fonction pure : `finisherVals(t, o)` appelée deux fois avec les mêmes arguments rend le
même résultat. Toute la logique de timing vit ici, donc `npm test` la couvre
directement.

Constantes exportées : `FIN_DUR` (0.8 s), et le `t` du beat d'impact.

### `finisher.js` — overlay et boucle de rendu

```js
window.FA_FINISHER.play({ win, onDone })
```

- `<canvas>` `position:fixed; inset:0; z-index:9990; pointer-events:none`, appendé au
  `body` **une seule fois** et réutilisé (singleton — pas de fuite sur combats répétés,
  contrairement à `cinematique.jsx` qui reconstruit tout à chaque montage).
- Lit `--accent` sur `body` via `getComputedStyle` au moment de `play()`.
- Boucle `requestAnimationFrame` : à chaque frame, appelle `finisherVals(t, { win })` et
  peint. `finisher.js` ne calcule pas de timing, il dessine.
- À `FIN_DUR` : cache le canvas, appelle `onDone()`.
- Réentrance : un `play()` pendant un `play()` annule le précédent (rAF coupé,
  `onDone` du précédent tout de même appelé — la modale ne doit jamais être perdue).

### Le geste

Il lit `--accent`, donc : orange `--fire` à la Fosse, rouge-magenta `#FF2D78` à
l'Arène, bleu glacial `--r-rare` à la Tour, vert `--success` en Campagne.

**Victoire (~800 ms)** — l'écran se fend en éclats hexagonaux tracés dans l'accent, qui
se rétractent vers le centre en accélérant (easing `eOut`-like), puis flash blanc bref à
l'impact. Le flash masque la transition vers la modale — même rôle que le `doFlash()` de
`totem-cine.js:104-119`.

**Défaite (~800 ms)** — pas de fracture : une **dé-minage**. Une grille de blocs se
désaligne, se pixellise et s'affaisse en se désaturant, pendant qu'une ligne de hash se
scramble et perd ses caractères (l'effet `scramble()` de `cinematique.jsx:38` est
réutilisable). **Aucun flash** : ça s'éteint, ça ne frappe pas.

## Points d'ancrage

Trois hooks, pas quatre : la Tour n'a pas de point d'ancrage propre, elle rend
`AreneBattle` (`tour.jsx:398`) et hérite donc du hook de l'Arène. Les trois modes
convergent sur un `setResult`/`setDone` unique portant un booléen `win`/`won`. Chacun
enveloppe l'appel existant, sans changer sa shape :

| Mode | Ligne | Hook actuel |
|---|---|---|
| Fosse | `fosse.jsx:296` | `setResult({ win, free, ...summary })` |
| Campagne | `campaign.jsx:263` | `setResult({ win, ... })` |
| Arène (+ Tour, partagé) | `arene-battle.jsx:47` (`done`) | `setDone(true)` |

Le garde `if (!isLoopRun)` de la Fosse enveloppe déjà le point d'appel, et la Tour en
auto ne l'atteint jamais : **le finisher est inatteignable depuis une boucle sans une
ligne de code**. Ce bypass est un invariant à verrouiller par test.

Cas Arène/Tour : l'implémentation branche sur `done` dans `arene-battle.jsx` (pas sur un
hook Tour dédié qui n'existe pas), et c'est le meilleur geste : le finisher tombe au
climax du combat plutôt qu'après un clic, et le code est partagé entre l'Arène et la
Tour. `onClose` déclenche `actions.pvpRefresh()` et **jamais avant** — verrouillé par
`test/arene-replay-spoiler.test.js:24` (anti-spoiler). Le finisher s'intercale sur
`setDone(true)`, en amont de ce `onClose` : l'invariant n'est pas touché.

**Correction a posteriori (prémisse fausse dans une version antérieure de ce doc) :**
cette section affirmait que le hook devait être `onClose` d'`AreneBattle` « sinon il se
déclencherait derrière le replay encore à l'écran ». C'est faux : le canvas du finisher
est en `z-index: 9990` (`finisher.js`), donc il passe **par-dessus** le rejeu, pas
derrière — l'argument qui a motivé un hook `onClose` séparé ne tenait pas.
Conséquence à consigner pour ne pas « réparer » cette déviation par erreur : à la Tour,
le finisher ne précède **pas** directement `TourResultModal`. Il joue sur `done` pendant
que le rejeu (`AreneBattle`) est encore affiché ; il reste ensuite un clic de fermeture
du rejeu (`onClose` → `setBattle(null)`) avant que `TourResultModal` apparaisse
(`tour.jsx:402`, `!battle && result`). L'argument « le flash masque la transition vers
la modale » (section *Le geste*) ne vaut donc qu'à l'Arène et à la Fosse/Campagne, pas à
la Tour.

## Deux dettes ramassées

**Le son remonte dans le finisher.** Aujourd'hui `FA_SFX.play("victory"/"defeat")` part
du `useEffect` de chaque modale (`fosse.jsx:442`, `tour.jsx:136`, `arene-battle.jsx:69`).
Si le finisher précède la modale de 800 ms, le son arriverait 800 ms après l'impact.
Donc `finisher.js` joue le son **à son beat d'impact**, et les trois `useEffect` le
lâchent. Un seul endroit au lieu de quatre. La convention `openSound={null}` des modales
(`fosse.jsx:444`, `tour.jsx:138`) reste : elles ne doivent toujours pas jouer le `open`
générique.

**La Campagne gagne le son.** `campaign.jsx:379` monte `<Modal>` sans `openSound={null}`
et n'appelle jamais `victory`/`defeat` — seul mode incohérent, il joue le `open`
générique. Brancher le hook répare le bug par construction ; ajouter `openSound={null}`.

**`prefers-reduced-motion`.** Le jeu le respecte partout (6 blocs : `styles.css:229`,
`:259`, `:372`, `index.html:74`, `:105`, `boot-anim.js:5`) sauf `totem-cine.js` et
`cinematique.jsx`. Le finisher le respecte : chemin réduit = aucune animation, **le son
part quand même**, `onDone()` immédiat (micro-délai nul). Le joueur perd le geste, pas le
feedback. Ce choix est aussi ce qui rend le son fiable : il vit dans `play()`, pas dans
la boucle de rendu.

Hors scope : corriger `totem-cine.js` et `cinematique.jsx` sur reduced-motion (dette
réelle, mais pas ce chantier).

## Tests

`npm test` = `node --test --test-force-exit test/*.test.js`, Node natif, CommonJS.
Rappel de la contrainte du repo : **les `.jsx` ne sont pas requirables** — les tests les
lisent en `fs.readFileSync` et assertent sur le texte source (pattern
`test/arene-replay-spoiler.test.js:14`).

`test/finisher-ui.test.js` — exécution réelle de `finisher-ui.js` :
- pureté : deux appels identiques → résultat identique
- bornes : `finisherVals(0, …)` et `finisherVals(FIN_DUR, …)` bien formés ; aucune valeur
  `NaN`/`undefined` sur un balayage de `t`
- monotonie de l'énergie sur le chemin victoire ; absence de flash sur le chemin défaite
- `win: true` et `win: false` produisent des timelines distinctes

`test/finisher-hooks.test.js` — asserts au niveau source :
- les 4 `.jsx` référencent `FA_FINISHER.play`
- le bypass Loop est intact : le `if (!isLoopRun)` de `fosse.jsx` enveloppe toujours
  l'appel (invariant : pas de finisher en boucle)
- les 3 `useEffect` de son ont bien été retirés des modales, et `finisher.js` contient le
  `play("victory")`/`play("defeat")`
- `campaign.jsx` a `openSound={null}`
- `finisher.js` contient un garde `prefers-reduced-motion`
- `index.html` déclare les deux nouveaux fichiers

`_bake/verify-finisher.mjs` — vérif visuelle Playwright headless sur le modèle de
`_bake/verify-accent.mjs` (servi par `_bake/serve.mjs`) : screenshots du finisher aux
beats clés, victoire et défaite, sur au moins deux écrans d'accent différents.

## Livraison

- Cache-bust : `?v=80` → `?v=81` sur les **39 occurrences** de `index.html`, plus les deux
  nouveaux fichiers déclarés (donc 41 après coup).
- Ordre : `npm test` vert → vérif Playwright → l'utilisateur dit « commit deploie » →
  push `origin main` (GitHub Pages auto) → poll de la prod → mise à jour de la mémoire.
- Client web seul. Aucun changement serveur : le serveur reste autoritatif sur le combat,
  le finisher ne lit que le `win` déjà renvoyé.
