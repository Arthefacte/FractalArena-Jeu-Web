/* Généré par tools/precompile.mjs depuis guide.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Barre de guidage de la première session
   ============================================================
   Affiche, sous la navigation, l'étape en cours du parcours « Tes premiers
   pas » avec un bouton qui amène au bon onglet, met en avant l'élément à
   cliquer ([data-guide="…"] → classe .guide-hl), et glisse une phrase de
   contexte la première fois qu'un onglet s'ouvre. La décision (quelle étape,
   quelle cible) vit dans guide-ui.js ; ici, uniquement l'affichage.

   Les étapes viennent du SERVEUR, pour tous les comptes (GET /guide/state, qui
   les recompte depuis l'historique réel du joueur). Jusqu'au 26/09/2026, les
   comptes non éligibles au parcours découverte étaient guidés par une lecture
   LOCALE — dont deux drapeaux « Tour jouée » / « Arène jouée » posés en
   localStorage. Dans le navigateur intégré de l'app UniSat (où le joueur va
   pour retirer ses gains), ces deux étapes étaient donc présentées comme à
   faire à quelqu'un qui les avait faites sur son ordinateur : le jeu semblait
   « pas à jour ». Plus rien ici ne dépend du navigateur.
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

// Repli local — plus la source. La vérité est sur le COMPTE (ui_state,
// player-ui.js) : ces clés ne servent qu'à ne pas réafficher un guide déjà
// masqué sur ce navigateur avant la bascule, et pendant la seconde où l'état du
// compte n'est pas encore arrivé.
const HIDDEN_KEY = "fractal_arena_guide_hidden_v1";
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
function unionListe(a, b) {
  const out = [];
  for (const x of (Array.isArray(a) ? a : []).concat(Array.isArray(b) ? b : [])) {
    if (typeof x === "string" && !out.includes(x)) out.push(x);
  }
  return out;
}

// Ré-affiche le guide (appelé à la fermeture du tutoriel « ? »). Le drapeau du
// COMPTE est remis à false par le composant, seul à avoir les actions réseau ;
// ici on libère le repli local et on prévient l'écouteur.
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
  const [seenTabs, setSeenTabs] = useState(() => unionListe(lsGet(TABS_KEY(g.wallet), []), []));
  const [hintOpen, setHintOpen] = useState(false);
  const alive = useRef(true);

  // État du parcours : à l'arrivée, à chaque changement d'onglet, et après
  // chaque action de jeu (événement posé par l'instrumentation fetch d'app.jsx
  // sur les POST de combat / réclamation). Le serveur recompte à chaque appel :
  // le client ne calcule aucune étape lui-même.
  const refresh = () => {
    actions.guideState().then(r => {
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

  // État d'interface du COMPTE : guide masqué, onglets déjà vus. Il arrive avec
  // la sauvegarde (GET /save → ui_state), donc après le premier rendu — d'où cet
  // effet plutôt qu'un initialiseur de useState. Union avec le repli local : un
  // masquage ou une astuce vue avant la bascule compte pour les deux mondes.
  useEffect(() => {
    const ui = g && g.uiState || {};
    if (ui.guide_hidden === true) setHidden(true);
    setSeenTabs(prev => unionListe(prev, unionListe(lsGet(TABS_KEY(g.wallet), []), ui.guide_tabs)));
  }, [g.wallet, g.uiState]);
  useEffect(() => {
    // Les drapeaux « Tour jouée » / « Arène jouée » ont disparu : les étapes
    // viennent du serveur, il suffit de relire son verdict après un combat.
    const onProgress = () => {
      refresh();
    };
    const onShow = () => {
      setHidden(false);
      lsSet(HIDDEN_KEY, false);
      // Le joueur a demandé à revoir le guide : le drapeau du compte suit, sinon
      // le prochain appareil (ou le prochain rechargement) le remasquerait.
      actions.pushUiState({
        guide_hidden: false
      });
    };
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
  }, [g.view, seenTabs]);
  const closeHint = () => {
    const next = unionListe(seenTabs, [g.view]);
    setSeenTabs(next);
    lsSet(TABS_KEY(g.wallet), next);
    setHintOpen(false);
    actions.pushUiState({
      guide_tabs: [g.view]
    });
  };
  const res = GU.computeGuide({
    disc,
    g,
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

  // Parcours terminé : un dernier message, puis on s'efface pour de bon (et le
  // compte retient qu'il est terminé, pour les autres appareils).
  useEffect(() => {
    if (res.mode === "done" && disc && !hidden) {
      const t = setTimeout(() => {
        setHidden(true);
        lsSet(HIDDEN_KEY, true);
        actions.pushUiState({
          guide_hidden: true
        });
      }, 8000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [res.mode, disc, hidden]);
  const hide = () => {
    setHidden(true);
    lsSet(HIDDEN_KEY, true);
    actions.pushUiState({
      guide_hidden: true
    });
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
