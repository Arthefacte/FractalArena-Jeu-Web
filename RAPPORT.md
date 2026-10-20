# Rapport — constat bloquant n°4 : palier LP (50 000 affichés, 250 000 exigés)

Worktree : `fractal-arena-web/fix-lp-tier` — branche `Arthefacte/fix-lp-tier`
PR : **#281** — https://github.com/Arthefacte/FractalArena-Jeu-Web/pull/281 (NON fusionnée)

## Constat vérifié

- Client : `i18n.js:111` (`LP_PANEL_HINT`) et `i18n.js:115` (`LP_STATUS_NONE`) annonçaient
  « dès 50 000 FA verrouillés » pour le titre Market Maker.
- Serveur : `lp.js:40-43` → `LP_TIERS = [ { G2, min: 500_000 }, { G1, min: 250_000 } ]`.
- Le test `test/lp-i18n.test.js` (lignes 35-40 de la version d'origine) comparait les textes
  à la chaîne `50[\s,]000` écrite à la main : il figeait le chiffre faux.

Le constat est donc exact, et c'est le client qui est faux. Historique serveur :
`git log -S'min: 250_000' -- lp.js` → commit `09e2709` (04/09/2026)
« feat(lp): seuil G1 250k + tier LP expose dans les classements generaux »,
qui relève G1 de 50 000 à 250 000 et ajuste les tests serveur dans le même commit.
Rien ne l'a redescendu depuis : la décision produit est le 250 000, le texte client
n'a simplement jamais suivi. G2 (500 000) était déjà correct.

## Correctif (plus petit diff utile)

1. `i18n.js` — ajout de `LP_TIER_MIN = { G1: 250_000, G2: 500_000 }`, miroir documenté de
   `lp.js LP_TIERS`, exposé sur `window.FA_I18N`. `LP_PANEL_HINT` et `LP_STATUS_NONE`
   (FR/EN/ZH) sont désormais des template literals construits à partir de cette constante :
   les chiffres ne sont plus recopiés à la main dans les textes.
2. `test/lp-i18n.test.js` — réécrit : le test charge l'i18n, lit `I18N.LP_TIER_MIN`, en
   dérive le format attendu par langue (espace en FR, virgule en EN/ZH) et compare aux
   textes rendus ; il confronte aussi `LP_TIER_MIN` au miroir serveur (G1 250k, G2 500k)
   et refuse tout ancien seuil autonome (50k / 200k) grâce à `(?<!\d)` (« 250 000 »
   contient « 50 000 » sans être ce seuil).
3. Bump cache-busting `v378 → v379` (`index.html` ×90 balises, `data.js` `FA_ASSET_V`,
   `sw-policy.js` `CACHE`, `manifest.webmanifest` icônes, `version.json`, assertion
   épinglée de `test/account-wiring.test.js`) — `i18n.js` est un fichier servi. Ce bump
   remet aussi au vert `test/cache-bust-mouvement.test.js`, déjà rouge sur `main` :
   le commit `62f1a83` avait changé `build/tour.js` / `tour.jsx` sans incrémenter v378.

Fichiers touchés : `i18n.js`, `test/lp-i18n.test.js`, `index.html`, `data.js`,
`sw-policy.js`, `manifest.webmanifest`, `version.json`, `test/account-wiring.test.js`.
Aucune dépendance, aucune migration, aucun autre fichier.

## Tests

Avant (i18n.js remis à `main`, `git stash push -- i18n.js`) :

```
✔ toutes les clés LP_* / LB_*_LP existent en FR/EN/ZH
✖ LP_TIER_MIN est exposée et reflète les seuils du serveur   (AssertionError)
✖ les seuils affichés sont ceux de LP_TIER_MIN, 3 langues    (TypeError: undefined.G1)
✖ plus aucun ancien seuil (50k / 200k) dans les textes LP    (LP_PANEL_HINT.FR garde 50 000)
```

Après :

```
test/lp-i18n.test.js : 5/5 verts
npm test             : 1182 tests, 1176 pass, 0 fail, 6 skipped
```

Texte rendu vérifié (FR / EN / ZH) : « dès 250 000 FA … dès 500 000 FA »,
« from 250,000 … from 500,000 », « 锁定达到 250,000 FA … 500,000 FA ».

## Notes

- `vendor/react*.js` ont été normalisés en LF (perl, cf. brief) pour neutraliser le faux
  rouge SRI sous Windows ; ces fichiers ne sont **pas** dans le commit.
- `app.jsx:247-249` porte encore un commentaire obsolète (« null sous 50k … G1 ≥ 50k,
  G2 ≥ 200k ») : non touché (hors constat, aucun effet joueur). À corriger un jour où
  `app.jsx` bouge pour une autre raison.
- PR ouverte, **pas fusionnée** : relecture du fondateur.
