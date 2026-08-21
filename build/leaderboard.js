/* Généré par tools/precompile.mjs depuis leaderboard.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Leaderboard (écran classement)
   ============================================================ */
const {
  useState,
  useEffect
} = React;
const {
  useFA,
  cx,
  SectionHead
} = window;
const I18N = window.FA_I18N;
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
  useEffect(() => {
    let alive = true;
    setSt(s => ({
      ...s,
      loading: true,
      error: false
    }));
    actions.fetchLeaderboard(board).then(r => {
      if (!alive) return;
      if (r.ok) setSt({
        loading: false,
        top: r.top,
        you: r.you,
        error: false
      });else setSt({
        loading: false,
        top: [],
        you: null,
        error: true
      });
    }).catch(() => {
      if (!alive) return;
      setSt({
        loading: false,
        top: [],
        you: null,
        error: true
      });
    });
    return () => {
      alive = false;
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
  }, I18N.t(lbl)))), st.loading && /*#__PURE__*/React.createElement("div", {
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
    key: row.rank,
    className: cx("lb-row", row.wallet_short === myShort && "mine", row.rank <= 3 && "top" + row.rank)
  }, /*#__PURE__*/React.createElement("span", {
    className: "lb-rank"
  }, "#", row.rank), /*#__PURE__*/React.createElement("span", {
    className: "lb-name"
  }, row.name), /*#__PURE__*/React.createElement("span", {
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
