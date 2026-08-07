# Quiz éducatif crypto — client web (plan d'implémentation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** afficher une bulle-question toutes les 30 secondes, laisser le joueur répondre puis choisir
entre garder ses 10 FA ou les offrir au pool de rachat, et faire défiler les dons dans un bandeau.

**Architecture:** un module autonome `quiz-ui.js` contenant **toute la logique décidable en fonctions
pures** (cadence, éligibilité, mise en pause, formatage du ticker), testé en `node:test` sans DOM —
le pattern exact de `juice-ui.js`. Le rendu et les appels réseau vivent dans `quiz.jsx`, monté par
`app.jsx`.

**Tech Stack:** JS vanille + React (JSX précompilé par `tools/precompile.mjs`), `node:test`.

**Spec:** repo serveur, `docs/superpowers/specs/2026-08-06-quiz-educatif-design.md`
**Prérequis :** le plan serveur est déployé sur Railway (routes `/quiz/*` disponibles en production).

## Global Constraints

- **Le serveur part en premier.** Ne pas livrer ce client tant que `/quiz/next` ne répond pas en prod.
- **Cadence : une bulle toutes les 30 secondes**, toast auto-effacé après **15 secondes**, **jamais
  deux toasts à l'écran**.
- **Pauses** : aucune bulle pendant un combat en résolution, une cinématique ou une signature UniSat.
- **Deux boutons de poids visuel identique** : « Garder 10 FA » / « Offrir au rachat ». Aucun adjectif
  valorisant ou culpabilisant, aucune différence de taille, de couleur ou de contraste.
- **Message factuel** : « 10 FA ajoutés au pool de rachat », jamais « tu soutiens le cours ».
- **Trilingue FR/EN/ZH** : tout libellé d'interface passe par `I18N.t(...)` dans `i18n.js`. Les
  énoncés et explications viennent du serveur et ne sont jamais traduits côté client.
- **Le ticker n'invente jamais rien** : s'il n'y a aucun don, il affiche le cumul communautaire, pas
  un faux joueur.
- **API** : `const API_URL = window.FA_API_URL;` (jamais d'URL en dur). Les appels authentifiés
  suivent le pattern de `claimQuest` dans `app.jsx:1192` — en-tête `Authorization: Bearer`, et sur
  un 401 on relance `actions.authenticate` puis on renvoie `{ ok: false, reason: "retry" }`.
- **Version** : chaque script chargé dans `index.html` porte `?v=<N>`. La livraison passe de
  `v=117` à `v=118` — **toutes** les balises, sans exception.

---

### Task 1 : logique pure de la cadence

**Files:**
- Create: `quiz-ui.js`
- Test: `test/quiz-ui.test.js`

**Interfaces:**
- Produces:
  - `QUIZ_INTERVAL_MS = 30000`, `QUIZ_TOAST_MS = 15000`
  - `shouldAsk(state, now)` → `boolean`
  - `nextDueAt(now)` → `number`
  - `tickerLine(data, t)` → `string` (ligne à afficher dans le bandeau)
- `state` = `{ lastAskAt, toastOpen, busy, wallet }` où `busy` est vrai pendant un combat, une
  cinématique ou une signature.

- [ ] **Step 1 : écrire le test**

```js
// test/quiz-ui.test.js
const test = require("node:test");
const assert = require("node:assert");
require("../quiz-ui.js");
const { QUIZ_INTERVAL_MS, QUIZ_TOAST_MS, shouldAsk, nextDueAt, tickerLine } = global.window.FA_QUIZ_UI;

const base = { lastAskAt: 0, toastOpen: false, busy: false, wallet: "w1" };

test("cadence et duree de toast conformes a la spec", () => {
  assert.strictEqual(QUIZ_INTERVAL_MS, 30000);
  assert.strictEqual(QUIZ_TOAST_MS, 15000);
});

test("demande une question quand le delai est ecoule", () => {
  assert.strictEqual(shouldAsk(base, 30000), true);
  assert.strictEqual(shouldAsk(base, 29999), false);
});

test("jamais deux toasts a l'ecran", () => {
  assert.strictEqual(shouldAsk({ ...base, toastOpen: true }, 999999), false);
});

test("jamais pendant un combat, une cinematique ou une signature", () => {
  assert.strictEqual(shouldAsk({ ...base, busy: true }, 999999), false);
});

test("jamais sans joueur connecte", () => {
  assert.strictEqual(shouldAsk({ ...base, wallet: null }, 999999), false);
});

test("nextDueAt repousse d'un intervalle plein", () => {
  assert.strictEqual(nextDueAt(1000), 31000);
});

test("le ticker montre les dons quand il y en a", () => {
  const t = (k, ...a) => (k === "QUIZ_TICKER_DON" ? `${a[0]} a offert ${a[1]} FA` : `total ${a[0]}`);
  assert.strictEqual(tickerLine({ dons: [{ nom: "Kevin", amount: 10 }], total: 500 }, t),
    "Kevin a offert 10 FA");
});

test("aucun don : cumul communautaire, jamais un faux joueur", () => {
  const t = (k, ...a) => (k === "QUIZ_TICKER_DON" ? `${a[0]} a offert ${a[1]} FA` : `total ${a[0]}`);
  assert.strictEqual(tickerLine({ dons: [], total: 12340 }, t), "total 12340");
});

test("donnees absentes : chaine vide, jamais une exception", () => {
  const t = () => "x";
  assert.strictEqual(tickerLine(null, t), "");
  assert.strictEqual(tickerLine({ dons: [], total: 0 }, t), "");
});
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

Run : `npm test -- test/quiz-ui.test.js`
Attendu : ÉCHEC — `Cannot find module '../quiz-ui.js'`.

- [ ] **Step 3 : écrire `quiz-ui.js`**

```js
/* ============================================================
   FRACTAL ARENA — Quiz éducatif : logique pure.
   Aucun DOM, aucun réseau, aucune horloge implicite : `now` est
   toujours passé en paramètre. quiz.jsx peint le résultat.
   Spec : repo serveur, docs/superpowers/specs/2026-08-06-quiz-educatif-design.md
   ============================================================ */
(function () {
  "use strict";

  const QUIZ_INTERVAL_MS = 30000; // une bulle toutes les 30 s
  const QUIZ_TOAST_MS = 15000;    // puis elle s'efface toute seule

  // Le joueur n'est jamais interrompu : pas pendant un combat, une cinématique
  // ou une signature UniSat, et jamais deux toasts en même temps.
  function shouldAsk(state, now) {
    if (!state || !state.wallet) return false;
    if (state.toastOpen || state.busy) return false;
    return now - (state.lastAskAt || 0) >= QUIZ_INTERVAL_MS;
  }

  function nextDueAt(now) {
    return now + QUIZ_INTERVAL_MS;
  }

  // Le bandeau montre un don réel, sinon le cumul communautaire. Jamais de faux
  // joueur : un bandeau qui invente du trafic se repère tout de suite.
  function tickerLine(data, t) {
    if (!data) return "";
    const dons = data.dons || [];
    if (dons.length > 0) return t("QUIZ_TICKER_DON", dons[0].nom, dons[0].amount);
    if (data.total > 0) return t("QUIZ_TICKER_TOTAL", data.total);
    return "";
  }

  const api = { QUIZ_INTERVAL_MS, QUIZ_TOAST_MS, shouldAsk, nextDueAt, tickerLine };
  if (typeof window === "undefined") { global.window = global.window || {}; }
  window.FA_QUIZ_UI = api;
})();
```

- [ ] **Step 4 : lancer le test, vérifier qu'il passe**

Run : `npm test -- test/quiz-ui.test.js`
Attendu : tous les tests PASS.

- [ ] **Step 5 : commit**

```bash
git add quiz-ui.js test/quiz-ui.test.js
git commit -m "quiz: logique pure de la cadence et du ticker"
```

---

### Task 2 : libellés trilingues

**Files:**
- Modify: `i18n.js`
- Test: `test/quiz-i18n.test.js`

**Interfaces:**
- Produces: les clés `QUIZ_*` dans `window.FA_I18N`.

- [ ] **Step 1 : écrire le test**

Reprendre le style de `test/arene-i18n.test.js` (vérifier comment il charge `i18n.js` et adapter).

```js
// test/quiz-i18n.test.js
const test = require("node:test");
const assert = require("node:assert");
require("../i18n.js");

const CLES = [
  "QUIZ_KEEP", "QUIZ_GIVE", "QUIZ_CORRECT", "QUIZ_WRONG", "QUIZ_REVIEW",
  "QUIZ_GIVEN", "QUIZ_TICKER_DON", "QUIZ_TICKER_TOTAL",
  "QUIZ_TITLE_KNOWLEDGE", "QUIZ_TITLE_CONTRIB",
];

test("toutes les cles du quiz existent en FR, EN et ZH", () => {
  for (const cle of CLES) {
    for (const lang of ["FR", "EN", "ZH"]) {
      const v = global.window.FA_I18N._T ? global.window.FA_I18N._T[cle] : null;
      assert.ok(v && v[lang] && v[lang].trim(), `${cle}/${lang} manquant`);
    }
  }
});

test("les deux boutons ne portent aucun adjectif valorisant", () => {
  const T = global.window.FA_I18N._T;
  for (const lang of ["FR", "EN", "ZH"]) {
    assert.ok(!/héros|hero|sois|be a /i.test(T.QUIZ_GIVE[lang]), `${lang} : bouton culpabilisant`);
  }
});
```

Si `FA_I18N` n'expose pas sa table, ajouter `_T: T` à son export — c'est la seule façon de tester la
complétude des trois langues.

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

Run : `npm test -- test/quiz-i18n.test.js`
Attendu : ÉCHEC — clés manquantes.

- [ ] **Step 3 : ajouter les libellés dans `i18n.js`**

À placer près du bloc des quêtes, en suivant le format exact `{ FR, EN, ZH }` du fichier.

```js
    // --- Quiz éducatif ---
    QUIZ_KEEP: { FR: "Garder 10 FA", EN: "Keep 10 FA", ZH: "保留 10 FA" },
    QUIZ_GIVE: { FR: "Offrir au rachat", EN: "Give to buyback", ZH: "捐给回购池" },
    QUIZ_CORRECT: { FR: "Bonne réponse", EN: "Correct", ZH: "回答正确" },
    QUIZ_WRONG: { FR: "Mauvaise réponse", EN: "Wrong answer", ZH: "回答错误" },
    QUIZ_REVIEW: { FR: "Révision — sans récompense", EN: "Review — no reward", ZH: "复习 — 无奖励" },
    QUIZ_GIVEN: { FR: "%d FA ajoutés au pool de rachat", EN: "%d FA added to the buyback pool", ZH: "已向回购池注入 %d FA" },
    QUIZ_TICKER_DON: { FR: "%s a offert %d FA au rachat", EN: "%s gave %d FA to the buyback", ZH: "%s 向回购池捐赠了 %d FA" },
    QUIZ_TICKER_TOTAL: { FR: "Les joueurs ont offert %d FA au rachat", EN: "Players have given %d FA to the buyback", ZH: "玩家已向回购池捐赠 %d FA" },
    QUIZ_TITLE_KNOWLEDGE: { FR: "Savoir", EN: "Knowledge", ZH: "知识" },
    QUIZ_TITLE_CONTRIB: { FR: "Contribution", EN: "Contribution", ZH: "贡献" },
```

- [ ] **Step 4 : lancer le test, vérifier qu'il passe**

Run : `npm test -- test/quiz-i18n.test.js`
Attendu : tous les tests PASS.

- [ ] **Step 5 : commit**

```bash
git add i18n.js test/quiz-i18n.test.js
git commit -m "quiz: libelles FR/EN/ZH"
```

---

### Task 3 : appels réseau

**Files:**
- Modify: `app.jsx` (bloc `actions`, à côté de `fetchQuests` / `claimQuest` ~ligne 1180)
- Test: `test/quiz-wiring.test.js`

**Interfaces:**
- Produces: `actions.fetchQuizQuestion()` → `{ ok, data }`,
  `actions.answerQuiz(questionId, choice, destination)` → `{ ok, data }`,
  `actions.donateQuiz(questionId)` → `{ ok, data }`,
  `actions.fetchQuizTicker()` → `{ ok, data }`.

- [ ] **Step 1 : écrire le test**

Le test lit la source — c'est le style de `test/account-wiring.test.js` (vérifier ce fichier et s'en
inspirer).

```js
// test/quiz-wiring.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");

test("les quatre appels quiz existent", () => {
  for (const fn of ["fetchQuizQuestion", "answerQuiz", "donateQuiz", "fetchQuizTicker"]) {
    assert.ok(src.includes(fn), fn + " absent");
  }
});

test("answerQuiz est authentifie et gere le 401", () => {
  const bloc = src.slice(src.indexOf("async answerQuiz"), src.indexOf("async answerQuiz") + 1200);
  assert.match(bloc, /Authorization/);
  assert.match(bloc, /401/);
});

test("aucune URL d'API en dur", () => {
  const bloc = src.slice(src.indexOf("async fetchQuizQuestion"), src.indexOf("async fetchQuizTicker") + 800);
  assert.ok(!/https?:\/\//.test(bloc), "utiliser API_URL");
});
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

Run : `npm test -- test/quiz-wiring.test.js`
Attendu : ÉCHEC — fonctions absentes.

- [ ] **Step 3 : ajouter les trois actions dans `app.jsx`**

```jsx
    async fetchQuizQuestion() {
      const s = gRef.current;
      if (!s.wallet) return { ok: false };
      try {
        const lang = encodeURIComponent(I18N.lang || "FR");
        const resp = await fetch(`${API_URL}/quiz/next/${encodeURIComponent(s.wallet)}?lang=${lang}`);
        if (!resp.ok) return { ok: false };
        return { ok: true, data: await resp.json() };
      } catch (e) {
        return { ok: false };
      }
    },
    async answerQuiz(questionId, choice, destination) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const lang = encodeURIComponent(I18N.lang || "FR");
        const resp = await fetch(`${API_URL}/quiz/answer?lang=${lang}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ question_id: questionId, choice, destination }),
        });
        if (resp.status === 401) {
          const re = await actions.authenticate(gRef.current.wallet);
          if (!re) { toast(I18N.t("AUTH_EXPIRED"), "bad"); return { ok: false, reason: "auth" }; }
          return { ok: false, reason: "retry" };
        }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return { ok: false, reason: err.error || `Erreur ${resp.status}` };
        }
        const data = await resp.json();
        if (data.reward > 0) setG((st) => ({ ...st, locked: (st.locked || 0) + data.reward }));
        return { ok: true, data };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    async fetchQuizTicker() {
      try {
        const resp = await fetch(`${API_URL}/quiz/ticker`);
        if (!resp.ok) return { ok: false };
        return { ok: true, data: await resp.json() };
      } catch (e) {
        return { ok: false };
      }
    },
```

Vérifier le nom exact de la langue courante (`I18N.lang` ou équivalent) :
Run : `grep -n "lang" i18n.js | head -10`

- [ ] **Step 4 : lancer le test, vérifier qu'il passe**

Run : `npm test -- test/quiz-wiring.test.js`
Attendu : tous les tests PASS.

- [ ] **Step 5 : commit**

```bash
git add app.jsx test/quiz-wiring.test.js
git commit -m "quiz: appels reseau next/answer/ticker"
```

---

### Task 4 : le toast

**Files:**
- Create: `quiz.jsx`
- Modify: `styles.css`, `index.html`
- Test: `test/quiz-toast.test.js`

**Interfaces:**
- Consumes: `window.FA_QUIZ_UI` (Task 1), `actions.fetchQuizQuestion` / `answerQuiz` (Task 3).
- Produces: le composant `QuizToast`, monté par `app.jsx`.

États du toast :

1. **Question** — énoncé + trois réponses cliquables.
2. **Choix de la destination** — seulement si la réponse est bonne et que ce n'est pas une révision :
   les deux boutons.
3. **Explication** — verdict, bonne réponse, explication du serveur. Se ferme au bout de 6 secondes
   ou au clic.

- [ ] **Step 1 : écrire le test**

```js
// test/quiz-toast.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "quiz.jsx"), "utf8");
const css = fs.readFileSync(path.join(__dirname, "..", "styles.css"), "utf8");

test("les deux boutons passent par i18n, jamais de texte en dur", () => {
  assert.match(src, /QUIZ_KEEP/);
  assert.match(src, /QUIZ_GIVE/);
  assert.ok(!/Garder 10 FA/.test(src), "libelle en dur");
});

test("le choix de destination n'apparait pas en revision", () => {
  assert.match(src, /revision/);
});

test("les deux boutons partagent la meme classe CSS (poids visuel identique)", () => {
  const boutons = src.match(/className="[^"]*quiz-choice[^"]*"/g) || [];
  assert.ok(boutons.length >= 2, "les deux boutons doivent porter la meme classe");
});

test("la classe du toast existe dans styles.css", () => {
  assert.match(css, /\.quiz-toast/);
});
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

Run : `npm test -- test/quiz-toast.test.js`
Attendu : ÉCHEC — `quiz.jsx` absent.

- [ ] **Step 3 : écrire `quiz.jsx`**

S'inspirer de la structure d'un composant existant monté globalement (regarder comment `tutorial.jsx`
s'affiche par-dessus l'app). Points obligatoires :

- minuteur qui appelle `shouldAsk(state, Date.now())` chaque seconde ;
- `busy` branché sur l'état réel du jeu (combat en cours, cinématique, signature) ;
- auto-effacement après `QUIZ_TOAST_MS` sans réponse, **sans** appeler `/quiz/answer` (une question
  ignorée n'est pas consommée) ;
- **le déroulé du choix garder/offrir**, qui découle d'une contrainte incontournable : le joueur ne
  peut pas décider avant de savoir si sa réponse est juste, et le serveur ne révèle jamais la bonne
  réponse à l'avance. Donc :
  1. le clic sur une réponse envoie `POST /quiz/answer` avec `destination: "garder"` ;
  2. si le serveur répond `correct: true` et `revision: false`, les 10 FA sont **déjà crédités** et
     le toast affiche l'explication **plus** le bouton « Offrir au rachat » ;
  3. ce bouton appelle `POST /quiz/donate` (tâche 7b du plan serveur), qui reprend les 10 FA et les
     verse au pool. Fenêtre de 60 secondes, ensuite le bouton disparaît.
- pour que les deux boutons gardent le **même poids visuel** malgré ce déroulé, « Garder » reste
  affiché à côté de « Offrir » (il ferme simplement le toast) : le joueur voit deux options
  équivalentes, jamais un unique bouton « Offrir » qui ressemblerait à une injonction.

- [ ] **Step 4 : styles**

Ajouter dans `styles.css` : `.quiz-toast` (coin bas-droite, largeur maximale ~320 px, au-dessus du
contenu mais **sous** les modales), `.quiz-choice` (la classe unique des boutons — même fond, même
bordure, même graisse), `.quiz-explain`. Prévoir le repli mobile dans `mobile.css` si le toast
déborde.

- [ ] **Step 5 : monter le composant**

Dans `app.jsx`, monter `<QuizToast />` au même niveau que les autres surcouches globales. Ajouter le
script dans `index.html` avec `?v=118`.

- [ ] **Step 6 : lancer les tests**

Run : `npm test`
Attendu : tout passe.

- [ ] **Step 7 : commit**

```bash
git add quiz.jsx styles.css mobile.css index.html app.jsx test/quiz-toast.test.js
git commit -m "quiz: toast de question et choix de destination"
```

---

### Task 5 : bandeau des dons

**Files:**
- Modify: `quiz.jsx`, `styles.css`
- Test: `test/quiz-ticker.test.js`

- [ ] **Step 1 : écrire le test**

```js
// test/quiz-ticker.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const src = fs.readFileSync(path.join(__dirname, "..", "quiz.jsx"), "utf8");

test("le bandeau utilise tickerLine (aucune mise en forme dupliquee)", () => {
  assert.match(src, /tickerLine/);
});

test("le bandeau ne fabrique jamais de nom de joueur", () => {
  assert.ok(!/Joueur \$\{|nom \|\| "/.test(src), "aucun nom inventé côté client");
});

test("le bandeau est rafraichi au plus toutes les 30 s", () => {
  assert.match(src, /30000|QUIZ_INTERVAL_MS/);
});
```

- [ ] **Step 2 : lancer le test, vérifier qu'il échoue**

Run : `npm test -- test/quiz-ticker.test.js`
Attendu : ÉCHEC.

- [ ] **Step 3 : implémenter le bandeau**

Une barre fine, une ligne, qui appelle `fetchQuizTicker()` toutes les 30 secondes et affiche
`tickerLine(data, I18N.t)`. Si la ligne est vide, **ne rien afficher du tout** — pas de barre vide.

- [ ] **Step 4 : lancer le test, vérifier qu'il passe**

Run : `npm test -- test/quiz-ticker.test.js`
Attendu : tous les tests PASS.

- [ ] **Step 5 : commit**

```bash
git add quiz.jsx styles.css test/quiz-ticker.test.js
git commit -m "quiz: bandeau des dons"
```

---

### Task 6 : titres de prestige dans le profil

**Files:**
- Modify: `account.jsx` (ou l'écran « Perso » selon l'emplacement du profil), `app.jsx`
- Test: `test/quiz-titles-ui.test.js`

- [ ] **Step 1 : localiser l'écran de profil**

Run : `grep -rn "NAV_PERSO\|NAV_OPTIONS" *.jsx | head -5`
Choisir l'écran où le joueur voit déjà son identité, et y ajouter le bloc.

- [ ] **Step 2 : écrire le test**

```js
// test/quiz-titles-ui.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const files = ["account.jsx", "app.jsx"].map((f) =>
  fs.readFileSync(path.join(__dirname, "..", f), "utf8")).join("\n");

test("les deux compteurs et les deux titres sont affiches", () => {
  assert.match(files, /knowledge_title/);
  assert.match(files, /contribution_title/);
});

test("le joueur choisit le titre qu'il affiche", () => {
  assert.match(files, /quizTitleChoice|title_choice/);
});
```

- [ ] **Step 3 : lancer le test, vérifier qu'il échoue**

Run : `npm test -- test/quiz-titles-ui.test.js`
Attendu : ÉCHEC.

- [ ] **Step 4 : implémenter**

Appeler `GET /quiz/profile/:wallet`, afficher les deux compteurs avec leur titre, et un sélecteur
(deux boutons radio) pour choisir lequel s'affiche à côté du nom. Le choix est **local** en v1
(`localStorage`, clé `fa_quiz_title_choice`) — aucune route serveur supplémentaire.

- [ ] **Step 5 : lancer le test, vérifier qu'il passe**

Run : `npm test -- test/quiz-titles-ui.test.js`
Attendu : tous les tests PASS.

- [ ] **Step 6 : commit**

```bash
git add account.jsx app.jsx test/quiz-titles-ui.test.js
git commit -m "quiz: titres de prestige dans le profil"
```

---

### Task 7 : version, build et vérification réelle

- [ ] **Step 1 : passer toutes les balises de `v=117` à `v=118`**

Run : `grep -c "v=117" index.html`
Puis remplacer, et vérifier : `grep -c "v=117" index.html` doit renvoyer `0`.

- [ ] **Step 2 : construire**

Run : `npm run build`
Attendu : aucune erreur ; les fichiers de `build/` sont régénérés.

- [ ] **Step 3 : toute la suite**

Run : `npm test`
Attendu : aucun échec.

- [ ] **Step 4 : essai réel en local**

Monter la stack locale (`dev-local.ps1` du repo serveur), ouvrir `localhost:8080`, se connecter, et
vérifier de ses yeux :

- une bulle apparaît au bout de 30 secondes ;
- elle s'efface seule après 15 secondes et la même question peut revenir ;
- une bonne réponse crédite 10 FA verrouillés ;
- « Offrir au rachat » fait bouger la jauge de rachat et fait apparaître la ligne dans le bandeau ;
- aucune bulle pendant un combat ou une cinématique ;
- basculer en EN puis en ZH : aucun libellé ne reste en français.

- [ ] **Step 5 : ouvrir la PR**

```bash
git push -u origin <branche>
gh pr create --title "Quiz educatif crypto (client, v118)" --body "Bulles de quiz toutes les 30 s, choix garder/offrir, bandeau des dons, titres de prestige. Serveur deja deploye."
```

- [ ] **Step 6 : vérifier la production**

Après merge et déploiement GitHub Pages, ouvrir `fractalarena.com`, vérifier que la v118 est bien
servie (et non une version en cache), et refaire l'essai « une bulle, une réponse, un don » en réel.
