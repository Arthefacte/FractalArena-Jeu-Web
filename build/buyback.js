/* Généré par tools/precompile.mjs depuis buyback.jsx — NE PAS ÉDITER. */
(function () {
// buyback.jsx
// Ticker économie — 4 jauges de rachat (pools 5k/10k/25k/50k) sous le header ← /buyback/status.
// Preuve = le pool du DEX (InSwap) où le rachat est exécuté puis la liquidité verrouillée à vie.
// Auto-suffisant : fait ses propres fetch + polling. Aucune prop. Exposé sur window.

const API_URL = window.FA_API_URL;
const {
  FaText
} = window;

// Lien « preuve » = page du DEX InSwap (paire FractalArena / sFB) — même cible que la vitrine arthefacte.com.
const DEX_URL = "https://inswap.net/swap?t0=FractalArena&t1=sFB___000";

// Pur : fraction de remplissage de la jauge, bornée [0, 1].
function buybackFraction(total, threshold) {
  if (!threshold || threshold <= 0) return 0;
  return Math.max(0, Math.min(1, total / threshold));
}

// Formatage compact des entiers (séparateurs de milliers).
function bbFmt(n) {
  return Math.round(n || 0).toLocaleString("en-US");
}

// Une rangée = une jambe économique (liquidité ou rachat).
function TickerRow({
  kind,
  icon,
  label,
  total,
  threshold,
  wallet,
  proofLabel,
  sub
}) {
  const frac = buybackFraction(total, threshold);
  return /*#__PURE__*/React.createElement("div", {
    className: "bb-row " + kind
  }, /*#__PURE__*/React.createElement("div", {
    className: "bb-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bb-icon"
  }, icon), /*#__PURE__*/React.createElement("span", {
    className: "bb-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "bb-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: frac * 100 + "%"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "bb-nums"
  }, bbFmt(total), " / ", bbFmt(threshold)), wallet && /*#__PURE__*/React.createElement("a", {
    className: "bb-tx",
    href: DEX_URL,
    target: "_blank",
    rel: "noreferrer"
  }, proofLabel, " \u2197")), sub && /*#__PURE__*/React.createElement("div", {
    className: "bb-sub"
  }, /*#__PURE__*/React.createElement(FaText, {
    text: sub,
    s: 10
  })));
}
function BuybackTicker() {
  const [bb, setBb] = React.useState(null);
  React.useEffect(() => {
    let alive = true;
    async function load() {
      const rb = await fetch(API_URL + "/buyback/status").then(r => r.json()).catch(() => null);
      if (!alive) return;
      if (rb && rb.buyback && Array.isArray(rb.buyback.pools)) setBb(rb.buyback);
    }
    load();
    const id = setInterval(load, 60000); // rafraîchit chaque minute
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Rien tant que les pools ne sont pas chargés — pas de bandeau vide.
  if (!bb || !bb.pools || !bb.pools.length) return null;
  const I = window.FA_I18N;
  const totalBought = bb.pools.reduce((s, p) => s + (p.total_bought || 0), 0);
  const last = bb.pools.length - 1;
  return /*#__PURE__*/React.createElement("div", {
    className: "bb-ticker",
    title: I.t("BB_TICK_TITLE")
  }, bb.pools.map((p, i) => /*#__PURE__*/React.createElement(TickerRow, {
    key: p.tier,
    kind: "buy",
    icon: "",
    label: I.t("BB_POOL_LABEL", bbFmt(p.tier)),
    total: p.total,
    threshold: p.threshold,
    wallet: i === 0 ? bb.buyback_wallet : null,
    proofLabel: I.t("BB_PROOF"),
    sub: i === last ? I.t("BB_BOUGHT_SUB", bbFmt(totalBought)) : null
  })));
}
Object.assign(window, {
  BuybackTicker,
  buybackFraction
});
})();
