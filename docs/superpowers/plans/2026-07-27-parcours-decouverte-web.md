# Parcours de découverte — Plan d'implémentation (volet WEB)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Montrer au joueur son parcours d'apprentissage — six étapes de jeu récompensées, puis le volet crypto qui le mène de « je n'ai pas de portefeuille » à « mes 2 000 FA d'airdrop sont arrivés dans UniSat ».

**Architecture:** Aucun écran nouveau. Les six étapes s'affichent en tête de l'onglet Quêtes, qui possède déjà tout ce qu'il faut (barre de progression, bouton de réclamation, état « réclamé », styles). Le volet crypto vit dans la fenêtre « Comment débloquer » du bandeau, déjà livrée. Le client ne calcule jamais de progression : il affiche ce que le serveur lui rend.

**Tech Stack:** React 18 sans build (Babel in-browser), modules globaux via `Object.assign(window, …)`, i18n maison `window.FA_I18N`, tests `node:test`.

## Global Constraints

- **Dépend du volet serveur** (même lot, branche `feat/compte-sans-wallet` du dépôt serveur) : routes `GET /discovery/state`, `POST /discovery/claim`, `POST /discovery/txid`. Ne pas merger avant lui.
- **Branche** `feat/compte-sans-wallet-web`, worktree `wt-sanswallet-web`.
- **i18n obligatoire FR/EN/ZH** pour chaque libellé ajouté, et chaque clé doit figurer dans la liste `KEYS` de `test/account-i18n.test.js`. C'est une règle du dépôt, vérifiée par test.
- **Cache-bust** : `?v=92` → `?v=93` sur TOUTES les balises de `index.html` sauf `favicon.png?v=1`.
- **Aucun écran de jeu ne doit être touché** : `data.js`, `fosse.jsx`, `arene.jsx`, `tour.jsx`, `forge-ui.js`, `market.jsx`. Vérifier en fin de lot : `git diff --stat origin/main -- data.js fosse.jsx arene.jsx tour.jsx forge-ui.js market.jsx` doit être vide.
- **Le client ne décide de rien** : ni de la progression, ni de l'éligibilité, ni du montant. Il affiche et il demande.
- **Tests :** `npm test`. En invocation directe sous Git Bash, nommer les fichiers un par un (`node --test test/` produit un faux échec par mangling de chemin).

---

## Le contrat serveur

`GET /discovery/state` (Bearer) rend :

```json
{
  "steps": [{ "id": "d_win", "target": 1, "reward": 50, "progress": 1, "done": true, "claimed": false }],
  "game_done": false,
  "dust_sent": false,
  "txid_verified": false
}
```

Les six identifiants, dans l'ordre : `d_win`, `d_paid`, `d_level`, `d_camp`, `d_tower`, `d_pvp`.

`POST /discovery/claim` `{step}` → `{status:"ok", step, reward}` ; erreurs : `409 deja_reclame`, `400 non_accompli`, `400 etape_inconnue`.

`POST /discovery/txid` `{txid}` → `{status:"ok", airdrop_pending, wallet}` ; erreurs : `400 txid_requis`, `400 poussiere_non_envoyee`, `400 txid_invalide`.

---

## Structure des fichiers

| Fichier | Responsabilité | Tâches |
|---|---|---|
| `i18n.js` | *Modifié.* Libellés des six étapes et du volet crypto. | 1 |
| `app.jsx` | *Modifié.* Actions `discoveryState`, `claimDiscovery`, `submitDustTxid`. | 2 |
| `quests.jsx` | *Modifié.* Section « Découverte » en tête de l'onglet Quêtes. | 3 |
| `account.jsx` | *Modifié.* Volet crypto dans la fenêtre de déblocage. | 4 |
| `index.html` | *Modifié.* Cache-bust v93. | 5 |
| `test/discovery-*.test.js` | *Créés.* | 1, 2, 3, 4 |

---

### Task 1 : Libellés FR / EN / ZH

**Files:**
- Modify: `i18n.js`, `test/account-i18n.test.js`
- Test: `test/discovery-i18n.test.js`

**Interfaces:**
- Consumes: rien.
- Produces: les clés `DISC_*` consommées par les tâches 3 et 4.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/discovery-i18n.test.js` :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SRC = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");

const KEYS = [
  "DISC_TITLE", "DISC_SUB", "DISC_DONE_ALL",
  "DISC_D_WIN", "DISC_D_PAID", "DISC_D_LEVEL", "DISC_D_CAMP", "DISC_D_TOWER", "DISC_D_PVP",
  "DISC_CLAIM", "DISC_CLAIMED", "DISC_CLAIM_FAIL",
  "DISC_CRYPTO_TITLE", "DISC_CRYPTO_LOCKED", "DISC_DUST_WAIT", "DISC_DUST_ARRIVED",
  "DISC_TXID_LABEL", "DISC_TXID_HINT", "DISC_TXID_PLACEHOLDER", "DISC_TXID_BTN",
  "DISC_TXID_BAD", "DISC_TXID_NONE", "DISC_TXID_OK",
];

function bloc(cle) {
  const m = SRC.match(new RegExp("\\b" + cle + ":\\s*\\{[^}]*\\}"));
  return m ? m[0] : null;
}

test("toutes les cles du parcours existent en FR/EN/ZH", () => {
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

test("un libelle par etape, dans l'ordre du serveur", () => {
  // Les six identifiants du serveur doivent tous avoir leur libelle : une etape
  // sans texte s'afficherait comme une cle brute au joueur.
  for (const id of ["d_win", "d_paid", "d_level", "d_camp", "d_tower", "d_pvp"]) {
    assert.ok(bloc("DISC_" + id.toUpperCase()), `libelle manquant pour ${id}`);
  }
});

test("le libelle du volet crypto dit ce qui debloque", () => {
  // Le joueur doit comprendre que le volet crypto s'ouvre APRES le volet jeu,
  // sinon il croit a un bug.
  const b = bloc("DISC_CRYPTO_LOCKED");
  assert.ok(b, "DISC_CRYPTO_LOCKED absente");
  for (const lang of ["FR", "EN", "ZH"]) assert.match(b, new RegExp(lang + ":"));
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test --test-force-exit test/discovery-i18n.test.js`
Expected: FAIL — toutes les clés absentes.

- [ ] **Step 3: Ajouter les libellés**

Dans `i18n.js`, à la suite des clés `ACC_*` :

```js
    // --- Parcours de decouverte ---
    DISC_TITLE: { FR: "Tes premiers pas", EN: "Your first steps", ZH: "你的第一步" },
    DISC_SUB: { FR: "Six étapes pour découvrir le jeu. Chacune rapporte.", EN: "Six steps to discover the game. Each one pays.", ZH: "六个步骤带你熟悉游戏，每步都有奖励。" },
    DISC_DONE_ALL: { FR: "Parcours terminé ✓", EN: "Journey complete ✓", ZH: "旅程已完成 ✓" },

    DISC_D_WIN: { FR: "Gagner un combat à la Fosse", EN: "Win a fight in the Pit", ZH: "在深坑赢得一场战斗" },
    DISC_D_PAID: { FR: "Gagner un combat avec mise", EN: "Win a fight with a stake", ZH: "赢得一场下注战斗" },
    DISC_D_LEVEL: { FR: "Monter une bête au niveau 5", EN: "Raise a beast to level 5", ZH: "将一只野兽提升至 5 级" },
    DISC_D_CAMP: { FR: "Terminer 5 étages de la Campagne", EN: "Clear 5 Campaign floors", ZH: "通关 5 层战役" },
    DISC_D_TOWER: { FR: "Atteindre l'étage 5 de la Tour", EN: "Reach floor 5 of the Tower", ZH: "到达高塔第 5 层" },
    DISC_D_PVP: { FR: "Gagner un combat en Arène", EN: "Win an Arena fight", ZH: "赢得一场竞技场战斗" },

    DISC_CLAIM: { FR: "Réclamer", EN: "Claim", ZH: "领取" },
    DISC_CLAIMED: { FR: "Réclamé ✓", EN: "Claimed ✓", ZH: "已领取 ✓" },
    DISC_CLAIM_FAIL: { FR: "Impossible de réclamer pour l'instant. Réessaie dans un moment.", EN: "Cannot claim right now. Try again shortly.", ZH: "暂时无法领取，请稍后再试。" },

    DISC_CRYPTO_TITLE: { FR: "Débloquer tes gains", EN: "Unlock your earnings", ZH: "解锁你的收益" },
    DISC_CRYPTO_LOCKED: { FR: "Termine les six étapes ci-dessus pour ouvrir cette partie.", EN: "Complete the six steps above to open this part.", ZH: "完成以上六个步骤即可开启此部分。" },
    DISC_DUST_WAIT: { FR: "Portefeuille lié ✓ On t'envoie un peu de Fractal Bitcoin. Compte quelques minutes.", EN: "Wallet linked ✓ We're sending you a little Fractal Bitcoin. Give it a few minutes.", ZH: "钱包已绑定 ✓ 我们正在向你发送少量 Fractal Bitcoin，请稍候几分钟。" },
    DISC_DUST_ARRIVED: { FR: "Ouvre UniSat, retrouve la transaction reçue, et colle son identifiant ci-dessous.", EN: "Open UniSat, find the transaction you received, and paste its ID below.", ZH: "打开 UniSat，找到收到的交易，并在下方粘贴其 ID。" },
    DISC_TXID_LABEL: { FR: "Identifiant de transaction (txid)", EN: "Transaction ID (txid)", ZH: "交易 ID（txid）" },
    DISC_TXID_HINT: { FR: "C'est le même geste que pour un dépôt : tu sauras le refaire.", EN: "It's the same move as for a deposit: you'll know how to do it again.", ZH: "这与充值的操作相同：以后你就会了。" },
    DISC_TXID_PLACEHOLDER: { FR: "Colle le txid ici", EN: "Paste the txid here", ZH: "在此粘贴 txid" },
    DISC_TXID_BTN: { FR: "Valider", EN: "Submit", ZH: "提交" },
    DISC_TXID_BAD: { FR: "Ce n'est pas le bon identifiant. Vérifie dans UniSat la transaction que tu viens de recevoir.", EN: "That's not the right ID. Check in UniSat the transaction you just received.", ZH: "ID 不正确。请在 UniSat 中核对你刚收到的交易。" },
    DISC_TXID_NONE: { FR: "La transaction n'est pas encore partie. Réessaie dans quelques minutes.", EN: "The transaction hasn't been sent yet. Try again in a few minutes.", ZH: "交易尚未发出，请几分钟后再试。" },
    DISC_TXID_OK: { FR: "Parfait ✓ Tes gains sont débloqués et ton airdrop est en route.", EN: "Perfect ✓ Your earnings are unlocked and your airdrop is on its way.", ZH: "完成 ✓ 收益已解锁，空投正在发放。" },
```

Puis ajouter les 23 clés à la liste `KEYS` de `test/account-i18n.test.js` — c'est ce fichier qui porte la règle du dépôt sur les trois langues.

- [ ] **Step 4: Lancer les tests**

Run: `node --test --test-force-exit test/discovery-i18n.test.js test/account-i18n.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add i18n.js test/discovery-i18n.test.js test/account-i18n.test.js
git commit -m "feat(i18n): libelles du parcours de decouverte en FR/EN/ZH"
```

---

### Task 2 : Actions d'API

**Files:**
- Modify: `app.jsx`
- Test: `test/discovery-wiring.test.js`

**Interfaces:**
- Consumes: rien (le serveur est déjà livré).
- Produces, dans `actions` :
  - `discoveryState() → Promise<{ok, data?}>`
  - `claimDiscovery(stepId) → Promise<{ok, reward?, reason?}>`
  - `submitDustTxid(txid) → Promise<{ok, airdrop_pending?, reason?}>`

**Le modèle à suivre :** les actions `fetchQuests` / `claimQuest` déjà présentes dans `app.jsx`. Mêmes conventions : Bearer depuis `g.authToken`, retour `{ok, …}` jamais une exception, `reason` distinguant les cas d'erreur.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/discovery-wiring.test.js` :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = read("app.jsx");

test("les trois routes du parcours sont appelees", () => {
  assert.match(APP, /\/discovery\/state/);
  assert.match(APP, /\/discovery\/claim/);
  assert.match(APP, /\/discovery\/txid/);
});

test("les trois actions portent le Bearer du joueur", () => {
  for (const nom of ["discoveryState", "claimDiscovery", "submitDustTxid"]) {
    const i = APP.indexOf("async " + nom);
    assert.ok(i > 0, `action ${nom} absente`);
    const bloc = APP.slice(i, i + 1200);
    assert.match(bloc, /Authorization/, `${nom} n'authentifie pas sa requete`);
  }
});

test("le client n'annonce jamais sa propre progression", () => {
  const i = APP.indexOf("async claimDiscovery");
  const bloc = APP.slice(i, i + 1200);
  assert.ok(!/progress|done:/.test(bloc),
    "le claim ne doit envoyer que l'identifiant de l'etape : le serveur recompte");
});

test("les cas d'erreur du serveur sont distingues", () => {
  const i = APP.indexOf("async submitDustTxid");
  const bloc = APP.slice(i, i + 1400);
  assert.match(bloc, /poussiere_non_envoyee|dust/, "le cas « pas encore envoyee » a son message");
  assert.match(bloc, /txid_invalide|bad/, "le cas « mauvais txid » a le sien");
});

test("aucune action ne leve : elles rendent toutes {ok:false}", () => {
  for (const nom of ["discoveryState", "claimDiscovery", "submitDustTxid"]) {
    const i = APP.indexOf("async " + nom);
    const bloc = APP.slice(i, i + 1400);
    assert.match(bloc, /catch/, `${nom} doit capturer ses erreurs reseau`);
  }
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test --test-force-exit test/discovery-wiring.test.js`
Expected: FAIL — 5 tests.

- [ ] **Step 3: Écrire les actions**

Dans `app.jsx`, dans le bloc `actions`, à côté de `fetchQuests` :

```js
    // Etat du parcours. Le serveur recompte la progression a chaque appel : le
    // client n'en garde aucune trace et n'en calcule jamais.
    async discoveryState() {
      const s = gRef.current;
      if (!s.authToken) return { ok: false };
      try {
        const r = await fetch(`${API_URL}/discovery/state`, {
          headers: { "Authorization": `Bearer ${s.authToken}` },
        });
        if (!r.ok) return { ok: false };
        return { ok: true, data: await r.json() };
      } catch (e) {
        return { ok: false };
      }
    },
    // Reclame une etape. On n'envoie QUE son identifiant : c'est le serveur qui
    // decide si elle est accomplie, et qui connait le montant.
    async claimDiscovery(stepId) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const r = await fetch(`${API_URL}/discovery/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ step: stepId }),
        });
        if (r.status === 409) return { ok: false, reason: "deja" };
        if (!r.ok) return { ok: false, reason: r.status >= 500 ? "server" : "refuse" };
        const d = await r.json();
        // Le solde verrouille bouge : on le refletera au prochain /save, mais on
        // remonte le montant pour l'afficher immediatement.
        return { ok: true, reward: Number(d.reward) || 0 };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    // Soumet le txid de la poussiere recue. Le serveur connait la valeur attendue.
    async submitDustTxid(txid) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const r = await fetch(`${API_URL}/discovery/txid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ txid: String(txid || "").trim() }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          if (j.error === "poussiere_non_envoyee") return { ok: false, reason: "dust" };
          if (j.error === "txid_invalide") return { ok: false, reason: "bad" };
          return { ok: false, reason: r.status >= 500 ? "server" : "refuse" };
        }
        const d = await r.json();
        setG((st) => ({ ...st, onchainVerified: true }));
        return { ok: true, airdrop_pending: !!d.airdrop_pending };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
```

- [ ] **Step 4: Lancer les tests**

Run: `node --test --test-force-exit test/discovery-wiring.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app.jsx test/discovery-wiring.test.js
git commit -m "feat(decouverte): actions state/claim/txid"
```

---

### Task 3 : La section « Tes premiers pas » dans l'onglet Quêtes

**Files:**
- Modify: `quests.jsx`
- Test: `test/discovery-ui.test.js`

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: la section affichée en tête de l'écran `Quests`.

**Pourquoi là et pas dans un écran neuf :** l'onglet Quêtes est déjà l'endroit où le joueur va chercher « qu'est-ce que je fais maintenant, et qu'est-ce que ça me rapporte ». Il possède déjà la barre de progression, le bouton de réclamation, l'état « réclamé » et leurs styles (`q-row`, `q-prog`, `q-claim`, `q-claimed`). Réutilise ces classes : le parcours doit ressembler au reste du jeu, pas à une pièce rapportée.

**Règle d'affichage :** la section disparaît entièrement une fois les six étapes réclamées — un tutoriel terminé ne doit plus occuper l'écran. Elle ne s'affiche pas non plus tant que `discoveryState()` n'a rien rendu.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/discovery-ui.test.js` :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const Q = fs.readFileSync(path.join(__dirname, "..", "quests.jsx"), "utf8");

test("la section du parcours existe et vient en tete", () => {
  assert.match(Q, /DISC_TITLE/, "titre du parcours absent");
  const iDisc = Q.indexOf("DISC_TITLE");
  const iDaily = Q.indexOf("Q_TITLE");
  assert.ok(iDisc > 0 && iDaily > 0 && iDisc < iDaily,
    "le parcours doit s'afficher AVANT les quetes du jour : c'est la premiere chose a faire");
});

test("chaque etape affiche sa progression et sa recompense", () => {
  assert.match(Q, /DISC_D_|DISC_\" \+|DISC_" \+/, "les libelles d'etape doivent etre resolus par identifiant");
  assert.match(Q, /q-prog/, "reutiliser la barre de progression existante");
  assert.match(Q, /q-claim/, "reutiliser le bouton de reclamation existant");
});

test("la section disparait quand tout est reclame", () => {
  assert.match(Q, /game_done|every\(/,
    "un tutoriel termine ne doit plus occuper l'ecran");
});

test("le client n'invente aucune progression", () => {
  // Tout vient de /discovery/state : aucun calcul local a partir de l'etat du jeu.
  assert.ok(!/g\.roster|g\.liquid|g\.locked/.test(Q.slice(Q.indexOf("DISC_TITLE") - 2000, Q.indexOf("DISC_TITLE") + 3000)),
    "la progression du parcours ne se derive jamais de l'etat client");
});

test("le bouton est desactive tant que l'etape n'est pas accomplie", () => {
  const i = Q.indexOf("DISC_CLAIM");
  const bloc = Q.slice(Math.max(0, i - 1500), i + 800);
  assert.match(bloc, /disabled/, "sans cela le joueur clique et recoit un refus serveur incomprehensible");
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test --test-force-exit test/discovery-ui.test.js`
Expected: FAIL.

- [ ] **Step 3: Écrire la section**

Dans `quests.jsx`, ajouter un état et un chargement au montage, puis rendre la section avant le bloc des quêtes quotidiennes. Structure attendue (adapte-la au style réel du fichier, que tu dois lire en entier d'abord) :

```jsx
  const [disc, setDisc] = useState(null);
  const [claimingDisc, setClaimingDisc] = useState(null);

  useEffect(() => {
    if (!g.wallet) return;
    let alive = true;
    actions.discoveryState().then((r) => { if (alive && r.ok) setDisc(r.data); }).catch(() => {});
    return () => { alive = false; };
  }, [g.wallet]);

  const onClaimDisc = async (id) => {
    setClaimingDisc(id);
    let r;
    try { r = await actions.claimDiscovery(id); } finally { setClaimingDisc(null); }
    if (!r.ok) { toast(I18N.t("DISC_CLAIM_FAIL"), "bad"); return; }
    // Recharger l'etat depuis le serveur plutot que de le patcher localement :
    // une seule source de verite, et la progression des autres etapes a pu bouger.
    const s = await actions.discoveryState();
    if (s.ok) setDisc(s.data);
  };
```

et le rendu, en tête du composant, avant les quêtes du jour :

```jsx
      {disc && !disc.steps.every((s) => s.claimed) && (
        <div className="q-block">
          <SectionHead eyebrow="🎓 START" title={I18N.t("DISC_TITLE")} />
          <div className="muted mono" style={{ fontSize: 12, marginBottom: 10 }}>{I18N.t("DISC_SUB")}</div>
          {disc.steps.map((s) => {
            const pct = s.target > 0 ? Math.min(100, Math.round((s.progress / s.target) * 100)) : 0;
            return (
              <div key={s.id} className={cx("q-row", s.claimed && "done")}>
                <span className="q-label">{I18N.t("DISC_" + s.id.toUpperCase())}</span>
                <span className="q-prog">{s.progress}/{s.target}</span>
                <span className="q-reward">+{s.reward} 🔒</span>
                {s.claimed
                  ? <span className="q-claimed">{I18N.t("DISC_CLAIMED")}</span>
                  : <button className="q-claim" disabled={!s.done || claimingDisc === s.id}
                            onClick={() => onClaimDisc(s.id)}>{I18N.t("DISC_CLAIM")}</button>}
              </div>
            );
          })}
        </div>
      )}
```

⚠️ Les noms de classes ci-dessus (`q-block`, `q-label`, `q-reward`) sont indicatifs : **lis `quests.jsx` et `styles.css` et emploie les classes qui existent réellement**. Une classe inventée donnerait un rendu cassé que les tests ne verraient pas.

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected: PASS intégral.

- [ ] **Step 5: Commit**

```bash
git add quests.jsx test/discovery-ui.test.js
git commit -m "feat(decouverte): section « Tes premiers pas » en tete des quetes"
```

---

### Task 4 : Le volet crypto — poussière et txid

**Files:**
- Modify: `account.jsx`
- Test: `test/discovery-crypto.test.js`

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: le volet crypto dans la fenêtre « Comment débloquer » de `LockedBanner`.

**L'enchaînement à rendre lisible :**
1. volet jeu inachevé → la partie crypto est visible mais grisée, avec `DISC_CRYPTO_LOCKED` qui explique pourquoi ;
2. volet jeu fini, portefeuille pas encore lié → le bouton « Lier mon portefeuille » (déjà livré) ;
3. portefeuille lié, poussière pas encore partie → `DISC_DUST_WAIT` ;
4. poussière partie → `DISC_DUST_ARRIVED` et le champ txid ;
5. txid validé → `DISC_TXID_OK`.

L'état vient de `GET /discovery/state` (`game_done`, `dust_sent`, `txid_verified`) : **ne le déduis jamais de l'état client.**

- [ ] **Step 1: Écrire le test qui échoue**

Créer `test/discovery-crypto.test.js` :

```js
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const A = fs.readFileSync(path.join(__dirname, "..", "account.jsx"), "utf8");

test("le volet crypto lit son etat du serveur", () => {
  assert.match(A, /discoveryState/, "l'etat du parcours doit venir du serveur");
  for (const champ of ["game_done", "dust_sent", "txid_verified"]) {
    assert.match(A, new RegExp(champ), `champ ${champ} jamais lu`);
  }
});

test("la partie crypto est fermee tant que le volet jeu n'est pas fini", () => {
  assert.match(A, /DISC_CRYPTO_LOCKED/,
    "le joueur doit comprendre POURQUOI c'est ferme, sinon il croit a un bug");
});

test("les trois etats d'attente ont chacun leur message", () => {
  for (const k of ["DISC_DUST_WAIT", "DISC_DUST_ARRIVED", "DISC_TXID_OK"]) {
    assert.match(A, new RegExp(k), `message ${k} absent`);
  }
});

test("les echecs de txid sont distingues", () => {
  assert.match(A, /DISC_TXID_BAD/, "mauvais txid");
  assert.match(A, /DISC_TXID_NONE/, "poussiere pas encore partie");
});

test("le champ txid n'est pas capitalise par le clavier mobile", () => {
  const i = A.indexOf("DISC_TXID_PLACEHOLDER");
  const bloc = A.slice(Math.max(0, i - 900), i + 400);
  assert.match(bloc, /autoCapitalize="off"/,
    "un txid est de l'hexadecimal : la capitalisation automatique le rendrait invalide");
  assert.match(bloc, /autoCorrect="off"/);
});
```

- [ ] **Step 2: Lancer le test pour vérifier qu'il échoue**

Run: `node --test --test-force-exit test/discovery-crypto.test.js`
Expected: FAIL.

- [ ] **Step 3: Écrire le volet**

Dans `account.jsx`, à l'intérieur de `LockedBanner`, charger l'état du parcours à l'ouverture de la fenêtre `howto`, et remplacer le contenu de cette fenêtre par l'enchaînement décrit plus haut. Le bouton « Lier mon portefeuille » existant ne doit s'afficher qu'à l'étape 2.

Points imposés :
- le champ txid porte `autoComplete="off"`, `autoCapitalize="off"`, `autoCorrect="off"`, `spellCheck={false}` — un txid est de l'hexadécimal sensible à la casse, et le mobile est ouvert ;
- après un txid validé, recharger `discoveryState()` plutôt que de patcher l'état local ;
- le bouton de validation est désactivé pendant l'appel et quand le champ est vide.

- [ ] **Step 4: Lancer les tests**

Run: `npm test`
Expected: PASS intégral.

- [ ] **Step 5: Commit**

```bash
git add account.jsx test/discovery-crypto.test.js
git commit -m "feat(decouverte): volet crypto — poussiere puis txid"
```

---

### Task 5 : Cache-bust et non-régression

**Files:**
- Modify: `index.html`
- Test: `test/account-wiring.test.js` (mise à jour de l'assertion de version)

- [ ] **Step 1: Bumper la version**

```bash
sed -i 's/?v=92/?v=93/g' index.html
```

Puis mettre à jour, dans `test/account-wiring.test.js`, le test d'homogénéité du cache-bust qui asserte `["92"]` → `["93"]`.

- [ ] **Step 2: Lancer la suite complète**

Run: `npm test`
Expected: PASS intégral. Rapporter les totaux exacts.

- [ ] **Step 3: Vérifier qu'aucun écran de jeu n'a bougé**

```bash
git diff --stat origin/main -- data.js fosse.jsx arene.jsx tour.jsx forge-ui.js market.jsx
```
Expected: sortie vide.

- [ ] **Step 4: Commit**

```bash
git add index.html test/account-wiring.test.js
git commit -m "chore(web): cache-bust v93"
```

---

## Récapitulatif

| # | Tâche | Livrable testable |
|---|---|---|
| 1 | i18n | 23 clés × FR/EN/ZH |
| 2 | Actions | `discoveryState`, `claimDiscovery`, `submitDustTxid` |
| 3 | Section parcours | Six étapes en tête des Quêtes |
| 4 | Volet crypto | Poussière → txid → airdrop |
| 5 | Cache-bust | v93 homogène, aucun écran de jeu touché |

## Points de vigilance

1. **Le client n'invente jamais de progression.** Tout vient de `/discovery/state`. Un calcul local divergerait du serveur au premier écart de règle.
2. **Les classes CSS doivent exister.** Le rendu n'est couvert par aucun test : une classe inventée passerait les tests et casserait l'écran.
3. **Ne pas merger avant le volet serveur.**
