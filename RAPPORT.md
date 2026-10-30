# Rapport — Wallet : cycle de cagnotte clôturé et part figée

Branche : `Arthefacte/wallet-cycle-cloture-2` — cible : `main`, sans fusion.

## Changement

Le panneau cagnotte du Wallet lit les indicateurs déjà reçus dans `pot.eligibility` :

- `cycle_closed === true` et `paid_out === false` : la phrase de fenêtre est remplacée par la date de clôture, le nombre de jours validés figé et la mention du tirage en attente.
- `paid_out === true` : une ligne discrète indique le tirage effectué, la part envoyée et le redémarrage au prochain FA versé. Cet état est prioritaire et masque les deux anciennes phrases de fenêtre.
- Cycle ouvert ou ancien payload : l'affichage existant est conservé, y compris la borne de fin exclusive du serveur.

Les deux nouvelles clés `POT_CYCLE_CLOSED` et `POT_CYCLE_PAID_OUT` sont traduites en FR/EN/ZH dans `i18n.js`. La clôture utilise directement `eligibility.cycle_closed_at`, formaté avec `toLocaleDateString()`, et `eligibility.days_qualified`, sans recalcul ni utilisation de la borne exclusive comme date de clôture.

La phrase de clôture exige une date lisible et un nombre entier de jours non négatif. Zéro est accepté ; une valeur absente, nulle ou invalide conserve la fenêtre historique. Aucun nouveau helper, aucune nouvelle requête, aucun changement des compteurs, des montants ou des règles serveur.

## Build et cache

- Dépendances installées avec `npm ci --no-audit --no-fund`, sans changement de dépendance.
- `npm run build` : 28 écrans et 17 empreintes d'assets régénérés par le pipeline du dépôt ; aucun fichier de `build/` édité à la main.
- `build/screens.js` et `build/sources.json` changent ; `build/app.js` et `asset-hashes.js` sont régénérés à contenu identique.
- Version du cache 429 → 430 dans `index.html`, `data.js`, `sw-policy.js`, `manifest.webmanifest`, `version.json` et les assertions existantes de `test/account-wiring.test.js`.

## Vérification

- `npm test` : **1 362 tests, 1 356 réussis, 6 ignorés, 0 échec**. Aucun faux rouge SRI Windows rencontré.
- Revue indépendante du diff : aucune anomalie relevée.
- Harnais temporaire exécutant les vrais composants Wallet et PotLigne transpilés par Babel : **99 rendus validés** (33 payloads × FR/EN/ZH). Cas vérifiés : ouvert, clôturé avec 5 ou 0 jours, payé prioritaire même sans date/jours, ancien serveur, borne exclusive, champs manquants, nuls et invalides.
- Chaque rendu contient une seule phrase de fenêtre/statut. Aucun placeholder, `undefined`, `NaN` ou date invalide dans cette phrase. Tous les autres appels i18n, arguments et textes sont comparés au composant de départ et restent identiques, notamment les compteurs, la progression et le dernier tirage.
- Le harnais jetable est conservé dans le dossier temporaire système : `wallet-cycle-render-review.cjs`. Il n'est pas ajouté au dépôt.
- `node tools/asset-hashes.mjs --check` et `git diff --check` réussis.
- Validation du rendu par harnais ; aucune inspection visuelle dans un navigateur.

Les modifications préexistantes de `BRIEF.md` et le dossier non suivi `mcp/` sont conservés hors commit.

Commit demandé : `feat(wallet): la cagnotte dit quand son cycle est cloture et sa part figee`.
