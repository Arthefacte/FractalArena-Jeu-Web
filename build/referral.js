/* Généré par tools/precompile.mjs depuis referral.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Écran « Parrainage » (spec 2026-09-07)
   Code du joueur + lien à partager, total gagné à vie grâce aux filleuls
   (FA verrouillés, 5 % des gains nets de leurs combats payants de la Fosse),
   liste des filleuls (triée serveur), parrain si présent.
   Atteint depuis Options (hors barre de nav). État LOCAL : rien n'entre dans
   le blob global — GET /referral/:wallet est relu à chaque ouverture.
   ============================================================ */
const I18N = window.FA_I18N;
const {
  useFA,
  SectionHead,
  fmt
} = window;
const refCell = {
  background: "var(--bg-panel)",
  border: "1px solid var(--line)",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 13,
  lineHeight: 1.5
};

// Bouton « Copier » : écrit dans le presse-papiers, dit « copié ! » 1,5 s.
// Le presse-papiers peut être refusé (contexte non sécurisé, permission) :
// on ne bloque rien, le texte reste sélectionnable à la main juste à côté.
function CopyBtn({
  text
}) {
  const {
    toast
  } = useFA();
  const [done, setDone] = React.useState(false);
  return /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    disabled: !text,
    onClick: () => {
      if (!text) return;
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
      setDone(true);
      toast(I18N.t("REF_COPIED"), "good");
      setTimeout(() => setDone(false), 1500);
    }
  }, done ? I18N.t("REF_COPIED") : I18N.t("REF_COPY"));
}
function Referral() {
  const {
    g,
    actions
  } = useFA();
  // null = chargement ; { ok: true, data } ; { ok: false, reason }.
  const [res, setRes] = React.useState(null);
  React.useEffect(() => {
    // Garde de démontage : la réponse d'un fetch en vol ne doit pas écrire
    // dans un écran déjà quitté (même pattern `vivant` que Options).
    let vivant = true;
    setRes(null);
    actions.fetchReferral().then(r => {
      if (vivant) setRes(r);
    });
    return () => {
      vivant = false;
    };
  }, [actions, g.wallet]);
  const data = res && res.ok ? res.data : null;
  const code = data ? data.code : "";
  const link = code ? window.FA_REFERRAL.referralLink(code) : "";
  const referees = data && Array.isArray(data.referees) ? data.referees : [];
  return /*#__PURE__*/React.createElement("div", {
    className: "container referral-screen",
    style: {
      maxWidth: 620,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "◈ " + I18N.t("REF_EYEBROW"),
    title: I18N.t("REF_TITLE"),
    sub: I18N.t("REF_HINT")
  }), res === null && /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 13
    }
  }, I18N.t("REF_LOADING")), res && !res.ok && /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 13,
      color: "var(--alert, #e55)"
    }
  }, I18N.t("REF_ERROR")), data && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...refCell,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("REF_CODE_LABEL")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 30,
      fontWeight: 800,
      letterSpacing: 4,
      margin: "6px 0 8px",
      userSelect: "all"
    }
  }, code), /*#__PURE__*/React.createElement(CopyBtn, {
    text: code
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      ...refCell,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("REF_LINK_LABEL")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 13,
      margin: "6px 0 8px",
      wordBreak: "break-all",
      userSelect: "all"
    }
  }, link), /*#__PURE__*/React.createElement(CopyBtn, {
    text: link
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      ...refCell,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("REF_EARNED")), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 22,
      fontWeight: 800,
      marginTop: 4
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/TOKEN.png",
    alt: "",
    width: "18",
    height: "18",
    style: {
      verticalAlign: "-3px",
      marginRight: 6
    }
  }), fmt(data.earned_total || 0), " ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      opacity: 0.8
    }
  }, "\uD83D\uDD12"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      textAlign: "left"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      textAlign: "center"
    }
  }, I18N.t("REF_REFEREES")), referees.length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12,
      textAlign: "center",
      marginTop: 6
    }
  }, I18N.t("REF_NONE")) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gap: 6,
      marginTop: 10
    }
  }, referees.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.wallet,
    className: "flex between center",
    style: {
      ...refCell,
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap"
    }
  }, r.name || r.wallet), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      flex: "none",
      fontWeight: 700
    }
  }, fmt(r.earned_total || 0), " \uD83D\uDD12"))))), data.referrer && /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 11.5,
      marginTop: 14,
      wordBreak: "break-all"
    }
  }, I18N.t("REF_REFERRER"), " ", data.referrer)), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    style: {
      marginTop: 24
    },
    onClick: () => actions.setView("options")
  }, I18N.t("REF_BACK")));
}
Object.assign(window, {
  Referral
});
})();
