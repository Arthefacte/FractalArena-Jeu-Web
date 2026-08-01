/* Généré par tools/precompile.mjs depuis login.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Cadeau de connexion (modale calendrier 7 jours)
   ============================================================ */
const {
  useState,
  useEffect
} = React;
const {
  useFA,
  cx,
  Modal,
  SectionHead
} = window;
const I18N = window.FA_I18N;
const TUT_KEY = "fractal_arena_tutorial_v1";
function LoginGate() {
  const {
    g,
    actions
  } = useFA();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  useEffect(() => {
    if (!g.wallet) return;
    let alive = true;
    let onTutClosed = null;
    actions.fetchLoginReward().then(r => {
      if (!alive) return;
      if (r.ok && r.data.claimable_today) {
        setData(r.data);
        // Cohabitation 1er login : si le tutoriel ne s'est jamais affiché,
        // on diffère le cadeau jusqu'à sa fermeture.
        let seen = false;
        try {
          seen = localStorage.getItem(TUT_KEY) === "1";
        } catch (e) {}
        if (seen) {
          setOpen(true);
        } else {
          onTutClosed = () => setOpen(true);
          window.addEventListener("fa-tutorial-closed", onTutClosed, {
            once: true
          });
        }
      }
    }).catch(() => {});
    return () => {
      alive = false;
      if (onTutClosed) window.removeEventListener("fa-tutorial-closed", onTutClosed);
    };
  }, [g.wallet]);
  if (!open || !data) return null;
  const onClaim = async () => {
    setClaiming(true);
    let r;
    try {
      r = await actions.claimLoginReward();
    } finally {
      setClaiming(false);
    }
    if (r.ok) {
      setOpen(false);
      return;
    }
    if (r.reason === "retry") {
      setClaiming(true);
      let rr;
      try {
        rr = await actions.claimLoginReward();
      } finally {
        setClaiming(false);
      }
      if (rr.ok) setOpen(false);
    }
  };
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setOpen(false),
    accent: "var(--gold)"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "\uD83C\uDF81 DAILY",
    title: I18N.t("LOGIN_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "login-grid"
  }, data.rewards.map((amt, i) => {
    const day = i + 1;
    const isToday = day === data.claim_day;
    const isPast = day < data.claim_day;
    return /*#__PURE__*/React.createElement("div", {
      key: day,
      className: cx("login-cell", isToday && "today", isPast && "past", day === 7 && "jackpot")
    }, /*#__PURE__*/React.createElement("span", {
      className: "login-day"
    }, I18N.t("LOGIN_DAY", day)), /*#__PURE__*/React.createElement("span", {
      className: "login-amt"
    }, "+", amt, " \uD83D\uDD12"), isPast && /*#__PURE__*/React.createElement("span", {
      className: "login-check"
    }, "\u2713"));
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold lg",
    style: {
      width: "100%",
      marginTop: 12
    },
    disabled: claiming,
    onClick: onClaim
  }, I18N.t("LOGIN_CLAIM")));
}
Object.assign(window, {
  LoginGate
});
})();
