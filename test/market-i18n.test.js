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
