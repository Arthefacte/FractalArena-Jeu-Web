# Spec — Tutoriel « Comment jouer » de Fractal Arena

**Date :** 2026-06-14
**Statut :** Validé, prêt pour le plan d'implémentation
**Repo :** `fractal-arena-web` (client web, React JSX/Babel, GitHub Pages)

## Objectif

Offrir un tutoriel de gameplay au démarrage, ciblant en priorité les joueurs qui se
connectent pour la première fois, afin qu'ils comprennent la boucle de jeu (équipe →
mise → combat → économie FA) sans aide extérieure.

## Décisions de cadrage (validées)

| Sujet | Décision |
|---|---|
| Format | Carrousel modal, 5 diapos (icône/emoji + titre + texte court) |
| Visuels | Icônes/emojis uniquement — aucun asset graphique à produire |
| Déclenchement | Auto une seule fois après la 1ère connexion wallet + bouton « ? » pour revoir |
| Moment | **Après** la connexion wallet (le joueur a déjà son roster + cadeau) |
| Persistance | Clé localStorage dédiée `fractal_arena_tutorial_v1` |
| Langues | FR / EN / ZH via `i18n.js` |
| Hors périmètre | Pas de spotlight interactif, pas de captures, pas de tracking serveur |

## Architecture

### Nouveau fichier : `tutorial.jsx`

Composant `TutorialGate`, calqué sur `login.jsx` / `LoginGate`. Dépendances globales :
`window.useFA`, `window.Modal`, `window.cx`, `window.FA_I18N`.

Responsabilités :
- Décider de l'auto-affichage au montage (voir « Déclenchement »).
- Gérer la navigation entre diapos (`step` 0→4).
- Poser le flag localStorage quand le tutoriel est terminé ou passé.
- S'exposer via `Object.assign(window, { TutorialGate })`.

Interface (ce que le reste du code voit) :
- Monté sans props dans `app.jsx` : `{g.wallet && <TutorialGate />}`.
- Lit le contexte `useFA()` pour `g.wallet`.
- Aucune action serveur, aucune mutation de l'état de jeu `g` — purement local + localStorage.

### Données des diapos (interne à `tutorial.jsx`)

Tableau constant de 5 entrées :

```js
const SLIDES = [
  { icon: "⚔️", t: "TUT_S1_T", b: "TUT_S1_B" },
  { icon: "🦞", t: "TUT_S2_T", b: "TUT_S2_B" },
  { icon: "🎯", t: "TUT_S3_T", b: "TUT_S3_B" },
  { icon: "🔒", t: "TUT_S4_T", b: "TUT_S4_B" },
  { icon: "🔨", t: "TUT_S5_T", b: "TUT_S5_B" },
];
```

Le texte n'est jamais en dur dans le composant : seules les clés i18n y figurent.

### Déclenchement et persistance

- Clé localStorage : `fractal_arena_tutorial_v1` (constante `TUT_KEY`).
  Valeur : `"1"` une fois vu. Volontairement **séparée** de `SAVE_KEY`
  (`fractal_arena_v1`) pour que `disconnect()` — qui supprime `SAVE_KEY` — n'efface
  pas l'historique « tuto déjà vu » : on évite de re-spammer le tuto à chaque
  reconnexion sur le même navigateur.
- Au montage du composant (`useEffect` sur `[g.wallet]`) :
  - Si `g.wallet` présent **ET** `localStorage[TUT_KEY]` absent → ouvrir le tuto
    (`open = true`), `step = 0`.
  - Sinon → fermé.
- Le flag est posé (`localStorage[TUT_KEY] = "1"`) à la **fermeture** du tuto, quel
  que soit le moyen (Passer, ✕, Échap, clic hors-modale, ou « Commencer » sur la
  dernière diapo).
- **Re-consultation** : le bouton « ? » du header appelle une ouverture forcée
  (`open = true`) **sans** condition sur le flag et **sans** le modifier. Mécanisme :
  un événement custom `window` (`"fa-open-tutorial"`) émis par le bouton header et
  écouté par `TutorialGate` — découple le bouton (dans `Header`) du composant
  (monté plus bas) sans remonter d'état dans `App`.

### Cohabitation avec `LoginGate` (cadeau de connexion)

Au tout premier login, le tuto **et** le cadeau quotidien voudraient s'ouvrir.
Comportement voulu : **tuto d'abord, cadeau ensuite**.

Approche retenue (simple, sans coupler les deux composants) :
- `LoginGate` ne s'ouvre pas tant que le tuto est susceptible de s'afficher pour la
  première fois. Implémentation : `LoginGate` vérifie `localStorage[TUT_KEY]` avant
  d'ouvrir sa modale ; s'il est absent (tuto pas encore vu), il **diffère** son
  ouverture jusqu'à réception de l'événement `"fa-tutorial-closed"` émis par
  `TutorialGate` à sa fermeture.
- Si le flag est déjà présent (joueur connu) → `LoginGate` se comporte comme
  aujourd'hui (ouverture immédiate selon `claimable_today`).

> Note d'implémentation : c'est la seule modification fonctionnelle de `login.jsx`.
> Garder le diff minimal : early-return / attente conditionnée au flag + écoute de
> l'événement de fermeture.

### Bouton d'aide « ? »

Ajouté dans le composant `Header` (`app.jsx`), après le sélecteur de langue
(`.lang-switch`). Bouton compact réutilisant les classes existantes (`btn ghost sm`
ou équivalent), libellé `?`, attribut `title`/`aria-label` = `I18N.t("TUT_HELP")`.
Au clic : `window.dispatchEvent(new Event("fa-open-tutorial"))`.

### Rendu de la modale

Réutilise `Modal` (`components.jsx`) : overlay, fermeture ✕/Échap/clic-hors.
Structure interne d'une diapo :
- `.tut-icon` : grande icône/emoji centrée.
- Titre `h1` = `I18N.t(slide.t)`.
- `.tut-body` (`muted`) = `I18N.t(slide.b)`.
- `.tut-dots` : 5 puces `.tut-dot`, celle active `.on` ; cliquables pour sauter à
  une diapo.
- Pied : bouton **Passer** (`TUT_SKIP`, gauche) ferme + pose le flag ; bouton
  **Suivant** (`TUT_NEXT`) incrémente `step`, qui devient **Commencer** (`TUT_START`)
  sur la dernière diapo et ferme + pose le flag.

## i18n — clés à ajouter (`i18n.js`, FR/EN/ZH)

Chrome :
- `TUT_TITLE` — eyebrow/titre de section (« Comment jouer »).
- `TUT_SKIP` — « Passer ».
- `TUT_NEXT` — « Suivant ».
- `TUT_START` — « Commencer ».
- `TUT_HELP` — title/aria du bouton « ? » (« Revoir le tutoriel »).

Diapos :
- `TUT_S1_T` / `TUT_S1_B` — Bienvenue + cadeau de bienvenue (FA verrouillés).
- `TUT_S2_T` / `TUT_S2_B` — Compose ton équipe : sélectionne 3 bêtes (onglet Équipe).
- `TUT_S3_T` / `TUT_S3_B` — Arène : combats gratuits quotidiens + mises Bronze/Argent/Or,
  victoire = gain / défaite = perte.
- `TUT_S4_T` / `TUT_S4_B` — Verrouillé vs disponible (◎) : le verrouillé se joue mais
  ne se retire pas ; le disponible se retire vers le wallet.
- `TUT_S5_T` / `TUT_S5_B` — Va plus loin : Forge, Campagne PvE, Quêtes & cadeau
  quotidien.

Contenu rédactionnel exact des diapos (à figer pendant l'implémentation, FR canon
puis EN/ZH) :

| Clé | FR (référence) |
|---|---|
| TUT_S1_T | Bienvenue dans l'Arène |
| TUT_S1_B | Fractal Arena est un auto-battler sur Fractal Bitcoin. Tu démarres avec un cadeau de bienvenue en FA verrouillés — de quoi te faire la main. |
| TUT_S2_T | Compose ton équipe |
| TUT_S2_B | Dans l'onglet Équipe, choisis 3 bêtes avant chaque combat. Elles gagnent de l'XP et montent en niveau au fil des victoires. |
| TUT_S3_T | Combats & mises |
| TUT_S3_B | Entraîne-toi avec tes combats gratuits quotidiens, puis mise des FA (Bronze, Argent, Or) à l'Arène : une victoire rapporte gros, une défaite coûte ta mise. |
| TUT_S4_T | Verrouillé vs disponible |
| TUT_S4_B | Le FA verrouillé 🔒 se joue mais ne se retire pas. Le FA disponible ◎ peut être retiré vers ton wallet. En gagnant, tu transformes l'un en l'autre. |
| TUT_S5_T | Va plus loin |
| TUT_S5_B | Forge pour fusionner et améliorer tes bêtes, Campagne pour les défis PvE à étoiles, Quêtes et cadeau quotidien pour des récompenses. À toi de jouer ! |

(Les traductions EN/ZH suivent le ton concis des clés `OB_*` existantes.)

## Style (`styles.css`)

Ajouter, sans toucher l'existant :
- `.tut-icon` — taille ~56px, centré, marge basse.
- `.tut-body` — interligne confortable, largeur lisible, centré.
- `.tut-dots` — flex centré, gap ; `.tut-dot` — pastille discrète ; `.tut-dot.on` —
  pastille active (accent feu/élec).
- Pied de modale : réutiliser `flex between` existant pour Passer/Suivant.

## Chargement / déploiement

- `index.html` : nouvelle balise `<script type="text/babel" src="tutorial.jsx?v=27">`
  insérée **avant** `app.jsx` (qui référence `TutorialGate`), après `login.jsx`.
- Incrémenter le cache-busting `?v=` de 26 → **27** sur tous les fichiers touchés
  (`index.html` styles/scripts, `tutorial.jsx`, `app.jsx`, `login.jsx`, `i18n.js`,
  `styles.css`).

## Tests / Vérification (manuelle)

Pas de logique métier testable en unitaire ici (UI pure). Checklist de vérif manuelle :

1. **Premier login** (wallet jamais vu sur ce navigateur, flag absent) → le tuto
   s'ouvre automatiquement après connexion ; le cadeau de connexion n'apparaît
   qu'après fermeture du tuto.
2. **Navigation** : Suivant parcourt les 5 diapos ; les puces sautent à une diapo ;
   la dernière affiche « Commencer ».
3. **Fermeture** par chaque moyen (Passer / ✕ / Échap / clic-hors / Commencer) pose
   le flag.
4. **Reconnexion / reload** → le tuto ne se rouvre pas tout seul.
5. **Bouton « ? »** du header → rouvre le tuto à volonté, sans modifier le flag, et
   ne re-déclenche pas le cadeau.
6. **3 langues** : FR/EN/ZH s'affichent correctement, pas de débordement.
7. **Mobile** : modale lisible, boutons accessibles (vérif via `mobile.css`).

## Fichiers touchés

| Fichier | Nature |
|---|---|
| `tutorial.jsx` | **Nouveau** — composant `TutorialGate` |
| `app.jsx` | Montage `<TutorialGate />` + bouton « ? » dans `Header` |
| `login.jsx` | Diffère l'ouverture du cadeau si tuto pas encore vu |
| `i18n.js` | 15 nouvelles clés `TUT_*` (FR/EN/ZH) : 5 chrome + 10 diapos |
| `styles.css` | Classes `.tut-*` |
| `index.html` | Balise script `tutorial.jsx` + bump `?v=27` |
