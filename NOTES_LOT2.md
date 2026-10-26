# Arène V2 — lot 2

## Périmètre

Client uniquement, sur `Arthefacte/arene-v2-client`, à partir du contrat du brief.
Le serveur V2 (PR serveur #255) n'est pas disponible : aucun appel à une API réelle dans les tests.
Aucun changement aux écrans Fosse, Forge, Boutique, Tour ou campagne.

## Réalisé

- Entrée explicite pour `404 pas_de_fantome`, avec deux boutons vers la sélection d'équipe ; chargement et erreur réseau distincts, adversaires masqués tant que la défense n'est pas confirmée.
- Une liste de six cartes maximum ; suppression des groupes, états et discours de défense implicite.
- Défense posée et PV serveur, barre accessible, soin protégé contre les doubles clics et resynchronisation du solde par `/save`.
- Défense tombée : attaque/revanche/soin bloqués, compte à rebours chaque seconde, une relecture serveur à l'échéance. Zéro PV reste tombé sans déduire de relève locale.
- Messages FR/EN/ZH ; plafond par couple et prix du soin lus dans `/pvp/cadence`. Le 429 `plafond_couple` est conservé.
- Tests purs, tests de source adaptés à la décision Arène V2, actions isolées avec réponses en mémoire et sans réseau.

## Validation

- Disque avant installation : 1 241 223 168 octets libres ; environ 1,18 Go après installation.
- `NODE_ENV` vidé avant `npm ci --no-audit --no-fund`. Premier essai bloqué par les permissions du cache npm ; relance autorisée réussie (23 packages).
- Référence avant changements rejouée avec les dépendances installées : **1 250 tests, 1 244 réussis, 6 ignorés, 0 échec**. Les fichiers de travail ont été sauvegardés puis restaurés après ce contrôle.
- Actions V2 isolées : 6 tests réussis. Suite Arène intermédiaire : 67 tests, 64 réussis, 3 ignorés, aucun échec.
- Étape fonctionnelle verte : `npm run build` réussi (28 écrans), puis suite complète : **1 269 tests, 1 263 réussis, 6 ignorés, 0 échec** (+19 tests). `git diff --check` nettoyé.

## Prévisualisation locale

`preview-arene-v2.html` reprend le CSS, les classes et les images du dépôt : entrée sans défense, défense entamée/soin, défense tombée/compte à rebours et carte d'adversaire.
FR/EN/ZH, soin simulé et variante zéro PV sans échéance. Les montants sont des fixtures locales, aucun appel API.
**Ce fichier est un outil de travail et reste hors commit.** Le brief reste également local.
Contrôle statique réussi (scripts, ressources et clés). Contrôle visuel non effectué : Computer Use a été arrêté car il ne pouvait pas déterminer l'URL active de Chrome avec certitude.

## Simplifications et questions ouvertes

- Le contrat donné omet `power` des cartes d'adversaires mais exige le ratio existant. Celui-ci est conservé si la valeur est fournie ; sinon puissance « — », aucun ratio inventé. À confirmer côté serveur avant fusion.
- Le drapeau de résultat `elo: false` reste pris en charge avec un message générique de combat hors classement, sans l'associer à une défense implicite.
- Si `/save` échoue après un soin confirmé, les PV restent confirmés ; le solde attend la prochaine synchronisation. Aucune soustraction locale.
- Aucun test d'intégration contre le serveur V2 avant sa disponibilité. PR cliente à maintenir en draft jusqu'à validation du contrat et de la preview.

## Livraison

- Versions distantes vérifiées après `git fetch origin` : maximum 408. Version libre candidate : 409, à revérifier avant livraison.
- Aucun merge et aucun push sur `main`.
