# Rapport — Dépôts FA et FB explicites dans le Portefeuille

Branche : `Arthefacte/depot-fb-ui` — cible : `main`, PR à ouvrir sans fusion.

## Résultat pour le joueur

Le dépôt général propose deux portes : « FA · BRC-20 FRACTALARENA » et « FB · natif (sats) ». Aucun formulaire ni adresse n'est affiché avant le choix. Une seule porte affiche ensuite ses consignes, l'adresse complète du pool et son champ TXID. Changer d'actif vide le TXID ; pendant la vérification, le choix et la saisie sont verrouillés.

La porte FB indique l'envoi depuis le wallet lié, le minimum du brief (100 000 sats = 0,001 FB) et les 3 confirmations requises. Elle appelle `POST /verify-deposit-fb` avec `{ wallet: g.wallet, txid }` et le jeton Bearer. Le toast de succès affiche directement `credited_sats` et `fb_sats` renvoyés par le serveur, sans conversion, addition locale ni crédit FA.

Les douze statuts demandés sont couverts : `ok`, `already_used`, `wrong_recipient`, `sender_unverified`, `sender_mismatch`, `tx_pending`, `tx_unconfirmed`, `below_minimum`, `invalid_amount`, `no_account`, `onchain_unavailable`, `deposits_disabled`. Le minimum d'un refus vient de `minimum_sats`. Les erreurs inconnues ont un message traduit, jamais le code brut.

Le bouton « Déposer du FB » de l'encart Portefeuille ouvre désormais `DepositModal` avec FB sélectionné, via `FbCaseModal`. Le bouton général s'appelle « Dépôt FA / FB ». La Boutique conserve son renvoi vers le Portefeuille et ne contient aucun formulaire de dépôt.

La porte FA conserve `/verify-deposit`, le payload authentifié, les consignes, `actions.deposit(data.credited)` et les messages de succès/refus existants.

## Rafraîchissement confirmé avec l'utilisateur

Contrairement au brief initial, Wallet écoutait déjà `fa:fb-liquidity` pour relire `/fb`. Après accord explicite de l'utilisateur, ce listener est réutilisé tel quel. Le succès FB émet l'événement une fois. Aucun nouveau mécanisme de rafraîchissement n'est ajouté.

## Fichiers

- `screens.jsx` : choix de l'actif, route FB, messages, événement et accès direct depuis l'encart FB.
- `i18n.js` : libellés et messages FR/EN/ZH.
- `test/deposit-modal.test.js` : 19 tests exécutant les vrais composants extraits de la source et du build, transpilés avec Babel puis évalués dans `vm`.
- `test/wallet-fb-card.test.js` : description de la rangée dépôt/retrait adaptée au dépôt FA/FB.
- `version.json`, `data.js`, tous les `?v=` de `index.html`, `manifest.webmanifest`, `sw-policy.js`, `test/account-wiring.test.js` : version 460 → 461.
- `build/screens.js` et `build/sources.json` : régénérés par `npm run build`.
- `RAPPORT.md` : présent rapport.

Les autres fichiers de build et `asset-hashes.js` sont régénérés à contenu identique. Les fichiers modifiés sont en CRLF. Les changements préexistants de `BRIEF.md` et le dossier non suivi `mcp/` restent hors commit.

## Vérifications

- `npm ci --no-audit --no-fund` : réussi, aucune dépendance modifiée.
- `npm run build` : réussi, 29 écrans transpilés et 17 empreintes d'assets produites.
- Tests ciblés (`deposit-modal`, `wallet-fb-card`, `boutique-depot`, `account-wiring`) : **51 réussis, 0 échec**.
- `npm test` avant commit : **1 446 tests, 1 440 réussis, 6 ignorés, 0 échec** (19 063,8016 ms).
- Les 6 tests ignorés sont les contrôles existants dépendant des sources du dépôt serveur (arène et forge), absentes de ce dépôt web.
- Vérifications du nouveau harnais : choix exclusif, adresse et consignes propres à l'actif en trois langues ; routes, Bearer et wallet ; montants serveur exacts ; chaque statut FB dans les trois langues ; anciens traitements FA ; erreurs réseau/HTTP/inconnues ; TXID invalide ; changement d'actif et verrouillage pendant l'envoi ; accès depuis l'encart FB ; relecture authentifiée de `/fb` sur succès et retrait du listener au démontage.
- `node tools/asset-hashes.mjs --check` : réussi après le build, 17 modèles à jour.
- `git diff --check` : réussi.

## Limites

Les requêtes des tests sont simulées. Aucun transfert réel, crédit en production ou appel authentifié au serveur n'a été effectué. La récupération effective du dépôt de 0,5 FB signalé dans le brief n'a donc pas été vérifiée. Le minimum initial affiché reprend la valeur du brief ; un refus affiche le minimum retourné par le serveur. Le rendu a été contrôlé par le harnais de composants, sans inspection visuelle dans un navigateur.
