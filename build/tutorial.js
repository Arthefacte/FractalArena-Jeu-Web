/* Généré par tools/precompile.mjs depuis tutorial.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Tutoriel onboarding « Comment jouer »
   ============================================================ */
const {
  useState,
  useEffect
} = React;
const {
  useFA,
  cx,
  Modal
} = window;
const I18N = window.FA_I18N;

// Repli local dédié (séparé de SAVE_KEY : survit à disconnect()). Il ne sert plus
// que pour un navigateur hors ligne ou sans compte : la VÉRITÉ est sur le compte
// (ui_state.tutorial_seen, player-ui.js). Le tutoriel n'était marqué que dans le
// localStorage, donc rouvert de zéro dans chaque navigateur neuf — dont le
// navigateur intégré de l'app UniSat, où le joueur va retirer ses gains, ce qui
// donnait l'impression d'un jeu « pas à jour ».
const TUT_KEY = "fractal_arena_tutorial_v1";

// Chaque icône doit illustrer le PROPOS du slide, pas un détail (retour user
// 2026-08-22 : le homard d'« équipe » et la cible de « combats » perdaient tout
// le monde). « 🔒◎ » montre les deux notions que le slide 4 oppose.
// Trois diapositives, pas cinq (22/09/2026) : l'équipe, les mises et « va plus
// loin » sont désormais montrés SUR l'écran par la barre de guidage (guide.jsx),
// au moment où le joueur en a besoin. Ici ne reste que ce qu'il faut savoir
// avant le premier clic : le cadeau, verrouillé contre disponible, et le guide.
const SLIDES = [{
  icon: "⚔️",
  t: "TUT_S1_T",
  b: "TUT_S1_B"
}, {
  icon: "🔒◎",
  t: "TUT_S4_T",
  b: "TUT_S4_B"
}, {
  icon: "🧭",
  t: "TUT_SG_T",
  b: "TUT_SG_B"
}];
function tutSeen() {
  // Le drapeau du compte d'abord : il suit le joueur d'un appareil à l'autre.
  if (window.FA_UI_STATE && window.FA_UI_STATE.tutorial_seen === true) return true;
  try {
    return localStorage.getItem(TUT_KEY) === "1";
  } catch (e) {
    return false;
  }
}
function markTutSeen() {
  try {
    localStorage.setItem(TUT_KEY, "1");
  } catch (e) {}
  // Marqué en mémoire tout de suite : les lectures qui suivent (cadeau de
  // connexion, bandeau des gains verrouillés) voient l'effet sans attendre le
  // serveur. L'écriture serveur, elle, se fait dans close().
  if (window.FA_UI_STATE) window.FA_UI_STATE.tutorial_seen = true;
}
// Exposé pour app.jsx : le bandeau « gains verrouillés » attend que le tutoriel
// ait été vu (une seule fenêtre à la fois au premier lancement).
window.FA_TUT_SEEN = tutSeen;

// `blocked` : une autre fenêtre a la priorité (le code de récupération d'un
// compte tout juste créé) — le tutoriel s'ouvre quand elle se ferme.
function TutorialGate({
  blocked
}) {
  const {
    g,
    actions
  } = useFA();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-ouverture unique après la 1ère connexion (flag absent).
  useEffect(() => {
    if (g.wallet && !blocked && !tutSeen()) {
      setStep(0);
      setOpen(true);
    }
  }, [g.wallet, blocked]);

  // Ouverture forcée via le bouton « ? » du header (ne touche pas au flag).
  useEffect(() => {
    const onOpen = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener("fa-open-tutorial", onOpen);
    return () => window.removeEventListener("fa-open-tutorial", onOpen);
  }, []);
  if (!open) return null;
  function close() {
    markTutSeen();
    // Le compte retient le tutoriel vu : les autres navigateurs (navigateur
    // intégré d'UniSat, PWA, autre ordinateur) ne le rouvriront plus.
    actions.pushUiState({
      tutorial_seen: true
    });
    setOpen(false);
    // Signale au cadeau de connexion qu'il peut s'ouvrir (cohabitation 1er login).
    window.dispatchEvent(new Event("fa-tutorial-closed"));
    // Revoir le tutoriel = vouloir de l'aide : le guide masqué revient.
    if (window.FA_GUIDE_SHOW) window.FA_GUIDE_SHOW();
  }
  function next() {
    if (step >= SLIDES.length - 1) close();else setStep(s => s + 1);
  }
  const slide = SLIDES[step];
  const last = step === SLIDES.length - 1;
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: close,
    accent: "var(--fire)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      textAlign: "center"
    }
  }, I18N.t("TUT_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "tut-icon"
  }, slide.icon), /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      textAlign: "center"
    }
  }, I18N.t(slide.t)), /*#__PURE__*/React.createElement("div", {
    className: "tut-body muted"
  }, I18N.t(slide.b)), /*#__PURE__*/React.createElement("div", {
    className: "tut-dots"
  }, SLIDES.map((_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: cx("tut-dot", i === step && "on"),
    onClick: () => setStep(i)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginTop: 16,
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: close
  }, I18N.t("TUT_SKIP")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-fire",
    onClick: next
  }, last ? I18N.t("TUT_START") : I18N.t("TUT_NEXT"))));
}
Object.assign(window, {
  TutorialGate
});
})();
