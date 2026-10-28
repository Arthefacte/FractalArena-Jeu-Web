# MISSION — lot « Arène unifiée » : le joueur tire aussi des équipes d'AGENT

Repo : `Arthefacte/FractalArena-Jeu-Web` (client web). Branche : `Arthefacte/arene-unifiee-agent`, base `origin/main`.
Worktree : tu travailles DANS le checkout fourni. Ne touche à aucun autre dossier.

## Contexte (le serveur est déjà écrit, sa PR est en brouillon)

Le serveur `Arthefacte/FractalArena` porte le ladder unifié agents + humains (PR #266, branche
`Arthefacte/ladder-unifie`, CI verte, brouillon). Décision du créateur du jeu : **parité complète** —
un agent est un joueur, mêmes règles d'attaque et de défense.

Ce que le serveur fait déjà, et que tu dois CONSOMMER tel quel (ne réinvente aucun nom de champ) :

1. `GET /pvp/opponents` publie désormais des défenses d'agent MÊLÉES aux défenses humaines, chaque
   carte portant EN PLUS : `opponent_kind` (`"agent"` | `"human"`) et `attack_path`
   (`"agent"` | `"wallet"`). Une carte d'agent porte `agent: true`, son `opponent_id` est l'uuid de
   l'agent, et ses champs habituels (name, rating, league, power, team, out_of_band) restent là.
2. `POST /pvp/attack` accepte l'uuid d'un agent comme `target` : le serveur **délègue tout seul**
   au chemin croisé. Réponse de même forme que pour un humain (`ok`, `win`, `points`… ). Ne PAS
   appeler `/pvp/attack-agent` depuis le client : la délégation suffit et évite deux chemins.
3. Codes d'erreur du chemin croisé, à AFFICHER en clair (jamais un « error » nu) :
   `agent_introuvable` (404), `auto_attaque_interdite` (400 — l'agent du wallet de l'appelant),
   `cooldown_couple` (429 — ce couple s'est déjà rencontré dans les 48 h),
   `defense_tombee` (409), `defense_modifiee` (409), `saison_pas_demarree` (403), `pas_de_defense` (403).
   Les codes existants côté humain (`rate_limited`, `session_expiree`, `solde_insuffisant`,
   `pas_de_ticket`, `quota_epuise`) gardent leur traitement actuel.
4. Un agent n'a PAS de revanche (il ne choisit pas ses adversaires) : aucun bouton revanche sur une
   carte d'agent, même si une adresse traîne dans la liste locale.

## Contrat à respecter (contraintes du dépôt)

- Lis d'abord `arene.jsx` (`carte`, ~ligne 500) et `app.jsx` (`pvpAttack`, ~ligne 3100) : le client
  envoie `target = o.opponent_id || o.wallet` et lit déjà `o.team`, `o.rating`, `o.league`,
  `o.power`, `o.out_of_band`. Ta tâche est d'AJOUTER le marquage, pas de refaire la carte.
- **Les libellés vivent dans `i18n.js`, en FR/EN/ZH** (jamais dans le composant). Ajoute les clés
  neuves nécessaires — une étiquette « agent » sur la carte, et un message par code d'erreur
  nouveau. Ajoute aussi leurs entrées au test de parité de langues s'il existe.
- **Bump de version obligatoire** : `index.html` (tous les `?v=NNN`), `data.js` (`FA_ASSET_V`),
  `version.json`, `sw-policy.js` (`fa-vNNN`), `manifest.webmanifest`, et le littéral de
  `test/account-wiring.test.js`. Prends le numéro libre AU-DESSUS de `origin/main` au moment de
  pousser (d'autres sessions bumpent en parallèle). Relis `git show origin/main:version.json` juste
  avant le push : si quelqu'un a pris le tien, re-bumpe.
- `npm run build` (régénère `build/*.js` + `asset-hashes.js`) puis `npm test`, et **`git add`
  APRÈS le build** — sinon les artefacts régénérés restent hors du commit et la CI tombe.
- N'ajoute aucun fichier de prévisualisation (`preview-*.html`) au commit.
- Avant `npm ci`/`npm test` : `unset NODE_ENV` (les deps sont en devDependencies).

## Livrable — non négociable

Commits sur la branche + **push + PR ouverte vers `main`** (titre en français, corps expliquant ce
que le joueur voit de neuf). Termine par un rapport court : ce que tu as changé (fichiers), le
numéro de version pris, le compte exact de tests (`tests / pass / fail`), et l'URL de la PR.
Si une suite est rouge, tu la corriges ou tu nommes précisément la cause — tu ne pousses pas rouge.

Écris tes notes d'avancement au fur et à mesure dans `NOTES-ARENE-UNIFIEE.md` à la racine du
worktree : une reprise doit être possible en lisant ce seul fichier.
