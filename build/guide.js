/* Généré par tools/precompile.mjs depuis guide.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Barre de guidage de la première session
   ============================================================
   Affiche, sous la navigation, l'étape en cours du parcours « Tes premiers
   pas » avec un bouton qui amène au bon onglet, met en avant l'élément à
   cliquer ([data-guide="…"] → classe .guide-hl), et glisse une phrase de
   contexte la première fois qu'un onglet s'ouvre. La décision (quelle étape,
   quelle cible) vit dans guide-ui.js ; ici, uniquement l'affichage et le
   stockage des drapeaux.
   ============================================================ */
const {
  useState,
  useEffect,
  useRef
} = React;
const {
  useFA
} = window;
const I18N = window.FA_I18N;
const GU = window.FA_GUIDE_UI;
const HIDDEN_KEY = "fractal_arena_guide_hidden_v1";
const FLAGS_KEY = w => "fractal_arena_guide_flags_" + w;
const TABS_KEY = w => "fractal_arena_guide_tabs_" + w;
function lsGet(k, dflt) {
  try {
    const v = localStorage.getItem(k);
    return v == null ? dflt : JSON.parse(v);
  } catch (e) {
    return dflt;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
}

// Ré-affiche le guide (appelé à la fermeture du tutoriel « ? »).
window.FA_GUIDE_SHOW = () => {
  try {
    localStorage.removeItem(HIDDEN_KEY);
  } catch (e) {}
  window.dispatchEvent(new Event("fa-guide-show"));
};
function GuideBar() {
  const {
    g,
    actions
  } = useFA();
  const [disc, setDisc] = useState(null);
  const [hidden, setHidden] = useState(() => lsGet(HIDDEN_KEY, false) === true);
  const [flags, setFlags] = useState(() => lsGet(FLAGS_KEY(g.wallet), {}));
  const [seenTabs, setSeenTabs] = useState(() => lsGet(TABS_KEY(g.wallet), []));
  const [hintOpen, setHintOpen] = useState(false);
  const alive = useRef(true);

  // État du parcours découverte : à l'arrivée, à chaque changement d'onglet,
  // et après chaque action de jeu (événement posé par l'instrumentation fetch
  // d'app.jsx sur les POST de combat / réclamation).
  const refresh = () => {
    actions.discoveryState().then(r => {
      if (alive.current && r.ok) setDisc(r.data);
    }).catch(() => {});
  };
  useEffect(() => {
    alive.current = true;
    refresh();
    return () => {
      alive.current = false;
    };
  }, [g.wallet]);
  useEffect(() => {
    refresh();
  }, [g.view, g.totalFights]);
  useEffect(() => {
    const onProgress = e => {
      const url = e && e.detail && e.detail.url || "";
      // Drapeaux locaux (comptes UniSat, hors parcours serveur) : avoir JOUÉ suffit.
      if (url.indexOf("/tower/fight") >= 0 || url.indexOf("/pvp/attack") >= 0) {
        setFlags(f => {
          const next = {
            ...f,
            ...(url.indexOf("/tower/fight") >= 0 ? {
              towerPlayed: true
            } : {}),
            ...(url.indexOf("/pvp/attack") >= 0 ? {
              pvpPlayed: true
            } : {})
          };
          lsSet(FLAGS_KEY(g.wallet), next);
          return next;
        });
      }
      refresh();
    };
    const onShow = () => setHidden(false);
    window.addEventListener("fa-guide-progress", onProgress);
    window.addEventListener("fa-guide-show", onShow);
    return () => {
      window.removeEventListener("fa-guide-progress", onProgress);
      window.removeEventListener("fa-guide-show", onShow);
    };
  }, [g.wallet]);

  // Phrase de contexte : une fois par onglet et par compte.
  useEffect(() => {
    const key = GU.tabHintKey(g.view);
    setHintOpen(!!key && !seenTabs.includes(g.view));
  }, [g.view]);
  const closeHint = () => {
    const next = seenTabs.includes(g.view) ? seenTabs : [...seenTabs, g.view];
    setSeenTabs(next);
    lsSet(TABS_KEY(g.wallet), next);
    setHintOpen(false);
  };
  const res = GU.computeGuide({
    disc,
    g,
    flags,
    view: g.view
  });

  // Mise en avant de l'élément à cliquer. Les écrans se re-rendent à leur
  // rythme : on ré-applique la classe toutes les 400 ms tant qu'une cible
  // existe, et on nettoie tout en partant.
  const target = hidden || res.mode === "done" ? null : res.target;
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll("[data-guide].guide-hl").forEach(el => {
        if (el.getAttribute("data-guide") !== target) el.classList.remove("guide-hl");
      });
      if (target) document.querySelectorAll(`[data-guide="${target}"]`).forEach(el => el.classList.add("guide-hl"));
    };
    apply();
    const id = setInterval(apply, 400);
    return () => {
      clearInterval(id);
      document.querySelectorAll("[data-guide].guide-hl").forEach(el => el.classList.remove("guide-hl"));
    };
  }, [target, g.view]);

  // Parcours terminé : un dernier message, puis on s'efface pour de bon.
  useEffect(() => {
    if (res.mode === "done" && disc && !hidden) {
      const t = setTimeout(() => {
        setHidden(true);
        lsSet(HIDDEN_KEY, true);
      }, 8000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [res.mode, disc, hidden]);
  const hide = () => {
    setHidden(true);
    lsSet(HIDDEN_KEY, true);
  };
  const go = () => {
    if (res.view && res.view !== g.view) actions.setView(res.view);
  };
  const hintKey = GU.tabHintKey(g.view);
  const showHint = hintOpen && hintKey && !hidden;
  if (hidden) return null;
  if (res.mode === "done" && !disc) return null; // rien à guider tant que l'état n'est pas connu

  const text = I18N.t(GU.instructionKey(res)) + (res.mode === "do" && res.rewarded ? " " + I18N.t("GUIDE_REWARD", res.reward) : "");
  const onRightTab = res.view === g.view;
  return /*#__PURE__*/React.createElement("div", {
    className: "guide-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "guide-bar" + (res.mode === "claim" ? " claim" : "") + (res.mode === "done" ? " done" : ""),
    role: "status"
  }, /*#__PURE__*/React.createElement("span", {
    className: "guide-step"
  }, res.mode === "done" ? I18N.t("GUIDE_LABEL") : I18N.t("GUIDE_STEP", res.index + 1, res.total)), /*#__PURE__*/React.createElement("span", {
    className: "guide-text"
  }, res.mode === "done" ? I18N.t("GUIDE_DONE") : text), res.mode !== "done" && !onRightTab && /*#__PURE__*/React.createElement("button", {
    className: "btn sm btn-fire guide-go",
    onClick: go
  }, I18N.t("GUIDE_GO")), /*#__PURE__*/React.createElement("button", {
    className: "guide-close",
    title: I18N.t("GUIDE_HIDE"),
    "aria-label": I18N.t("GUIDE_HIDE"),
    onClick: hide
  }, "\u2715")), showHint && /*#__PURE__*/React.createElement("div", {
    className: "guide-hint",
    role: "note"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCA1 ", I18N.t(hintKey)), /*#__PURE__*/React.createElement("button", {
    className: "guide-hint-ok",
    onClick: closeHint
  }, I18N.t("GUIDE_OK"))));
}
Object.assign(window, {
  GuideBar
});
})();
