/* Généré par tools/precompile.mjs depuis quiz.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Quiz éducatif : bulle de question et bandeau des dons.
   La logique décidable vit dans quiz-ui.js (pure, testée sans DOM) ; ici on
   ne fait que peindre et appeler le serveur.
   Spec : repo serveur, docs/superpowers/specs/2026-08-06-quiz-educatif-design.md
   ============================================================ */
const {
  useState,
  useEffect,
  useRef
} = React;
const {
  useFA,
  cx,
  FaText
} = window;
const I18N = window.FA_I18N;
const QUIZ = window.FA_QUIZ_UI;

// ---- drapeau d'occupation ----
// Un seul point de vérité : la classe `fa-busy` sur <body>. Les écrans qui
// jouent un combat en ligne (Fosse, Campagne) et les actions qui ouvrent une
// signature UniSat la posent le temps qu'il faut ; le quiz la lit avant de
// proposer une bulle. Un Set de sources, sinon deux sources concurrentes se
// retireraient mutuellement le drapeau.
const _busy = new Set();
function setBusy(source, actif) {
  if (actif) _busy.add(source);else _busy.delete(source);
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.toggle("fa-busy", _busy.size > 0);
  }
}
window.FA_SET_BUSY = setBusy;

// Occupé = drapeau explicite, ou n'importe quelle surcouche plein écran :
// `.overlay` couvre à la fois les modales (components.jsx) et l'écran de
// combat d'Arène (arene-battle.jsx). Une bulle par-dessus serait une coupure.
function estOccupe() {
  if (typeof document === "undefined") return false;
  if (document.body && document.body.classList.contains("fa-busy")) return true;
  return !!document.querySelector(".overlay");
}

// ---- la bulle ----

function QuizToast() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [question, setQuestion] = useState(null); // { id, q, c[], revision }
  const [verdict, setVerdict] = useState(null); // réponse du serveur
  const [envoi, setEnvoi] = useState(false); // une seule réponse à la fois
  const [donne, setDonne] = useState(false); // don déjà effectué
  const lastAskAt = useRef(0);
  const effacement = useRef(null);
  const ouvert = !!question;

  // Minuterie : on regarde chaque seconde s'il est temps de proposer une bulle.
  // shouldAsk() tranche — le composant ne décide rien.
  useEffect(() => {
    const id = setInterval(async () => {
      const etat = {
        lastAskAt: lastAskAt.current,
        toastOpen: !!question,
        busy: estOccupe(),
        wallet: g.wallet
      };
      if (!QUIZ.shouldAsk(etat, Date.now())) return;
      lastAskAt.current = Date.now();
      const r = await actions.fetchQuizQuestion();
      if (!r.ok || !r.data || !r.data.question) return;
      setVerdict(null);
      setDonne(false);
      setQuestion(r.data.question);
    }, 1000);
    return () => clearInterval(id);
  }, [g.wallet, question, actions]);

  // Auto-effacement : une question qu'on ignore n'est PAS consommée — on ferme
  // sans rien envoyer au serveur, elle pourra revenir plus tard.
  useEffect(() => {
    clearTimeout(effacement.current);
    if (!ouvert) return undefined;
    const delai = verdict ? 6000 : QUIZ.QUIZ_TOAST_MS;
    effacement.current = setTimeout(() => fermer(), delai);
    return () => clearTimeout(effacement.current);
  }, [ouvert, verdict]);
  function fermer() {
    setQuestion(null);
    setVerdict(null);
    setEnvoi(false);
    setDonne(false);
    lastAskAt.current = Date.now(); // la prochaine bulle repart d'un intervalle plein
  }
  async function repondre(i) {
    if (envoi || verdict) return;
    setEnvoi(true);
    let r = await actions.answerQuiz(question.id, i);
    if (!r.ok && r.reason === "retry") r = await actions.answerQuiz(question.id, i);
    setEnvoi(false);
    if (!r.ok) {
      fermer();
      return;
    }
    setVerdict(r.data);
  }

  // « Offrir » reprend les 10 FA déjà crédités et les verse au pool (fenêtre de
  // 60 s côté serveur). « Garder » ne fait rien d'autre que fermer : c'est ce
  // qui permet aux deux options d'avoir exactement le même poids à l'écran.
  async function offrir() {
    if (donne) return;
    let r = await actions.donateQuiz(question.id);
    if (!r.ok && r.reason === "retry") r = await actions.donateQuiz(question.id);
    if (r.ok) {
      setDonne(true);
      // Message factuel, jamais « tu soutiens le cours ». Le montant passe par
      // FaText (le toast rend son message tel quel) : logo du token, pas « FA ».
      toast(/*#__PURE__*/React.createElement(FaText, {
        text: I18N.t("QUIZ_GIVEN", r.data && r.data.granted_pool || 0),
        s: 12
      }), "good");
    }
    fermer();
  }
  if (!g.wallet || !question) return null;
  const gagne = verdict && verdict.correct && !verdict.revision && verdict.reward > 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "quiz-toast",
    role: "dialog",
    "aria-live": "polite"
  }, question.revision && /*#__PURE__*/React.createElement("div", {
    className: "quiz-tag"
  }, I18N.t("QUIZ_REVIEW")), /*#__PURE__*/React.createElement("div", {
    className: "quiz-q"
  }, question.q), !verdict && /*#__PURE__*/React.createElement("div", {
    className: "quiz-answers"
  }, question.c.map((choix, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    className: "quiz-answer",
    disabled: envoi,
    onClick: () => repondre(i)
  }, choix))), verdict && /*#__PURE__*/React.createElement("div", {
    className: "quiz-explain"
  }, /*#__PURE__*/React.createElement("div", {
    className: cx("quiz-verdict", verdict.correct ? "ok" : "ko")
  }, I18N.t(verdict.correct ? "QUIZ_CORRECT" : "QUIZ_WRONG")), /*#__PURE__*/React.createElement("div", {
    className: "quiz-why"
  }, verdict.explanation), gagne && !donne && /*#__PURE__*/React.createElement("div", {
    className: "quiz-dest"
  }, /*#__PURE__*/React.createElement("button", {
    className: "quiz-choice",
    onClick: fermer
  }, /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("QUIZ_KEEP", verdict.reward),
    s: 12
  })), /*#__PURE__*/React.createElement("button", {
    className: "quiz-choice",
    onClick: offrir
  }, I18N.t("QUIZ_GIVE")))));
}
Object.assign(window, {
  QuizToast,
  quizEstOccupe: estOccupe
});
})();
