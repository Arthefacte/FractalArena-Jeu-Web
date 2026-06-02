# Handoff Claude Code — Fractal Arena

## Aperçu

**Fractal Arena** est un auto-battler crypto/blockchain jouable, construit en **React 18 (JSX via Babel standalone, sans build step)**. Le joueur connecte un wallet (simulé), constitue une équipe de 3 entités, mise des jetons FRACTALARENA, lance des combats automatiques, gagne de l'XP et des récompenses, puis fait progresser / forge / invoque ses entités.

⚠️ **Ce n'est PAS qu'une maquette** — c'est une application complète et fonctionnelle. Contrairement à un handoff classique (où l'on recrée des écrans HTML statiques), ici **le code est déjà la source de vérité**. L'objectif de Claude Code est d'**étendre / faire évoluer le gameplay** sur cette base existante.

La couche « blockchain » (wallet, dépôts, retraits, airdrop, économie, **inscriptions de noms ordinaux**) est **simulée en mémoire** et persistée dans `localStorage`. Il n'y a aucun appel on-chain réel. Un axe d'évolution majeur est de brancher un vrai backend (Fractal Bitcoin / UniSat).

---

## État actuel (fonctionnalités notables ajoutées après le build initial)

- **Wallet obligatoire à chaque démarrage** — au chargement, `loadState()` force `wallet: null` : on repasse toujours par l'écran de connexion, mais la progression (roster, soldes, tickets, nom ordinal…) est conservée. La reconnexion ne redonne PAS le cadeau de bienvenue (détecté via `roster.length`).
- **Noms ordinaux (.fb)** — dans Options → Profil joueur, un bouton « Rechercher mes noms ordinaux » simule un scan on-chain (`FA_DATA.walletNameInscriptions(address)`, déterministe par wallet) et liste les inscriptions de nom possédées. Le joueur en **sélectionne une** ; elle s'affiche alors à la place de l'adresse wallet (en-tête de l'arène, etc.) via `g.ordinalName`. Gère les gros volumes (100+) : champ de recherche/filtre + liste scrollable + compteur « X sur Y ». ~1 wallet sur 4 est un « collectionneur ». **À remplacer** par une vraie requête à l'API Ordinals/UniSat (avec pagination).
- **Dépôt par TXID** — le modal de dépôt demande le **TXID** d'une transaction (validation `^[0-9a-f]{64}$`), pas un montant ; le montant crédité est « détecté » (dérivé du txid en simulation). L'adresse du Reward Pool y figure avec bouton Copier.
- **Sélecteur de langue sur l'onboarding** (sous le bandeau cadeau), en plus du header et des Options. `actions.setLang` applique la langue de façon **synchrone** (sinon il fallait double-cliquer).
- **Options épurées** — vitesse de combat retirée (fixée à 1×), bouton « Réinitialiser la progression » retiré.
- **Logo détouré** — `assets/LOGO_cut.png` (fond noir supprimé par remplissage depuis les bords) ; utilisé dans le header et l'onboarding.
- **Fond** — le quadrillage cyan a été retiré ; il reste le filigrane d'arène, le halo radial et les braises.

---

## Stack technique

- **React 18.3.1** + **ReactDOM** chargés via CDN (unpkg, avec integrity hashes).
- **Babel Standalone 7.29** — transpilation JSX **dans le navigateur** (`<script type="text/babel">`). Pas de bundler, pas de npm, pas d'étape de compilation.
- **CSS pur** dans `styles.css` (variables CSS, clip-path octogonal, keyframes transform-only).
- **i18n maison** — FR / EN / 中文 via `window.FA_I18N.t()`.
- **Persistance** — `localStorage` clé `fractal_arena_v1`.
- **Polices** — `Chakra Petch` (titres/UI) + `JetBrains Mono` (data/log), via Google Fonts.

### Pourquoi pas de build step ?
Le projet est volontairement « zero-build » pour rester portable (un dossier qu'on dépose sur n'importe quel hébergeur). Si Claude Code souhaite migrer vers Vite/Next + npm pour un vrai projet de prod, c'est un choix légitime — mais ce n'est **pas requis**. Conserver l'approche actuelle reste parfaitement viable pour itérer sur le gameplay.

---

## Architecture des fichiers

Les scripts se chargent dans cet ordre (cf. `index.html`) — l'ordre **compte** :

| Fichier | Type | Rôle |
|---|---|---|
| `index.html` | HTML | Point d'entrée, ordre de chargement des scripts, splash de boot, thumbnail bundler. |
| `styles.css` | CSS | Thème complet : variables (couleurs, raretés, polices), composants (cartes, boutons, barres, modals, log, embers), animations. |
| `data.js` | JS vanilla | **Données & règles.** Templates de créatures, raretés, presets, constantes d'économie/forge/boosts, fabrique d'entités (`mintBeast`), progression (XP, level-up, upgrade de rareté), génération d'équipe ennemie, **scan simulé des noms ordinaux** (`walletNameInscriptions`). Exposé sur `window.FA_DATA`. |
| `i18n.js` | JS vanilla | Toutes les traductions FR/EN/中文 + `t(key, ...args)`. Exposé sur `window.FA_I18N`. |
| `engine.js` | JS vanilla | **Moteur de combat auto** (ordre par SPD, ciblage par preset, dégâts, crit, rage de round, cap 22 rounds) qui produit un flux d'événements rejoué par l'UI. Inclut un **calibrateur de difficulté** (`buildSequence`) qui vise un win-rate cible. Exposé sur `window.FA_ENGINE`. |
| `components.jsx` | React | Composants partagés : contexte `FA_Ctx`/`useFA`, `CreatureCard`, `Bar`, `StatGrid`, `Modal`, `SectionHead`, `MiniStats`, helpers (`cx`, `fmt`). Exporte tout sur `window`. |
| `arena.jsx` | React | Écran **Arène** (combat) : `CombatCard`, `Arena`, `ResultModal`. Stepper de combat piloté par `setTimeout`. |
| `screens.jsx` | React | Écrans **Équipe, Forge (Fusion/Reroll/Invoquer), Boosts, Wallet (Dépôt/Retrait), Perso/Vanity, Options**. |
| `app.jsx` | React | **Racine.** État global (`g`), persistance, toutes les `actions` (économie, forge, boosts, vanity, wallet), `Header`, `Nav`, `Onboarding`, `Ambient` (embers), `Toasts`. Monte l'app sur `#root`. |

### ⚠️ Règle critique des scopes Babel
Chaque `<script type="text/babel">` a **son propre scope** après transpilation. Les composants ne se partagent PAS automatiquement. Convention du projet :
- Chaque fichier JSX **importe** ce dont il a besoin depuis `window` en haut (`const { useFA, CreatureCard, ... } = window;`).
- Chaque fichier JSX **exporte** ses composants à la fin via `Object.assign(window, { ... })`.
- **Ne jamais** nommer un objet de styles global `styles` — utiliser des noms préfixés (collisions garanties sinon). Le projet privilégie les styles inline et les classes CSS.

---

## État global (`app.jsx` → `freshState()`)

```
lang, wallet, liquid, locked, useLocked,
roster[], selected[] (max 3 ids),
freeFights, freeResetTs, totalFights,
loopSilverToday, loopGoldToday, ticketsSilver, ticketsGold,
session{wins,losses,net}, boosts{xp_boost,insurance,lucky_strike},
playerName, playerTitle, ordinalName, holderDays,
options{sound,anim,speed}, view
```

L'état descend par le contexte `FA_Ctx` ; les écrans appellent `actions.*` pour le muter. Le combat remonte la progression au roster via `actions.resolveFight`.

### Forme d'une entité (beast)
```
{ id, template_name, type, image_key, preset, rarity,
  base_hp, base_atk, base_def, base_spd, base_mag,
  level, xp, reroll_count, name, custom_name }
```
Stats effectives = `base × (1 + 0.03×(level−1))` via `FA_DATA.eff(beast, key)`.

---

## Modèle de combat (`engine.js`)

- `runBattle(playerBeasts, enemyBeasts)` → `{ events[], winner, rounds }`. Événements : `round`, `atk`, `sp`, `crit`, `miss`, `heal`, `timeout`, `win`, `lose` — chacun porte un `state` (snapshot HP des deux équipes) que l'UI applique frame par frame.
- Ordre par **SPD desc** (tiebreak aléatoire). Ciblage : achever toute cible <32% PV, sinon préférence par preset (aggressive/berserker→max PV, controller→max SPD, sniper→max MAG, tactician/lifesteal→PV min, défaut→aléatoire pondéré sur les blessés).
- Dégâts = `stat × rnd(1.0–1.34) − def×0.5`, × crit (12%, ×1.6), × rage de round (+16%/round). Lifesteal soigne l'allié le plus blessé (décroissant). Cap **22 rounds** → victoire au meilleur %PV cumulé.
- `buildSequence(team)` calibre une séquence de multiplicateurs de difficulté (sim headless + recherche binaire) visant ~62% de win-rate moyen.

### ⚠️ Note de rendu (piège connu)
L'Arène rejoue le combat via des `setTimeout` chaînés (`stepBattle`). Le **throttling des timers dans un onglet/iframe en arrière-plan** peut donner l'illusion d'un combat « gelé ». Ce n'est pas un bug : au premier plan, tout se déroule normalement. Ne pas « corriger » en repassant à de l'`async/await` — c'était précisément la source d'un blocage sous Babel.

---

## Économie (constantes dans `data.js` → `ECON`, `FORGE`, `BOOSTS`)

- **Mises** : Bronze 10 (+7), Argent 25 (+17), Or 50 (+35). Débitée au lancement.
- **Victoire** → mise rendue + gain ×1.7 + 50 XP/entité. **Défaite** → mise perdue, 2/3 pool · 1/3 burn.
- **5 combats gratuits/jour** (reset 24h). Gains des combats gratuits → **verrouillés**.
- **Boucle** : caps/jour Argent 100, Or 50 (repli auto sur Bronze sinon).
- **Milestones** tous les 50 combats → +50 verrouillé + tickets (10 Argent / 5 Or).
- **Solde Liquide** (misable + retirable) vs **Verrouillé** (misable uniquement). Dépense : liquide d'abord, puis verrouillé.
- **Forge** : Fusion (2 entités même rareté → rareté+ selon % succès), Reroll (redistribue stats, total conservé, coût croissant), Invoquer (−20 000, tirage 70/20/8/2%).
- **Boosts** : XP×2 (50 combats), Insurance (5 charges), Lucky Strike (15 combats).
- **Vanity** : renommer une entité (−1 000), titre joueur (−5 000).
- **Progression** : level quand `xp ≥ level×100`. Au niveau 100 → upgrade de rareté auto (Common→Rare→Epic→Legendary).

---

## Direction artistique (design tokens)

Définis dans `styles.css` `:root` :

```
Fonds      --bg-0 #05070f  --bg-1 #060912  --bg-panel #0a0f1e  --bg-panel-2 #0d1426  --bg-elev #111a30
Texte      --text #EAF1FF  --text-dim #7F8DAD  --text-faint #4a5878
Accents    --fire #F7931A  --elec #00F0FF  --forge #B026FF  --success #27E08A  --alert #FF3B5C  --gold #FFE600
Raretés    Common #9CA3AF  Rare #3B82F6  Epic #B026FF  Legendary #F7931A
Lignes     --line #1d2740  --line-soft #141d33
Bevel      --bevel 12px / --bevel-sm 7px  (clip-path octogonal, classe .oct)
Polices    --font-display 'Chakra Petch' (uppercase, letter-spacing) ; --font-mono 'JetBrains Mono'
```

Repères visuels : métal brossé, coins biseautés octogonaux, hexagones (VS), background d'arène en filigrane partout (plein dans l'arène), braises animées (`Ambient`), animations **transform-only** (jamais d'opacity 0→1 en keyframe).

---

## Assets (dossier `assets/`)

- `LOGO.png` — logo original (fond noir). `LOGO_cut.png` — version détourée (fond transparent) utilisée dans l'app.
- `BACKGROUND.png` — scène d'arène (filigrane via variable CSS `--filigrane`).
- 6 artworks de créatures, mappés dans `FA_DATA.ART` par `image_key` :
  `HASHBYTE.png` (HashByte/HASH), `MINER.png` (Miner/MINING), `LEDGER.png` (Ledger/LEDGER), `NETWORK.png` (Network/NETWORK), `BLOCK.png` (Block/BLOCK), `GENESIS.png` (Genesis/GENESIS).

Source originale : portage d'un jeu Godot (`fractal_arena_source.gd`) fourni par le client.

---

## Pistes d'extension de gameplay (exemples)

Le code est structuré pour faciliter ces ajouts :

- **Nouvelles entités / types** → ajouter des templates dans `data.js` (`TEMPLATES`, `TYPE_TO_PRESET`, `ART`) + l'artwork dans `assets/`.
- **Nouvelles capacités / presets de combat** → étendre `useSpecial` / `chooseTarget` / le calcul de dégâts dans `engine.js` (penser à refléter la logique dans le calibrateur `cDecide`).
- **Nouveaux modes** (tournois, PvP asynchrone, boss) → nouvel écran dans `screens.jsx` + onglet dans `Nav` (`app.jsx`) + actions dédiées.
- **Vrai backend blockchain** → remplacer les actions simulées `connectWallet`, `deposit`, `withdraw` (et l'économie) par des appels à une API / UniSat. Le reste de l'UI n'a pas à changer.
- **Équilibrage** → ajuster les constantes `ECON` / `FORGE` / `BOOSTS` et les multiplicateurs de rareté/variance dans `data.js`.
- **Nouvelles langues** → ajouter une clé de langue dans `i18n.js` et l'option dans `Options` / le header.

---

## Lancer le projet

Aucune installation. Servir le dossier en statique (ou ouvrir `index.html` via un petit serveur local pour éviter les restrictions `file://` sur le chargement des `.jsx`) :

```bash
# depuis la racine du projet
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

Tout le dossier doit être déployé ensemble en conservant la structure (`index.html` + `*.css` + `*.js` + `*.jsx` + `assets/`).

---

## Fichiers inclus dans ce bundle

Le code source complet de l'application est joint (voir le dossier parent) : `index.html`, `styles.css`, `data.js`, `i18n.js`, `engine.js`, `components.jsx`, `arena.jsx`, `screens.jsx`, `app.jsx`, et `assets/`.
