# Notes — lot « Arène unifiée » (client web)

Branche : `Arthefacte/arene-unifiee-agent` · base `origin/main` · worktree
`C:\Users\PC\orca\workspaces\fractal-arena-web\arene-unifiee-agent`.

## Journal

### 1. Lecture (brief, arene.jsx, app.jsx, i18n.js, serveur en lecture seule)

- `arene.jsx` : la carte est la fonction locale `carte(o)` (~l.500). Elle lit déjà
  `o.opponent_id || o.wallet` comme cible, `o.name`, `o.league`, `o.rating`, `o.power`,
  `o.team`, `o.out_of_band`, et décide la revanche sur `pvp.revanches`.
- `app.jsx` : `pvpAttack(target, entry, attackers, posture)` (~l.3100) poste sur
  `/pvp/attack` avec `target` tel quel et remonte `j.error` brut → les nouveaux codes
  serveur arrivent donc déjà dans `I18N.localizeServerError`.
- `i18n.js` : `SERVER_ERROR_KEYS` (code serveur → clé) + `T` (FR/EN/ZH). Déjà mappés :
  `auto_attaque_interdite`, `defense_tombee`, `saison_pas_demarree`, `pas_de_defense`,
  `rate_limited`, `session_expiree`, `solde_insuffisant`, `pas_de_ticket`, `quota_epuise`.
  Manquants : `agent_introuvable`, `cooldown_couple`, `defense_modifiee`.
- PHP lu côté serveur (`ladder-unifie`, LECTURE SEULE, pour vérifier le contrat) :
  - `/pvp/opponents` sert les cartes d'agent avec `agent: true`, `opponent_kind: "agent"`,
    `attack_path: "agent"`, `opponent_id` = uuid, `team` DÉJÀ résolue, `league: null`.
  - `/pvp/attack` délègue à `ladder-cross.attackAgentTeam` quand `resoudreRef` rend null.
  - **`/pvp/defense/:ref` ne connaît PAS les agents** : `resoudreRef` rend null sur un
    uuid → 400 `wallet_invalide`. Conséquence client : `onPickOpponent` ne doit PAS
    appeler `pvpDefenseOf` sur une carte d'agent (sinon « Adversaire invalide. » et
    aucun combat possible) — la carte porte déjà l'équipe affrontée.
  - Posture d'agent jamais exposée → « Posture inconnue » dans la modale (correct).

### 2. Baseline tests avant travaux

`npm test` (NODE_ENV désarmé) : **tests 1321 / pass 1315 / fail 0 / skipped 6**.

### 3. Travaux

(à compléter)
