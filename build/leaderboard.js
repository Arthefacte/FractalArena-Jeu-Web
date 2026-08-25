/* Généré par tools/precompile.mjs depuis leaderboard.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Leaderboard (écran classement)
   ============================================================ */
const {
  useState,
  useEffect,
  useRef
} = React;
const {
  useFA,
  cx,
  SectionHead
} = window;
const I18N = window.FA_I18N;
const LU = window.FA_LB_LIVE_UI;

// Cadence du classement vivant : re-fetch toutes les 20 s tant que l'ecran est
// ouvert (cache serveur 15 s — on voit les chiffres bouger sans marteler l'API).
const LIVE_POLL_MS = 20_000;
const FLASH_MS = 1600;
const SECTIONS = {
  compet: [["wins", "LB_TAB_WINS"], ["collection", "LB_TAB_POWER"]],
  eco: [["earned", "LB_TAB_EARNED"], ["buyback", "LB_TAB_BUYBACK"]]
};
function Leaderboard() {
  const {
    g,
    actions
  } = useFA();
  const [section, setSection] = useState("compet");
  const [board, setBoard] = useState("wins");
  const [st, setSt] = useState({
    loading: true,
    top: [],
    you: null,
    error: false
  });
  const [flash, setFlash] = useState(new Set());
  const prevTopRef = useRef(null);
  const flashTimerRef = useRef(null);
  useEffect(() => {
    let alive = true;
    prevTopRef.current = null;
    setFlash(new Set());
    setSt(s => ({
      ...s,
      loading: true,
      error: false
    }));

    // silencieux = refresh du polling : pas de spinner, mais un flash sur les
    // lignes dont la valeur ou le rang a bouge — c'est ce qui rend le live visible.
    const load = silencieux => actions.fetchLeaderboard(board).then(r => {
      if (!alive) return;
      if (!r.ok) {
        if (!silencieux) setSt({
          loading: false,
          top: [],
          you: null,
          error: true
        });
        return;
      }
      if (silencieux) {
        const changed = LU.diffChanges(prevTopRef.current, r.top);
        if (changed.size > 0) {
          setFlash(changed);
          if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
          flashTimerRef.current = setTimeout(() => {
            if (alive) setFlash(new Set());
          }, FLASH_MS);
        }
      }
      prevTopRef.current = r.top;
      setSt({
        loading: false,
        top: r.top,
        you: r.you,
        error: false
      });
    }).catch(() => {
      if (!alive) return;
      if (!silencieux) setSt({
        loading: false,
        top: [],
        you: null,
        error: true
      });
    });
    load(false);
    const id = setInterval(() => load(true), LIVE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, [board]);
  const pickSection = sec => {
    setSection(sec);
    setBoard(SECTIONS[sec][0][0]);
  };
  const myShort = g.wallet ? g.wallet.slice(0, 6) + "…" + g.wallet.slice(-4) : "";
  return /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      maxWidth: 640
    }
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "\uD83C\uDFC6 LEADERBOARD",
    title: I18N.t("LB_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "lb-tabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: cx("lb-tab", section === "compet" && "on"),
    onClick: () => pickSection("compet")
  }, I18N.t("LB_SEC_COMPET")), /*#__PURE__*/React.createElement("button", {
    className: cx("lb-tab", section === "eco" && "on"),
    onClick: () => pickSection("eco")
  }, I18N.t("LB_SEC_ECO"))), /*#__PURE__*/React.createElement("div", {
    className: "lb-tabs"
  }, SECTIONS[section].map(([key, lbl]) => /*#__PURE__*/React.createElement("button", {
    key: key,
    className: cx("lb-tab", board === key && "on"),
    onClick: () => setBoard(key)
  }, I18N.t(lbl)))), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 10,
      textAlign: "right",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--success)"
    }
  }, "\u25CF"), " ", I18N.t("LB_LIVE_HINT")), st.loading && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      textAlign: "center",
      padding: 24
    }
  }, I18N.t("LB_LOADING")), st.error && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      textAlign: "center",
      padding: 24,
      color: "var(--alert)"
    }
  }, I18N.t("LB_ERROR")), !st.loading && !st.error && /*#__PURE__*/React.createElement("div", {
    className: "lb-list"
  }, st.top.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      textAlign: "center",
      padding: 24
    }
  }, I18N.t("LB_EMPTY")), st.top.map(row => /*#__PURE__*/React.createElement("div", {
    key: LU.rowKey(row),
    className: cx("lb-row", row.wallet_short === myShort && "mine", row.rank <= 3 && "top" + row.rank),
    style: {
      transition: "background 0.8s ease",
      background: flash.has(LU.rowKey(row)) ? "rgba(0,240,255,0.14)" : undefined
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "lb-rank"
  }, "#", row.rank), /*#__PURE__*/React.createElement("span", {
    className: "lb-name"
  }, row.live && /*#__PURE__*/React.createElement("span", {
    title: I18N.t("LB_LIVE_HINT"),
    style: {
      color: "var(--success)",
      marginRight: 6,
      fontSize: 10,
      textShadow: "0 0 6px rgba(0,255,140,0.9)"
    }
  }, "\u25CF"), !row.live && (() => {
    const ago = LU.formatAgo(row.ago_s);
    return ago && /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        marginRight: 6,
        fontSize: 9,
        color: "var(--text-faint)"
      }
    }, ago.n === null ? I18N.t(ago.key) : I18N.t(ago.key, ago.n));
  })(), row.name), /*#__PURE__*/React.createElement("span", {
    className: "lb-val"
  }, row.value))), st.you && /*#__PURE__*/React.createElement("div", {
    className: "lb-row mine"
  }, /*#__PURE__*/React.createElement("span", {
    className: "lb-rank"
  }, "#", st.you.rank), /*#__PURE__*/React.createElement("span", {
    className: "lb-name"
  }, I18N.t("LB_YOU")), /*#__PURE__*/React.createElement("span", {
    className: "lb-val"
  }, st.you.value))));
}
Object.assign(window, {
  Leaderboard
});
})();
