/* Généré par tools/precompile.mjs depuis market.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Marché (hôtel des ventes reliques)
   Deux volets : Parcourir (achat) / Mes ventes (lister, annuler,
   récupérer, historique). Resync du save après chaque mutation.
   ============================================================ */
const {
  useState,
  useEffect
} = React;
const D = window.FA_DATA,
  I18N = window.FA_I18N;
const {
  useFA,
  cx,
  fmt,
  rarityLabel,
  TokenIcon,
  FaText,
  Modal,
  SectionHead,
  RelicIcon
} = window;
const MKT = window.FA_MARKET;

// Message d'erreur : clé serveur connue → traduction dédiée, sinon générique.
// (Ne PAS faire I18N.t("MKT_ERR_" + e) || generic : une clé inconnue renvoie la clé brute, truthy.)
const MKT_ERR_KEYS = ["deja_vendu", "listing_expire", "auto_achat_interdit", "limite_listings", "prix_invalide"];
function mktErrMsg(j) {
  const e = j && j.error;
  return MKT_ERR_KEYS.indexOf(e) >= 0 ? I18N.t("MKT_ERR_" + e) : I18N.t("MKT_ERR_generic");
}
function MarketListingCard({
  l,
  onBuy,
  own
}) {
  const it = l.item || {};
  return /*#__PURE__*/React.createElement("div", {
    className: "oct-sm",
    style: {
      border: "1px solid var(--line-soft)",
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: 10,
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement(RelicIcon, {
    type: it.type,
    rarity: it.rarity,
    size: 36
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      color: D.RARITY_COLORS[it.rarity]
    }
  }, I18N.t("RELIC_" + String(it.type || "").toUpperCase()), " \xB7 ", rarityLabel(it.rarity)), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12
    }
  }, I18N.t("MKT_SELLER"), " : ", String(l.seller || "").slice(0, 8), "\u2026", String(l.seller || "").slice(-4))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono"
  }, /*#__PURE__*/React.createElement(TokenIcon, null), " ", fmt(l.price)), !own && /*#__PURE__*/React.createElement("button", {
    className: "btn sm",
    onClick: () => onBuy(l)
  }, I18N.t("MKT_BUY"))));
}
function MarketBrowse() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [fType, setFType] = useState("");
  const [fRarity, setFRarity] = useState("");
  const [confirm, setConfirm] = useState(null); // listing en attente de confirmation
  const [busy, setBusy] = useState(false);
  const listings = MKT.filterListings(g.market && g.market.listings || [], {
    type: fType || null,
    rarity: fRarity || null
  });
  async function doBuy() {
    if (!confirm || busy) return;
    setBusy(true);
    const j = await actions.marketBuy(confirm.id);
    setBusy(false);
    setConfirm(null);
    if (j && j.status === "ok") toast(I18N.t("MKT_BOUGHT_OK"), "good");else if (j && j.status === "insufficient_balance") toast(I18N.t("INSUFFICIENT", (g.liquid || 0) + (g.locked || 0), confirm.price), "bad");else toast(mktErrMsg(j), "bad");
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap8 wrap",
    style: {
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("select", {
    className: "field",
    style: {
      flex: 1,
      minWidth: 160
    },
    value: fType,
    onChange: e => setFType(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, I18N.t("MKT_ALL_TYPES")), Object.keys(D.RELICS).map(k => /*#__PURE__*/React.createElement("option", {
    key: k,
    value: k
  }, I18N.t("RELIC_" + k.toUpperCase())))), /*#__PURE__*/React.createElement("select", {
    className: "field",
    style: {
      flex: 1,
      minWidth: 160
    },
    value: fRarity,
    onChange: e => setFRarity(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, I18N.t("MKT_ALL_RARITIES")), ["Common", "Rare", "Epic", "Legendary"].map(r => /*#__PURE__*/React.createElement("option", {
    key: r,
    value: r
  }, rarityLabel(r))))), listings.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      textAlign: "center",
      padding: 24
    }
  }, I18N.t("MKT_EMPTY")), listings.map(l => /*#__PURE__*/React.createElement(MarketListingCard, {
    key: l.id,
    l: l,
    own: l.seller === g.wallet,
    onBuy: setConfirm
  })), confirm && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setConfirm(null)
  }, /*#__PURE__*/React.createElement("div", {
    className: "h2",
    style: {
      fontSize: 14,
      marginBottom: 10,
      textAlign: "center"
    }
  }, I18N.t("MKT_CONFIRM_TITLE")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: 8
    }
  }, /*#__PURE__*/React.createElement(RelicIcon, {
    type: confirm.item.type,
    rarity: confirm.item.rarity,
    size: 48
  }), /*#__PURE__*/React.createElement("p", {
    className: "mono"
  }, /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("MKT_CONFIRM_TEXT", fmt(confirm.price))
  })), /*#__PURE__*/React.createElement("p", {
    className: "muted mono"
  }, /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("MKT_BALANCE_AFTER", fmt(Math.max(0, (g.liquid || 0) + (g.locked || 0) - confirm.price)))
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec",
    disabled: busy,
    onClick: doBuy
  }, I18N.t("MKT_BUY")))));
}
function MarketMine() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [sel, setSel] = useState(null); // relic_id sélectionnée
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = g.market && g.market.mine || {
    active: [],
    expired: [],
    history: []
  };
  const inventory = g.equipment || [];
  // reliques équipées (⚔) = portées par une bête du roster — miroir du repère de screens.jsx (RelicSlot).
  const equippedIds = new Set((g.roster || []).map(c => c && c.relic_id).filter(Boolean));
  const p = parseInt(price, 10);
  const fees = MKT.isValidPrice(p) ? MKT.listingFees(p) : null;
  async function doList() {
    if (!sel || !fees || busy) return;
    setBusy(true);
    const j = await actions.marketList(sel, p);
    setBusy(false);
    if (j && j.status === "ok") {
      toast(I18N.t("MKT_LISTED_OK"), "good");
      setSel(null);
      setPrice("");
    } else if (j && j.status === "insufficient_balance") toast(I18N.t("MKT_ERR_generic"), "bad");else toast(mktErrMsg(j), "bad");
  }
  async function doCancel(id) {
    if (busy) return;
    setBusy(true);
    const j = await actions.marketCancel(id);
    setBusy(false);
    if (j && j.status === "ok") toast(I18N.t("MKT_CANCELLED_OK"), "good");else toast(mktErrMsg(j), "bad");
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(SectionHead, {
    title: I18N.t("MKT_SELL_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      marginBottom: 6,
      fontSize: 13
    }
  }, I18N.t("MKT_SELECT_RELIC")), /*#__PURE__*/React.createElement("div", {
    className: "flex wrap",
    style: {
      gap: 6,
      marginBottom: 8
    }
  }, inventory.map(it => /*#__PURE__*/React.createElement("button", {
    key: it.id,
    className: cx("btn sm", sel === it.id && "on"),
    onClick: () => setSel(it.id),
    style: {
      justifyContent: "flex-start",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement(RelicIcon, {
    type: it.type,
    rarity: it.rarity,
    size: 18
  }), " ", I18N.t("RELIC_" + it.type.toUpperCase()), " ", equippedIds.has(it.id) ? "⚔" : ""))), /*#__PURE__*/React.createElement("input", {
    className: "field",
    type: "number",
    min: "100",
    max: "1000000",
    step: "1",
    style: {
      maxWidth: 280
    },
    placeholder: I18N.t("MKT_PRICE_INPUT"),
    value: price,
    onChange: e => setPrice(e.target.value)
  }), fees && /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12,
      margin: "6px 0"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("MKT_FEE_PREVIEW", fmt(fees.listing_fee)),
    s: 12
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("MKT_NET_PREVIEW", fmt(fees.net_seller)),
    s: 12
  }))), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec",
    style: {
      marginTop: 8
    },
    disabled: !sel || !fees || busy,
    onClick: doList
  }, I18N.t("MKT_LIST_ACTION")), /*#__PURE__*/React.createElement(SectionHead, {
    title: I18N.t("MKT_MY_ACTIVE", (mine.active || []).length + (mine.expired || []).length)
  }), (mine.active || []).map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    className: "oct-sm",
    style: {
      border: "1px solid var(--line-soft)",
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(RelicIcon, {
    type: l.item.type,
    rarity: l.item.rarity,
    size: 24
  }), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      flex: 1,
      minWidth: 0
    }
  }, I18N.t("RELIC_" + l.item.type.toUpperCase()), " \xB7 ", /*#__PURE__*/React.createElement(TokenIcon, {
    s: 13
  }), " ", fmt(l.price)), /*#__PURE__*/React.createElement("button", {
    className: "btn sm",
    disabled: busy,
    onClick: () => doCancel(l.id)
  }, I18N.t("MKT_CANCEL")))), (mine.expired || []).length > 0 && /*#__PURE__*/React.createElement(SectionHead, {
    title: I18N.t("MKT_MY_EXPIRED")
  }), (mine.expired || []).map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    className: "oct-sm",
    style: {
      border: "1px solid var(--line-soft)",
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement(RelicIcon, {
    type: l.item.type,
    rarity: l.item.rarity,
    size: 24
  }), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      flex: 1,
      minWidth: 0
    }
  }, I18N.t("RELIC_" + l.item.type.toUpperCase()), " \xB7 ", /*#__PURE__*/React.createElement(TokenIcon, {
    s: 13
  }), " ", fmt(l.price)), /*#__PURE__*/React.createElement("button", {
    className: "btn sm",
    disabled: busy,
    onClick: () => doCancel(l.id)
  }, I18N.t("MKT_RECLAIM")))), (mine.history || []).length > 0 && /*#__PURE__*/React.createElement(SectionHead, {
    title: I18N.t("MKT_HISTORY")
  }), (mine.history || []).map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    className: "muted mono",
    style: {
      fontSize: 12,
      padding: "2px 0"
    }
  }, I18N.t("RELIC_" + l.item.type.toUpperCase()), " \u2014 ", l.status === "sold" ? I18N.t("MKT_SOLD_TO", fmt(l.price)) : I18N.t("MKT_CANCEL"))));
}
function Market() {
  const {
    g,
    actions
  } = useFA();
  const [tab, setTab] = useState("browse");
  useEffect(() => {
    actions.marketRefresh();
  }, [g.authToken]);
  // Ici, et pas au boot : c'est le premier écran où une grille de reliques
  // s'affiche. À l'inactivité, pour ne pas disputer le thread au rendu.
  useEffect(() => {
    const M = window.FA_RELIC_MODELS;
    if (M && M.preloadWhenIdle) M.preloadWhenIdle();
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement(SectionHead, {
    title: I18N.t("MKT_TITLE"),
    sub: I18N.t("MKT_TAG")
  }), /*#__PURE__*/React.createElement("div", {
    className: "subtabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: cx("subtab", tab === "browse" && "on"),
    onClick: () => setTab("browse")
  }, I18N.t("MKT_TAB_BROWSE")), /*#__PURE__*/React.createElement("button", {
    className: cx("subtab", tab === "mine" && "on"),
    onClick: () => setTab("mine")
  }, I18N.t("MKT_TAB_MINE"))), tab === "browse" ? /*#__PURE__*/React.createElement(MarketBrowse, null) : /*#__PURE__*/React.createElement(MarketMine, null));
}
Object.assign(window, {
  Market
});
})();
