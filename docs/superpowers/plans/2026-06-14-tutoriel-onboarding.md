# Tutoriel Onboarding « Comment jouer » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Afficher un carrousel modal de 5 diapos enseignant la boucle de jeu, auto-affiché une fois après la 1ère connexion wallet et re-consultable via un bouton « ? ».

**Architecture:** Nouveau composant React `TutorialGate` (`tutorial.jsx`), calqué sur `LoginGate`, monté dans `app.jsx`. Persistance via une clé localStorage dédiée. Découplage du bouton header et de la cohabitation avec le cadeau de connexion via deux événements `window` custom (`fa-open-tutorial`, `fa-tutorial-closed`). Aucune logique serveur, aucun asset graphique.

**Tech Stack:** React 18 (UMD) + Babel-in-browser (JSX), `i18n.js` (FR/EN/ZH), CSS vanilla. Vérification de complétude i18n via `node:test`. Le reste (UI React) se vérifie manuellement — le repo n'a aucun test de composant React (pattern existant : `login.jsx`, `screens.jsx` ne sont pas testés unitairement).

**Spec de référence :** `docs/superpowers/specs/2026-06-14-tutoriel-onboarding-design.md`

---

## File Structure

| Fichier | Responsabilité | Action |
|---|---|---|
| `tutorial.jsx` | Composant `TutorialGate` : carrousel, auto-ouverture, persistance | **Créer** |
| `test/tutorial-i18n.test.js` | Vérifie que les 15 clés `TUT_*` existent en FR/EN/ZH | **Créer** |
| `i18n.js` | 15 clés `TUT_*` | Modifier |
| `styles.css` | Classes `.tut-*` | Modifier |
| `app.jsx` | Montage `<TutorialGate />` + bouton « ? » dans `Header` | Modifier |
| `login.jsx` | Diffère le cadeau si tuto pas encore vu | Modifier |
| `index.html` | Balise `<script>` tutorial.jsx + bump `?v=27` | Modifier |

---

## Task 1: Clés i18n `TUT_*` (FR/EN/ZH) + test de complétude

**Files:**
- Create: `test/tutorial-i18n.test.js`
- Modify: `i18n.js` (insérer après le bloc `LOGIN_*`, autour de la ligne 33)

- [ ] **Step 1: Écrire le test de complétude (qui échoue)**

Create `test/tutorial-i18n.test.js`:

```js
const test = require("node:test");
const assert = require("node:assert");

// i18n.js est une IIFE qui fait `window.FA_I18N = {...}`. On shim `window`
// sur le global pour pouvoir le charger en Node (identifiant `window` nu).
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;

const KEYS = [
  "TUT_TITLE", "TUT_SKIP", "TUT_NEXT", "TUT_START", "TUT_HELP",
  "TUT_S1_T", "TUT_S1_B", "TUT_S2_T", "TUT_S2_B", "TUT_S3_T", "TUT_S3_B",
  "TUT_S4_T", "TUT_S4_B", "TUT_S5_T", "TUT_S5_B",
];
const LANGS = ["FR", "EN", "ZH"];

test("les 15 clés TUT_* existent dans les 3 langues, non vides", () => {
  for (const k of KEYS) {
    assert.ok(T[k], `clé manquante : ${k}`);
    for (const lg of LANGS) {
      assert.ok(T[k][lg] && T[k][lg].trim().length > 0, `${k}.${lg} vide`);
    }
  }
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `node --test test/tutorial-i18n.test.js`
Expected: FAIL — `clé manquante : TUT_TITLE`

- [ ] **Step 3: Ajouter les 15 clés dans `i18n.js`**

Insérer ce bloc dans l'objet `T`, juste après la ligne `LOGIN_REWARD_GRANTED: { ... },` (≈ ligne 33) :

```js
    // tutoriel onboarding
    TUT_TITLE: { FR: "Comment jouer", EN: "How to play", ZH: "游戏玩法" },
    TUT_SKIP:  { FR: "Passer", EN: "Skip", ZH: "跳过" },
    TUT_NEXT:  { FR: "Suivant", EN: "Next", ZH: "下一步" },
    TUT_START: { FR: "Commencer", EN: "Start", ZH: "开始" },
    TUT_HELP:  { FR: "Revoir le tutoriel", EN: "Replay tutorial", ZH: "重看教程" },
    TUT_S1_T: { FR: "Bienvenue dans l'Arène", EN: "Welcome to the Arena", ZH: "欢迎来到竞技场" },
    TUT_S1_B: {
      FR: "Fractal Arena est un auto-battler sur Fractal Bitcoin. Tu démarres avec un cadeau de bienvenue en FA verrouillés — de quoi te faire la main.",
      EN: "Fractal Arena is an auto-battler on Fractal Bitcoin. You start with a welcome gift of locked FA — enough to get the hang of it.",
      ZH: "Fractal Arena 是 Fractal Bitcoin 上的自动战斗游戏。你将获得锁定 FA 的欢迎礼物，足够你上手。",
    },
    TUT_S2_T: { FR: "Compose ton équipe", EN: "Build your team", ZH: "组建队伍" },
    TUT_S2_B: {
      FR: "Dans l'onglet Équipe, choisis 3 bêtes avant chaque combat. Elles gagnent de l'XP et montent en niveau au fil des victoires.",
      EN: "In the Team tab, pick 3 beasts before each fight. They earn XP and level up as you win.",
      ZH: "在「队伍」标签中，每场战斗前选择 3 只野兽。它们会随着胜利获得经验并升级。",
    },
    TUT_S3_T: { FR: "Combats & mises", EN: "Fights & bets", ZH: "战斗与下注" },
    TUT_S3_B: {
      FR: "Entraîne-toi avec tes combats gratuits quotidiens, puis mise des FA (Bronze, Argent, Or) à l'Arène : une victoire rapporte gros, une défaite coûte ta mise.",
      EN: "Train with your daily free fights, then bet FA (Bronze, Silver, Gold) in the Arena: a win pays big, a loss costs your stake.",
      ZH: "用每日免费战斗练习，然后在竞技场下注 FA（铜、银、金）：获胜收益丰厚，失败则损失赌注。",
    },
    TUT_S4_T: { FR: "Verrouillé vs disponible", EN: "Locked vs available", ZH: "锁定与可用" },
    TUT_S4_B: {
      FR: "Le FA verrouillé 🔒 se joue mais ne se retire pas. Le FA disponible ◎ peut être retiré vers ton wallet. En gagnant, tu transformes l'un en l'autre.",
      EN: "Locked FA 🔒 can be played but not withdrawn. Available FA ◎ can be withdrawn to your wallet. Winning turns one into the other.",
      ZH: "锁定 FA 🔒 可用于游戏但不可提现。可用 FA ◎ 可提现到你的钱包。获胜可将前者转化为后者。",
    },
    TUT_S5_T: { FR: "Va plus loin", EN: "Go further", ZH: "更进一步" },
    TUT_S5_B: {
      FR: "Forge pour fusionner et améliorer tes bêtes, Campagne pour les défis PvE à étoiles, Quêtes et cadeau quotidien pour des récompenses. À toi de jouer !",
      EN: "Forge to fuse and upgrade your beasts, Campaign for starred PvE challenges, Quests and the daily gift for rewards. Now it's your turn!",
      ZH: "在熔炉中融合并强化野兽，战役挑战星级 PvE，任务和每日礼物赢取奖励。现在轮到你了！",
    },
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `node --test test/tutorial-i18n.test.js`
Expected: PASS — 1 test, 0 fail

- [ ] **Step 5: Commit**

```bash
git add i18n.js test/tutorial-i18n.test.js
git commit -m "feat(tutorial): cles i18n TUT_* (FR/EN/ZH) + test de completude"
```

---

## Task 2: Styles `.tut-*`

**Files:**
- Modify: `styles.css` (ajouter à la fin, avant toute media query finale s'il y en a — sinon en fin de fichier)

- [ ] **Step 1: Ajouter le bloc CSS**

Ajouter à la fin de `styles.css` :

```css
/* ---- Tutoriel onboarding ---- */
.tut-icon { font-size: 56px; text-align: center; line-height: 1; margin: 4px 0 14px; filter: drop-shadow(0 0 14px rgba(247,147,26,0.35)); }
.tut-body { text-align: center; font-size: 14px; line-height: 1.7; max-width: 420px; margin: 10px auto 0; }
.tut-dots { display: flex; justify-content: center; gap: 8px; margin-top: 18px; }
.tut-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-faint); cursor: pointer; transition: background .2s, transform .2s; }
.tut-dot.on { background: var(--fire); transform: scale(1.25); }
.tut-help { padding: 5px 11px; font-weight: 700; }
```

- [ ] **Step 2: Vérification visuelle rapide (pas de runner CSS)**

Aucune commande automatisée. La vérification réelle se fait à la Task 6 (rendu navigateur). Ici, relire le bloc : les variables `--text-faint` et `--fire` existent bien dans `:root` (styles.css L17, L21).

- [ ] **Step 3: Commit**

```bash
git add styles.css
git commit -m "feat(tutorial): styles .tut-* (icone, dots, body, bouton aide)"
```

---

## Task 3: Composant `TutorialGate` (`tutorial.jsx`)

**Files:**
- Create: `tutorial.jsx`

- [ ] **Step 1: Créer `tutorial.jsx`**

```jsx
/* ============================================================
   FRACTAL ARENA — Tutoriel onboarding « Comment jouer »
   ============================================================ */
const { useState, useEffect } = React;
const { useFA, cx, Modal } = window;
const I18N = window.FA_I18N;

// Clé localStorage dédiée (séparée de SAVE_KEY : survit à disconnect()).
const TUT_KEY = "fractal_arena_tutorial_v1";

const SLIDES = [
  { icon: "⚔️", t: "TUT_S1_T", b: "TUT_S1_B" },
  { icon: "🦞", t: "TUT_S2_T", b: "TUT_S2_B" },
  { icon: "🎯", t: "TUT_S3_T", b: "TUT_S3_B" },
  { icon: "🔒", t: "TUT_S4_T", b: "TUT_S4_B" },
  { icon: "🔨", t: "TUT_S5_T", b: "TUT_S5_B" },
];

function tutSeen() {
  try { return localStorage.getItem(TUT_KEY) === "1"; } catch (e) { return false; }
}
function markTutSeen() {
  try { localStorage.setItem(TUT_KEY, "1"); } catch (e) {}
}

function TutorialGate() {
  const { g } = useFA();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-ouverture unique après la 1ère connexion (flag absent).
  useEffect(() => {
    if (g.wallet && !tutSeen()) { setStep(0); setOpen(true); }
  }, [g.wallet]);

  // Ouverture forcée via le bouton « ? » du header (ne touche pas au flag).
  useEffect(() => {
    const onOpen = () => { setStep(0); setOpen(true); };
    window.addEventListener("fa-open-tutorial", onOpen);
    return () => window.removeEventListener("fa-open-tutorial", onOpen);
  }, []);

  if (!open) return null;

  function close() {
    markTutSeen();
    setOpen(false);
    // Signale au cadeau de connexion qu'il peut s'ouvrir (cohabitation 1er login).
    window.dispatchEvent(new Event("fa-tutorial-closed"));
  }
  function next() {
    if (step >= SLIDES.length - 1) close();
    else setStep((s) => s + 1);
  }

  const slide = SLIDES[step];
  const last = step === SLIDES.length - 1;

  return (
    <Modal onClose={close} accent="var(--fire)">
      <div className="eyebrow" style={{ textAlign: "center" }}>{I18N.t("TUT_TITLE")}</div>
      <div className="tut-icon">{slide.icon}</div>
      <div className="h1" style={{ textAlign: "center" }}>{I18N.t(slide.t)}</div>
      <div className="tut-body muted">{I18N.t(slide.b)}</div>
      <div className="tut-dots">
        {SLIDES.map((_, i) => (
          <span key={i} className={cx("tut-dot", i === step && "on")} onClick={() => setStep(i)} />
        ))}
      </div>
      <div className="flex between center" style={{ marginTop: 16, gap: 12 }}>
        <button className="btn ghost" onClick={close}>{I18N.t("TUT_SKIP")}</button>
        <button className="btn btn-fire" onClick={next}>{last ? I18N.t("TUT_START") : I18N.t("TUT_NEXT")}</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { TutorialGate });
```

- [ ] **Step 2: Vérifier que le fichier parse (lint babel léger)**

Pas de build pipeline ; la vérification de parsing se fait au chargement navigateur (Task 6). Relecture : `Modal`, `useFA`, `cx` viennent bien de `window` (définis dans `components.jsx`), `btn`/`btn-fire`/`ghost`/`eyebrow`/`h1`/`muted`/`flex between center` sont des classes existantes.

- [ ] **Step 3: Commit**

```bash
git add tutorial.jsx
git commit -m "feat(tutorial): composant TutorialGate (carrousel 5 diapos)"
```

---

## Task 4: Charger `tutorial.jsx` dans `index.html` + bump cache `v=27`

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Ajouter la balise script tutorial.jsx**

Dans `index.html`, juste après la ligne `login.jsx` (L58) et avant `campaign.jsx` :

Remplacer :
```html
  <script type="text/babel" src="login.jsx?v=26"></script>
  <script type="text/babel" src="campaign.jsx?v=26"></script>
```
par :
```html
  <script type="text/babel" src="login.jsx?v=27"></script>
  <script type="text/babel" src="tutorial.jsx?v=27"></script>
  <script type="text/babel" src="campaign.jsx?v=27"></script>
```

- [ ] **Step 2: Bumper TOUS les `?v=26` → `?v=27`**

Remplacer chaque occurrence `?v=26` par `?v=27` dans `index.html` (lignes 10–11 CSS, 45–60 scripts). Au total : `styles.css`, `mobile.css`, `data.js`, `i18n.js`, `engine.js`, `cosmetic.js`, `components.jsx`, `arena.jsx`, `screens.jsx`, `chat.jsx`, `roomchat.jsx`, `leaderboard.jsx`, `quests.jsx`, `app.jsx` (+ login/tutorial/campaign déjà faits au Step 1).

Vérification : `grep -c "v=26" index.html` doit retourner `0`, et `grep -c "v=27" index.html` doit retourner le nombre de fichiers versionnés (≥ 16).

- [ ] **Step 3: Vérifier l'ordre de chargement**

`tutorial.jsx` doit être chargé **avant** `app.jsx` (qui référence `window.TutorialGate`). Confirmer que la balise `app.jsx` reste la dernière `text/babel` de la liste.

Run: `grep -n "text/babel" index.html`
Expected: `tutorial.jsx` apparaît avant `app.jsx`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "build(tutorial): charge tutorial.jsx + cache-busting v=27"
```

---

## Task 5: Monter `TutorialGate` et ajouter le bouton « ? » (`app.jsx`)

**Files:**
- Modify: `app.jsx:7` (destructuration window), `app.jsx:882-895` (render), `app.jsx:925-946` (Header)

- [ ] **Step 1: Ajouter `TutorialGate` à la destructuration**

Remplacer `app.jsx:7` :
```jsx
const { Team, Arena, Forge, Wallet, Boosts, Perso, Options, ChatFab, RoomFab, Leaderboard, Quests, Campaign, LoginGate } = window;
```
par :
```jsx
const { Team, Arena, Forge, Wallet, Boosts, Perso, Options, ChatFab, RoomFab, Leaderboard, Quests, Campaign, LoginGate, TutorialGate } = window;
```

- [ ] **Step 2: Monter `<TutorialGate />` dans le shell connecté**

Dans le `return` principal de `App` (≈ L893), remplacer :
```jsx
      <Toasts toasts={toasts} />
      {g.wallet && <LoginGate />}
    </FA_Ctx.Provider>
```
par :
```jsx
      <Toasts toasts={toasts} />
      {g.wallet && <TutorialGate />}
      {g.wallet && <LoginGate />}
    </FA_Ctx.Provider>
```

- [ ] **Step 3: Ajouter le bouton « ? » dans `Header`**

Dans le composant `Header` (≈ L935-943), à l'intérieur du `<div className="flex gap8 center wrap" ...>`, juste après le `<div className="lang-switch">…</div>`, ajouter :
```jsx
        <button
          className="btn ghost sm tut-help"
          title={I18N.t("TUT_HELP")}
          aria-label={I18N.t("TUT_HELP")}
          onClick={() => window.dispatchEvent(new Event("fa-open-tutorial"))}
        >?</button>
```

- [ ] **Step 4: Vérification (navigateur, Task 6)**

Pas de runner ; validé à la Task 6. Relecture : `I18N` est en scope module (`app.jsx:5`), `TutorialGate` désormais destructuré (Step 1).

- [ ] **Step 5: Commit**

```bash
git add app.jsx
git commit -m "feat(tutorial): monte TutorialGate + bouton aide ? dans le header"
```

---

## Task 6: Cohabitation avec le cadeau de connexion (`login.jsx`)

**Files:**
- Modify: `login.jsx:8-22` (constante + `useEffect`)

- [ ] **Step 1: Ajouter la constante de clé**

Dans `login.jsx`, juste après les `const` du haut (après L6 `const I18N = window.FA_I18N;`), ajouter :
```jsx
const TUT_KEY = "fractal_arena_tutorial_v1";
```

- [ ] **Step 2: Différer l'ouverture du cadeau si le tuto n'a jamais été vu**

Remplacer le `useEffect` actuel (`login.jsx:14-22`) :
```jsx
  useEffect(() => {
    if (!g.wallet) return;
    let alive = true;
    actions.fetchLoginReward().then((r) => {
      if (!alive) return;
      if (r.ok && r.data.claimable_today) { setData(r.data); setOpen(true); }
    }).catch(() => {});
    return () => { alive = false; };
  }, [g.wallet]);
```
par :
```jsx
  useEffect(() => {
    if (!g.wallet) return;
    let alive = true;
    let onTutClosed = null;
    actions.fetchLoginReward().then((r) => {
      if (!alive) return;
      if (r.ok && r.data.claimable_today) {
        setData(r.data);
        // Cohabitation 1er login : si le tutoriel ne s'est jamais affiché,
        // on diffère le cadeau jusqu'à sa fermeture.
        let seen = false;
        try { seen = localStorage.getItem(TUT_KEY) === "1"; } catch (e) {}
        if (seen) {
          setOpen(true);
        } else {
          onTutClosed = () => setOpen(true);
          window.addEventListener("fa-tutorial-closed", onTutClosed, { once: true });
        }
      }
    }).catch(() => {});
    return () => {
      alive = false;
      if (onTutClosed) window.removeEventListener("fa-tutorial-closed", onTutClosed);
    };
  }, [g.wallet]);
```

- [ ] **Step 3: Vérification (navigateur, Task 7)**

Relecture : `{ once: true }` auto-retire l'écouteur après déclenchement ; le cleanup le retire s'il n'a pas encore tiré (changement de wallet). La clé `TUT_KEY` est identique à celle de `tutorial.jsx`.

- [ ] **Step 4: Commit**

```bash
git add login.jsx
git commit -m "feat(tutorial): cadeau de connexion differe apres le tuto (1er login)"
```

---

## Task 7: Vérification manuelle complète

**Files:** aucun (validation navigateur). Servir en local depuis la racine du repo.

- [ ] **Step 1: Lancer un serveur statique local**

Run (depuis `fractal-arena-web/`) :
```bash
python -m http.server 8080
```
Ouvrir `http://localhost:8080`.

> Note : la connexion réelle exige l'extension UniSat. Pour tester rapidement sans wallet, utiliser le mode manuel (lien « Saisir l'adresse manuellement » sur l'onboarding) avec une adresse `bc1…` de test, OU forcer un wallet en console : `localStorage.setItem("fractal_arena_v1", JSON.stringify({wallet:"bc1ptest..."})); location.reload();`.

- [ ] **Step 2: Cas premier login**

1. Vider l'état : en console, `localStorage.clear(); location.reload();`.
2. Se connecter (UniSat ou manuel).
3. **Attendu** : le carrousel tutoriel s'ouvre automatiquement (diapo 1/5). Le cadeau de connexion N'apparaît PAS encore.

- [ ] **Step 3: Navigation du carrousel**

1. Cliquer « Suivant » → parcourt les 5 diapos ; la 5ᵉ affiche « Commencer ».
2. Cliquer une puce `tut-dot` → saute directement à la diapo correspondante (la puce active passe en orange).
3. **Attendu** : pas de débordement, icône + titre + texte lisibles.

- [ ] **Step 4: Fermeture pose le flag + déclenche le cadeau**

1. Fermer via « Commencer » (ou ✕ / Échap / clic hors-modale / « Passer »).
2. **Attendu** : `localStorage.getItem("fractal_arena_tutorial_v1") === "1"`, et le cadeau de connexion s'ouvre alors (si `claimable_today`).

- [ ] **Step 5: Pas de ré-ouverture automatique**

1. Recharger la page (`location.reload()`).
2. **Attendu** : le tutoriel ne se rouvre PAS tout seul.

- [ ] **Step 6: Bouton « ? » re-consultable**

1. Cliquer le bouton « ? » du header.
2. **Attendu** : le tutoriel se rouvre (diapo 1). Le fermer ne re-déclenche PAS un nouveau cadeau de connexion. Le flag reste `"1"`.

- [ ] **Step 7: 3 langues**

1. Basculer FR / EN / 中文 via le sélecteur du header, rouvrir le tuto via « ? » à chaque langue.
2. **Attendu** : titres et textes traduits, pas de clé brute (`TUT_S1_T`) affichée, pas de débordement.

- [ ] **Step 8: Mobile**

1. Ouvrir les DevTools en mode responsive (largeur ~390px).
2. **Attendu** : modale lisible, boutons « Passer »/« Suivant » accessibles, puces cliquables, bouton « ? » du header visible (cf. `mobile.css`).

- [ ] **Step 9: Re-lancer la suite de tests Node (non-régression)**

Run: `node --test test/`
Expected: PASS — `tutorial-i18n.test.js` + `cosmetic.test.js` verts.

- [ ] **Step 10: Commit final (si ajustements)**

```bash
git add -A
git commit -m "chore(tutorial): ajustements post-verification manuelle"
```

---

## Self-Review (effectuée)

**Couverture spec :**
- Composant `TutorialGate` / carrousel 5 diapos → Task 3 ✓
- Déclenchement auto 1ère connexion + flag localStorage dédié → Task 3 (`useEffect` + `tutSeen`/`markTutSeen`) ✓
- Bouton « ? » re-consultable → Task 5 (Header) + Task 3 (écouteur `fa-open-tutorial`) ✓
- Cohabitation cadeau (tuto d'abord) → Task 6 ✓
- i18n FR/EN/ZH (15 clés) → Task 1 ✓
- Styles `.tut-*` → Task 2 ✓
- Chargement + cache-bust v=27 → Task 4 ✓
- Vérif manuelle (3 langues, mobile, persistance) → Task 7 ✓

**Cohérence des types/noms :** `TUT_KEY` identique dans `tutorial.jsx` (Task 3) et `login.jsx` (Task 6). Événements `fa-open-tutorial` (émis Task 5, écouté Task 3) et `fa-tutorial-closed` (émis Task 3, écouté Task 6) cohérents. Clés i18n `TUT_*` du test (Task 1) = clés utilisées par `SLIDES` et l'UI (Task 3).

**Placeholders :** aucun — tout le code et toutes les commandes sont fournis.
