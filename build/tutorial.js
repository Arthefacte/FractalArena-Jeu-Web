/* Généré par tools/precompile.mjs depuis tutorial.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — « Comment jouer »
   ============================================================
   Une seule surface d'aide, qui répond au retour d'un joueur (25/10/2026) :
   « un guide étape par étape expliquant comment commencer, comment fonctionnent
   les combats et les différents modes de jeu ». Trois constats l'ont déclenché :

   1. Ce panneau ne montrait plus qu'UNE diapositive (« Bienvenue ») : les quatre
      autres avaient été retirées le 15/10 au motif que le rail les racontait.
      Le rail dit quoi FAIRE, il n'explique pas ce qui se passe dans un combat.
   2. Il n'était atteignable que par le « ? » du bandeau, or `.hdr .tut-help`
      est en `display: none` en mobile (mobile.css) et le tiroir « Plus » n'en
      portait pas de copie : sur téléphone, l'aide n'avait AUCUNE entrée.
   3. Rien n'expliquait les trois chiffres de l'écran de résultat (Gain, Net,
      XP par entité) — le joueur les voyait sans savoir d'où ils sortent.

   Le contenu est fait de textes du jeu, pas de paraphrase : les modes reprennent
   mot pour mot les HINT_TAB_* d'i18n.js (les mêmes phrases que l'astuce
   d'onglet), et le bloc argent est HINT_TAB_WALLET. Ce qui est nouveau vient des
   règles réellement appliquées : le déroulé d'un combat (L_TIMEOUT), l'XP
   (50/10, cf. GUIDE_D_LEVEL) et la marge par niveau (3 %, idem).
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

// Les blocs, dans l'ordre où on les lit. `lines` = clés i18n rendues en puces
// (les modes) ; `b` = un seul paragraphe.
const SECTIONS = [{
  t: "TUT_S2_T",
  b: "TUT_S2_B"
}, {
  t: "HOWTO_COMBAT_T",
  b: "HOWTO_COMBAT_B"
}, {
  t: "HOWTO_RESULT_T",
  b: "HOWTO_RESULT_B"
}, {
  t: "TUT_S3_T",
  b: "TUT_S3_B"
}, {
  t: "HOWTO_MODES_T",
  lines: ["HINT_TAB_FOSSE", "HINT_TAB_CAMPAIGN", "HINT_TAB_TOUR", "HINT_TAB_ARENE", "HINT_TAB_EXPEDITIONS"]
}, {
  t: "TUT_S4_T",
  b: "TUT_S4_B"
}, {
  t: "TUT_S5_T",
  b: "TUT_S5_B"
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

  // Auto-ouverture unique après la 1ère connexion (flag absent).
  useEffect(() => {
    if (g.wallet && !blocked && !tutSeen()) setOpen(true);
  }, [g.wallet, blocked]);

  // Ouverture depuis le « ? » du bandeau (desktop) et depuis sa copie du tiroir
  // « Plus » (mobile) — le même événement, deux points d'entrée.
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("fa-open-tutorial", onOpen);
    return () => window.removeEventListener("fa-open-tutorial", onOpen);
  }, []);
  if (!open) return null;
  function close() {
    // Vu une fois = vu. Le panneau rouvert par le « ? » ne rejoue pas la
    // cérémonie du premier lancement (drapeau, cadeau, retour du guide) : celle
    // d'un joueur qui consulte l'aide au bout d'un mois n'a rien à annoncer.
    if (!tutSeen()) {
      markTutSeen();
      // Le compte retient le tutoriel vu : les autres navigateurs (navigateur
      // intégré d'UniSat, PWA, autre ordinateur) ne le rouvriront plus.
      actions.pushUiState({
        tutorial_seen: true
      });
      // Signale au cadeau de connexion qu'il peut s'ouvrir (cohabitation 1er login).
      window.dispatchEvent(new Event("fa-tutorial-closed"));
      // Revoir le tutoriel = vouloir de l'aide : le guide masqué revient.
      if (window.FA_GUIDE_SHOW) window.FA_GUIDE_SHOW();
    }
    setOpen(false);
  }
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: close,
    accent: "var(--fire)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      textAlign: "center"
    }
  }, I18N.t("TUT_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      textAlign: "center",
      fontSize: 22,
      margin: "4px 0 2px"
    }
  }, I18N.t("TUT_S1_T")), /*#__PURE__*/React.createElement("div", {
    "data-fa": "howto-body",
    style: {
      maxHeight: "58vh",
      overflowY: "auto",
      WebkitOverflowScrolling: "touch",
      marginTop: 10,
      paddingRight: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "tut-body muted",
    style: {
      marginBottom: 14
    }
  }, I18N.t("TUT_S1_B")), SECTIONS.map((s, i) => /*#__PURE__*/React.createElement("div", {
    key: s.t,
    style: {
      marginBottom: 16
    },
    "data-fa": "howto-" + s.t
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      letterSpacing: 1,
      color: "var(--gold)",
      textTransform: "uppercase",
      marginBottom: 4,
      textAlign: "left"
    }
  }, i + 1, " \xB7 ", I18N.t(s.t)), s.b && /*#__PURE__*/React.createElement("div", {
    className: "tut-body muted",
    style: {
      margin: 0,
      textAlign: "left"
    }
  }, I18N.t(s.b)), s.lines && /*#__PURE__*/React.createElement("ul", {
    style: {
      margin: "2px 0 0",
      paddingLeft: 16
    }
  }, s.lines.map(k => /*#__PURE__*/React.createElement("li", {
    key: k,
    className: "tut-body muted",
    style: {
      marginBottom: 6,
      textAlign: "left"
    }
  }, I18N.t(k))))))), /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginTop: 16,
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-fire",
    style: {
      flex: 1
    },
    onClick: close,
    "data-fa": "howto-close"
  }, I18N.t("TUT_START"))));
}
Object.assign(window, {
  TutorialGate
});
})();
