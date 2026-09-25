# Audit complet 2026-09 — D10, client web

Dépôt audité : `Arthefacte/FractalArena-Jeu-Web` (`main` @ `442b66e`, v293).
Dépôt serveur lu **en lecture seule** pour vérifier chaque règle : `Arthefacte/FractalArena` (`main` @ `9786f04`).
Cadre : `docs/audit-complet-2026-09/CONTRAT.md` et `D10.md` du dépôt serveur. Aucune requête vers la production, aucune écriture côté serveur.

## Verdict en bref

- **Point 1 (confiance accordée au client) : le client ne décide d'aucune valeur économique.** Chaque combat (Fosse, Arène, Campagne, Tour), chaque tirage (forge, invocations, expéditions), chaque récompense (quêtes, quiz, connexion, découverte, airdrop) et chaque mouvement de FA (marché, dépôt, retrait) est recalculé côté serveur. `POST /save` ignore soldes, tickets, créatures et quotas. Le moteur de combat client a été retiré : les écrans rejouent seulement les `events` serveur. Il reste trois règles serveur contournables en appelant l'API directement (Tour, Arène, plafond de la Fosse) et un champ libre (`ordinal_name`). Aucune ne vole de fonds, ce sont des décisions produit.
- **Le risque le plus grave est le vol du jeton, pas un calcul client.** Un jeton de session de **compte généré sans portefeuille lié** suffit à vider le compte (E1). Aucun XSS exploitable n'a été trouvé dans le client, mais le jeton de ces comptes vit en `localStorage` : extension malveillante, poste partagé ou futur XSS suffisent.
- **XSS : rien d'exploitable.** Seul point d'insertion HTML : le QR de liaison (`screens.jsx:1851`), produit sans texte injecté. La CSP interdisait déjà les scripts en ligne ; elle autorisait encore tout `unpkg.com`, c'est corrigé dans cette PR.
- **Build = source**, **aucun secret**, **service worker sans risque de version bloquée**.

## 1. Périmètre réellement lu

**Lus en entier (client) :**
- `app.jsx` (3 283 lignes), `screens.jsx` (2 064), `components.jsx`, `data.js`, `cosmetic.js`, `talents-data.js`.
- Écrans : `arene.jsx`, `arene-battle.jsx`, `campaign.jsx`, `tour.jsx`, `fosse.jsx`, `champion.jsx`, `cinematique.jsx`, `expeditions.jsx`, `quiz.jsx`, `account.jsx`, `buyback.jsx`, `login.jsx`, `link.jsx`, `referral.jsx`, `chat.jsx`, `roomchat.jsx`, `market.jsx`, `leaderboard.jsx`, `quests.jsx`, `guide.jsx`, `tutorial.jsx`, `pwa.jsx`, `core-viewer.jsx`, `relic-viewer.jsx`.
- Modules `*-ui.js` : `account-ui`, `arene-ui`, `champion-ui`, `tour-ui`, `expeditions-ui`, `quiz-ui`, `pot-ui`, `totem-ui`, `finisher-ui`, `forge-ui`, `forge-cine-ui`, `market-ui`, `lb-live-ui`, `talents-ui`, `referral-ui`, `guide-ui`, `pwa-ui`, `juice-ui`, `chain-bg-ui`, `tape-ui`, `device-link-ui`, `dex-ui`.
- Autres modules : `diag.js`, `loop.js`, `juice.js`, `sfx.js`, `finisher.js`, `chain-bg.js`, `forge-cine.js`, `totem-cine.js`, `core-*.js`, `relic-*.js`.
- Démarrage et service worker : `asset-hashes.js`, `boot-hash.js`, `boot-splash.js`, `frame-guard.js`, `sw.js`, `sw-policy.js`, `sw-register.js`.
- Fichiers de page et de publication : `index.html`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, `llms.txt`, `Caddyfile`, `.gitignore`.
- Outils et CI : `tools/precompile.mjs`, `tools/asset-hashes.mjs`, `.github/workflows/tests.yml`.
- Pages hors périmètre lues pour le point 5 : `_cine-test.html`, `_chain-bg-proto.html`, `_forge-cine-proto.html`, `docs/cloudflare-migration*`.

**Lus partiellement (dit franchement) :**
- `i18n.js` (1 662 lignes, presque uniquement des chaînes) : en-tête, fin de fichier et tous les commentaires. Pour le reste, recherche de balises HTML, d'URL et de mots sensibles (seuil, anti-triche, admin, secret, ban…), sans relecture ligne à ligne.
- `_rarete-proto.html`, `_totem-cine-proto.html`, `_bake/*.html` : lus par recherche seulement (hors périmètre).
- Bibliothèque QR vendorisée : seules `createSvgTag` et `escapeXml` ont été lues.

**Serveur, lu pour vérification :**
- En entier : `auth.js`, `device-link.js`, `names.js`, `login.js`, `referral.js`, `chatroom.js`, `chat-support.js`, `deposit.js`, `market.js`, `talents.js`, `fight.js`, `pvp.js`, `campaign.js`, `tower.js`, `agent-fosse.js`, `champions.js`, `expeditions.js`, `expedition-guard.js`, `quiz.js`, `totem.js`.
- Par extraits ciblés (routes appelées par le client) : `server.js` (`/save`, `/withdraw`, `/verify-deposit`, `/claim-airdrop`, `/chat`, `/vanity/ordinal-names`, limiteurs), `accounts.js`, `forge.js`, `vanity.js`, `boosts.js`, `quests.js`, `discovery.js`, `lp.js`, `buyback.js`, `inswap.js`, `burn.js`, `engine.node.js`, `data.node.js`.
- Non lus : `withdrawals.js`, `balance.js`, `dex-autoconfirm.js`, `validate.js`, `save-shape.js`. Seules leurs entrées client ont été vérifiées ; aucun écran n'y envoie de montant qu'ils devraient recalculer.

**Hors périmètre, non audités :** `vendor/three-0.160.0`, `_bake/`, `_*-proto.html` (sauf ce qui est dit au F8), `build/*.js` (voir §4 pour la correspondance avec les sources).

## 2. Point 1 — ce que le client calcule et ce que le serveur recalcule

| Action (client) | Route, corps | Serveur |
|---|---|---|
| Fosse `app.jsx:1256` | `POST /fight {bet_tier, is_free, selected, use_locked, is_loop}` | Recalcule équipe (roster en base), ennemis, aléa, mise, gain, boosts, gratuits (`fight.js:196-526`). **`is_loop` est cru** → F4 |
| Arène `app.jsx:2627` | `POST /pvp/attack {target, entry, posture, attackers}` | Combat serveur, attaquants pris dans le roster, entrée débitée sous verrou (`pvp.js:338-378`). **`target` libre** → M3 |
| Campagne `app.jsx:2343` | `POST /campaign/fight {world_index, floor_index, selected, posture, champion_*}` | Étage déverrouillé vérifié, récompense en delta, auto-emprunt bloqué (`campaign.js:157-377`) |
| Tour `app.jsx:2425` | `POST /tower/fight {beast_ids, posture, champion_*}` | Étage, PV, paliers (`claimed_tiers` sous verrou) serveur. **Auto-emprunt non bloqué** → M2 |
| Expéditions `app.jsx:1731` | `start {destination, beast_ids, mode, duration_s, ticket}` / `claim` / `recall` | Listes blanches, taux figé serveur, tirage au claim, `claimed_at` anti double claim (`expeditions.js:315-624`) |
| Forge `app.jsx:1475-1697` | fusion, reroll, confirm, summon, fuse, equip, disenchant : **ids seulement** | Coûts, taux, tirages, propriété : tables serveur (`forge.js:356-1103`) |
| Talents, boosts, vanity | ids / type / nom | Coût et catalogue serveur (`talents.js:37-110`, `boosts.js:13-130`, `vanity.js:60-170`) |
| Quiz `app.jsx:2071` | `{question_id, choice}` | Correction serveur, PK (wallet, question). **Renvoie la bonne réponse** → F5 |
| Quêtes, découverte, connexion | `{quest_id}` / `{step}` / `{}` | Progression et montant recalculés sous verrou |
| Marché `app.jsx:2688-2716` | `list {price}`, `buy {listing_id}`, `cancel` | Prix borné 100 à 1 000 000, propriété, verrou anti double achat, liquide seulement (`market.js:75-290`) |
| Retrait `screens.jsx:1612` | `POST /withdraw {wallet, amount}` | Jeton `withdraw` (5 min), bornes 500 à 20 000, solde en base, destination = `linked_wallet` |
| Dépôt `screens.jsx:1546` | `POST /verify-deposit {wallet, txid}` | Vérification on-chain, expéditeur = wallet du jeton, doublons refusés |
| Autosave `app.jsx:465-493` | `POST /save/:wallet` (état complet) | Ignore `arte_*`, tickets, créatures, quotas, `airdrop_claimed` (`server.js:816-925`). **Écrit tel quel `ordinal_name`** → M5 ; `session_*`, `next_creature_id`, `lang` écrits mais sans effet économique |

Les soldes « optimistes » du client (`actions.deposit/withdraw`, `creditQuizGain`, déductions Arène et Tour) ne servent qu'à l'affichage : `/save` ne relit pas les soldes. Les tables dupliquées dans `data.js` / `talents-data.js` (probabilités, coûts, taux) correspondent au serveur, qui n'en lit jamais la valeur envoyée par le client. Quatre écarts d'affichage sont listés en F13.

## 3. Findings

Chaque finding donne : la sévérité, la référence `fichier:ligne`, le chemin d'exploitation et « vol de fonds direct oui/non ». Les références `server/…` renvoient au dépôt serveur, les autres au dépôt web.

### Élevé

**E1 — Un jeton de session volé vide un compte généré sans portefeuille lié.** Vol de fonds direct : **oui** (conditionné au vol du jeton).
- `server/accounts.js:239-288` : `/account/link-wallet` exige le jeton de session du compte plus une signature `withdraw` du **nouveau** portefeuille, que l'attaquant produit avec son propre portefeuille. La garde `linked_wallet IS NULL` empêche seulement de *changer* un portefeuille déjà lié. La même requête passe `onchain_verified` à TRUE et libère `locked_unverified` en liquide.
- Chemin d'exploitation :
  1. Obtenir `fa_auth_token`. Pour un compte généré, il est **toujours** en `localStorage` (`account-ui.js:53`) : extension, poste partagé, XSS futur.
  2. `GET /auth/challenge?wallet=<attaquant>&scope=withdraw`, signer, puis `POST /account/link-wallet` avec le Bearer volé.
  3. `/auth/challenge?…&account=<victime>` puis `/auth/verify` : un jeton `withdraw` est émis sur le compte victime (`server/auth.js:252`).
  4. `POST /withdraw` : les fonds partent vers `linked_wallet`, c'est-à-dire l'attaquant. Plafond 20 000 FA par 24 h, aucun délai après la liaison.
- Le commentaire client qui affirmait « ce jeton NE PERMET PAS DE RETIRER DES FONDS » était faux pour ces comptes. **Il est corrigé dans cette PR.** La correction du fond est côté serveur (domaine auth/comptes) et appartient à une décision produit, voir §6.

### Moyen

**M1 — La borne absolue de 90 jours du jeton se contourne par la liaison d'appareil.** Vol direct : non (prolonge E1 et M6 indéfiniment).
- `server/device-link.js:130` émet `issueToken(wallet, "session")` **sans** `orig_iat`, donc avec une borne remise à zéro. Or `/auth/device-link` n'exige qu'un jeton de session.
- Chemin : avec un jeton volé, générer un code, le réclamer, obtenir un jeton neuf avec 90 jours devant lui, et recommencer indéfiniment.
- Correctif serveur trivial (transmettre l'`orig_iat` du jeton émetteur), pas dans ce dépôt.

**M2 — Tour : s'emprunter soi-même son champion fait jouer deux fois la même bête.** Vol direct : non (émission de FA).
- `server/tower.js:379-442` n'a ni le contrôle `selected.includes(champ.beast.id)` de la Campagne (`server/campaign.js:207-213`), ni la garde d'expédition étendue au champion (`campaign.js:228`). Côté client, la seule protection est un filtre d'affichage (`champion.jsx:52-55`).
- Chemin : `POST /champion {beast_id: X}`, puis `/tower/start`, puis `/tower/fight {beast_ids:[X,Y], champion_owner_wallet:<soi>, champion_slot:2}`.
- Effet : équipe [X, Y, X] (relique comptée deux fois, synergie Duo), et X peut combattre alors qu'il est en expédition. Cela donne des paliers plus hauts et la dotation du top 10.
- Touche une règle de jeu : non corrigé ici. Avis : aligner sur la Campagne.

**M3 — Arène : cible libre et ligue figée en bronze sans défense posée.** Vol direct : non (classement et dotation de saison).
- `server/pvp.js:198-199` n'impose pas que `target` vienne de `/pvp/opponents`. La ligue n'est écrite que par `/pvp/defense` (`pvp.js:146-153`).
- Un joueur fort qui ne pose jamais de défense reste « bronze ». Il attaque avec son top 3 n'importe quel wallet faible et monte en ELO. Comme cible implicite, il ne perd jamais d'ELO.
- Décision produit (§6).

**M4 — Le message signé pour lier un portefeuille ne nomme ni le compte cible ni le site.** Vol direct : non.
- `server/auth.js:65-67`, `server/accounts.js:251`, `app.jsx:1104-1107`. Le texte signé est le même que pour un retrait ordinaire.
- Chemin (phishing) : l'attaquant fait signer à la victime ce texte « Fractal Arena — authentification » sur son propre site, puis le rejoue sur `/account/link-wallet` avec le jeton de **son** compte généré.
- Effet : le portefeuille de la victime est lié définitivement au compte de l'attaquant (index unique, déblocage par le support). Le compte de l'attaquant passe « vérifié » et son verrouillé est libéré.
- Correctif serveur : scope `link` distinct avec une ligne `account:`. Côté client, rien à changer : le client signe déjà tel quel le `message` fourni par le serveur.

**M5 — `ordinal_name` est libre (envoyé par `/save`) et affiché à tous les joueurs.** Vol direct : non (usurpation).
- Client : la liste de noms proposés est la seule barrière (`screens.jsx:1901` → `app.jsx:2328`).
- Serveur : stockage tel quel, seulement sans chevrons (`server/server.js:903`). La vérification on-chain ne tranche que les noms en `.fb` (`server/vanity.js:245`, `vanity.js:226-240`) : tout autre nom reste `ordinal_verified = NULL` et s'affiche (`server/names.js:34`).
- Chemin : `POST /save/<soi> {"ordinal_name":"Support FractalArena"}`. Le nom apparaît au classement, dans le chat, en PvP et sur les champions ; le titre payant à 1 000 FA est contourné.
- Aggravant : `server/lp.js:209-216` renvoie `ordinal_name` brut, sans `composeName` (ni filtre anti-lien, ni troncature, ni masquage).
- Pas de XSS : les chevrons sont retirés et le rendu React est textuel.

**M6 — Un jeton volé transfère le liquide de la victime par le marché.** Vol indirect : **oui**.
- `server/market.js:235-290` : l'attaquant met en vente un objet sans valeur à 1 000 000 FA, l'achète avec le jeton de la victime, reçoit 95 % du prix, puis retire depuis son propre compte.
- Vaut pour tout jeton volé, y compris UniSat : en onglet le jeton est en `sessionStorage`, en PWA ou sur appareil lié il est en `localStorage`. C'est la limite réelle du « jeton de portée session ».

### Faible

**F1 — Le rafraîchissement du jeton pouvait ressusciter une session fermée.** **Corrigé dans cette PR.**
- `account-ui.js`, intercepteur `installTokenRefresh`. Une réponse portant `x-fa-token-refresh`, arrivée **après** une déconnexion ou un changement de compte, réécrivait le jeton de l'ancienne session.
- Deux effets : le jeton déconnecté revenait en `localStorage` (poste partagé), et le compte B pouvait être écrasé par le compte A.
- Désormais, le jeton frais ne remplace que le jeton encore en place qui a porté la requête.

**F2 — La CSP autorisait tout `https://unpkg.com`.** **Corrigé dans cette PR.**
- `index.html:25`. Le SRI ne protège que les deux balises React présentes. Avec le domaine entier, une injection HTML (par exemple `<iframe srcdoc>`, qui hérite de la CSP) pouvait charger n'importe quel paquet npm servi par unpkg.
- La CSP ne liste plus que les deux chemins exacts.
- Vérifié dans Chromium : les deux fichiers React passent, `https://unpkg.com/autre@1/x.js` est refusé ; il était accepté avant.

**F3 — Lien d'appareil piégé (fixation de session).**
- `app.jsx:80-84`, `app.jsx:2880-2910`, `account.jsx:67-72`.
- Chemin : l'attaquant génère un code sur **son** compte et envoie `https://fractalarena.com/#link=CODE`. La modale nomme la session remplacée, jamais le compte rejoint ; via « Récupérer mon compte », un code collé est réclamé sans confirmation. La victime joue alors sur le compte de l'attaquant, ce qui devient dangereux combiné à M4.
- Les dépôts, eux, ne sont pas détournables : l'expéditeur on-chain doit égaler le wallet du jeton (`server/deposit.js:80-87`).
- Correctif : route d'aperçu non consommante qui affiche le compte cible avant réclamation. Cela change l'interface, donc non fait ici.

**F4 — Le plafond quotidien argent/or de la Fosse dépend du drapeau `is_loop` envoyé par le client.**
- `server/fight.js:105-120`, `fight.js:199-201`. Un script qui envoie `is_loop:false` n'est jamais plafonné (180 requêtes par minute seulement). Le commentaire « infalsifiable » est inexact.
- Chaque combat reste payé : l'impact dépend de l'espérance réelle de la Fosse. **À vérifier** : taux de victoire réel sur `fight_history`, et intention du plafond (anti-automatisation de l'interface ou plafond économique).

**F5 — Quiz : `/quiz/answer` renvoie la bonne réponse même en cas d'erreur, pour n'importe quel `question_id`.**
- `server/quiz.js:198` et `quiz.js:278-285`.
- Chemin : un compte reconstitue le corrigé des 100 questions, puis chaque autre compte fait 100/100 (1 000 FA verrouillés), puis des révisions à 500 FA verrouillés par jour.
- Verrouillé tant que le compte n'est pas vérifié : décision produit.

**F6 — Nonces d'authentification indexés par wallet seul.**
- `server/auth.js:39`, `auth.js:82`. N'importe qui écrase le nonce en attente d'une victime (`/auth/challenge?wallet=<victime>`) : déni de service sur la connexion, le retrait ou la liaison. Freiné par le limiteur IP.

**F7 — `GET /totem/:wallet` n'est ni authentifié ni validé, génère de l'art pour des tiers et renvoie `err.message` brut** (`server/totem.js:236-262`).

**F8 — Pages de prototype servies publiquement sur la même origine, sans CSP ni frame-guard.**
- `_cine-test.html:16-20` et `_totem-cine-proto.html:36-40` importent Three.js depuis unpkg **sans SRI**. Si ce paquet était compromis et qu'une victime ouvrait la page, le script lirait le `localStorage` de fractalarena.com (jeton des comptes générés).
- Hors périmètre de lecture, non modifié. Avis : supprimer ces fichiers ou les sortir de la publication.

**F9 — Chatbot support : tours `assistant` forgés.**
- `chat.jsx:96-110`, `app.jsx:1916-1926`, `server/chat-support.js:46-60`. Injection de prompt limitée à la conversation de l'attaquant ; le modèle n'a pas d'outils. Voir §5.

**F10 — Wallet complet exposé dans le salon et au parrain.**
- `server/chatroom.js:86-93` et `chatroom.js:149` : `GET /chat-room/messages` n'est pas authentifié. Même chose dans `server/referral.js:166`, affiché en repli à `referral.jsx:90`. Voir §5.

**F11 — `/vanity/ordinal-names/:wallet` n'est pas authentifié.** Son repli peut déclencher de nombreux appels UniSat pour un wallet chargé d'inscriptions (`server/server.js:2101-2139`). **À vérifier** : compter les appels sur un tel wallet.

**F12 — Identifiants lus sans `Object.hasOwn`.** `FIGHT_BETS[bet_tier]`, `BOOSTS_CONFIG[…]` et `DESTINATIONS[…]` acceptent `"constructor"`. Dans les chemins lus, cela se termine en 500 avec rollback. **À vérifier** : une expédition `"constructor"` avec ticket Or passe `/start` ; reste à savoir si `/claim` échoue et si le ticket est perdu (auto-nuisance seulement).

**F13 — Affichages qui divergent du serveur.**
- Coût du reroll : le client affiche `×(1+0,5n)` (`screens.jsx:606`), le serveur applique `[1 ; 1,5 ; 2,25 ; 3]` en comptant les essais abandonnés (`server/forge.js:535-552`).
- « Solde après achat » au marché calculé sur liquide + verrouillé, et `insufficient_liquid` non traité (`market.jsx:76`, `market.jsx:102`).
- `server/data.node.js:217-218` (1 000 / 5 000) contredit `vanity.js` (100 / 1 000). Le client affiche les valeurs réellement facturées.
- Clés `CORES` différentes, sans effet (`data.js:106-113`).

**F14 — Pas de version minimale imposée par le serveur (information).** Un onglet resté ouvert garde son code sans limite ; il obtient des 404 sur une route supprimée. Aucun chemin où une vieille version contournerait une règle, puisque le serveur fait foi (voir §4).

### Bugs fonctionnels relevés en passant (pas de sécurité, comportement visible, non corrigés)

- **`tour.jsx:198`** lit `g.onchainVerified` dans `TourResultModal`, où `g` n'existe pas (aucune variable globale `g`). Dès qu'un palier est atteint (`rewards.tiers` non vide), le rendu lève une `ReferenceError` : la modale de résultat plante. Introduit par `f98f66f`. **À corriger en priorité**, en passant `g` (ou le booléen) en prop.
- **`app.jsx:2617`** : `pvpDefenseOf` appelle `authHeaders()`, qui n'est pas défini dans sa portée (il est local aux actions voisines, l. 2603 et 2628). L'erreur est avalée, la posture revient toujours `null`, et `arene.jsx:36/59` peut réécrire « equilibre » par-dessus la posture choisie. Le correctif « audit 22/09 » ne fonctionne donc pas.
- Commentaires périmés « 30 jours » : `app.jsx:749`, `server/auth.js:239`. La vraie durée est 7 jours glissants, avec une borne de 90 jours.

## 4. Points 2, 4 et 5 du brief

**Stockage du jeton (point 2).**

| Cas | Stockage | Clé |
|---|---|---|
| Compte généré | `localStorage` (persistant) | `fa_auth_token` |
| Compte UniSat en onglet | `sessionStorage` (effacé à la fermeture) | `fa_auth_token` |
| Compte UniSat en PWA installée, ou appareil lié par QR (`fa_device_linked=1`) | `localStorage` (persistant) | `fa_auth_token` |

Voir `account-ui.js:52-85`.
- Le type de compte est dans `fa_account_kind`. Le jeton est exclu du blob de sauvegarde `fractal_arena_v1` (`app.jsx:435`).
- Validité : JWT HS256 de **7 jours** (et non 30), renouvelé en glissant après 1 jour, borne absolue de 90 jours contournable (M1). Il n'est **pas révocable** : pas de jti, pas de déconnexion serveur ; `disconnect()` n'efface que le stockage local.
- Ce qu'un XSS en ferait : lire le jeton (dans les deux stockages tant que l'onglet est ouvert), l'exfiltrer hors de la page — `connect-src` ne bloque pas une navigation ni une image —, puis :
  - vider un compte généré non lié (E1) ;
  - transférer le liquide par le marché (M6) ;
  - dépenser en jeu ;
  - prolonger l'accès indéfiniment (M1).
- Un retrait direct vers une adresse arbitraire reste impossible pour un compte UniSat ou un compte déjà lié : il faut une signature `withdraw` fraîche, et la destination est fixée par le serveur.
- Le wallet n'est jamais pris comme identité sans preuve : toutes les écritures prennent le wallet du jeton, ou exigent jeton = wallet du corps. Seules des lectures publiques prennent un wallet en URL.

**Cache-busting (point 4).**
- `?v=293` est écrit à la main sur toutes les balises d'`index.html` et sur le manifeste. La même valeur est dans `FA_ASSET_V` (`data.js:29`) et dans `CACHE` (`sw-policy.js:10`) ; des tests vérifient la concordance.
- Les `.glb` sont nommés par empreinte de contenu (`asset-hashes.js`), sauf `assets/cores/*.glb`, qui retombent sur `?v` (performance seulement).
- Le service worker ne met **rien** en cache d'abord : navigation en réseau d'abord (cache seulement hors ligne), tout le reste en réseau seul, API jamais interceptée, anciens caches purgés à l'activation, `skipWaiting` + `clients.claim`.
- Un joueur ne peut donc pas rester bloqué sur une vieille version au-delà du cache HTTP de GitHub Pages (environ 10 min, non mesuré en production), sauf un onglet jamais rechargé (F14).

**Bundle = source (point 4 bis).**
- 27 `.jsx` pour 27 `build/*.js`, sans fichier orphelin. `index.html` ne charge aucun `.jsx`.
- Une reconstruction dans une copie isolée donne un `diff -r build/` vide, et `asset-hashes --check` est à jour.
- La CI échoue si un `.jsx` est modifié sans rebuild (`test/precompile.test.js`).

**Code mort et secrets (point 5).**
- Aucun secret : ni clé API, ni jeton, ni WIF, ni mot de passe, ni route ou en-tête d'administration dans le code servi.
- `diag.js` n'envoie rien au serveur : rapport local à copier, sans jeton ni wallet.
- Tous les `.js` de la racine sont chargés. Seules les pages `_*.html` et `_bake/` ne servent à rien en production (F8).
- `docs/cloudflare-migration.md` cite un ID de zone tronqué et l'existence d'un jeton API Cloudflare, sans son contenu : rien d'exploitable, mais c'est retirable.
- Les commentaires publics exposent des règles déjà publiques (cagnotte, paliers LP), pas de seuil anti-triche.
- Le code servi ne contient ni `eval` ni `new Function` : le retrait de `'unsafe-eval'` tient.

## 5. Pistes transmises par D8

**XSS (hors `roomchat.jsx` l. 1-160 et `chat.jsx`, déjà vus par D8).**
- `roomchat.jsx` l. 160-229 : rendu textuel uniquement.
- Aucun `innerHTML` dans le client servi. Le seul `dangerouslySetInnerHTML` (`screens.jsx:1851`) insère le SVG de qrcode-generator, fait uniquement de balises et de coordonnées : l'URL encodée n'y est jamais recopiée.
- Tous les `href` construits le sont sur un préfixe fixe (`https://uniscan.cc/fractal/tx/` + txid serveur validé en 64 hex, `https://app.unisat.cloud/…`), donc aucun `javascript:` possible.
- Les `img src` passent par des tables (`D.artFor`) ou l'art du totem, restreint par `img-src`. Les attributs `title` sont posés par React, donc échappés.
- Le retrait des chevrons côté serveur n'est donc pas la seule barrière : aucune insertion en attribut ou en HTML n'existe côté client.

**Historique du chatbot — ce qu'exigerait côté client la correction « réponses signées HMAC » (non implémentée, décision produit).**
1. Stockage : passer à une clé versionnée (`fa_chat_v2:<wallet>`) où chaque tour `assistant` garde `{content, sig, ts, kid}` renvoyés par `/chat`, **sans jamais les modifier**.
2. Envoi : `callChat` (`app.jsx:1919-1921`) filtre sans reconstruire les objets, donc les champs partiraient déjà. Il faut le garantir par un test.
3. Réponses locales : le message d'erreur `CHAT_ERROR` (`chat.jsx:107-108`) et le texte de repli « support indisponible » du serveur sont aujourd'hui stockés comme tours `assistant`. Il faut les marquer `local:true`, les afficher et ne jamais les envoyer.
4. Tours `user` consécutifs (réponse perdue, limite de débit) : les fusionner avant l'envoi.
5. Migration : les anciens historiques ne sont pas signés. Soit on les garde à l'affichage sans envoyer leurs tours `assistant`, soit on les purge. Dans les deux cas, la fenêtre envoyée doit commencer par un tour `user` et s'aligner sur celle du serveur (20 tours, contre 40 gardés localement).

Côté serveur : HMAC sur `wallet ‖ ts ‖ sha256(contenu) ‖ sha256(tour user précédent)`, vérifié **avant** `sanitizeChatMessages`.

**Wallet dans le salon — ce qu'exigerait une migration vers un identifiant opaque (non implémentée).**
- Serveur (`chatroom.js:86`, `93`, `149`) : renvoyer `author` (HMAC tronqué du wallet ou `public_id` stocké) au lieu de `wallet`, et exposer son propre `author_id` au client, par exemple dans la réponse de `/save`.
- Client, `roomchat.jsx` :
  - l. 57 : `muted.includes(m.author)` ;
  - l. 82 : `m.author === myAuthorId`, nouvelle prop alimentée depuis `g` (l. 218) ;
  - l. 89 : `onMute(m.author)` ;
  - l. 179 : décompte des non-lus.
- Migration des sourdines, car `fa_muted:<wallet>` contient des adresses impossibles à convertir côté client. Deux options :
  - une période où le serveur renvoie `wallet` **et** `author`, pendant laquelle le client ajoute l'`author` de chaque message dont le `wallet` est en sourdine, avant de retirer `wallet` ;
  - ou une remise à zéro (`fa_muted_v2:`).
- **Condition nécessaire :** `composeName` retombe sur `shortWallet` (`server/names.js:47`, `names.js:50`). Sans changer aussi ce repli, le nom affiché continue de fuiter une partie du wallet.

## 6. Sortie finale

### 6.1 Findings par sévérité

1. **E1** (élevé, vol oui si jeton volé) : jeton de session d'un compte généré non lié → liaison du portefeuille de l'attaquant → retrait.
2. **M1** (moyen) : borne de 90 jours contournable par `/auth/device-claim`.
3. **M6** (moyen, vol indirect oui si jeton volé) : transfert par le marché.
4. **M4** (moyen) : signature de liaison sans compte ni domaine, donc liaison forcée par phishing.
5. **M5** (moyen) : `ordinal_name` libre, usurpation ; `lp.js` l'affiche brut.
6. **M2** (moyen) : auto-emprunt du champion dans la Tour.
7. **M3** (moyen) : Arène, cible libre et ligue bronze figée.
8. **F1 à F14** (faibles), plus trois bugs fonctionnels, dont un crash (`tour.jsx:198`).

### 6.2 Corrigé dans cette PR, et ce qui ne l'est pas

**Corrigé** (aucun changement visible pour le joueur, tests dans `test/audit-d10.test.js`) :
- **F1** — `account-ui.js` : le jeton rafraîchi n'est rangé que s'il remplace le jeton qui a porté la requête. 5 tests : cas nominal, déconnexion en vol, changement de compte en vol, en-têtes `Headers`, requête sans Bearer.
- **F2** — `index.html` : `script-src` limité aux deux URL React exactes. Test de concordance CSP ↔ balises ; vérification manuelle dans Chromium.
- Le commentaire faux d'`account-ui.js` sur la portée du jeton, remplacé par la description exacte d'E1 et M6.

**Non corrigé** :
- Tout le reste est côté serveur (E1, M1 à M6, F4 à F7, F11, F12), touche une règle de jeu, ou change l'interface (F3, bugs fonctionnels).
- F8 porte sur des fichiers hors périmètre.
- La version (`?v=293`) n'est pas incrémentée : `index.html` est servi en réseau d'abord, et `account-ui.js` sera repris au prochain bump de version (l'ancienne version reste fonctionnelle).

### 6.3 Décisions produit (une par ligne, avec mon avis)

- **E1** : exiger le code de récupération (ou une confirmation par un autre facteur) pour `/account/link-wallet`, et/ou un délai de 24 à 48 h entre la liaison et le premier retrait. *Avis : le code de récupération, c'est la seule preuve qu'un voleur de jeton n'a pas.*
- **M1** : transmettre `orig_iat` dans `/auth/device-claim`. *Avis : à faire tout de suite, sans effet pour le joueur.*
- **Révocation** : ajouter un `jti` ou un compteur de session en base pour permettre « déconnecter tous mes appareils ». *Avis : utile dès qu'un jeton persiste 90 jours.*
- **M6** : plafonner le prix d'une annonce en fonction de la valeur de l'objet, ou soumettre un gros achat à une confirmation fraîche. *Avis : confirmation `withdraw` au-delà d'un seuil.*
- **M4** : scope `link` distinct, avec le compte cible et le domaine dans le message signé. *Avis : oui, c'est un changement serveur isolé.*
- **M5** : refuser dans `/save` un `ordinal_name` absent de `/vanity/ordinal-names`, et faire passer `lp.js` par `composeName`. *Avis : oui.*
- **M2** : aligner la Tour sur la Campagne (refus de l'auto-emprunt en double, garde d'expédition). *Avis : oui, c'est clairement un oubli.*
- **M3** : imposer une cible issue de `/pvp/opponents` et dériver la ligue de l'équipe d'attaque. *Avis : oui, avant la prochaine dotation de saison.*
- **F4** : décider si le plafond argent/or est un plafond économique ; si oui, l'appliquer quel que soit `is_loop`.
- **F5** : ne renvoyer la bonne réponse qu'après une réponse juste, ou seulement l'explication. *Avis : oui, sinon le quiz est automatisable en FA verrouillés.*
- **F3** : afficher le compte cible avant de consommer un code de liaison.
- **F8** : retirer `_*.html` et `_bake/` de la publication.
- **Chatbot HMAC et identifiant opaque du salon** : voir §5. *Avis : l'identifiant opaque d'abord (vie privée), le HMAC ensuite (coût et prompt injection bornés à soi-même).*

### 6.4 Non vérifié, et pourquoi

- **Chargement réel de React depuis unpkg avec la nouvelle CSP** : unpkg est bloqué (403) par le proxy de la sandbox. La règle a été vérifiée dans Chromium avec des réponses simulées pour les mêmes URL. **À contrôler en production** après le déploiement : page d'accueil rendue, aucune erreur « Refused to load » en console.
- **Cache HTTP réel de GitHub Pages et Cloudflare** : aucune requête vers la production n'était permise.
- **F4** (espérance réelle de la Fosse) : demande `fight_history` en production.
- **F11** (nombre d'appels UniSat) : demande un wallet réel chargé d'inscriptions.
- **F12** (expédition `"constructor"`) : il faudrait lire `/expeditions/claim` sur ce cas précis.
- **Historique git public** : l'ancien `x-client-secret` y figure peut-être. Le clone est limité à 50 commits, et le serveur ne l'accepte plus de toute façon.
- **`i18n.js`** : parcouru par recherche, pas relu ligne à ligne (voir §1).
- **Modules serveur non lus** : `withdrawals.js`, `balance.js`, `dex-autoconfirm.js`, `validate.js`, `save-shape.js`.
