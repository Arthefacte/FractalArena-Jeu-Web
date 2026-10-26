# Arène V2 — lot 3a : provenance de la défense

## Périmètre

Client uniquement, branche `Arthefacte/arene-v2-provenance`, base `origin/main`
(`bbd066e`, v409). Le brief `BRIEF_ARENE_LOT3A.md` reste local.
Livraison prévue en PR draft, sans fusion.

## Référence avant changements

- `git fetch origin` effectué ; la branche de travail et `origin/main` sont alignées.
- `node_modules` déjà peuplé : aucune installation de dépendances.
- Disque vérifié : environ 35 Go libres.
- Premier `npm run build` réussi : 28 écrans transpilés, 16 empreintes générées.
- Suite complète avec `NODE_ENV` vidé et sortie redirigée directement dans
  `C:\Users\PC\AppData\Local\Temp\ar_v2_prov_before.log` : **1 269 tests,
  1 263 réussis, 6 ignorés, 0 échec**.

## Réalisé

- L'invitation rouge dépend de l'absence de défense posée, même si la sélection
  est vide ou différente. Le toast de pose reste conditionné aux trois sélections.
- La carte affiche la date locale de pose au format court FR/EN/ZH lorsqu'elle
  est disponible, puis les noms (personnalisés compris) du snapshot enregistré.
- Le signalement `stale` est rendu même sans les nouveaux champs. Contrairement
  à l'hypothèse du brief, ce signalement n'était plus présent dans le client initial.
- Le bandeau apparaît seulement si les deux puissances sont numériques et finies
  et si `best_power > power * 1.25`. L'égalité à 25 % ne déclenche pas l'alerte.
- Les champs absents ou invalides ne créent ni date de remplacement ni alerte.
  L'action de lecture conserve déjà les nouveaux champs via la réponse serveur.
- Les en-têtes PvP et classement n'annoncent plus des ligues. Les badges restent
  en place ; aucun autre libellé existant n'a été reformulé.
- Quatre nouvelles clés FR/EN/ZH, parité étendue, 13 tests supplémentaires :
  helpers, rendu simulé, clics, sélection distincte du snapshot et transport API.

## Choix et points ouverts

- **Top-3 : repli vers Équipe.** Le store expose `toggleSelect` pour un choix
  individuel, mais aucune action top-3 et aucun score individuel de puissance PvP
  garanti. Les deux boutons du bandeau ouvrent donc Équipe ; aucun trio n'est
  choisi et aucune défense n'est posée automatiquement. C'est le repli prévu au brief.
- Le contrat des nouveaux champs provient du brief (PR serveur #256).
  Aucun appel à l'API réelle ni validation d'intégration serveur dans ce lot.
- La prévisualisation doit encore être revue visuellement : Computer Use s'est
  arrêté parce qu'il ne pouvait pas déterminer l'URL active de Chrome avec assez
  de certitude. Aucun contrôle visuel réussi n'est revendiqué.

## Prévisualisation locale

`preview-arene-v2.html` actualisé avec six états : entrée, défense datée avec noms
et sélection vide, défense tombée, adversaire précédé du bandeau d'avertissement,
ancien serveur sans champs facultatifs, défense périmée. Les helpers de date et
de seuil sont ceux du client ; les données et actions restent simulées.

Contrôle statique réussi : scripts valides, ressources locales présentes, clés
FR/EN/ZH et six sections. Le fichier est ignoré par Git et reste **hors commit**.

## Validation et version

- Build après éditions fonctionnelles réussi : 28 écrans, 16 empreintes.
- Suite intermédiaire complète dans `ar_v2_prov_step1.log` : **1 282 tests,
  1 276 réussis, 6 ignorés, 0 échec** (+13 tests).
- Revue indépendante des changements : aucun défaut bloquant relevé.
- Second `git fetch origin`, 18 références distantes examinées : maximum v409,
  dont `origin/main`. Version libre retenue : **v410**.
- Les cinq marqueurs sont alignés (`index.html`, `data.js`,
  `manifest.webmanifest`, `sw-policy.js`, `version.json`), ainsi que les deux
  littéraux de `test/account-wiring.test.js`.
- Build après bump réussi (28 écrans, 16 empreintes), puis suite complète dans
  `C:\Users\PC\AppData\Local\Temp\ar_v2_prov.log` : **1 282 tests,
  1 276 réussis, 6 ignorés, 0 échec**. `git diff --check` réussi.
- L'ajout à l'index suit ce build ; le bump accompagne le commit des fichiers
  servis pour respecter le contrôle de cache-busting par rapport au parent.
