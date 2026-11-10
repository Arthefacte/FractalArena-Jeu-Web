# Rapport — Minage par détection seule, version 463

Branche : `Arthefacte/minage-detect` ; cible de livraison : PR vers `main`, sans fusion.

## Résultat

La saisie manuelle est supprimée : états, curseur, bornes, boutons, traductions, styles et tests du curseur.

Avec une carte reconnue, le joueur voit son modèle, le hashrate de la table, la jauge, ses probabilités, les FB attendus par jour et le temps moyen. Les 43 valeurs de la table sont conservées ; une phrase documente leur convention d'usine (clocks stock, médiane des relevés publiés pour SHA-256d, sans underclock ni overclock).

Sur téléphone ou dès que le renderer est absent, masqué ou non reconnu, l'écran affiche « Pas de carte graphique détectée » et le texte demandant d'ouvrir cet écran sur un ordinateur équipé d'une carte dédiée. Cet état ne contient ni chiffre, ni jauge, ni estimation, ni action. Les messages existent en FR, EN et ZH.

Le titre « Minage », l'entrée dans Plus et la mention de simulation sont conservés. Aucun backend ni appel réseau ajouté.

## Calibrage et formatage

- `GH_PAR_COMPTE` : **300 → 20 GH/s**.
- `COMPTES_FALLBACK` : **1 000** autres mineurs, toujours une hypothèse fixe.
- Constantes conservées : `BLOC_MS = 30000`, `BLOCS_PAR_JOUR = 2880`, `REWARD_FB = 6.25`.
- Probabilités arrondies à deux chiffres significatifs, sans seuil « < 0,1 % ». Pour respecter les exemples du brief, aucun zéro final n'est ajouté au-delà du millième sous 0,01 % : `0,030 %`, `0,006 %`, `0,002 %` ; une seconde décimale significative reste affichée si nécessaire (`0,0061 %`). Zéro, y compris `-0`, donne `0 %`.

| Carte | Part par bloc | Affichage | FB attendus/jour | Temps moyen |
| --- | --- | --- | --- | --- |
| 6 GH/s | 0,00029991002699190244 | 0,030 % | 5,398380485854244 | 1,1577546296296297 jour, affiché « 1 jour » |
| 12 GH/s | 0,0005996402158704777 | 0,060 % | 10,793523885668597 | 0,579050925925926 jour, affiché « 13 h 53 » |

Doubler le hashrate double approximativement la part et les FB attendus et divise l'attente moyenne par deux ; la puissance du joueur est incluse au dénominateur.

## Fichiers

- `minage.jsx` : détection seule, branche d'affichage dédiée quand aucune carte n'est reconnue.
- `minage-ui.js` : calibrage à 20 GH/s et formatage des petites probabilités.
- `gpu-hashrate.js` : convention d'usine et suppression des commentaires du mode manuel.
- `i18n.js` : messages FR/EN/ZH et retrait des anciens libellés.
- `styles.css`, `mobile.css` : présentation du message et retrait des styles manuels.
- `test/minage-ui.test.js` : calculs, formatage et composants extraits de la source et du build, transpilés avec Babel puis exécutés dans `vm`.
- `test/gpu-hashrate.test.js` : Apple GPU, Adreno (TM) 740 et Mali-G78 inconnus, sans exception.
- `version.json`, `data.js`, tous les `?v=` de `index.html`, `manifest.webmanifest`, `sw-policy.js`, littéraux de `test/account-wiring.test.js` : version **462 → 463**.
- `build/minage.js`, `build/sources.json` : régénérés.
- `RAPPORT.md` : présent rapport.

Les autres fichiers de build et `asset-hashes.js` sont régénérés à contenu identique. Les fichiers livrés sont en CRLF. Le BRIEF.md modifié avant intervention et le dossier non suivi mcp/ restent hors commit.

## Vérifications

- `npm ci --no-audit --no-fund` : réussi, 23 paquets installés, aucune dépendance modifiée.
- `npm run build` : réussi, **30 écrans** transpilés et **17 empreintes** d'assets produites.
- Tests ciblés minage, GPU et account-wiring : **39 réussis, 0 échec**.
- `npm test` sur les fichiers finaux en CRLF : **1 465 tests, 1 459 réussis, 6 ignorés, 0 échec**, durée **8 116,0238 ms**.
- Les 6 tests ignorés dépendent des sources du dépôt serveur (arène et forge), absentes de ce dépôt web.
- Tests de rendu sur source et build en FR/EN/ZH : carte reconnue ; Apple GPU, Adreno, Mali ; renderer nul ou vide ; modèle inconnu ; variante absente de la table. Aucun chiffre ni contrôle dans l'état sans carte ; mention de simulation conservée ; détection unique entre deux rendus.
- `git diff --check` : réussi ; aucune référence au mode manuel ne subsiste dans le code minage.

Le rendu est contrôlé par le harnais de composants, sans inspection visuelle dans un navigateur ni mesure sur du matériel physique.
