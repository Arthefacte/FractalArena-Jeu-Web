# Rapport — la vraie règle de la poussière de FB

Branche : `Arthefacte/dust-ui-publie-la-regle` — PR vers `main`, sans fusion.

## Constat vérifié avant modification

Dans le client au commit `ff7b9cc` :

- `i18n.js:1357` (`EXP_DUST_RULE`) annonce « 1 % · 8 h et plus · une par semaine ».
- `i18n.js:1342` (`EXP_DUST_NEEDS_8H`) annonce « à partir de 8 h seulement ».
- `expeditions-ui.js:27` fixe localement `DUST_MIN_H = 8`.

Lecture du dépôt serveur local, fichier
`C:/Users/PC/orca/workspaces/fractal-arena-server/dust-etat-expose/expeditions.js` :
la route `GET /expeditions/state` (ligne 556) renvoie les six champs attendus
aux lignes 593–601 : `dust_sats`, `dust_p`, `dust_min_h`, `dust_min_rarity`,
`dust_weekly_cap` et `dust_week` (`used`, `left`). Les constantes serveur valent
respectivement 1 000 000 sats, 0,05, 12 h, Epic et 5 trouvailles par semaine UTC.
Le versement utilise le wallet lié (lignes 291–308). Le claim publie son montant
réel dans `rewards.dust_sats` et son nouveau compteur dans `dust_week`.
Aucun fichier serveur modifié ; vérification du code de la route, sans appel
authentifié au compte d'un joueur en production.

## Avant / après visible

- Avant : « 1 % · 8 h et plus · une par semaine ».
- Après : « 0,01 FB · 5 % de chance · expéditions de 12 h · 5 par joueur et par semaine UTC ».
- Durée insuffisante : « Poussière de FB : à partir de 12 h seulement. »
- Conditions : expédition réussie, chacune des trois entités au rang minimum
  reçu du serveur, compte vérifié on-chain.
- Destination : « Envoyée directement sur ton wallet lié, on-chain — pas dans le bandeau FB. »
- Exemple de compteur : « 2 / 5 cette semaine UTC », « Trouvailles restantes : 3 ».
- Au plafond : « Plafond atteint, ça repart la semaine prochaine (UTC). »
  La mise en avant du gain et les invitations à changer la durée, le rang ou
  la vérification disparaissent ; la règle reste consultable.

Tous ces textes sont traduits en FR / EN / ZH et paramétrés. Les nombres de
l'exemple viennent du serveur ; aucune nouvelle règle numérique n'est copiée
dans le client. La conversion d'un FB en 100 000 000 sats sert uniquement au formatage.

## Implémentation

- `expeditions-ui.js` : suppression des seuils locaux de durée et de rareté ;
  validation du payload complet, comparaison au rang serveur et formatage FB localisé.
- `app.jsx` : transporte la règle et le compteur dans `g.expDust`. État initial
  et rechargement à `null` ; la règle n'est pas restaurée depuis une ancienne
  sauvegarde locale. Les réponses d'un ancien compte restent écartées.
- Le claim applique immédiatement son compteur serveur, même si le GET de
  rafraîchissement échoue. Aucun calcul local du nombre de trouvailles.
- `expeditions.jsx` : bloc absent avant réception de données complètes et valides,
  compteur et conditions explicites, plafond prioritaire. Le butin affiche le
  montant réel du claim en FB, sans lui substituer le montant de la règle courante.
- `i18n.js` : clés génériques `EXP_DUST_NEEDS_H` et `EXP_DUST_NEEDS_RARITY`,
  règle et nouveaux textes dans les trois langues.

## Build et validation

- `npm ci --no-audit --no-fund` réussi ; aucune dépendance ajoutée.
- `npm run build` réussi : 28 écrans régénérés par le pipeline, dont
  `build/expeditions.js` et `build/app.js`, avec `build/sources.json`.
  `asset-hashes.js` régénéré à contenu identique ; aucun build édité à la main.
- Version de cache 426 → 427 dans `index.html`, `data.js`, `sw-policy.js`,
  `manifest.webmanifest`, `version.json` et les deux assertions correspondantes.
- Tests ciblés : 63/63 réussis. Les tests existants de rareté conservent leurs cas
  Épique/Légendaire, équipe incomplète et rang inconnu avec un seuil serveur injecté.
- Nouveau test de rendu JSX et des actions : FR/EN/ZH, valeurs serveur alternatives,
  champs manquants, 8/12 h, rang, vérification, plafond, montant réel du claim,
  compteur après échec réseau, garde de session et rechargement.
- `npm test` : **1 353 tests, 1 347 réussis, 6 ignorés, 0 échec**.
  Aucun faux rouge SRI rencontré ; aucun fichier `vendor/` modifié.
- `git diff --check` propre ; revue indépendante des sources sans anomalie relevée.

`BRIEF.md`, déjà modifié à l'arrivée, est conservé hors commit.
