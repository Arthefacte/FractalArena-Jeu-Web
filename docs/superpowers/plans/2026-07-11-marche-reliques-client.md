# Marché entre joueurs — Reliques V1 (client web) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Onglet « Marché » 🏪 sur fractalarena.com : parcourir/acheter les reliques en vente, gérer ses propres listings (lister, annuler, récupérer, historique).

**Architecture:** Pattern Arène : helpers purs dans `market-ui.js` (testables `node:test`), composant `market.jsx` (vue `"market"`, exposé `window.Market`), actions fetch dans `app.jsx` (Bearer `g.authToken`), i18n `MKT_*` FR/EN/ZH, cache-bust global v69. Après achat/mise en vente/annulation, on resynchronise via `GET /save/:wallet` (pattern `relicSummon`) — le solde et l'inventaire affichés sont donc immédiatement justes.

**Tech Stack:** React sans build (Babel in-browser), fetch API, `node:test` pour les helpers purs.

**Spec:** `fractal-arena-server/docs/superpowers/specs/2026-07-11-marche-reliques-design.md`

## Global Constraints

- PRÉREQUIS : le serveur (plan `fractal-arena-server/docs/superpowers/plans/2026-07-11-marche-reliques-serveur.md`) doit être MERGÉ ET DÉPLOYÉ sur Railway avant de merger ce plan (le merge web = mise en prod GitHub Pages).
- Frais côté affichage = miroir exact du serveur : mise en vente `max(20, floor(price*0.01))`, commission `floor(price*0.05)`, net vendeur `price - commission`, bornes 100–1 000 000, durée 7 jours. Ne jamais calculer un montant côté client pour l'envoyer au serveur — affichage seulement.
- API : `GET /market/listings` (public), `GET /market/mine` (Bearer), `POST /market/list` `{wallet, relic_id, price}`, `POST /market/buy` `{wallet, listing_id}`, `POST /market/cancel` `{wallet, listing_id}`. Erreurs : clés stables (`deja_vendu`, `listing_expire`, `auto_achat_interdit`, `limite_listings`, `prix_invalide`, `pas_le_vendeur`, `listing_introuvable`, `erreur_serveur`) + `{status:"insufficient_balance"}`.
- i18n : chaque clé en FR, EN et ZH — jamais de texte en dur dans le JSX.
- Cache-bust : TOUTES les références `?v=68` de `index.html` passent à `?v=69` (styles inclus).
- Tests : `node --test --test-force-exit` ; parse Babel de tout `.jsx` modifié (pattern des tests `parse` existants).

---

### Task 1: Helpers purs `market-ui.js`

**Files:**
- Create: `market-ui.js`
- Test: `test/market-ui.test.js`

**Interfaces:**
- Produces: `window.FA_MARKET = { listingFees, isValidPrice, isListingExpired, filterListings, MARKET_PRICE_MIN, MARKET_PRICE_MAX }` (IIFE avec export Node pour les tests, pattern `arene-ui.js`).

- [ ] **Step 1: Write the failing test**

```js
// test/market-ui.test.js
const test = require("node:test");
const assert = require("node:assert");
const M = require("../market-ui.js");

test("listingFees : miroir serveur (1% min 20, commission 5%, net)", () => {
  assert.deepStrictEqual(M.listingFees(100), { listing_fee: 20, commission: 5, net_seller: 95 });
  assert.deepStrictEqual(M.listingFees(8000), { listing_fee: 80, commission: 400, net_seller: 7600 });
  assert.deepStrictEqual(M.listingFees(1000000), { listing_fee: 10000, commission: 50000, net_seller: 950000 });
});

test("isValidPrice : entier dans [100, 1000000]", () => {
  assert.strictEqual(M.isValidPrice(100), true);
  assert.strictEqual(M.isValidPrice(99), false);
  assert.strictEqual(M.isValidPrice(1000001), false);
  assert.strictEqual(M.isValidPrice(2.5), false);
  assert.strictEqual(M.isValidPrice("500"), false);
});

test("isListingExpired : 7 jours depuis created_at", () => {
  const now = Date.parse("2026-07-11T12:00:00Z");
  assert.strictEqual(M.isListingExpired("2026-07-05T12:00:01Z", now), false);
  assert.strictEqual(M.isListingExpired("2026-07-04T12:00:00Z", now), true);
});

test("filterListings : filtre type/rareté + tri prix croissant", () => {
  const L = [
    { id: 1, price: 900, item: { type: "ruby_shard", rarity: "Rare" } },
    { id: 2, price: 300, item: { type: "amber_cell", rarity: "Epic" } },
    { id: 3, price: 500, item: { type: "ruby_shard", rarity: "Common" } },
  ];
  assert.deepStrictEqual(M.filterListings(L, {}).map((l) => l.id), [2, 3, 1]);
  assert.deepStrictEqual(M.filterListings(L, { type: "ruby_shard" }).map((l) => l.id), [3, 1]);
  assert.deepStrictEqual(M.filterListings(L, { rarity: "Epic" }).map((l) => l.id), [2]);
  assert.deepStrictEqual(M.filterListings(L, { type: "ruby_shard", rarity: "Rare" }).map((l) => l.id), [1]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-force-exit test/market-ui.test.js`
Expected: FAIL — `Cannot find module '../market-ui.js'`

- [ ] **Step 3: Write minimal implementation**

```js
/* ============================================================
   FRACTAL ARENA — Marché (reliques) : helpers purs (testables Node)
   Miroir des constantes serveur (market.js) — affichage seulement,
   le serveur reste seul juge des montants réels.
   ============================================================ */
(function () {
  const MARKET_PRICE_MIN = 100;
  const MARKET_PRICE_MAX = 1000000;
  const MARKET_LISTING_FEE_MIN = 20;
  const MARKET_LISTING_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  function listingFees(price) {
    const listing_fee = Math.max(MARKET_LISTING_FEE_MIN, Math.floor(price * 0.01));
    const commission = Math.floor(price * 0.05);
    return { listing_fee, commission, net_seller: price - commission };
  }

  function isValidPrice(price) {
    return Number.isInteger(price) && price >= MARKET_PRICE_MIN && price <= MARKET_PRICE_MAX;
  }

  function isListingExpired(created_at, nowMs) {
    const now = typeof nowMs === "number" ? nowMs : Date.now();
    return now - new Date(created_at).getTime() >= MARKET_LISTING_TTL_MS;
  }

  // Filtre type/rareté + tri prix croissant (id croissant en départage).
  function filterListings(listings, f) {
    const q = f || {};
    return (Array.isArray(listings) ? listings : [])
      .filter((l) => l && l.item && (!q.type || l.item.type === q.type) && (!q.rarity || l.item.rarity === q.rarity))
      .slice()
      .sort((a, b) => a.price - b.price || a.id - b.id);
  }

  const api = { listingFees, isValidPrice, isListingExpired, filterListings, MARKET_PRICE_MIN, MARKET_PRICE_MAX };
  if (typeof window !== "undefined") window.FA_MARKET = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-force-exit test/market-ui.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add market-ui.js test/market-ui.test.js
git commit -m "feat(market): helpers purs market-ui.js (frais miroir serveur, filtre/tri)"
```

---

### Task 2: i18n `MKT_*` (FR/EN/ZH) + test de présence

**Files:**
- Modify: `i18n.js` (ajouter le bloc après les clés `RELIC_*`)
- Test: `test/market-i18n.test.js`

**Interfaces:**
- Produces: clés `NAV_MARKET` et `MKT_*` utilisées par `market.jsx` (Task 3). Liste exacte dans le test ci-dessous.

- [ ] **Step 1: Write the failing test**

```js
// test/market-i18n.test.js
// Pattern de test/arene-i18n.test.js : chaque clé existe en FR, EN et ZH.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const KEYS = [
  "NAV_MARKET", "MKT_TITLE", "MKT_TAG", "MKT_TAB_BROWSE", "MKT_TAB_MINE",
  "MKT_BUY", "MKT_CONFIRM_TITLE", "MKT_CONFIRM_TEXT", "MKT_BALANCE_AFTER",
  "MKT_PRICE", "MKT_SELLER", "MKT_EMPTY", "MKT_ALL_TYPES", "MKT_ALL_RARITIES",
  "MKT_SELL_TITLE", "MKT_SELECT_RELIC", "MKT_PRICE_INPUT", "MKT_FEE_PREVIEW",
  "MKT_NET_PREVIEW", "MKT_LIST_ACTION", "MKT_MY_ACTIVE", "MKT_MY_EXPIRED",
  "MKT_CANCEL", "MKT_RECLAIM", "MKT_HISTORY", "MKT_SOLD_TO", "MKT_LISTED_OK",
  "MKT_BOUGHT_OK", "MKT_CANCELLED_OK",
  "MKT_ERR_deja_vendu", "MKT_ERR_listing_expire", "MKT_ERR_auto_achat_interdit",
  "MKT_ERR_limite_listings", "MKT_ERR_prix_invalide", "MKT_ERR_generic",
];

test("i18n : toutes les clés MKT_* existent en FR/EN/ZH", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "i18n.js"), "utf8");
  for (const k of KEYS) {
    const idx = src.indexOf(k + ":");
    assert.notStrictEqual(idx, -1, `clé manquante : ${k}`);
    const block = src.slice(idx, src.indexOf("}", idx) + 1);
    for (const lang of ["FR:", "EN:", "ZH:"]) {
      assert.ok(block.includes(lang), `${k} : langue manquante ${lang}`);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-force-exit test/market-i18n.test.js`
Expected: FAIL — `clé manquante : NAV_MARKET`

- [ ] **Step 3: Write the implementation** — ajouter dans `i18n.js`, dans l'objet des traductions (après le bloc `RELIC_*`), les clés (FR d'abord, EN/ZH fidèles ; `{0}`/`{1}` = interpolations `I18N.t`) :

```js
    // ---- Marché (hôtel des ventes reliques) ----
    NAV_MARKET: { FR: "🏪 Marché", EN: "🏪 Market", ZH: "🏪 市场" },
    MKT_TITLE: { FR: "Marché", EN: "Market", ZH: "市场" },
    MKT_TAG: { FR: "Achetez et vendez vos reliques entre joueurs", EN: "Buy and sell relics with other players", ZH: "与其他玩家买卖遗物" },
    MKT_TAB_BROWSE: { FR: "Parcourir", EN: "Browse", ZH: "浏览" },
    MKT_TAB_MINE: { FR: "Mes ventes", EN: "My sales", ZH: "我的出售" },
    MKT_BUY: { FR: "Acheter", EN: "Buy", ZH: "购买" },
    MKT_CONFIRM_TITLE: { FR: "Confirmer l'achat", EN: "Confirm purchase", ZH: "确认购买" },
    MKT_CONFIRM_TEXT: { FR: "Acheter cette relique pour {0} FA ?", EN: "Buy this relic for {0} FA?", ZH: "以 {0} FA 购买此遗物？" },
    MKT_BALANCE_AFTER: { FR: "Solde après : {0} FA", EN: "Balance after: {0} FA", ZH: "购买后余额：{0} FA" },
    MKT_PRICE: { FR: "Prix", EN: "Price", ZH: "价格" },
    MKT_SELLER: { FR: "Vendeur", EN: "Seller", ZH: "卖家" },
    MKT_EMPTY: { FR: "Aucune relique en vente pour l'instant.", EN: "No relics for sale right now.", ZH: "目前没有遗物出售。" },
    MKT_ALL_TYPES: { FR: "Tous types", EN: "All types", ZH: "所有类型" },
    MKT_ALL_RARITIES: { FR: "Toutes raretés", EN: "All rarities", ZH: "所有稀有度" },
    MKT_SELL_TITLE: { FR: "Mettre en vente", EN: "List for sale", ZH: "上架出售" },
    MKT_SELECT_RELIC: { FR: "Choisis une relique de ton inventaire", EN: "Pick a relic from your inventory", ZH: "从你的库存中选择一件遗物" },
    MKT_PRICE_INPUT: { FR: "Prix (100 à 1 000 000 FA)", EN: "Price (100 to 1,000,000 FA)", ZH: "价格（100 至 1,000,000 FA）" },
    MKT_FEE_PREVIEW: { FR: "Frais de mise en vente : {0} FA (non remboursés)", EN: "Listing fee: {0} FA (non-refundable)", ZH: "上架费：{0} FA（不退还）" },
    MKT_NET_PREVIEW: { FR: "Tu recevras {0} FA après commission (5 %)", EN: "You will receive {0} FA after the 5% commission", ZH: "扣除 5% 佣金后你将获得 {0} FA" },
    MKT_LIST_ACTION: { FR: "Mettre en vente", EN: "List", ZH: "上架" },
    MKT_MY_ACTIVE: { FR: "En vente ({0}/10)", EN: "Listed ({0}/10)", ZH: "在售（{0}/10）" },
    MKT_MY_EXPIRED: { FR: "Expirées — à récupérer", EN: "Expired — reclaim", ZH: "已过期 — 待取回" },
    MKT_CANCEL: { FR: "Annuler", EN: "Cancel", ZH: "取消" },
    MKT_RECLAIM: { FR: "Récupérer", EN: "Reclaim", ZH: "取回" },
    MKT_HISTORY: { FR: "Historique", EN: "History", ZH: "历史记录" },
    MKT_SOLD_TO: { FR: "Vendue {0} FA", EN: "Sold for {0} FA", ZH: "以 {0} FA 售出" },
    MKT_LISTED_OK: { FR: "Relique mise en vente !", EN: "Relic listed!", ZH: "遗物已上架！" },
    MKT_BOUGHT_OK: { FR: "Relique achetée !", EN: "Relic purchased!", ZH: "已购买遗物！" },
    MKT_CANCELLED_OK: { FR: "Relique récupérée.", EN: "Relic returned.", ZH: "遗物已取回。" },
    MKT_ERR_deja_vendu: { FR: "Trop tard : déjà vendue.", EN: "Too late: already sold.", ZH: "太迟了：已售出。" },
    MKT_ERR_listing_expire: { FR: "Cette annonce a expiré.", EN: "This listing has expired.", ZH: "该商品已过期。" },
    MKT_ERR_auto_achat_interdit: { FR: "Tu ne peux pas acheter ta propre relique.", EN: "You can't buy your own relic.", ZH: "你不能购买自己的遗物。" },
    MKT_ERR_limite_listings: { FR: "Limite atteinte : 10 ventes actives max.", EN: "Limit reached: 10 active listings max.", ZH: "已达上限：最多 10 个在售商品。" },
    MKT_ERR_prix_invalide: { FR: "Prix invalide (100 à 1 000 000 FA, entier).", EN: "Invalid price (100 to 1,000,000 FA, integer).", ZH: "价格无效（100 至 1,000,000 FA，整数）。" },
    MKT_ERR_generic: { FR: "Erreur du Marché, réessaie.", EN: "Market error, please retry.", ZH: "市场错误，请重试。" },
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test --test-force-exit test/market-i18n.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add i18n.js test/market-i18n.test.js
git commit -m "feat(market): i18n MKT_* FR/EN/ZH"
```

---

### Task 3: Actions `app.jsx` + composant `market.jsx` + câblage nav + cache-bust v69

**Files:**
- Create: `market.jsx`
- Modify: `app.jsx` (state, actions, VIEWS, nav), `index.html` (2 scripts + v68→v69 partout)
- Test: `test/market-parse.test.js` (parse Babel, pattern des tests parse existants)

**Interfaces:**
- Consumes: `window.FA_MARKET` (Task 1), clés i18n (Task 2), `RelicIcon` (components.jsx), `Modal`, `useFA`, `fmt`, `rarityLabel`, `D.RELICS`/`D.relicStatDelta`, API `/market/*` (plan serveur).
- Produces: vue `"market"` accessible par l'onglet 🏪 ; `g.market = { listings: [], mine: null }` ; actions `marketRefresh()`, `marketList(relicId, price)`, `marketBuy(listingId)`, `marketCancel(listingId)` (toutes retournent le JSON serveur ou `{error}`).

- [ ] **Step 1: Write the failing parse test**

```js
// test/market-parse.test.js
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const Babel = require("@babel/standalone");

test("market.jsx parse sans erreur (presets react)", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "market.jsx"), "utf8");
  assert.doesNotThrow(() => Babel.transform(src, { presets: ["react"] }));
});

test("app.jsx référence la vue market et les actions", () => {
  const src = fs.readFileSync(path.join(__dirname, "..", "app.jsx"), "utf8");
  for (const needle of ["market: Market", "NAV_MARKET", "marketRefresh", "marketList", "marketBuy", "marketCancel"]) {
    assert.ok(src.includes(needle), `app.jsx doit contenir ${needle}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test --test-force-exit test/market-parse.test.js`
Expected: FAIL — `market.jsx` inexistant

- [ ] **Step 3: Actions dans `app.jsx`** — dans l'objet `actions` (après le bloc `pvp*`, vers la ligne 1238), ajouter :

```js
    async marketRefresh() {
      const s = gRef.current;
      try {
        const r = await fetch(`${API_URL}/market/listings`);
        const j = await r.json().catch(() => ({}));
        let mine = null;
        if (s.authToken) {
          const rm = await fetch(`${API_URL}/market/mine`, { headers: { "Authorization": "Bearer " + s.authToken } });
          if (rm.ok) mine = await rm.json().catch(() => null);
        }
        setG((st) => ({ ...st, market: { listings: (j && j.listings) || [], mine } }));
      } catch (e) { /* réseau : on garde l'état précédent */ }
    },
    // Après toute mutation : resync du save (solde + inventaire), pattern relicSummon.
    async marketResync() {
      const s = gRef.current;
      if (!s.wallet) return;
      try {
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
      } catch (e) { /* silencieux */ }
    },
    async marketList(relicId, price) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { error: "auth" };
      const r = await fetch(`${API_URL}/market/list`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.authToken },
        body: JSON.stringify({ wallet: s.wallet, relic_id: relicId, price }),
      });
      const j = await r.json().catch(() => ({ error: "erreur_serveur" }));
      if (j && j.status === "ok") { await actions.marketResync(); await actions.marketRefresh(); }
      return j;
    },
    async marketBuy(listingId) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { error: "auth" };
      const r = await fetch(`${API_URL}/market/buy`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.authToken },
        body: JSON.stringify({ wallet: s.wallet, listing_id: listingId }),
      });
      const j = await r.json().catch(() => ({ error: "erreur_serveur" }));
      if (j && j.status === "ok") { await actions.marketResync(); await actions.marketRefresh(); }
      return j;
    },
    async marketCancel(listingId) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { error: "auth" };
      const r = await fetch(`${API_URL}/market/cancel`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.authToken },
        body: JSON.stringify({ wallet: s.wallet, listing_id: listingId }),
      });
      const j = await r.json().catch(() => ({ error: "erreur_serveur" }));
      if (j && j.status === "ok") { await actions.marketResync(); await actions.marketRefresh(); }
      return j;
    },
```

NOTE : si l'objet `actions` est construit d'un bloc (`useMemo(() => ({ ... }), [])`) et que `actions.marketResync` n'est pas accessible depuis l'intérieur, extraire `marketResync` en fonction locale au-dessus du `useMemo` et l'appeler directement — suivre ce que fait déjà le fichier pour les helpers partagés (ex. `svOpts`).

Dans le state initial de `g`, ajouter `market: { listings: [], mine: null }` à côté de `pvp: {}`.

Dans `VIEWS` (ligne ~1260) ajouter `market: Market` (et destructurer `Market` depuis `window` comme `Arene`). Dans les onglets nav (ligne ~1353), ajouter `["market", "NAV_MARKET"]` après `["forge", "NAV_FORGE"]`.

- [ ] **Step 4: Composant `market.jsx`**

```jsx
/* ============================================================
   FRACTAL ARENA — Marché (hôtel des ventes reliques)
   Deux volets : Parcourir (achat) / Mes ventes (lister, annuler,
   récupérer, historique). Resync du save après chaque mutation.
   ============================================================ */
const { useFA, cx, fmt, rarityLabel, Modal, SectionHead, RelicIcon } = window;
const MKT = window.FA_MARKET;

// Message d'erreur : clé serveur connue → traduction dédiée, sinon générique.
// (Ne PAS faire I18N.t("MKT_ERR_" + e) || generic : une clé inconnue renvoie la clé brute, truthy.)
const MKT_ERR_KEYS = ["deja_vendu", "listing_expire", "auto_achat_interdit", "limite_listings", "prix_invalide"];
function mktErrMsg(j) {
  const e = j && j.error;
  return MKT_ERR_KEYS.indexOf(e) >= 0 ? I18N.t("MKT_ERR_" + e) : I18N.t("MKT_ERR_generic");
}

function MarketListingCard({ l, onBuy, own }) {
  const it = l.item || {};
  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: 10, padding: 10 }}>
      <RelicIcon type={it.type} rarity={it.rarity} size={36} />
      <div style={{ flex: 1 }}>
        <div style={{ color: D.RARITY_COLORS[it.rarity] }}>
          {I18N.t("RELIC_" + String(it.type || "").toUpperCase())} · {rarityLabel(it.rarity)}
        </div>
        <div className="dim" style={{ fontSize: 12 }}>
          {I18N.t("MKT_SELLER")} : {String(l.seller || "").slice(0, 8)}…{String(l.seller || "").slice(-4)}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div><Coin /> {fmt(l.price)}</div>
        {!own && <button className="btn small" onClick={() => onBuy(l)}>{I18N.t("MKT_BUY")}</button>}
      </div>
    </div>
  );
}

function MarketBrowse() {
  const { g, actions, toast } = useFA();
  const [fType, setFType] = React.useState("");
  const [fRarity, setFRarity] = React.useState("");
  const [confirm, setConfirm] = React.useState(null); // listing en attente de confirmation
  const [busy, setBusy] = React.useState(false);
  const listings = MKT.filterListings((g.market && g.market.listings) || [], { type: fType || null, rarity: fRarity || null });

  async function doBuy() {
    if (!confirm || busy) return;
    setBusy(true);
    const j = await actions.marketBuy(confirm.id);
    setBusy(false);
    setConfirm(null);
    if (j && j.status === "ok") toast(I18N.t("MKT_BOUGHT_OK"));
    else if (j && j.status === "insufficient_balance") toast(I18N.t("INSUFFICIENT", (g.liquid || 0) + (g.locked || 0), confirm.price));
    else toast(mktErrMsg(j));
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <select value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">{I18N.t("MKT_ALL_TYPES")}</option>
          {Object.keys(D.RELICS).map((k) => <option key={k} value={k}>{I18N.t("RELIC_" + k.toUpperCase())}</option>)}
        </select>
        <select value={fRarity} onChange={(e) => setFRarity(e.target.value)}>
          <option value="">{I18N.t("MKT_ALL_RARITIES")}</option>
          {["Common", "Rare", "Epic", "Legendary"].map((r) => <option key={r} value={r}>{rarityLabel(r)}</option>)}
        </select>
      </div>
      {listings.length === 0 && <div className="dim">{I18N.t("MKT_EMPTY")}</div>}
      {listings.map((l) => <MarketListingCard key={l.id} l={l} own={l.seller === g.wallet} onBuy={setConfirm} />)}
      {confirm && (
        <Modal onClose={() => setConfirm(null)} title={I18N.t("MKT_CONFIRM_TITLE")}>
          <div style={{ textAlign: "center", padding: 8 }}>
            <RelicIcon type={confirm.item.type} rarity={confirm.item.rarity} size={48} />
            <p>{I18N.t("MKT_CONFIRM_TEXT", fmt(confirm.price))}</p>
            <p className="dim">{I18N.t("MKT_BALANCE_AFTER", fmt(Math.max(0, (g.liquid || 0) + (g.locked || 0) - confirm.price)))}</p>
            <button className="btn" disabled={busy} onClick={doBuy}>{I18N.t("MKT_BUY")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MarketMine() {
  const { g, actions, toast } = useFA();
  const [sel, setSel] = React.useState(null);   // relic_id sélectionnée
  const [price, setPrice] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const mine = (g.market && g.market.mine) || { active: [], expired: [], history: [] };
  const inventory = (g.equipment || []);
  const equippedIds = new Set((g.creatures || []).map((c) => c && c.relic_id).filter(Boolean));
  const p = parseInt(price, 10);
  const fees = MKT.isValidPrice(p) ? MKT.listingFees(p) : null;

  async function doList() {
    if (!sel || !fees || busy) return;
    setBusy(true);
    const j = await actions.marketList(sel, p);
    setBusy(false);
    if (j && j.status === "ok") { toast(I18N.t("MKT_LISTED_OK")); setSel(null); setPrice(""); }
    else if (j && j.status === "insufficient_balance") toast(I18N.t("MKT_ERR_generic"));
    else toast(mktErrMsg(j));
  }

  async function doCancel(id) {
    if (busy) return;
    setBusy(true);
    const j = await actions.marketCancel(id);
    setBusy(false);
    if (j && j.status === "ok") toast(I18N.t("MKT_CANCELLED_OK"));
    else toast(mktErrMsg(j));
  }

  return (
    <div>
      <SectionHead title={I18N.t("MKT_SELL_TITLE")} />
      <div className="dim" style={{ marginBottom: 6 }}>{I18N.t("MKT_SELECT_RELIC")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
        {inventory.map((it) => (
          <button key={it.id} className={cx("chip", sel === it.id && "on")} onClick={() => setSel(it.id)}>
            <RelicIcon type={it.type} rarity={it.rarity} size={20} />
            {I18N.t("RELIC_" + it.type.toUpperCase())} {equippedIds.has(it.id) ? "⚔" : ""}
          </button>
        ))}
      </div>
      <input type="number" min="100" max="1000000" step="1" placeholder={I18N.t("MKT_PRICE_INPUT")}
             value={price} onChange={(e) => setPrice(e.target.value)} />
      {fees && (
        <div className="dim" style={{ fontSize: 12, margin: "6px 0" }}>
          <div>{I18N.t("MKT_FEE_PREVIEW", fmt(fees.listing_fee))}</div>
          <div>{I18N.t("MKT_NET_PREVIEW", fmt(fees.net_seller))}</div>
        </div>
      )}
      <button className="btn" disabled={!sel || !fees || busy} onClick={doList}>{I18N.t("MKT_LIST_ACTION")}</button>

      <SectionHead title={I18N.t("MKT_MY_ACTIVE", (mine.active || []).length)} />
      {(mine.active || []).map((l) => (
        <div key={l.id} className="card" style={{ display: "flex", alignItems: "center", gap: 8, padding: 8 }}>
          <RelicIcon type={l.item.type} rarity={l.item.rarity} size={24} />
          <span style={{ flex: 1 }}>{I18N.t("RELIC_" + l.item.type.toUpperCase())} · {fmt(l.price)} FA</span>
          <button className="btn small" disabled={busy} onClick={() => doCancel(l.id)}>{I18N.t("MKT_CANCEL")}</button>
        </div>
      ))}

      {(mine.expired || []).length > 0 && <SectionHead title={I18N.t("MKT_MY_EXPIRED")} />}
      {(mine.expired || []).map((l) => (
        <div key={l.id} className="card" style={{ display: "flex", alignItems: "center", gap: 8, padding: 8 }}>
          <RelicIcon type={l.item.type} rarity={l.item.rarity} size={24} />
          <span style={{ flex: 1 }}>{I18N.t("RELIC_" + l.item.type.toUpperCase())} · {fmt(l.price)} FA</span>
          <button className="btn small" disabled={busy} onClick={() => doCancel(l.id)}>{I18N.t("MKT_RECLAIM")}</button>
        </div>
      ))}

      {(mine.history || []).length > 0 && <SectionHead title={I18N.t("MKT_HISTORY")} />}
      {(mine.history || []).map((l) => (
        <div key={l.id} className="dim" style={{ fontSize: 12, padding: "2px 0" }}>
          {I18N.t("RELIC_" + l.item.type.toUpperCase())} — {l.status === "sold" ? I18N.t("MKT_SOLD_TO", fmt(l.price)) : I18N.t("MKT_CANCEL")}
        </div>
      ))}
    </div>
  );
}

function Market() {
  const { g, actions } = useFA();
  const [tab, setTab] = React.useState("browse");
  React.useEffect(() => { actions.marketRefresh(); }, [g.authToken]);
  return (
    <div className="screen">
      <SectionHead title={I18N.t("MKT_TITLE")} sub={I18N.t("MKT_TAG")} />
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button className={cx("tab", tab === "browse" && "on")} onClick={() => setTab("browse")}>{I18N.t("MKT_TAB_BROWSE")}</button>
        <button className={cx("tab", tab === "mine" && "on")} onClick={() => setTab("mine")}>{I18N.t("MKT_TAB_MINE")}</button>
      </div>
      {tab === "browse" ? <MarketBrowse /> : <MarketMine />}
    </div>
  );
}

Object.assign(window, { Market });
```

IMPORTANT : avant d'écrire ce fichier, vérifier dans `components.jsx`/`screens.jsx` les noms réels des classes CSS (`card`, `chip`, `tab`, `btn small`, `dim`) et les signatures réelles de `Modal`/`SectionHead`/`Coin`/`I18N.t(clé, ...args)` — s'aligner sur l'existant (copier un usage voisin), ne pas inventer. Ajuster le JSX en conséquence ; le test de parse et la vérif navigateur (Task 4) attraperont les écarts.

- [ ] **Step 5: `index.html`** — ajouter les 2 scripts au bon endroit de l'ordre de chargement :
  - `<script src="market-ui.js?v=69"></script>` après la ligne `arene-ui.js` (ligne ~80) ;
  - `<script type="text/babel" src="market.jsx?v=69"></script>` après la ligne `arene.jsx` (ligne ~97, AVANT `screens.jsx` et `app.jsx`).
  - Puis remplacer TOUTES les occurrences `?v=68` par `?v=69` (styles.css, mobile.css, tous les scripts).

- [ ] **Step 6: Run all tests**

Run: `node --test --test-force-exit`
Expected: PASS (market-ui, market-i18n, market-parse + tous les tests existants)

- [ ] **Step 7: Commit**

```bash
git add market.jsx app.jsx index.html test/market-parse.test.js
git commit -m "feat(market): onglet Marche — parcourir/acheter + mes ventes (v69)"
```

---

### Task 4: Vérification navigateur réelle

**Files:** aucun (vérification)

- [ ] **Step 1:** Invoquer le skill `Fractal Arena/fractal-arena-web:verify` (Playwright) et dérouler :
  1. L'onglet 🏪 apparaît dans la nav et s'ouvre sans erreur console.
  2. Volet Parcourir : listings affichés (ou message vide), filtres et tri fonctionnent.
  3. Volet Mes ventes : sélection d'une relique, saisie d'un prix → l'aperçu frais/net se met à jour en direct ; prix hors bornes → bouton désactivé.
  4. Mise en vente réelle (wallet de test) → toast, solde et inventaire mis à jour, listing visible dans Parcourir.
  5. Annulation → relique de retour dans l'inventaire.
  6. Achat avec un SECOND wallet de test → solde débité, relique dans l'inventaire de l'acheteur, listing disparu.
  7. Auto-achat → message d'erreur propre.
- [ ] **Step 2:** Corriger tout écart trouvé, relancer les tests, committer les fixes éventuels.

---

## Déploiement

1. NE PAS merger avant que le serveur `/market/*` soit LIVE sur Railway (le merge web = prod GitHub Pages immédiate).
2. PR web → merge → vérifier fractalarena.com sert la v69 (onglet Réseau : `market.jsx?v=69`).
3. Vérification manuelle post-prod : browse public sans wallet, achat/vente avec wallet réel.
