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

// Clé localStorage dédiée (séparée de SAVE_KEY : survit à disconnect()).
const TUT_KEY = "fractal_arena_tutorial_v1";
const SLIDES = [{
  icon: "⚔️",
  t: "TUT_S1_T",
  b: "TUT_S1_B"
}, {
  icon: "🦞",
  t: "TUT_S2_T",
  b: "TUT_S2_B"
}, {
  icon: "🎯",
  t: "TUT_S3_T",
  b: "TUT_S3_B"
}, {
  icon: "🔒",
  t: "TUT_S4_T",
  b: "TUT_S4_B"
}, {
  icon: "🔨",
  t: "TUT_S5_T",
  b: "TUT_S5_B"
}];
function tutSeen() {
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
}
function TutorialGate() {
  const {
    g
  } = useFA();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  // Auto-ouverture unique après la 1ère connexion (flag absent).
  useEffect(() => {
    if (g.wallet && !tutSeen()) {
      setStep(0);
      setOpen(true);
    }
  }, [g.wallet]);

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
    setOpen(false);
    // Signale au cadeau de connexion qu'il peut s'ouvrir (cohabitation 1er login).
    window.dispatchEvent(new Event("fa-tutorial-closed"));
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
