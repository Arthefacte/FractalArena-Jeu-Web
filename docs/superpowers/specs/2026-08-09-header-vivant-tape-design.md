# Header vivant — tape boursière + pluie d'or (idée #7 de la roadmap esthétique)

Décidé le 09/08/2026 en session (brainstorm prose). Dernière étape animée de la
roadmap du 14/07 avant les empty states. Les étapes déjà en place ont couvert une
partie de la vision d'origine : les soldes du header annoncent leurs mouvements
(v130-v132) et les jauges s'allument sur les entrées (`gainsPools`, v131). Ce
chantier livre ce qui manque : la **tape boursière en vraies données**, la
**pluie d'or au rachat**, et le **« ka-ching »** différé depuis l'étape 1.

## 1. La tape (« FA-TAPE »)

Ligne mono ~18 px sous les 4 jauges du `BuybackTicker`, défilement continu
droite→gauche en `transform` pur (leçon Mali-G68 : jamais de filtre ni de layout
animé ; une piste dupliquée + `translateX(-50 %)` en boucle).

**Vraies données, zéro appel réseau nouveau** : tout vient du `/buyback/status`
déjà relevé par le ticker (60 s + `fa:buyback-refresh`). Une fonction pure
(`tape-ui.js`, patron `juice-ui.js`) compose le cycle d'items :

- derniers rachats par pool (`last_buyback` : montant + âge relatif), du plus
  récent au plus ancien ;
- entrées vues dans la session (`gainsSession`, alimenté par `gainsPools`) ;
- remplissage de chaque pool (« POOL 25K · 82 % », borné 0-100) ;
- cumul racheté (somme des `total_bought`, seulement s'il est > 0).

La fonction pure renvoie des items **structurés** (`{type, tier, montant, …}`) ;
le rendu les formate via I18N (clés FR/EN/ZH nouvelles `TAPE_*`). Un item d'âge
utilise `tempsRelatif(ageMs)` → `{unite, n}` formaté par le rendu.

**Mobile (≤ 640 px, breakpoint existant du ticker)** : tape masquée par défaut ;
elle se déplie quand il y a du neuf (entrée détectée ou rachat), reste ~8 s,
se replie. **`prefers-reduced-motion`** : pas de défilement (texte statique).

## 2. Pluie d'or + ka-ching (le rachat devient un moment)

**Signal** : entre deux relevés, un `buyback_count` de pool augmente →
`rachatsDetectes(prev, suivants, initialise)` (pure, même patron et même garde
anti-premier-relevé que `gainsPools` — le piège du « +38 610 au login »).

**À ce signal** :
- ~30 particules d'or en **spans CSS** (transform/opacity seulement, patron
  embers de la cinématique — pas de canvas) pleuvent sur la zone du ticker ~2 s ;
- la rangée du pool concerné pulse (classe dédiée, cousine de `.bb-gain`) ;
- `FA_SFX.play('kaching')` — recette procédurale nouvelle dans `sfx.js`
  (impulsions métalliques brillantes + assise grave), coupée par le toggle
  `options.sound` existant, zéro fichier audio.

Coupé en `prefers-reduced-motion` (particules) ; le son suit le toggle son.

## 3. Architecture, replis, vérification

- `tape-ui.js` (nouveau, IIFE `window.FA_TAPE`) : `composerTape`,
  `rachatsDetectes`, `tempsRelatif` — pur, sans DOM ni I18N, testé `node:test`.
- `buyback.jsx` : rendu de la tape + détection rachat + particules + son.
  **Repli** : si `window.FA_TAPE` est absent (404 de déploiement), le ticker
  rend exactement comme aujourd'hui — aucun crash, pas de tape.
- `sfx.js` : recette `kaching`.
- `styles.css` : `.fa-tape` (marquee), `.fa-or` (particules), media 640 px,
  blocs `prefers-reduced-motion`.
- `index.html` : chargement `tape-ui.js` avant `build/buyback.js`, cache-bust
  v144 complet (`sw-policy.js` `fa-v144`, `FA_ASSET_V`, test de version).
- Vérification : tests purs (composition, bornes, garde d'initialisation),
  verrous de source (câblage, repli), `_bake/verify-tape.mjs` en navigateur
  (route interceptée sur `/buyback/status` : tape visible desktop, masquée
  mobile par défaut, pas d'erreur page).

**Hors périmètre (YAGNI)** : historique serveur des rachats (le `last_buyback`
par pool suffit), tape sur d'autres écrans, particules plein écran (le moment
appartient à l'économie, pas au combat), son au survol.
