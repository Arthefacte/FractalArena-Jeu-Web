# Jouer sans wallet — Plan d'implémentation (volet WEB)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre d'entrer dans le jeu en un clic sans installer UniSat — y compris sur mobile — en consommant les routes serveur de la PR #66, et rendre visible l'état « gains verrouillés » ainsi que la marche à suivre pour débloquer.

**Architecture:** Le compte généré *est* un wallet : une fois `g.wallet` et `g.authToken` posés, tout le client existant (Fosse, Tour, PvP, forge, classements) fonctionne sans modification. Le volet web se réduit donc à quatre choses : trois appels d'API, un écran de secrets affiché une seule fois, un bandeau de rappel, et une règle de persistance du token. La logique décidable vit dans `account-ui.js` (helpers purs testables en Node, à la manière de `tour-ui.js`) ; les écrans dans `account.jsx`.

**Tech Stack:** React 18 sans build (Babel in-browser), modules globaux via `Object.assign(window, …)`, i18n maison `window.FA_I18N`, tests `node:test` par lecture de source et logique pure.

## Global Constraints

- **Dépend de la PR serveur #66** (`feat/compte-sans-wallet`). Ne pas merger ce volet avant elle : les routes `/account/create`, `/auth/recover`, `/account/verify-onchain` n'existent pas sans elle.
- **Spec de référence :** `docs/superpowers/specs/2026-07-26-compte-sans-wallet-design.md` (dépôt serveur), §9 pour le client.
- **Branche** `feat/compte-sans-wallet-web`, worktree `wt-sanswallet-web`, créée depuis `origin/main` (v91).
- **i18n obligatoire FR/EN/ZH** pour chaque libellé ajouté — c'est une règle du dépôt, vérifiée par test.
- **Cache-bust** : `?v=91` → `?v=92` sur TOUTES les balises de `index.html`, sinon les navigateurs servent l'ancien code.
- **La seed n'est jamais redemandée** : aucun champ de saisie du client ne doit accepter 12 mots. Seul le code de récupération est saisi. C'est la règle anti-phishing de la spec §7.
- **La seed et le code ne sont jamais persistés** : ni `localStorage`, ni `sessionStorage`, ni le blob de sauvegarde. Ils vivent dans un état React le temps de l'écran, puis disparaissent.
- **Décision du user (2026-07-27) — persistance du token :** `localStorage` **uniquement** pour les comptes générés ; les comptes UniSat gardent `sessionStorage`. Un compte UniSat peut re-signer silencieusement, pas un compte généré. L'exposition XSS reste bornée aux comptes générés.
- **Décision du user (2026-07-27) — mobile :** le blocage mobile est levé. « Jouer maintenant » s'affiche sur mobile ; seule la connexion UniSat y reste indisponible.
- **Tests :** `npm test` (= `node --test --test-force-exit test/*.test.js`). Sous Git Bash, `node --test test/` produit un faux échec par mangling de chemin.
- **Ne pas toucher** : `engine.js` n'existe plus, `data.js`, le moteur de combat, la Fosse, la Tour, le PvP, la forge. Ils opèrent sur `g.wallet` et ne voient pas la différence.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâches |
|---|---|---|
| `account-ui.js` | *Créé.* Helpers purs : choix du stockage selon le type de compte, lecture/écriture/effacement du token, validation du code de récupération, décision d'affichage du bandeau. | 1 |
| `i18n.js` | *Modifié.* Libellés FR/EN/ZH de tous les écrans ajoutés. | 2 |
| `app.jsx` | *Modifié.* Actions `createAccount` / `recoverAccount` / `verifyOnchain`, bascule des helpers de token vers `account-ui.js`, reconnexion auto d'un compte généré, Onboarding. | 3, 6, 7 |
| `account.jsx` | *Créé.* `SecretsGate` (écran des secrets), `RecoverScreen`, `LockedBanner`. | 4, 5, 6 |
| `index.html` | *Modifié.* Déclaration des deux nouveaux fichiers + cache-bust v92. | 8 |
| `styles.css` | *Modifié.* Styles du bandeau et de l'écran des secrets. | 4, 6 |
| `test/account-ui.test.js` | *Créé.* Helpers purs. | 1 |
| `test/account-i18n.test.js` | *Créé.* Présence des clés dans les 3 langues. | 2 |
| `test/account-wiring.test.js` | *Créé.* Câblage : routes appelées, anti-phishing, déclaration dans index.html. | 3, 5, 7, 8 |

**Ordre imposé** : la Task 1 (helpers) et la Task 2 (i18n) n'ont aucune dépendance et fondent tout le reste. La Task 3 (actions) doit précéder les écrans qui les appellent (4, 5, 6, 7). La Task 8 câble et vérifie l'ensemble.

---

### Task 1 : Helpers purs — stockage du token et décisions d'affichage

**Files:**
- Create: `account-ui.js`
- Test: `test/account-ui.test.js`

**Interfaces:**
- Consumes: rien.
- Produces (sur `window.FA_ACCOUNT`) :
  - `KIND_GENERATED = "generated"` / `KIND_UNISAT = "unisat"`
  - `readToken() → string` — lit sessionStorage puis localStorage.
  - `writeToken(token, kind) → void` — écrit dans le bon stockage selon `kind`, et purge l'autre.
  - `clearToken() → void` — efface les deux stockages et le type.
  - `readKind() → string` — `""` si inconnu.
  - `isValidRecoveryCode(s) → boolean`
  - `looksLikeSeed(s) → boolean`
  - `shouldShowLockedBanner({kind, onchainVerified, dismissedAt, now}) → boolean`

**Pourquoi des helpers purs :** ce sont les seules décisions du volet web qui méritent un test, et le dépôt a déjà ce pattern (`tour-ui.js`, `market-ui.js`, `juice-ui.js`) : une IIFE qui expose sur `window`, testable en Node parce qu'elle ne touche ni React ni le DOM.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/account-ui.test.js` :

```js
// test/account-ui.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

// Le module est une IIFE qui écrit sur `window` : on lui fournit un window et des
// stockages factices, puis on l'évalue. Même approche que test/tour-ui.test.js.
function load() {
  const src = fs.readFileSync(path.join(__dirname, "..", "account-ui.js"), "utf8");
  function mkStore() {
    const m = new Map();
    return {
      getItem: (k) => (m.has(k) ? m.get(k) : null),
      setItem: (k, v) => m.set(k, String(v)),
      removeItem: (k) => m.delete(k),
      _map: m,
    };
  }
  const win = { localStorage: mkStore(), sessionStorage: mkStore() };
  const fn = new Function("window", "localStorage", "sessionStorage", src);
  fn(win, win.localStorage, win.sessionStorage);
  return { A: win.FA_ACCOUNT, win };
}

test("un compte UniSat garde sessionStorage (comportement d'avant inchange)", () => {
  const { A, win } = load();
  A.writeToken("tok-unisat", A.KIND_UNISAT);
  assert.strictEqual(win.sessionStorage.getItem("fa_auth_token"), "tok-unisat");
  assert.strictEqual(win.localStorage.getItem("fa_auth_token"), null,
    "un token UniSat ne doit JAMAIS atterrir en localStorage (audit 2026-06-24)");
  assert.strictEqual(A.readToken(), "tok-unisat");
});

test("un compte genere persiste en localStorage", () => {
  const { A, win } = load();
  A.writeToken("tok-gen", A.KIND_GENERATED);
  assert.strictEqual(win.localStorage.getItem("fa_auth_token"), "tok-gen");
  assert.strictEqual(A.readToken(), "tok-gen");
  assert.strictEqual(A.readKind(), A.KIND_GENERATED);
});

test("changer de type purge l'autre stockage (jamais deux tokens en vie)", () => {
  const { A, win } = load();
  A.writeToken("tok-gen", A.KIND_GENERATED);
  A.writeToken("tok-unisat", A.KIND_UNISAT);
  assert.strictEqual(win.localStorage.getItem("fa_auth_token"), null);
  assert.strictEqual(A.readToken(), "tok-unisat");
});

test("clearToken efface les deux stockages et le type", () => {
  const { A, win } = load();
  A.writeToken("tok-gen", A.KIND_GENERATED);
  A.clearToken();
  assert.strictEqual(A.readToken(), "");
  assert.strictEqual(A.readKind(), "");
  assert.strictEqual(win.localStorage.getItem("fa_auth_token"), null);
  assert.strictEqual(win.sessionStorage.getItem("fa_auth_token"), null);
});

test("writeToken('') efface sans rien laisser", () => {
  const { A } = load();
  A.writeToken("tok-gen", A.KIND_GENERATED);
  A.writeToken("", A.KIND_GENERATED);
  assert.strictEqual(A.readToken(), "");
});

test("un stockage indisponible (mode prive) ne fait jamais planter", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "account-ui.js"), "utf8");
  const boom = { getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); }, removeItem() { throw new Error("denied"); } };
  const win = { localStorage: boom, sessionStorage: boom };
  new Function("window", "localStorage", "sessionStorage", src)(win, boom, boom);
  assert.doesNotThrow(() => win.FA_ACCOUNT.writeToken("t", "generated"));
  assert.strictEqual(win.FA_ACCOUNT.readToken(), "");
});

test("code de recuperation : accepte le format du serveur, refuse le reste", () => {
  const { A } = load();
  // makeRecoveryCode() serveur = randomBytes(24).toString("base64url") → 32 caracteres URL-safe.
  assert.ok(A.isValidRecoveryCode("abcdefghij_klmnopqrst-uvwxyz01234"));
  assert.ok(A.isValidRecoveryCode("  abcdefghij_klmnopqrst-uvwxyz012  "), "les espaces autour sont tolerés");
  assert.ok(!A.isValidRecoveryCode("court"));
  assert.ok(!A.isValidRecoveryCode(""));
  assert.ok(!A.isValidRecoveryCode(null));
  assert.ok(!A.isValidRecoveryCode("a".repeat(300)), "borne haute : pas d'envoi demesure");
  assert.ok(!A.isValidRecoveryCode("abc def ghi jkl mno pqr stu vwx yza bcd efg hij"), "espaces internes = ce n'est pas un code");
});

test("looksLikeSeed detecte une phrase mnemonique (garde anti-phishing)", () => {
  const { A } = load();
  const seed12 = "abandon ability able about above absent absorb abstract absurd abuse access accident";
  assert.ok(A.looksLikeSeed(seed12), "12 mots = seed");
  assert.ok(A.looksLikeSeed("  " + seed12 + "  "));
  assert.ok(!A.looksLikeSeed("abcdefghij_klmnopqrst-uvwxyz01234"), "un code de recuperation n'est pas une seed");
  assert.ok(!A.looksLikeSeed("deux mots"));
  assert.ok(!A.looksLikeSeed(""));
});

test("bandeau : visible seulement pour un compte genere non verifie", () => {
  const { A } = load();
  const now = 1_000_000_000_000;
  assert.ok(A.shouldShowLockedBanner({ kind: "generated", onchainVerified: false, dismissedAt: 0, now }));
  assert.ok(!A.shouldShowLockedBanner({ kind: "generated", onchainVerified: true, dismissedAt: 0, now }),
    "compte verifie : plus rien a rappeler");
  assert.ok(!A.shouldShowLockedBanner({ kind: "unisat", onchainVerified: false, dismissedAt: 0, now }),
    "un joueur venu avec son wallet n'est jamais concerne");
});

test("bandeau : ferme, il se tait 24 h puis revient", () => {
  const { A } = load();
  const now = 1_000_000_000_000;
  const base = { kind: "generated", onchainVerified: false, now };
  assert.ok(!A.shouldShowLockedBanner({ ...base, dismissedAt: now - 3600_000 }), "1 h après : silencieux");
  assert.ok(A.shouldShowLockedBanner({ ...base, dismissedAt: now - 25 * 3600_000 }), "25 h après : revient");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test --test-force-exit test/account-ui.test.js`
Expected: FAIL — `account-ui.js` n'existe pas (`ENOENT`).

- [ ] **Step 3: Écrire l'implémentation**

Créer `account-ui.js` :

```js
/* ============================================================
   FRACTAL ARENA — Compte sans wallet : helpers purs (testables Node)
   Le serveur fait foi (accounts.js) : ici, seulement les decisions
   d'affichage et la regle de stockage du jeton de session.
   ============================================================ */
(function () {
  const TOKEN_KEY = "fa_auth_token";
  const KIND_KEY = "fa_account_kind";
  const KIND_GENERATED = "generated";
  const KIND_UNISAT = "unisat";

  // Un compte UniSat peut re-signer silencieusement a tout moment : son jeton
  // reste en sessionStorage (efface a la fermeture de l'onglet), comme decide a
  // l'audit 2026-06-24. Un compte genere, lui, n'a rien a re-signer — sans
  // persistance il faudrait ressaisir le code de recuperation a chaque fois.
  // L'exposition XSS reste donc bornee aux comptes generes.
  function store(kind) {
    return kind === KIND_GENERATED ? window.localStorage : window.sessionStorage;
  }
  function get(s, k) { try { return s.getItem(k) || ""; } catch (e) { return ""; } }
  function set(s, k, v) { try { s.setItem(k, v); } catch (e) {} }
  function del(s, k) { try { s.removeItem(k); } catch (e) {} }

  function readKind() { return get(window.localStorage, KIND_KEY); }

  function readToken() {
    return get(window.sessionStorage, TOKEN_KEY) || get(window.localStorage, TOKEN_KEY);
  }

  function writeToken(token, kind) {
    const k = kind || readKind() || KIND_UNISAT;
    if (!token) { clearToken(); return; }
    // Purger l'autre stockage AVANT d'ecrire : jamais deux jetons en vie, sinon
    // readToken pourrait rendre le perime apres un changement de compte.
    del(k === KIND_GENERATED ? window.sessionStorage : window.localStorage, TOKEN_KEY);
    set(store(k), TOKEN_KEY, token);
    set(window.localStorage, KIND_KEY, k);
  }

  function clearToken() {
    del(window.sessionStorage, TOKEN_KEY);
    del(window.localStorage, TOKEN_KEY);
    del(window.localStorage, KIND_KEY);
  }

  // makeRecoveryCode() serveur : randomBytes(24).toString("base64url") → 32
  // caracteres de l'alphabet base64url. On borne large mais on borne (le serveur
  // refuse au-dela de 256).
  const CODE_RE = /^[A-Za-z0-9_-]{24,256}$/;
  function isValidRecoveryCode(s) {
    return typeof s === "string" && CODE_RE.test(s.trim());
  }

  // Garde anti-phishing : si le joueur colle sa seed dans le champ du code, on
  // refuse AVANT tout envoi reseau et on l'avertit. La seed ne doit jamais
  // quitter sa machine, y compris vers nous.
  function looksLikeSeed(s) {
    if (typeof s !== "string") return false;
    const words = s.trim().split(/\s+/).filter(Boolean);
    return words.length >= 11 && words.every((w) => /^[a-zA-Z]+$/.test(w));
  }

  const BANNER_SNOOZE_MS = 24 * 3600 * 1000;
  function shouldShowLockedBanner(o) {
    const s = o || {};
    if (s.kind !== KIND_GENERATED) return false;
    if (s.onchainVerified) return false;
    const now = s.now || 0;
    const dismissed = s.dismissedAt || 0;
    return now - dismissed >= BANNER_SNOOZE_MS;
  }

  window.FA_ACCOUNT = {
    KIND_GENERATED, KIND_UNISAT, TOKEN_KEY, KIND_KEY, BANNER_SNOOZE_MS,
    readToken, writeToken, clearToken, readKind,
    isValidRecoveryCode, looksLikeSeed, shouldShowLockedBanner,
  };
})();
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `node --test --test-force-exit test/account-ui.test.js`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add account-ui.js test/account-ui.test.js
git commit -m "feat(compte): helpers purs de session et de decision d'affichage"
```

---

### Task 2 : Libellés FR / EN / ZH

**Files:**
- Modify: `i18n.js`
- Test: `test/account-i18n.test.js`

**Interfaces:**
- Consumes: rien.
- Produces: les clés `ACC_*` consommées par les tâches 4 à 7.

**Contexte :** `i18n.js` est un objet `T` de clés, chacune `{ FR, EN, ZH }`. La fonction `I18N.t(key, ...args)` interpole `%s` / `%d`. Ajouter le bloc à la suite des clés `OB_*` (onboarding), dont il est le voisin logique.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/account-i18n.test.js` :

```js
// test/account-i18n.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

const KEYS = [
  "ACC_PLAY_NOW", "ACC_PLAY_NOW_SUB", "ACC_HAVE_WALLET", "ACC_CREATING",
  "ACC_CREATE_FAIL", "ACC_SECRETS_TITLE", "ACC_SECRETS_INTRO",
  "ACC_CODE_LABEL", "ACC_CODE_HINT", "ACC_COPY", "ACC_COPIED",
  "ACC_SEED_LABEL", "ACC_SEED_HINT", "ACC_SEED_REVEAL", "ACC_SEED_HIDE",
  "ACC_PHISHING_WARN", "ACC_CONFIRM_SAVED", "ACC_CONTINUE",
  "ACC_RECOVER_LINK", "ACC_RECOVER_TITLE", "ACC_RECOVER_SUB",
  "ACC_RECOVER_PLACEHOLDER", "ACC_RECOVER_BTN", "ACC_RECOVER_FAIL",
  "ACC_RECOVER_SEED_REFUSED", "ACC_RECOVER_RATE",
  "ACC_LOCKED_BANNER", "ACC_LOCKED_HOW", "ACC_LOCKED_CLOSE",
  "ACC_HOWTO_TITLE", "ACC_HOWTO_1", "ACC_HOWTO_2", "ACC_HOWTO_3", "ACC_HOWTO_CAP",
  "ACC_VERIFY_BTN", "ACC_VERIFY_OK", "ACC_VERIFY_NONE",
];

function bloc(cle) {
  const m = SRC.match(new RegExp("\\b" + cle + ":\\s*\\{[^}]*\\}"));
  return m ? m[0] : null;
}

test("toutes les cles du compte sans wallet existent en FR/EN/ZH", () => {
  const manquantes = [];
  for (const k of KEYS) {
    const b = bloc(k);
    if (!b) { manquantes.push(k + " (absente)"); continue; }
    for (const lang of ["FR", "EN", "ZH"]) {
      if (!new RegExp(lang + ":").test(b)) manquantes.push(k + " → " + lang);
    }
  }
  assert.deepStrictEqual(manquantes, []);
});

test("aucune traduction vide", () => {
  for (const k of KEYS) {
    const b = bloc(k);
    for (const lang of ["FR", "EN", "ZH"]) {
      const m = b.match(new RegExp(lang + ':\\s*"([^"]*)"'));
      assert.ok(m && m[1].trim().length > 0, `${k} → ${lang} vide`);
    }
  }
});

test("l'avertissement anti-phishing nomme le jeu (une consigne vague ne protege personne)", () => {
  const b = bloc("ACC_PHISHING_WARN");
  assert.match(b, /Fractal Arena/, "l'avertissement doit dire que MEME Fractal Arena ne demandera jamais la seed");
});

test("le message du bandeau ne promet pas de deverrouillage total", () => {
  // Le deverrouillage est plafonne au montant depose (serveur §8.4) : le libelle
  // ne doit pas laisser croire qu'un depot symbolique debloque tout.
  const b = bloc("ACC_HOWTO_CAP");
  assert.ok(b, "ACC_HOWTO_CAP absente");
  for (const lang of ["FR", "EN", "ZH"]) assert.match(b, new RegExp(lang + ":"));
});

test("le mobile n'est plus annonce comme bloque", () => {
  const b = bloc("OB_MOBILE_MSG");
  if (!b) return; // cle supprimee : acceptable
  assert.ok(!/extension UniSat\. La version mobile arrive bientôt/.test(b),
    "OB_MOBILE_MSG promet encore que le mobile n'est pas jouable");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test --test-force-exit test/account-i18n.test.js`
Expected: FAIL — toutes les clés `ACC_*` sont absentes.

- [ ] **Step 3: Ajouter les libellés**

Dans `i18n.js`, juste après la dernière clé `OB_*` (`OB_MOBILE_MSG`, ~ligne 107) :

```js
    // --- Compte sans wallet ---
    ACC_PLAY_NOW: { FR: "Jouer maintenant", EN: "Play now", ZH: "立即游玩" },
    ACC_PLAY_NOW_SUB: { FR: "Sans installation. Le jeu crée ton compte et ton wallet.", EN: "No install. The game creates your account and wallet.", ZH: "无需安装。游戏为你创建账号和钱包。" },
    ACC_HAVE_WALLET: { FR: "J'ai déjà un wallet", EN: "I already have a wallet", ZH: "我已有钱包" },
    ACC_CREATING: { FR: "Création…", EN: "Creating…", ZH: "创建中…" },
    ACC_CREATE_FAIL: { FR: "Création impossible pour l'instant. Réessaie dans un moment.", EN: "Cannot create an account right now. Try again shortly.", ZH: "暂时无法创建账号，请稍后再试。" },

    ACC_SECRETS_TITLE: { FR: "Garde ces deux choses", EN: "Keep these two things", ZH: "请保管好这两样东西" },
    ACC_SECRETS_INTRO: { FR: "Elles ne seront plus jamais affichées. Note-les maintenant.", EN: "They will never be shown again. Write them down now.", ZH: "它们不会再次显示。请立即记录。" },
    ACC_CODE_LABEL: { FR: "Code de récupération", EN: "Recovery code", ZH: "恢复码" },
    ACC_CODE_HINT: { FR: "Sert à revenir sur ton compte si tu changes d'appareil ou vides ton navigateur.", EN: "Use it to get back into your account on another device or after clearing your browser.", ZH: "用于在更换设备或清除浏览器数据后找回账号。" },
    ACC_COPY: { FR: "Copier", EN: "Copy", ZH: "复制" },
    ACC_COPIED: { FR: "Copié ✓", EN: "Copied ✓", ZH: "已复制 ✓" },
    ACC_SEED_LABEL: { FR: "Phrase de récupération (12 mots)", EN: "Recovery phrase (12 words)", ZH: "助记词（12 个单词）" },
    ACC_SEED_HINT: { FR: "Sert à récupérer tes jetons dans UniSat. Ne sert JAMAIS à te connecter ici.", EN: "Use it to recover your tokens in UniSat. NEVER to log in here.", ZH: "用于在 UniSat 中找回你的代币。绝不用于在此登录。" },
    ACC_SEED_REVEAL: { FR: "Afficher", EN: "Reveal", ZH: "显示" },
    ACC_SEED_HIDE: { FR: "Masquer", EN: "Hide", ZH: "隐藏" },
    ACC_PHISHING_WARN: { FR: "⚠️ Ne saisis JAMAIS ces 12 mots sur un site web — Fractal Arena compris. Personne de légitime ne te les demandera.", EN: "⚠️ NEVER type these 12 words on any website — Fractal Arena included. No legitimate party will ever ask for them.", ZH: "⚠️ 切勿在任何网站输入这 12 个单词 —— 包括 Fractal Arena。任何正规方都不会索要。" },
    ACC_CONFIRM_SAVED: { FR: "J'ai noté mon code de récupération", EN: "I have saved my recovery code", ZH: "我已保存恢复码" },
    ACC_CONTINUE: { FR: "Entrer dans l'arène", EN: "Enter the arena", ZH: "进入竞技场" },

    ACC_RECOVER_LINK: { FR: "Récupérer mon compte", EN: "Recover my account", ZH: "找回我的账号" },
    ACC_RECOVER_TITLE: { FR: "Récupérer ton compte", EN: "Recover your account", ZH: "找回你的账号" },
    ACC_RECOVER_SUB: { FR: "Colle ton code de récupération. Jamais ta phrase de 12 mots.", EN: "Paste your recovery code. Never your 12-word phrase.", ZH: "粘贴你的恢复码。切勿粘贴 12 个助记词。" },
    ACC_RECOVER_PLACEHOLDER: { FR: "Code de récupération", EN: "Recovery code", ZH: "恢复码" },
    ACC_RECOVER_BTN: { FR: "Récupérer", EN: "Recover", ZH: "找回" },
    ACC_RECOVER_FAIL: { FR: "Code invalide.", EN: "Invalid code.", ZH: "恢复码无效。" },
    ACC_RECOVER_SEED_REFUSED: { FR: "C'est ta phrase de 12 mots — ne la saisis jamais ici. Utilise ton code de récupération.", EN: "That's your 12-word phrase — never enter it here. Use your recovery code.", ZH: "这是你的 12 个助记词 —— 切勿在此输入。请使用恢复码。" },
    ACC_RECOVER_RATE: { FR: "Trop de tentatives. Réessaie dans un moment.", EN: "Too many attempts. Try again shortly.", ZH: "尝试次数过多，请稍后再试。" },

    ACC_LOCKED_BANNER: { FR: "Tes gains sont verrouillés : dépensables en jeu, pas encore retirables.", EN: "Your earnings are locked: spendable in game, not yet withdrawable.", ZH: "你的收益已锁定：可在游戏中使用，但暂不可提现。" },
    ACC_LOCKED_HOW: { FR: "Comment débloquer", EN: "How to unlock", ZH: "如何解锁" },
    ACC_LOCKED_CLOSE: { FR: "Plus tard", EN: "Later", ZH: "稍后" },
    ACC_HOWTO_TITLE: { FR: "Débloquer tes gains", EN: "Unlock your earnings", ZH: "解锁你的收益" },
    ACC_HOWTO_1: { FR: "1. Installe UniSat et importe ta phrase de 12 mots.", EN: "1. Install UniSat and import your 12-word phrase.", ZH: "1. 安装 UniSat 并导入你的 12 个助记词。" },
    ACC_HOWTO_2: { FR: "2. Envoie des FA vers l'adresse de dépôt affichée dans l'onglet Wallet.", EN: "2. Send FA to the deposit address shown in the Wallet tab.", ZH: "2. 向钱包页显示的充值地址发送 FA。" },
    ACC_HOWTO_3: { FR: "3. Colle le txid : ton compte est vérifié et tes gains se débloquent.", EN: "3. Paste the txid: your account is verified and your earnings unlock.", ZH: "3. 粘贴交易 ID：账号即通过验证，收益随之解锁。" },
    ACC_HOWTO_CAP: { FR: "Le déblocage est plafonné au montant déposé : déposer 1 000 FA débloque au plus 1 000 FA verrouillés.", EN: "Unlocking is capped at the deposited amount: depositing 1,000 FA unlocks at most 1,000 locked FA.", ZH: "解锁额度以充值金额为上限：充值 1,000 FA 最多解锁 1,000 锁定 FA。" },
    ACC_VERIFY_BTN: { FR: "Vérifier mon activité on-chain", EN: "Check my on-chain activity", ZH: "检查我的链上活动" },
    ACC_VERIFY_OK: { FR: "Compte vérifié ✓ Tes prochains gains arrivent en liquide.", EN: "Account verified ✓ Your next earnings will be liquid.", ZH: "账号已验证 ✓ 后续收益将为可用余额。" },
    ACC_VERIFY_NONE: { FR: "Aucune activité on-chain détectée sur ton adresse pour l'instant.", EN: "No on-chain activity detected on your address yet.", ZH: "暂未检测到你的地址有链上活动。" },
```

Puis remplacer `OB_MOBILE_TITLE` / `OB_MOBILE_MSG` (le mobile n'est plus bloqué — décision du user) :

```js
    OB_MOBILE_TITLE: { FR: "Jouer sur mobile", EN: "Play on mobile", ZH: "在移动端游玩" },
    OB_MOBILE_MSG: { FR: "Sur mobile, joue avec un compte créé par le jeu. La connexion par extension UniSat reste réservée à l'ordinateur.", EN: "On mobile, play with an account created by the game. Connecting via the UniSat extension remains desktop-only.", ZH: "在移动端可使用游戏创建的账号游玩。UniSat 扩展登录仍仅限电脑。" },
```

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `node --test --test-force-exit test/account-i18n.test.js`
Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add i18n.js test/account-i18n.test.js
git commit -m "feat(i18n): libelles du compte sans wallet en FR/EN/ZH"
```

---

### Task 3 : Actions d'API et bascule du stockage de session

**Files:**
- Modify: `app.jsx` (helpers de token ~lignes 8-15, `loadState` ~ligne 139, reconnexion auto ~ligne 170, persistance ~ligne 186, bloc `actions`)
- Test: `test/account-wiring.test.js`

**Interfaces:**
- Consumes: Task 1 (`window.FA_ACCOUNT`).
- Produces, dans `actions` :
  - `createAccount() → Promise<{ok, wallet?, seed?, recovery_code?, reason?}>`
  - `recoverAccount(code) → Promise<{ok, reason?}>`
  - `verifyOnchain() → Promise<{ok, verified?, reason?}>`
  - et l'état `g.accountKind` (`"generated" | "unisat" | ""`), `g.onchainVerified` (booléen).

**Le piège de la reconnexion :** aujourd'hui, au boot, `if (!token) token = await actions.authenticate(w)` déclenche une signature UniSat. Pour un compte généré, `authenticate()` retourne `""` (pas de `window.unisat`) et le joueur se retrouverait déconnecté avec une save fantôme. Il faut donc court-circuiter : un compte généré se reconnecte avec son token persisté, sans jamais appeler `authenticate`.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/account-wiring.test.js` :

```js
// test/account-wiring.test.js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = read("app.jsx");

test("app.jsx delegue le stockage du jeton a FA_ACCOUNT", () => {
  assert.match(APP, /FA_ACCOUNT/, "app.jsx doit consommer les helpers testes, pas redefinir les siens");
  assert.ok(!/function writeToken\(t\)\s*\{\s*try\s*\{\s*if \(t\) sessionStorage\.setItem/.test(APP),
    "l'ancien writeToken code en dur sur sessionStorage subsiste");
});

test("les trois routes de compte sont appelees", () => {
  assert.match(APP, /\/account\/create/);
  assert.match(APP, /\/auth\/recover/);
  assert.match(APP, /\/account\/verify-onchain/);
});

test("la seed et le code ne sont jamais persistes", () => {
  // Aucun stockage ne doit contenir de seed ni de code : ils vivent en etat React.
  assert.ok(!/setItem\([^)]*seed/i.test(APP), "une seed est ecrite dans un stockage");
  assert.ok(!/setItem\([^)]*recovery/i.test(APP), "un code de recuperation est ecrit dans un stockage");
  const blob = APP.match(/localStorage\.setItem\(SAVE_KEY[^;]*/);
  assert.ok(blob, "la persistance du blob est introuvable");
  assert.ok(!/seed|recovery_code/.test(blob[0]), "la seed ou le code fuient dans le blob de sauvegarde");
});

test("un compte genere ne declenche jamais de signature UniSat au boot", () => {
  const i = APP.indexOf("didAutoConnectRef");
  assert.ok(i > 0, "bloc de reconnexion introuvable");
  const bloc = APP.slice(i, i + 1400);
  assert.match(bloc, /KIND_GENERATED|accountKind/,
    "la reconnexion doit distinguer un compte genere : authenticate() n'a rien a signer sans UniSat");
});

test("recoverAccount refuse une seed avant tout appel reseau", () => {
  const i = APP.indexOf("async recoverAccount");
  assert.ok(i > 0, "recoverAccount introuvable");
  const bloc = APP.slice(i, i + 900);
  const iSeed = bloc.indexOf("looksLikeSeed");
  const iFetch = bloc.indexOf("fetch(");
  assert.ok(iSeed > 0, "la garde anti-phishing est absente");
  assert.ok(iSeed < iFetch, "la seed doit etre refusee AVANT de partir sur le reseau");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test --test-force-exit test/account-wiring.test.js`
Expected: FAIL — 5 tests (aucune action n'existe encore).

- [ ] **Step 3: Basculer les helpers de token**

Dans `app.jsx`, remplacer le bloc des lignes 9-15 :

```js
// Le bearer authToken vit en sessionStorage (et JAMAIS dans le blob localStorage) : il survit
// au rechargement de l'onglet (pas de re-signature à chaque F5) mais est effacé à la fermeture
// de l'onglet → bien moins exposé qu'un token persisté en localStorage (audit 2026-06-24).
const TOKEN_KEY = "fa_auth_token";
function readToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
function writeToken(t) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch (e) {} }
function clearToken() { try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {} }
```

par :

```js
// Stockage du bearer : delegue a FA_ACCOUNT (account-ui.js), qui applique la regle
// decidee le 2026-07-27 — sessionStorage pour un compte UniSat (efface a la fermeture
// de l'onglet, il peut re-signer a tout moment ; audit 2026-06-24), localStorage pour
// un compte genere (il n'a rien a re-signer, sinon il faudrait ressaisir le code de
// recuperation a chaque fermeture d'onglet). JAMAIS dans le blob localStorage.
const ACC = window.FA_ACCOUNT;
const readToken = () => ACC.readToken();
const writeToken = (t, kind) => ACC.writeToken(t, kind);
const clearToken = () => ACC.clearToken();
```

Dans `freshState()`, ajouter deux champs après `authToken: "",` :

```js
    accountKind: "",      // "generated" | "unisat" | "" — decide ou vit le jeton
    onchainVerified: true, // optimiste : un compte UniSat l'est ; /save le corrige
```

Dans `loadState()`, remplacer `authToken: readToken(),` par :

```js
      authToken: readToken(),
      accountKind: ACC.readKind(),
```

Dans le `useEffect` de persistance (~ligne 186), remplacer `writeToken(g.authToken);` par :

```js
    writeToken(g.authToken, g.accountKind);
```

- [ ] **Step 4: Court-circuiter la reconnexion d'un compte généré**

Remplacer le corps du `useEffect` de reconnexion (~ligne 170) :

```js
    const w = gRef.current.wallet;
    if (w) {
      (async () => {
        let token = gRef.current.authToken;        // restauré depuis sessionStorage
        if (!token) token = await actions.authenticate(w);
        await actions.connectWallet(w, token);
      })();
    }
```

par :

```js
    const w = gRef.current.wallet;
    if (w) {
      (async () => {
        let token = gRef.current.authToken;        // restauré depuis le stockage adapté
        // Un compte généré n'a aucune clé dans le navigateur : authenticate() ouvrirait
        // une popup UniSat inexistante et rendrait "". Son jeton persiste en
        // localStorage ; s'il a expiré, l'UI le renverra vers l'écran de récupération.
        const generated = gRef.current.accountKind === ACC.KIND_GENERATED;
        if (!token && !generated) token = await actions.authenticate(w);
        if (!token && generated) { clearToken(); setG((s) => ({ ...s, wallet: "", accountKind: "" })); return; }
        await actions.connectWallet(w, token);
      })();
    }
```

- [ ] **Step 5: Ajouter les trois actions**

Dans le bloc `actions`, juste après `connectUnisat()` :

```js
    // Crée un compte + wallet côté serveur. Les deux secrets rendus ici ne sont
    // JAMAIS persistés : ils vivent dans l'état de l'écran des secrets, puis
    // disparaissent. Aucune autre route ne les relit.
    async createAccount() {
      try {
        const r = await fetch(`${API_URL}/account/create`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        });
        if (r.status === 429) return { ok: false, reason: "rate" };
        if (!r.ok) return { ok: false, reason: "server" };
        const d = await r.json();
        if (!d.wallet || !d.token) return { ok: false, reason: "server" };
        setG((s) => ({ ...s, accountKind: ACC.KIND_GENERATED, onchainVerified: false }));
        writeToken(d.token, ACC.KIND_GENERATED);
        await actions.connectWallet(d.wallet, d.token);
        setG((s) => ({ ...s, authToken: d.token }));
        return { ok: true, wallet: d.wallet, seed: d.seed, recovery_code: d.recovery_code };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    // Retour sur un compte généré depuis un autre appareil ou après vidage du cache.
    async recoverAccount(code) {
      // Garde anti-phishing AVANT tout appel réseau : une seed ne doit jamais
      // quitter la machine du joueur, y compris vers nous.
      if (ACC.looksLikeSeed(code)) return { ok: false, reason: "seed" };
      if (!ACC.isValidRecoveryCode(code)) return { ok: false, reason: "invalid" };
      try {
        const r = await fetch(`${API_URL}/auth/recover`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recovery_code: String(code).trim() }),
        });
        if (r.status === 429) return { ok: false, reason: "rate" };
        if (!r.ok) return { ok: false, reason: "invalid" };
        const d = await r.json();
        if (!d.wallet || !d.token) return { ok: false, reason: "invalid" };
        setG((s) => ({ ...s, accountKind: ACC.KIND_GENERATED }));
        writeToken(d.token, ACC.KIND_GENERATED);
        await actions.connectWallet(d.wallet, d.token);
        setG((s) => ({ ...s, authToken: d.token }));
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    // Demande au serveur de constater une activité on-chain (solde FB > 0). Le
    // client ne décide jamais : il ne fait que déclencher la vérification.
    async verifyOnchain() {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const r = await fetch(`${API_URL}/account/verify-onchain`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: "{}",
        });
        if (!r.ok) return { ok: false, reason: "server" };
        const d = await r.json();
        if (d.verified) setG((st) => ({ ...st, onchainVerified: true }));
        return { ok: true, verified: !!d.verified };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
```

Enfin, refléter dans l'état le statut renvoyé par le serveur. Dans `connectWallet(addr, token)`, branche `if (saveResp.ok)` (~ligne 322), le `setG` construit `next` via `serverToState(save, addr, s)` puis lui ajoute des champs. Y ajouter une ligne, à côté de `next.totem = totem;` :

```js
            next.onchainVerified = save.onchain_verified !== false;
```

Dans la branche `else if (saveResp.status === 404)` (compte tout juste créé), l'objet passé à `setG` part de `freshState()` : y ajouter, à côté de `wallet: addr,` :

```js
            onchainVerified: false,
```

⚠️ `serverToState` recopie la save serveur dans l'état : vérifier qu'il n'écrase pas `onchainVerified` avec `undefined`. Le `next.onchainVerified = …` posé **après** l'appel garantit la valeur, mais si `serverToState` filtre les champs inconnus, ce champ doit être ajouté à sa liste.

- [ ] **Step 6: Lancer les tests**

Run: `node --test --test-force-exit test/account-wiring.test.js test/api-url.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app.jsx test/account-wiring.test.js
git commit -m "feat(compte): actions create/recover/verify et stockage de session par type de compte"
```

---

### Task 4 : Écran de sauvegarde des secrets

**Files:**
- Create: `account.jsx`
- Modify: `styles.css`

**Interfaces:**
- Consumes: Task 2 (clés `ACC_*`), Task 3 (`actions.createAccount`).
- Produces: `window.SecretsGate` — `<SecretsGate secrets={{seed, recovery_code}} onDone={fn} />`.

**Règle non négociable :** on ne peut pas sortir de cet écran sans avoir coché la confirmation. C'est le seul moment où le code de récupération existe ; le joueur qui le rate perd son compte au prochain vidage de cache.

- [ ] **Step 1: Créer le composant**

Créer `account.jsx` :

```jsx
/* ============================================================
   FRACTAL ARENA — Compte sans wallet : ecrans
   SecretsGate (unique affichage des secrets), RecoverScreen, LockedBanner.
   Les secrets ne sont JAMAIS persistes : ils vivent ici, puis disparaissent.
   ============================================================ */
const { useState } = React;
const { useFA, cx, Modal, SectionHead } = window;
const I18N = window.FA_I18N;
const ACC = window.FA_ACCOUNT;

function SecretsGate({ secrets, onDone }) {
  const [revealed, setRevealed] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!secrets) return null;

  const copy = async () => {
    try { await navigator.clipboard.writeText(secrets.recovery_code); setCopied(true); }
    catch (e) { setCopied(false); }
  };

  return (
    <Modal accent="var(--gold)">
      <SectionHead eyebrow="🔑 BACKUP" title={I18N.t("ACC_SECRETS_TITLE")} />
      <div className="muted mono" style={{ fontSize: 13, marginBottom: 16 }}>{I18N.t("ACC_SECRETS_INTRO")}</div>

      <div className="acc-secret">
        <div className="acc-secret-label">{I18N.t("ACC_CODE_LABEL")}</div>
        <div className="acc-code mono">{secrets.recovery_code}</div>
        <button className="btn sm" onClick={copy}>{copied ? I18N.t("ACC_COPIED") : I18N.t("ACC_COPY")}</button>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{I18N.t("ACC_CODE_HINT")}</div>
      </div>

      <div className="acc-secret">
        <div className="acc-secret-label">{I18N.t("ACC_SEED_LABEL")}</div>
        <div className={cx("acc-seed mono", !revealed && "masked")}>
          {revealed ? secrets.seed : "•••• •••• •••• •••• •••• •••• •••• •••• •••• •••• •••• ••••"}
        </div>
        <button className="btn sm" onClick={() => setRevealed(!revealed)}>
          {revealed ? I18N.t("ACC_SEED_HIDE") : I18N.t("ACC_SEED_REVEAL")}
        </button>
        <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>{I18N.t("ACC_SEED_HINT")}</div>
      </div>

      <div className="acc-warn">{I18N.t("ACC_PHISHING_WARN")}</div>

      <label className="acc-confirm">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>{I18N.t("ACC_CONFIRM_SAVED")}</span>
      </label>

      <button className="btn btn-gold lg" style={{ width: "100%", marginTop: 12 }}
              disabled={!confirmed} onClick={onDone}>
        {I18N.t("ACC_CONTINUE")}
      </button>
    </Modal>
  );
}

Object.assign(window, { SecretsGate });
```

⚠️ `Modal` doit pouvoir s'afficher sans `onClose` (pas de fermeture par la croix ni par l'extérieur). Vérifier sa signature dans `components.jsx` : si `onClose` est obligatoire, passer `onClose={() => {}}` — jamais une fermeture réelle.

- [ ] **Step 2: Ajouter les styles**

Dans `styles.css`, à la fin :

```css
/* --- Compte sans wallet --- */
.acc-secret { margin: 14px 0; padding: 12px; border: 1px solid rgba(247,147,26,0.25); border-radius: 8px; background: rgba(0,0,0,0.25); }
.acc-secret-label { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--text-dim); margin-bottom: 6px; }
.acc-code { font-size: 15px; word-break: break-all; margin-bottom: 8px; color: var(--gold); }
.acc-seed { font-size: 13px; line-height: 1.7; margin-bottom: 8px; word-break: break-word; }
.acc-seed.masked { letter-spacing: 2px; color: var(--text-dim); user-select: none; }
.acc-warn { margin: 14px 0; padding: 10px 12px; border-left: 3px solid #e5484d; background: rgba(229,72,77,0.08); font-size: 12px; line-height: 1.6; }
.acc-confirm { display: flex; gap: 8px; align-items: flex-start; font-size: 13px; cursor: pointer; margin-top: 10px; }
.acc-confirm input { margin-top: 3px; flex: none; }
.acc-banner { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; padding: 10px 14px; background: rgba(247,147,26,0.1); border-bottom: 1px solid rgba(247,147,26,0.3); font-size: 13px; }
.acc-banner .grow { flex: 1 1 220px; }
```

- [ ] **Step 3: Vérifier visuellement**

Servir le client localement (voir `_dev/` dans le dépôt serveur) et créer un compte. Vérifier : le bouton « Entrer dans l'arène » reste désactivé tant que la case n'est pas cochée, la seed est masquée par défaut, la copie du code fonctionne.

- [ ] **Step 4: Commit**

```bash
git add account.jsx styles.css
git commit -m "feat(compte): ecran de sauvegarde des secrets, affiche une seule fois"
```

---

### Task 5 : Écran de récupération

**Files:**
- Modify: `account.jsx`
- Test: `test/account-wiring.test.js` (ajout)

**Interfaces:**
- Consumes: Task 3 (`actions.recoverAccount`).
- Produces: `window.RecoverScreen` — `<RecoverScreen onClose={fn} />`.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `test/account-wiring.test.js` :

```js
const ACCJSX = read("account.jsx");

test("l'ecran de recuperation ne suggere jamais la seed", () => {
  const i = ACCJSX.indexOf("function RecoverScreen");
  assert.ok(i > 0, "RecoverScreen introuvable");
  const bloc = ACCJSX.slice(i, i + 1800);
  assert.match(bloc, /ACC_RECOVER_PLACEHOLDER/, "le champ doit annoncer un CODE");
  assert.ok(!/ACC_SEED_LABEL|12 mots|mnemonic/i.test(bloc),
    "l'ecran de recuperation ne doit ni demander ni evoquer une saisie de seed");
});

test("l'ecran de recuperation traite le refus de seed", () => {
  const i = ACCJSX.indexOf("function RecoverScreen");
  const bloc = ACCJSX.slice(i, i + 1800);
  assert.match(bloc, /ACC_RECOVER_SEED_REFUSED/,
    "coller une seed doit produire un avertissement explicite, pas un 'code invalide' muet");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test --test-force-exit test/account-wiring.test.js`
Expected: FAIL — `RecoverScreen` introuvable.

- [ ] **Step 3: Écrire le composant**

Dans `account.jsx`, avant `Object.assign` :

```jsx
function RecoverScreen({ onClose }) {
  const { actions, toast } = useFA();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    let r;
    try { r = await actions.recoverAccount(code); } finally { setBusy(false); }
    if (r.ok) { onClose && onClose(); return; }
    if (r.reason === "seed") { toast(I18N.t("ACC_RECOVER_SEED_REFUSED"), "bad"); setCode(""); return; }
    if (r.reason === "rate") { toast(I18N.t("ACC_RECOVER_RATE"), "bad"); return; }
    toast(I18N.t("ACC_RECOVER_FAIL"), "bad");
  };

  return (
    <Modal onClose={onClose} accent="var(--gold)">
      <SectionHead eyebrow="🔑 RECOVERY" title={I18N.t("ACC_RECOVER_TITLE")} />
      <div className="muted mono" style={{ fontSize: 13, marginBottom: 14 }}>{I18N.t("ACC_RECOVER_SUB")}</div>
      <input className="field" style={{ marginBottom: 10 }} value={code} autoComplete="off" spellCheck={false}
             onChange={(e) => setCode(e.target.value)}
             placeholder={I18N.t("ACC_RECOVER_PLACEHOLDER")}
             onKeyDown={(e) => e.key === "Enter" && submit()} />
      <button className="btn btn-gold block lg" disabled={busy || !code.trim()} onClick={submit}>
        {I18N.t("ACC_RECOVER_BTN")}
      </button>
    </Modal>
  );
}
```

Ajouter `RecoverScreen` à l'`Object.assign(window, …)` final.

- [ ] **Step 4: Lancer le test pour vérifier qu'il passe**

Run: `node --test --test-force-exit test/account-wiring.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add account.jsx test/account-wiring.test.js
git commit -m "feat(compte): ecran de recuperation par code, refus explicite d'une seed"
```

---

### Task 6 : Bandeau « gains verrouillés » et vérification on-chain

**Files:**
- Modify: `account.jsx`, `app.jsx`

**Interfaces:**
- Consumes: Task 1 (`shouldShowLockedBanner`), Task 3 (`actions.verifyOnchain`), Task 2 (clés `ACC_LOCKED_*`, `ACC_HOWTO_*`, `ACC_VERIFY_*`).
- Produces: `window.LockedBanner` — sans props, se branche sur le contexte.

**Comportement :** non bloquant, fermable, réapparaît après 24 h (`BANNER_SNOOZE_MS`). Le bouton « Comment débloquer » ouvre la marche à suivre, qui porte aussi le bouton de vérification manuelle — utile au joueur qui a déposé depuis un autre canal.

- [ ] **Step 1: Écrire le composant**

Dans `account.jsx`, avant `Object.assign` :

```jsx
const DISMISS_KEY = "fa_locked_banner_dismissed";
function readDismissed() { try { return parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10) || 0; } catch (e) { return 0; } }
function writeDismissed(ts) { try { localStorage.setItem(DISMISS_KEY, String(ts)); } catch (e) {} }

function LockedBanner() {
  const { g, actions, toast } = useFA();
  const [dismissedAt, setDismissedAt] = useState(readDismissed);
  const [howto, setHowto] = useState(false);
  const [checking, setChecking] = useState(false);

  const show = ACC.shouldShowLockedBanner({
    kind: g.accountKind, onchainVerified: g.onchainVerified,
    dismissedAt, now: Date.now(),
  });
  if (!show && !howto) return null;

  const close = () => { const t = Date.now(); writeDismissed(t); setDismissedAt(t); };
  const check = async () => {
    setChecking(true);
    let r;
    try { r = await actions.verifyOnchain(); } finally { setChecking(false); }
    if (r.ok && r.verified) { toast(I18N.t("ACC_VERIFY_OK"), "good"); setHowto(false); return; }
    toast(I18N.t("ACC_VERIFY_NONE"), "bad");
  };

  return (
    <>
      {show && (
        <div className="acc-banner">
          <span className="grow">🔒 {I18N.t("ACC_LOCKED_BANNER")}</span>
          <button className="btn sm" onClick={() => setHowto(true)}>{I18N.t("ACC_LOCKED_HOW")}</button>
          <button className="btn-link" style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                  onClick={close}>{I18N.t("ACC_LOCKED_CLOSE")}</button>
        </div>
      )}
      {howto && (
        <Modal onClose={() => setHowto(false)} accent="var(--gold)">
          <SectionHead eyebrow="🔓 UNLOCK" title={I18N.t("ACC_HOWTO_TITLE")} />
          <div className="mono" style={{ fontSize: 13, lineHeight: 2 }}>
            <div>{I18N.t("ACC_HOWTO_1")}</div>
            <div>{I18N.t("ACC_HOWTO_2")}</div>
            <div>{I18N.t("ACC_HOWTO_3")}</div>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>{I18N.t("ACC_HOWTO_CAP")}</div>
          <button className="btn block" style={{ marginTop: 14 }} disabled={checking} onClick={check}>
            {I18N.t("ACC_VERIFY_BTN")}
          </button>
        </Modal>
      )}
    </>
  );
}
```

Ajouter `LockedBanner` à l'`Object.assign(window, …)`.

- [ ] **Step 2: Monter le bandeau dans le shell**

Dans `app.jsx`, le shell monte ses surcouches vers la ligne 1338 :

```jsx
      <ChatFab />
      <RoomFab />

      {g.wallet && <TutorialGate />}
      {g.wallet && <LoginGate />}
```

Ajouter le bandeau à la suite :

```jsx
      {g.wallet && <LockedBanner />}
```

Le bandeau se rend en flux normal (pas en position fixe) : s'il apparaît visuellement au mauvais endroit, le remonter juste avant la barre de navigation du même rendu plutôt que de le passer en `position: fixed` — un bandeau flottant masquerait des boutons de jeu.

Ajouter également `LockedBanner` (et, si la Task 7 les remonte au niveau du shell, `SecretsGate` et `RecoverScreen`) à la destructuration de la ligne 7 :

```js
const { Team, Fosse, Arene, Forge, Wallet, Boosts, Perso, Options, ChatFab, RoomFab, Leaderboard, Quests, Campaign, Tour, LoginGate, TutorialGate, Link, Cinematique, Market, LockedBanner } = window;
```

⚠️ Cette destructuration s'évalue au chargement du module : `account.jsx` doit donc être déclaré **avant** `app.jsx` dans `index.html` (Task 8), sinon `LockedBanner` vaut `undefined` et React lève « Element type is invalid » au premier rendu.

- [ ] **Step 3: Vérifier**

Run: `npm test`
Expected: PASS intégral.

Puis à la main : créer un compte, constater le bandeau ; le fermer, recharger, constater qu'il ne revient pas ; ouvrir « Comment débloquer », lancer la vérification sur un compte sans activité on-chain → message `ACC_VERIFY_NONE`.

- [ ] **Step 4: Commit**

```bash
git add account.jsx app.jsx
git commit -m "feat(compte): bandeau gains verrouilles et verification on-chain a la demande"
```

---

### Task 7 : Onboarding — « Jouer maintenant » et déblocage du mobile

**Files:**
- Modify: `app.jsx` (fonction `Onboarding`, ~ligne 1442)
- Test: `test/account-wiring.test.js` (ajout)

**Interfaces:**
- Consumes: Task 3 (`actions.createAccount`), Task 4 (`SecretsGate`), Task 5 (`RecoverScreen`).
- Produces: rien de programmatique.

**La bascule :** aujourd'hui `Onboarding` a trois branches exclusives (extension présente / mobile / desktop sans extension), et deux d'entre elles sont des culs-de-sac. Après cette tâche, « Jouer maintenant » est l'action principale dans les trois cas, et la connexion UniSat devient l'action secondaire — affichée seulement quand l'extension existe.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `test/account-wiring.test.js` :

```js
test("l'onboarding propose de jouer sans wallet dans tous les cas", () => {
  const i = APP.indexOf("function Onboarding");
  assert.ok(i > 0, "Onboarding introuvable");
  const bloc = APP.slice(i, APP.indexOf("function Toasts"));
  assert.match(bloc, /ACC_PLAY_NOW/, "l'action principale « Jouer maintenant » est absente");
  assert.match(bloc, /createAccount/, "le bouton doit appeler createAccount");
  assert.match(bloc, /ACC_RECOVER_LINK/, "l'acces a la recuperation est absent de l'accueil");
});

test("le mobile n'est plus un cul-de-sac", () => {
  const i = APP.indexOf("function Onboarding");
  const bloc = APP.slice(i, APP.indexOf("function Toasts"));
  const iMobile = bloc.indexOf("mobile ?");
  if (iMobile === -1) return; // branche mobile supprimee : encore mieux
  const branche = bloc.slice(iMobile, iMobile + 700);
  assert.match(branche, /ACC_PLAY_NOW|onPlayNow/,
    "la branche mobile doit offrir de jouer, pas seulement afficher un message");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test --test-force-exit test/account-wiring.test.js`
Expected: FAIL — 2 tests.

- [ ] **Step 3: Réécrire Onboarding**

Remplacer le corps de `Onboarding` (de `const { actions, toast } = useFA();` jusqu'au `return`) par :

```jsx
  const { actions, toast } = useFA();
  const [addr, setAddr] = useState("");
  const [checking, setChecking] = useState(false);
  const [manual, setManual] = useState(false);
  const [secrets, setSecrets] = useState(null);
  const [recovering, setRecovering] = useState(false);
  const hasWallet = HAS_UNISAT();
  const mobile = IS_MOBILE();

  async function connectUnisat() {
    setChecking(true);
    const r = await actions.connectUnisat();
    setChecking(false);
    if (!r.ok) toast(I18N.t("OB_CONNECT_FAIL"), "bad");
  }
  async function connectManual() {
    const a = addr.trim();
    if (a.length < 20 || !/^bc1/i.test(a)) { toast(I18N.t("OB_INVALID"), "bad"); return; }
    setChecking(true);
    try {
      const token = await actions.authenticate(a);
      const isNew = await actions.connectWallet(a, token);
      await actions.claimAirdropIfNew(a, token, isNew);
    } finally {
      setChecking(false);
    }
  }
  // Entrée sans friction : on crée le compte, puis on retient le joueur sur
  // l'écran des secrets — c'est le SEUL moment où le code de récupération existe.
  async function playNow() {
    setChecking(true);
    let r;
    try { r = await actions.createAccount(); } finally { setChecking(false); }
    if (!r.ok) { toast(I18N.t("ACC_CREATE_FAIL"), "bad"); return; }
    setSecrets({ seed: r.seed, recovery_code: r.recovery_code });
  }
```

et le bloc de rendu conditionnel (de `{hasWallet ? (` jusqu'à la fermeture de cette expression) par :

```jsx
        <div className="h2" style={{ fontSize: 18, marginBottom: 8 }}>{I18N.t("ACC_PLAY_NOW")}</div>
        <div className="muted mono" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>{I18N.t("ACC_PLAY_NOW_SUB")}</div>
        <button className="btn btn-fire block lg" disabled={checking} onClick={playNow}>
          {checking ? I18N.t("ACC_CREATING") : I18N.t("ACC_PLAY_NOW")}
        </button>
        <div className="pill" style={{ marginTop: 14, color: "var(--gold)", borderColor: "rgba(255,230,0,0.3)" }}>🎁 {I18N.t("OB_GIFT")}</div>

        {/* Action secondaire : le joueur qui a deja un wallet garde son flux d'avant. */}
        {hasWallet ? (
          <button className="btn block" style={{ marginTop: 12 }} disabled={checking} onClick={connectUnisat}>
            {I18N.t("ACC_HAVE_WALLET")}
          </button>
        ) : mobile ? (
          <div className="muted mono" style={{ fontSize: 12, lineHeight: 1.7, marginTop: 14 }}>{I18N.t("OB_MOBILE_MSG")}</div>
        ) : (
          <a className="btn block" style={{ marginTop: 12 }} href="https://unisat.io/download" target="_blank" rel="noopener noreferrer">
            {I18N.t("OB_INSTALL_EXT_BTN")}
          </a>
        )}

        <div style={{ marginTop: 14 }}>
          <button className="btn-link" style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => setRecovering(true)}>{I18N.t("ACC_RECOVER_LINK")}</button>
        </div>
```

Enfin, monter les deux écrans juste avant la fermeture du `<div>` racine d'`Onboarding` :

```jsx
        {secrets && <window.SecretsGate secrets={secrets} onDone={() => setSecrets(null)} />}
        {recovering && <window.RecoverScreen onClose={() => setRecovering(false)} />}
```

⚠️ `SecretsGate` reste monté tant que le joueur n'a pas confirmé. Comme `createAccount` a déjà posé `g.wallet`, l'application bascule hors d'`Onboarding` dès le rendu suivant — **vérifier que l'écran des secrets n'est pas démonté avec elle**. Si c'est le cas, remonter l'état `secrets` dans `App` et rendre `SecretsGate` au niveau du shell, pas dans `Onboarding`. C'est le point le plus susceptible de casser silencieusement : un joueur qui ne voit jamais son code de récupération perd son compte.

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected: PASS intégral.

- [ ] **Step 5: Vérifier à la main**

Créer un compte depuis une fenêtre sans extension UniSat : l'écran des secrets doit s'afficher et rester jusqu'à confirmation. Recharger la page : le joueur revient connecté sans rien saisir (token en localStorage).

- [ ] **Step 6: Commit**

```bash
git add app.jsx test/account-wiring.test.js
git commit -m "feat(compte): « Jouer maintenant » en action principale, mobile debloque"
```

---

### Task 8 : Câblage, cache-bust et non-régression

**Files:**
- Modify: `index.html`
- Test: `test/account-wiring.test.js` (ajout)

**Interfaces:**
- Consumes: toutes les tâches précédentes.
- Produces: rien.

**Ordre de chargement :** `account-ui.js` est du JS simple et doit être chargé **avant** `app.jsx` (qui lit `window.FA_ACCOUNT` au niveau module, hors de tout composant). `account.jsx` est du Babel et doit venir **après** `components.jsx` (il utilise `Modal` et `SectionHead`) et **avant** `app.jsx`.

- [ ] **Step 1: Écrire le test qui échoue**

Ajouter à `test/account-wiring.test.js` :

```js
const HTML = read("index.html");

test("les deux nouveaux fichiers sont declares", () => {
  assert.match(HTML, /account-ui\.js\?v=/, "account-ui.js n'est pas charge");
  assert.match(HTML, /account\.jsx\?v=/, "account.jsx n'est pas charge");
});

test("account-ui.js est charge avant app.jsx (lu au niveau module)", () => {
  assert.ok(HTML.indexOf("account-ui.js") < HTML.indexOf("app.jsx"),
    "app.jsx lit window.FA_ACCOUNT a l'evaluation : le helper doit exister avant");
});

test("account.jsx est charge apres components.jsx et avant app.jsx", () => {
  const iComp = HTML.indexOf("components.jsx");
  const iAcc = HTML.indexOf("account.jsx");
  const iApp = HTML.indexOf("app.jsx");
  assert.ok(iComp < iAcc && iAcc < iApp, "account.jsx utilise Modal/SectionHead de components.jsx");
});

test("cache-bust homogene : aucune balise ne reste sur l'ancienne version", () => {
  const versions = [...HTML.matchAll(/\?v=(\d+)/g)].map((m) => m[1]).filter((v) => v !== "1");
  const uniques = [...new Set(versions)];
  assert.deepStrictEqual(uniques, ["92"],
    `versions heterogenes trouvees : ${uniques.join(", ")} — une seule balise oubliee sert du code perime`);
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test --test-force-exit test/account-wiring.test.js`
Expected: FAIL — fichiers non déclarés, version encore à 91.

- [ ] **Step 3: Déclarer les fichiers et bumper la version**

Dans `index.html`, ajouter dans le bloc « plain JS data/logic », juste après `i18n.js` :

```html
  <script src="account-ui.js?v=92"></script>
```

et dans le bloc Babel, entre `components.jsx` et `cinematique.jsx` :

```html
  <script type="text/babel" src="account.jsx?v=92"></script>
```

Puis remplacer partout `?v=91` par `?v=92` (laisser `favicon.png?v=1` tel quel) :

```bash
sed -i 's/?v=91/?v=92/g' index.html
```

- [ ] **Step 4: Lancer la suite complète**

Run: `npm test`
Expected: PASS intégral. Rapporter les totaux exacts.

- [ ] **Step 5: Vérifier qu'aucun fichier de jeu n'a bougé**

```bash
git diff --stat origin/main -- data.js fosse.jsx arene.jsx tour.jsx forge-ui.js market.jsx
```
Expected: sortie vide. Le compte généré étant un wallet comme un autre, aucun écran de jeu ne doit avoir eu besoin d'une modification. Si l'un d'eux apparaît, c'est que le volet a débordé — relire le diff avant de continuer.

- [ ] **Step 6: Commit**

```bash
git add index.html test/account-wiring.test.js
git commit -m "chore(web): declare account-ui/account et bump cache-bust v92"
```

---

### Task 9 : Ouvrir la PR web

**Files:** aucun.

- [ ] **Step 1: Vérifier l'état de la PR serveur**

```bash
gh pr view 66 --repo Arthefacte/FractalArena --json state,mergedAt --jq '.state'
```

Si elle n'est pas encore mergée, l'indiquer dans le corps de la PR web : **le web ne doit pas partir avant le serveur**, sinon « Jouer maintenant » appellerait une route inexistante et échouerait en 404.

- [ ] **Step 2: Pousser et ouvrir la PR**

```bash
git push -u origin feat/compte-sans-wallet-web
gh pr create --base main --title "Jouer sans wallet — volet web (v92)" --body "$(cat <<'EOF'
Entrer dans le jeu en un clic, sans installer UniSat — mobile compris.

Serveur correspondant : #66 (a merger AVANT celle-ci).
Spec : `docs/superpowers/specs/2026-07-26-compte-sans-wallet-design.md` §9 (depot serveur).

## Ce que voit le joueur

- **« Jouer maintenant »** en action principale sur l'accueil, dans tous les cas ;
  « J'ai deja un wallet » devient l'action secondaire (flux UniSat inchange).
- **Ecran des secrets**, affiche une seule fois : code de recuperation copiable avec
  confirmation obligatoire, seed masquee par defaut, avertissement anti-phishing.
- **Bandeau « gains verrouilles »** non bloquant, fermable, de retour apres 24 h, avec
  la marche a suivre et une verification on-chain a la demande.
- **Ecran de recuperation** par code. Coller une seed est refuse AVANT tout appel
  reseau, avec un message explicite — jamais un « code invalide » muet.

## Deux decisions

- **Persistance du jeton** : `localStorage` pour les comptes generes uniquement ; les
  comptes UniSat gardent `sessionStorage`. Un compte UniSat peut re-signer
  silencieusement, pas un compte genere — sans persistance il faudrait ressaisir le
  code de recuperation a chaque fermeture d'onglet. L'exposition XSS reste bornee aux
  comptes generes, dont les gains sont verrouilles tant qu'aucun depot n'a eu lieu.
- **Mobile debloque** : la seule raison du blocage etait l'impossibilite de signer avec
  UniSat. Un compte genere n'a rien a signer.

## Perimetre

Aucun ecran de jeu n'est touche : le compte genere est un wallet comme un autre, tout
opere deja sur `wallet_address`. Cache-bust v92.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Vérifier**

```bash
gh pr view --json number,state --jq '"PR #\(.number) — \(.state)"'
```

---

## Récapitulatif

| # | Tâche | Livrable testable |
|---|---|---|
| 1 | Helpers purs | Stockage par type de compte, validation du code, décision du bandeau |
| 2 | i18n | 36 clés × FR/EN/ZH |
| 3 | Actions | `createAccount`, `recoverAccount`, `verifyOnchain` + reconnexion sans signature |
| 4 | Écran des secrets | Confirmation obligatoire, seed masquée |
| 5 | Écran de récupération | Refus explicite d'une seed |
| 6 | Bandeau verrouillé | Fermable, 24 h de silence, vérification à la demande |
| 7 | Onboarding | « Jouer maintenant » partout, mobile ouvert |
| 8 | Câblage | Ordre de chargement, cache-bust v92, aucun écran de jeu touché |
| 9 | PR | PR ouverte, dépendance à #66 signalée |

## Points de vigilance

1. **L'écran des secrets ne doit jamais être sauté.** `createAccount` pose `g.wallet`, ce qui fait basculer l'app hors d'`Onboarding` au rendu suivant. Si `SecretsGate` y est monté, il disparaît avec — et le joueur perd son code de récupération sans le savoir. C'est vérifié à la main en Task 7 Step 5.
2. **Le cache-bust est tout ou rien.** Une balise oubliée en `?v=91` sert un fichier périmé qui peut appeler une fonction disparue. Le test de la Task 8 l'attrape.
3. **Ne pas merger avant le serveur #66.**
4. **La seed ne transite jamais vers nous.** Le test de la Task 3 vérifie que le refus précède le `fetch`.
