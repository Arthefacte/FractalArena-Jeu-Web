/* Généré par tools/precompile.mjs depuis academie.jsx — NE PAS ÉDITER. */
(function () {
/* FRACTAL ARENA — Académie : contenu et progression fournis par le serveur. */
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
function academyStatus(progress) {
  if (!progress) return null;
  return I18N.t(progress.exam_passed ? "ACADEMY_PASSED" : progress.unlocked === false ? "ACADEMY_LOCKED" : "ACADEMY_IN_PROGRESS");
}
function AcademyError({
  retry,
  missing
}) {
  return /*#__PURE__*/React.createElement("div", {
    role: "alert",
    className: "muted",
    style: {
      padding: 24
    }
  }, /*#__PURE__*/React.createElement("p", null, I18N.t(missing ? "ACADEMY_NOT_FOUND" : "ACADEMY_ERROR")), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: retry
  }, I18N.t("ACADEMY_RETRY")));
}
function AcademyList({
  revision,
  retry,
  select
}) {
  const {
    g,
    actions
  } = useFA();
  const [st, setSt] = useState({
    loading: true,
    error: false,
    modules: []
  });
  const [progress, setProgress] = useState({});
  useEffect(() => {
    let active = true;
    setSt({
      loading: true,
      error: false,
      modules: []
    });
    setProgress({});
    (async () => {
      const r = await actions.fetchAcademyModules();
      if (!active) return;
      if (!r.ok || !Array.isArray(r.data?.modules)) {
        setSt({
          loading: false,
          error: true,
          modules: []
        });
        return;
      }
      const modules = [...r.data.modules].sort((a, b) => a.order - b.order);
      setSt({
        loading: false,
        error: false,
        modules
      });
      // Le catalogue ne porte pas de progression ; seul le détail la connaît.
      if (g.wallet) modules.forEach(async module => {
        const detail = await actions.fetchAcademyModule(module.id);
        if (active && detail.ok && detail.data?.module) {
          setProgress(p => ({
            ...p,
            [module.id]: detail.data.module.progress
          }));
        }
      });
    })();
    return () => {
      active = false;
    };
  }, [g.lang, g.wallet, revision]);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHead, {
    title: I18N.t("ACADEMY_TITLE")
  }), /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, I18N.t("ACADEMY_SUBTITLE")), st.loading && /*#__PURE__*/React.createElement("p", {
    role: "status",
    className: "muted"
  }, I18N.t("ACADEMY_LOADING")), st.error && /*#__PURE__*/React.createElement(AcademyError, {
    retry: retry
  }), !st.loading && !st.error && !st.modules.length && /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, I18N.t("ACADEMY_EMPTY")), /*#__PURE__*/React.createElement("div", {
    className: "q-list"
  }, st.modules.map(module => /*#__PURE__*/React.createElement("button", {
    key: module.id,
    className: cx("q-row", progress[module.id]?.exam_passed && "done"),
    style: {
      textAlign: "left",
      cursor: "pointer",
      font: "inherit"
    },
    onClick: () => select(module.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "q-info"
  }, /*#__PURE__*/React.createElement("span", {
    className: "q-name"
  }, module.title)), /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, module.tagline), /*#__PURE__*/React.createElement("span", {
    className: "q-foot"
  }, /*#__PURE__*/React.createElement("span", {
    className: "q-prog"
  }, I18N.t("ACADEMY_LESSONS", module.lessons.length), " · ", I18N.t("ACADEMY_QUESTIONS", module.question_count)), progress[module.id] && /*#__PURE__*/React.createElement("span", {
    className: "q-claimed"
  }, academyStatus(progress[module.id])))))));
}

// ---- l'examen d'un module ----
// Un examen ne se joue pas dans une bulle : il a son écran. Les questions
// s'enchaînent, une par une, et une mauvaise réponse donne la bonne réponse
// AVEC sa source — c'est ce qui distingue une leçon d'un simple score.
function AcademyExam({
  module,
  onClose
}) {
  const {
    actions
  } = useFA();
  const total = module.exam?.question_count || module.question_count || 0;
  const [etat, setEtat] = useState({
    loading: true,
    question: null,
    error: false,
    fin: false
  });
  const [verdict, setVerdict] = useState(null);
  const [choix, setChoix] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [score, setScore] = useState({
    posees: 0,
    bonnes: 0,
    gains: 0
  });
  const [rates, setRates] = useState([]);
  // Un échec de VALIDATION ne détruit pas l'examen : la question reste à
  // l'écran et le joueur lit ce qui bloque (session expirée, serveur muet).
  // Seul l'échec du premier chargement remplace l'écran.
  const [souci, setSouci] = useState(null); // null | "auth" | "reseau"
  // Le quiz limite à une réponse toutes les 20 s (anti-farm). En examen, ça se
  // traduisait par un 429 et un écran en erreur : on attend le délai annoncé et
  // on rejoue la réponse tout seul.
  const [attente, setAttente] = useState(0);
  const [relance, setRelance] = useState(false);
  useEffect(() => {
    if (attente <= 0) return;
    const id = setTimeout(() => setAttente(n => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(id);
  }, [attente]);
  useEffect(() => {
    if (attente === 0 && relance) {
      setRelance(false);
      repondre(choix);
    }
  }, [attente, relance]);
  async function charger() {
    setEtat({
      loading: true,
      question: null,
      error: false,
      fin: false
    });
    setVerdict(null);
    setChoix(null);
    const r = await actions.fetchQuizQuestion(module.id);
    const question = r.ok && r.data ? r.data.question : null;
    if (question) return setEtat({
      loading: false,
      question,
      error: false,
      fin: false
    });
    // Plus de question pour ce module : l'examen s'arrête proprement, ce n'est
    // pas une panne (le pool peut être plus court que le nombre annoncé).
    if (r.ok || r.status === 404) return setEtat({
      loading: false,
      question: null,
      error: false,
      fin: true
    });
    setEtat({
      loading: false,
      question: null,
      error: true,
      fin: false
    });
  }
  useEffect(() => {
    charger();
  }, []);
  async function repondre(i) {
    if (envoi || verdict || attente > 0) return;
    setEnvoi(true);
    setChoix(i);
    setSouci(null);
    let r = await actions.answerQuiz(etat.question.id, i);
    // Le jeton expiré est rejoué une fois par answerQuiz (« retry ») ; s'il
    // revient encore, on ne boucle pas indéfiniment.
    if (!r.ok && r.reason === "retry") r = await actions.answerQuiz(etat.question.id, i);
    setEnvoi(false);
    if (!r.ok || !r.data) {
      // Limiteur : on attend le délai qu'il annonce, puis on rejoue la réponse.
      if (r.reason === "rate") {
        setAttente(r.retry_after || 20);
        setRelance(true);
        return;
      }
      // Session absente ou expirée : on le dit, la question reste en place.
      setSouci(r.ok === false && r.reason === "auth" ? "auth" : "reseau");
      return;
    }
    const v = r.data;
    setVerdict(v);
    setScore(s => ({
      posees: s.posees + 1,
      bonnes: s.bonnes + (v.correct ? 1 : 0),
      gains: s.gains + (v.reward || 0)
    }));
    if (!v.correct) {
      setRates(rs => [...rs, {
        id: etat.question.id,
        q: etat.question.q,
        c: etat.question.c,
        answer: v.answer,
        explanation: v.explanation,
        source: v.source
      }]);
    }
  }
  function suite() {
    if (score.posees >= total) {
      return setEtat({
        loading: false,
        question: null,
        error: false,
        fin: true
      });
    }
    charger();
  }
  if (etat.loading) return /*#__PURE__*/React.createElement("p", {
    role: "status",
    className: "muted"
  }, I18N.t("ACADEMY_LOADING"));
  if (etat.error) return /*#__PURE__*/React.createElement(AcademyError, {
    retry: charger
  });
  if (etat.fin) {
    const pct = score.posees ? Math.round(score.bonnes / score.posees * 100) : 0;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHead, {
      title: module.title
    }), /*#__PURE__*/React.createElement("div", {
      className: "exam-score"
    }, /*#__PURE__*/React.createElement("div", {
      className: "exam-score-big"
    }, score.bonnes, " / ", score.posees), /*#__PURE__*/React.createElement("div", {
      className: "q-prog"
    }, I18N.t("ACADEMY_EXAM_PCT", pct)), score.gains > 0 && /*#__PURE__*/React.createElement("div", {
      className: "q-prog"
    }, I18N.t("ACADEMY_EXAM_EARNED", score.gains))), !!rates.length && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h3", {
      className: "exam-h"
    }, I18N.t("ACADEMY_EXAM_MISSED", rates.length)), /*#__PURE__*/React.createElement("div", {
      className: "q-list"
    }, rates.map(item => /*#__PURE__*/React.createElement("div", {
      key: item.id,
      className: "q-row exam-missed"
    }, /*#__PURE__*/React.createElement("span", {
      className: "q-name"
    }, item.q), /*#__PURE__*/React.createElement("span", {
      className: "exam-ok"
    }, item.c[item.answer]), item.explanation && /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, item.explanation), item.source && /*#__PURE__*/React.createElement("a", {
      href: item.source,
      target: "_blank",
      rel: "noopener noreferrer",
      className: "exam-source"
    }, item.source))))), /*#__PURE__*/React.createElement("button", {
      className: "btn solid btn-gold block",
      style: {
        marginTop: 16
      },
      onClick: onClose
    }, I18N.t("ACADEMY_EXAM_BACK")));
  }
  const q = etat.question;
  const numero = Math.min(score.posees + 1, total || score.posees + 1);
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "exam-bar"
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: onClose
  }, I18N.t("ACADEMY_EXAM_QUIT")), /*#__PURE__*/React.createElement("span", {
    className: "q-prog"
  }, I18N.t("ACADEMY_EXAM_PROGRESS", numero, total))), /*#__PURE__*/React.createElement("div", {
    className: "q-bar"
  }, /*#__PURE__*/React.createElement("div", {
    className: "q-fill",
    style: {
      width: (total ? score.posees / total * 100 : 0) + "%"
    }
  })), /*#__PURE__*/React.createElement("p", {
    className: "q-name exam-q"
  }, q.q), /*#__PURE__*/React.createElement("div", {
    className: "q-list"
  }, q.c.map((choice, i) => /*#__PURE__*/React.createElement("button", {
    key: i,
    disabled: !!verdict || envoi || attente > 0,
    className: cx("q-row", "exam-choice", verdict && i === verdict.answer && "exam-juste", verdict && i === choix && !verdict.correct && "exam-faux"),
    onClick: () => repondre(i)
  }, /*#__PURE__*/React.createElement("span", {
    className: "q-name"
  }, choice)))), attente > 0 && /*#__PURE__*/React.createElement("p", {
    className: "q-prog exam-attente",
    role: "status"
  }, I18N.t("ACADEMY_EXAM_WAIT", attente)), !attente && souci && /*#__PURE__*/React.createElement("div", {
    className: "exam-souci",
    role: "alert"
  }, /*#__PURE__*/React.createElement("p", {
    className: "exam-ko"
  }, I18N.t(souci === "auth" ? "ACADEMY_CONNECT" : "ACADEMY_ERROR")), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    onClick: () => repondre(choix)
  }, I18N.t("ACADEMY_RETRY"))), verdict && /*#__PURE__*/React.createElement("div", {
    className: "exam-verdict"
  }, /*#__PURE__*/React.createElement("p", {
    className: verdict.correct ? "exam-ok" : "exam-ko"
  }, I18N.t(verdict.correct ? "ACADEMY_EXAM_CORRECT" : "ACADEMY_EXAM_WRONG")), !verdict.correct && /*#__PURE__*/React.createElement("p", {
    className: "exam-ok"
  }, I18N.t("ACADEMY_EXAM_ANSWER_WAS", q.c[verdict.answer])), verdict.explanation && /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, verdict.explanation), verdict.source && /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, I18N.t("ACADEMY_EXAM_SOURCE"), " : ", /*#__PURE__*/React.createElement("a", {
    href: verdict.source,
    target: "_blank",
    rel: "noopener noreferrer",
    className: "exam-source"
  }, verdict.source)), /*#__PURE__*/React.createElement("button", {
    className: "btn solid btn-gold block",
    style: {
      marginTop: 12
    },
    onClick: suite
  }, score.posees >= total ? I18N.t("ACADEMY_EXAM_FINISH") : I18N.t("ACADEMY_EXAM_NEXT"))));
}
function AcademyModule({
  id,
  revision,
  retry
}) {
  const {
    g,
    actions
  } = useFA();
  const [st, setSt] = useState({
    loading: true,
    error: false,
    module: null
  });
  const [open, setOpen] = useState(undefined);
  // L'examen remplace le contenu du module : c'est un écran, pas une bulle.
  const [examen, setExamen] = useState(false);
  useEffect(() => {
    let active = true;
    setSt({
      loading: true,
      error: false,
      module: null
    });
    (async () => {
      const r = await actions.fetchAcademyModule(id);
      if (!active) return;
      const module = r.ok && r.data?.module;
      setSt({
        loading: false,
        error: !module,
        missing: r.status === 404,
        module
      });
      if (module) setOpen(previous => previous === undefined ? module.lessons[0]?.id : previous);
    })();
    return () => {
      active = false;
    };
  }, [id, g.lang, g.wallet, revision]);
  if (st.loading) return /*#__PURE__*/React.createElement("p", {
    role: "status",
    className: "muted"
  }, I18N.t("ACADEMY_LOADING"));
  if (st.error) return /*#__PURE__*/React.createElement(AcademyError, {
    retry: retry,
    missing: st.missing
  });
  const module = st.module;
  if (examen) return /*#__PURE__*/React.createElement(AcademyExam, {
    module: module,
    onClose: () => {
      setExamen(false);
      retry();
    }
  });
  const progress = module.progress;
  const locked = progress?.unlocked === false;
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(SectionHead, {
    title: module.title
  }), /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, module.tagline), progress && /*#__PURE__*/React.createElement("p", {
    className: "q-prog"
  }, academyStatus(progress), " · ", I18N.t("ACADEMY_SCORE", progress.correct, module.exam.question_count)), /*#__PURE__*/React.createElement("div", {
    className: "q-list"
  }, module.lessons.map(lesson => /*#__PURE__*/React.createElement("div", {
    key: lesson.id,
    className: "q-row"
  }, /*#__PURE__*/React.createElement("button", {
    className: "q-info",
    style: {
      width: "100%",
      padding: 0,
      border: 0,
      background: "none",
      textAlign: "left",
      cursor: "pointer"
    },
    "aria-expanded": open === lesson.id,
    "aria-controls": "academy-lesson-" + lesson.id,
    onClick: () => setOpen(open === lesson.id ? null : lesson.id)
  }, /*#__PURE__*/React.createElement("span", {
    className: "q-name"
  }, lesson.title), /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, I18N.t("ACADEMY_MINUTES", lesson.minutes))), /*#__PURE__*/React.createElement("div", {
    id: "academy-lesson-" + lesson.id,
    hidden: open !== lesson.id
  }, lesson.body.map((paragraph, i) => /*#__PURE__*/React.createElement("p", {
    key: i
  }, paragraph)), !!lesson.sources.length && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, I18N.t("ACADEMY_SOURCES")), /*#__PURE__*/React.createElement("ul", null, lesson.sources.filter(url => /^https?:\/\//i.test(url)).map((url, i) => /*#__PURE__*/React.createElement("li", {
    key: i
  }, /*#__PURE__*/React.createElement("a", {
    href: url,
    target: "_blank",
    rel: "noopener noreferrer",
    style: {
      overflowWrap: "anywhere"
    }
  }, url))))))))), locked && /*#__PURE__*/React.createElement("p", {
    className: "muted"
  }, I18N.t("ACADEMY_LOCKED_HELP")), /*#__PURE__*/React.createElement("button", {
    className: "btn solid btn-gold block",
    style: {
      marginTop: 16
    },
    disabled: locked,
    onClick: () => setExamen(true)
  }, I18N.t("ACADEMY_EXAM")));
}

// Une demande ouverte AILLEURS (résultat du quiz : « lire la fiche ») arrive
// pendant que cet écran n'est pas monté — le module demandé attend donc dans une
// variable de module, consommée au montage. Le navigateur pointe l'écran en même
// temps (fa:academy-module est écouté par la barre de nav).
let demandeModule = null;
// Écouteur de module : la demande peut arriver avant le montage (le quiz est une
// modale qui vit sur un autre écran). Il ne fait que mémoriser.
window.addEventListener("fa:academy-module", event => {
  const id = event && event.detail && event.detail.module;
  if (id) demandeModule = id;
});

// Deux canaux pour la même intention, et il faut les deux : la variable de
// module (événement reçu avant ce montage) et window.__faAcademyModule (posé par
// le clic du quiz JUSTE avant la navigation — donc lisible même si l'écouteur
// de module n'était pas encore chargé). Consommées une seule fois : revenir sur
// l'écran plus tard doit rendre la liste, pas rouvrir le module.
function consommerDemande() {
  const pose = window.__faAcademyModule || null;
  window.__faAcademyModule = null;
  const enAttente = demandeModule;
  demandeModule = null;
  return pose || enAttente || null;
}
function Academie() {
  const {
    g
  } = useFA();
  const [selected, setSelected] = useState(consommerDemande);
  const [revision, setRevision] = useState(0);
  const retry = () => setRevision(n => n + 1);
  useEffect(() => {
    demandeModule = null;
    window.__faAcademyModule = null;
    const ouvrir = event => {
      const id = event && event.detail && event.detail.module;
      if (id) {
        demandeModule = null;
        window.__faAcademyModule = null;
        setSelected(id);
      }
    };
    window.addEventListener("fa:academy-refresh", retry);
    window.addEventListener("fa:academy-module", ouvrir);
    return () => {
      window.removeEventListener("fa:academy-refresh", retry);
      window.removeEventListener("fa:academy-module", ouvrir);
    };
  }, []);
  const scope = `${g.lang}:${g.wallet || ""}`;
  return /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      maxWidth: 640
    }
  }, selected !== null ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "exq-back exq-mono",
    onClick: () => setSelected(null)
  }, I18N.t("ACADEMY_BACK")), /*#__PURE__*/React.createElement(AcademyModule, {
    key: scope + ":" + selected,
    id: selected,
    revision: revision,
    retry: retry
  })) : /*#__PURE__*/React.createElement(AcademyList, {
    key: scope,
    revision: revision,
    retry: retry,
    select: setSelected
  }));
}
Object.assign(window, {
  Academie,
  AcademyExam
});
})();
