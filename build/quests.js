/* Généré par tools/precompile.mjs depuis quests.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Écran Quêtes quotidiennes
   ============================================================ */
const {
  useState,
  useEffect
} = React;
const {
  useFA,
  cx,
  SectionHead,
  TokenIcon,
  DiscoveryFinish
} = window;
const I18N = window.FA_I18N;
const ACC = window.FA_ACCOUNT;
const Q_LABEL = {
  wins: "Q_WINS",
  paid: "Q_PAID",
  chat: "Q_CHAT"
};
const QW_LABEL = {
  w_pvp: "QW_PVP",
  w_tower: "QW_TOWER",
  w_fosse: "QW_FOSSE"
};

// Parcours de découverte. Même forme que ci-dessus : les six identifiants
// viennent du serveur (discovery.js), les libellés sont résolus ici.
const D_LABEL = {
  d_win: "DISC_D_WIN",
  d_paid: "DISC_D_PAID",
  d_level: "DISC_D_LEVEL",
  d_camp: "DISC_D_CAMP",
  d_tower: "DISC_D_TOWER",
  d_pvp: "DISC_D_PVP"
};
function fmtCountdown(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec % 3600 / 60);
  return h + "h " + String(m).padStart(2, "0") + "m";
}
function fmtCountdownWeek(sec) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor(sec % 86400 / 3600);
  return d + "j " + String(h).padStart(2, "0") + "h";
}
function Quests() {
  const {
    g,
    actions
  } = useFA();
  const [st, setSt] = useState({
    loading: true,
    error: false,
    data: null
  });
  const [claiming, setClaiming] = useState(null);
  const [reset, setReset] = useState(0);
  const [resetW, setResetW] = useState(0);
  const load = () => {
    setSt(s => ({
      ...s,
      loading: true,
      error: false
    }));
    actions.fetchQuests().then(r => {
      if (r.ok) {
        setSt({
          loading: false,
          error: false,
          data: r.data
        });
        setReset(r.data.reset_in_seconds);
        setResetW(r.data.weekly ? r.data.weekly.week_ends_in : 0);
      } else setSt({
        loading: false,
        error: true,
        data: null
      });
    }).catch(() => {
      setSt({
        loading: false,
        error: true,
        data: null
      });
    });
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const id = setInterval(() => {
      setReset(s => s > 0 ? s - 1 : 0);
      setResetW(s => s > 0 ? s - 1 : 0);
    }, 1000);
    return () => clearInterval(id);
  }, []);
  const onClaim = async id => {
    setClaiming(id);
    let r;
    try {
      r = await actions.claimQuest(id);
    } finally {
      setClaiming(null);
    }
    if (r.ok) load();
  };

  // --- Parcours de découverte ---
  // L'état vient entièrement du serveur, y compris l'éligibilité : le parcours
  // n'est proposé qu'aux comptes créés sans wallet, et c'est le serveur qui en
  // décide (discovery.js). On ne le déduit jamais de l'état client.
  const [disc, setDisc] = useState(null);
  const [claimingDisc, setClaimingDisc] = useState(null);
  const [finish, setFinish] = useState(false);
  const loadDisc = () => actions.discoveryState().then(r => {
    if (r.ok) setDisc(r.data);
    return r.ok ? r.data : null;
  }).catch(() => null);
  useEffect(() => {
    loadDisc();
  }, []);
  const onClaimDisc = async id => {
    setClaimingDisc(id);
    let r;
    try {
      r = await actions.claimDiscovery(id);
    } finally {
      setClaimingDisc(null);
    }
    if (!r.ok) return;
    // Recharger depuis le serveur plutôt que de patcher localement : une seule
    // source de vérité, et la progression des autres étapes a pu bouger.
    const apres = await loadDisc();
    // La sixième étape vient d'être réclamée : le volet crypto s'ouvre de
    // lui-même. C'est le seul moment où le joueur est là, et jusqu'ici la seule
    // porte était un bandeau qu'il pouvait avoir fermé pour 24 h.
    if (ACC.discoveryNextAction(apres, g.linkedWallet, g.accountKind === ACC.KIND_UNISAT)) setFinish(true);
  };

  // Ce qu'il reste à faire du volet crypto, décidé par le serveur (null = rien).
  const etapeCrypto = ACC.discoveryNextAction(disc, g.linkedWallet, g.accountKind === ACC.KIND_UNISAT);

  // Visible tant qu'il reste une étape à réclamer, OU une étape crypto à faire :
  // un tutoriel terminé ne doit plus occuper l'écran, mais un parcours fini dont
  // le portefeuille n'est pas lié doit garder sa porte — sans elle, le joueur
  // n'avait plus que le bandeau fermable pour y accéder.
  const showDisc = !!(disc && disc.eligible && disc.steps.length > 0 && (!disc.steps.every(s => s.claimed) || etapeCrypto));
  const d = st.data;
  return /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      maxWidth: 640
    }
  }, showDisc && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 22
    }
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "\uD83C\uDF93 START",
    title: I18N.t("DISC_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12,
      margin: "0 0 10px"
    }
  }, I18N.t("DISC_SUB")), /*#__PURE__*/React.createElement("div", {
    className: "q-list"
  }, disc.steps.map(s => {
    const pct = s.target > 0 ? Math.min(100, Math.round(s.progress / s.target * 100)) : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: s.id,
      className: cx("q-row", s.claimed && "done")
    }, /*#__PURE__*/React.createElement("div", {
      className: "q-info"
    }, /*#__PURE__*/React.createElement("span", {
      className: "q-name"
    }, I18N.t(D_LABEL[s.id])), /*#__PURE__*/React.createElement("span", {
      className: "q-reward"
    }, "+", /*#__PURE__*/React.createElement(TokenIcon, {
      s: 12
    }), " ", s.reward, " \uD83D\uDD12")), /*#__PURE__*/React.createElement("div", {
      className: "q-bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "q-fill",
      style: {
        width: pct + "%"
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "q-foot"
    }, /*#__PURE__*/React.createElement("span", {
      className: "q-prog"
    }, s.progress, "/", s.target), s.claimed ? /*#__PURE__*/React.createElement("span", {
      className: "q-claimed"
    }, I18N.t("DISC_CLAIMED")) : /*#__PURE__*/React.createElement("button", {
      className: "q-claim",
      disabled: !s.done || claimingDisc === s.id,
      onClick: () => onClaimDisc(s.id)
    }, I18N.t("DISC_CLAIM"))));
  })), etapeCrypto && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold block",
    style: {
      marginTop: 12
    },
    onClick: () => setFinish(true)
  }, I18N.t("DISC_FINISH_OPEN"))), finish && /*#__PURE__*/React.createElement(DiscoveryFinish, {
    disc: disc,
    reload: loadDisc,
    onClose: () => setFinish(false)
  }), /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "\uD83C\uDFAF DAILY",
    title: I18N.t("Q_TITLE")
  }), st.loading && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      textAlign: "center",
      padding: 24
    }
  }, I18N.t("Q_LOADING")), st.error && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      textAlign: "center",
      padding: 24,
      color: "var(--alert)"
    }
  }, I18N.t("Q_ERROR")), !st.loading && !st.error && d && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "q-head"
  }, /*#__PURE__*/React.createElement("span", {
    className: "q-streak"
  }, "\uD83D\uDD25 ", I18N.t("Q_STREAK", d.streak)), /*#__PURE__*/React.createElement("span", {
    className: "q-reset"
  }, I18N.t("Q_RESET_IN", fmtCountdown(reset)))), /*#__PURE__*/React.createElement("div", {
    className: "q-list"
  }, d.quests.map(q => {
    const pct = q.target > 0 ? Math.min(100, Math.round(q.progress / q.target * 100)) : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: q.id,
      className: cx("q-row", q.claimed && "done")
    }, /*#__PURE__*/React.createElement("div", {
      className: "q-info"
    }, /*#__PURE__*/React.createElement("span", {
      className: "q-name"
    }, I18N.t(Q_LABEL[q.id], q.target)), /*#__PURE__*/React.createElement("span", {
      className: "q-reward"
    }, "+", /*#__PURE__*/React.createElement(TokenIcon, {
      s: 12
    }), " ", q.reward, " \uD83D\uDD12")), /*#__PURE__*/React.createElement("div", {
      className: "q-bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "q-fill",
      style: {
        width: pct + "%"
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "q-foot"
    }, /*#__PURE__*/React.createElement("span", {
      className: "q-prog"
    }, q.progress, "/", q.target), q.claimed ? /*#__PURE__*/React.createElement("span", {
      className: "q-claimed"
    }, I18N.t("Q_CLAIMED")) : /*#__PURE__*/React.createElement("button", {
      className: "q-claim",
      disabled: !q.done || claiming === q.id,
      onClick: () => onClaim(q.id)
    }, I18N.t("Q_CLAIM"))));
  })), d.weekly && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "q-head",
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "q-streak"
  }, "\uD83D\uDCC5 ", I18N.t("QW_TITLE")), /*#__PURE__*/React.createElement("span", {
    className: "q-reset"
  }, I18N.t("QW_RESET_IN", fmtCountdownWeek(resetW)))), /*#__PURE__*/React.createElement("div", {
    className: "q-list"
  }, d.weekly.quests.map(q => {
    const pct = q.target > 0 ? Math.min(100, Math.round(q.progress / q.target * 100)) : 0;
    return /*#__PURE__*/React.createElement("div", {
      key: q.id,
      className: cx("q-row", q.claimed && "done")
    }, /*#__PURE__*/React.createElement("div", {
      className: "q-info"
    }, /*#__PURE__*/React.createElement("span", {
      className: "q-name"
    }, I18N.t(QW_LABEL[q.id], q.target)), /*#__PURE__*/React.createElement("span", {
      className: "q-reward"
    }, "+", /*#__PURE__*/React.createElement(TokenIcon, {
      s: 12
    }), " ", q.reward, " \uD83D\uDD12")), /*#__PURE__*/React.createElement("div", {
      className: "q-bar"
    }, /*#__PURE__*/React.createElement("div", {
      className: "q-fill",
      style: {
        width: pct + "%"
      }
    })), /*#__PURE__*/React.createElement("div", {
      className: "q-foot"
    }, /*#__PURE__*/React.createElement("span", {
      className: "q-prog"
    }, q.progress, "/", q.target), q.claimed ? /*#__PURE__*/React.createElement("span", {
      className: "q-claimed"
    }, I18N.t("Q_CLAIMED")) : /*#__PURE__*/React.createElement("button", {
      className: "q-claim",
      disabled: !q.done || claiming === q.id,
      onClick: () => onClaim(q.id)
    }, I18N.t("Q_CLAIM"))));
  })))));
}
Object.assign(window, {
  Quests
});
})();
