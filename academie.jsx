/* FRACTAL ARENA — Académie : contenu et progression fournis par le serveur. */
const { useState, useEffect } = React;
const { useFA, cx, SectionHead } = window;
const I18N = window.FA_I18N;

function academyStatus(progress) {
  if (!progress) return null;
  return I18N.t(progress.exam_passed ? "ACADEMY_PASSED"
    : progress.unlocked === false ? "ACADEMY_LOCKED" : "ACADEMY_IN_PROGRESS");
}

function AcademyError({ retry, missing }) {
  return <div role="alert" className="muted" style={{ padding: 24 }}>
    <p>{I18N.t(missing ? "ACADEMY_NOT_FOUND" : "ACADEMY_ERROR")}</p>
    <button className="btn" onClick={retry}>{I18N.t("ACADEMY_RETRY")}</button>
  </div>;
}

function AcademyList({ revision, retry, select }) {
  const { g, actions } = useFA();
  const [st, setSt] = useState({ loading: true, error: false, modules: [] });
  const [progress, setProgress] = useState({});
  useEffect(() => {
    let active = true;
    setSt({ loading: true, error: false, modules: [] });
    setProgress({});
    (async () => {
      const r = await actions.fetchAcademyModules();
      if (!active) return;
      if (!r.ok || !Array.isArray(r.data?.modules)) {
        setSt({ loading: false, error: true, modules: [] });
        return;
      }
      const modules = [...r.data.modules].sort((a, b) => a.order - b.order);
      setSt({ loading: false, error: false, modules });
      // Le catalogue ne porte pas de progression ; seul le détail la connaît.
      if (g.wallet) modules.forEach(async (module) => {
        const detail = await actions.fetchAcademyModule(module.id);
        if (active && detail.ok && detail.data?.module) {
          setProgress((p) => ({ ...p, [module.id]: detail.data.module.progress }));
        }
      });
    })();
    return () => { active = false; };
  }, [g.lang, g.wallet, revision]);

  return <>
    <SectionHead title={I18N.t("ACADEMY_TITLE")} />
    <p className="muted">{I18N.t("ACADEMY_SUBTITLE")}</p>
    {st.loading && <p role="status" className="muted">{I18N.t("ACADEMY_LOADING")}</p>}
    {st.error && <AcademyError retry={retry} />}
    {!st.loading && !st.error && !st.modules.length &&
      <p className="muted">{I18N.t("ACADEMY_EMPTY")}</p>}
    <div className="q-list">
      {st.modules.map((module) => <button key={module.id}
        className={cx("q-row", progress[module.id]?.exam_passed && "done")}
        style={{ textAlign: "left", cursor: "pointer", font: "inherit" }}
        onClick={() => select(module.id)}>
        <span className="q-info"><span className="q-name">{module.title}</span></span>
        <span className="muted">{module.tagline}</span>
        <span className="q-foot">
          <span className="q-prog">
            {I18N.t("ACADEMY_LESSONS", module.lessons.length)}
            {" · "}{I18N.t("ACADEMY_QUESTIONS", module.question_count)}
          </span>
          {progress[module.id] && <span className="q-claimed">
            {academyStatus(progress[module.id])}
          </span>}
        </span>
      </button>)}
    </div>
  </>;
}

// ---- l'examen d'un module ----
// Un examen ne se joue pas dans une bulle : il a son écran. Les questions
// s'enchaînent, une par une, et une mauvaise réponse donne la bonne réponse
// AVEC sa source — c'est ce qui distingue une leçon d'un simple score.
function AcademyExam({ module, onClose }) {
  const { actions } = useFA();
  const total = module.exam?.question_count || module.question_count || 0;
  const [etat, setEtat] = useState({ loading: true, question: null, error: false, fin: false });
  const [verdict, setVerdict] = useState(null);
  const [choix, setChoix] = useState(null);
  const [envoi, setEnvoi] = useState(false);
  const [score, setScore] = useState({ posees: 0, bonnes: 0, gains: 0 });
  const [rates, setRates] = useState([]);
  // Un échec de VALIDATION ne détruit pas l'examen : la question reste à
  // l'écran et le joueur lit ce qui bloque (session expirée, serveur muet).
  // Seul l'échec du premier chargement remplace l'écran.
  const [souci, setSouci] = useState(null);   // null | "auth" | "reseau"

  async function charger() {
    setEtat({ loading: true, question: null, error: false, fin: false });
    setVerdict(null);
    setChoix(null);
    const r = await actions.fetchQuizQuestion(module.id);
    const question = r.ok && r.data ? r.data.question : null;
    if (question) return setEtat({ loading: false, question, error: false, fin: false });
    // Plus de question pour ce module : l'examen s'arrête proprement, ce n'est
    // pas une panne (le pool peut être plus court que le nombre annoncé).
    if (r.ok || r.status === 404) return setEtat({ loading: false, question: null, error: false, fin: true });
    setEtat({ loading: false, question: null, error: true, fin: false });
  }
  useEffect(() => { charger(); }, []);

  async function repondre(i) {
    if (envoi || verdict) return;
    setEnvoi(true);
    setChoix(i);
    setSouci(null);
    let r = await actions.answerQuiz(etat.question.id, i);
    // Le jeton expiré est rejoué une fois par answerQuiz (« retry ») ; s'il
    // revient encore, on ne boucle pas indéfiniment.
    if (!r.ok && r.reason === "retry") r = await actions.answerQuiz(etat.question.id, i);
    setEnvoi(false);
    if (!r.ok || !r.data) {
      // Session absente ou expirée : on le dit, la question reste en place.
      setSouci(r.ok === false && r.reason === "auth" ? "auth" : "reseau");
      return;
    }
    const v = r.data;
    setVerdict(v);
    setScore((s) => ({
      posees: s.posees + 1,
      bonnes: s.bonnes + (v.correct ? 1 : 0),
      gains: s.gains + (v.reward || 0),
    }));
    if (!v.correct) {
      setRates((rs) => [...rs, {
        id: etat.question.id,
        q: etat.question.q,
        c: etat.question.c,
        answer: v.answer,
        explanation: v.explanation,
        source: v.source,
      }]);
    }
  }

  function suite() {
    if (score.posees >= total) {
      return setEtat({ loading: false, question: null, error: false, fin: true });
    }
    charger();
  }

  if (etat.loading) return <p role="status" className="muted">{I18N.t("ACADEMY_LOADING")}</p>;
  if (etat.error) return <AcademyError retry={charger} />;

  if (etat.fin) {
    const pct = score.posees ? Math.round((score.bonnes / score.posees) * 100) : 0;
    return <>
      <SectionHead title={module.title} />
      <div className="exam-score">
        <div className="exam-score-big">{score.bonnes} / {score.posees}</div>
        <div className="q-prog">{I18N.t("ACADEMY_EXAM_PCT", pct)}</div>
        {score.gains > 0 && <div className="q-prog">{I18N.t("ACADEMY_EXAM_EARNED", score.gains)}</div>}
      </div>
      {!!rates.length && <>
        <h3 className="exam-h">{I18N.t("ACADEMY_EXAM_MISSED", rates.length)}</h3>
        <div className="q-list">
          {rates.map((item) => <div key={item.id} className="q-row exam-missed">
            <span className="q-name">{item.q}</span>
            <span className="exam-ok">{item.c[item.answer]}</span>
            {item.explanation && <span className="muted">{item.explanation}</span>}
            {item.source && <a href={item.source} target="_blank" rel="noopener noreferrer"
              className="exam-source">{item.source}</a>}
          </div>)}
        </div>
      </>}
      <button className="btn solid btn-gold block" style={{ marginTop: 16 }} onClick={onClose}>
        {I18N.t("ACADEMY_EXAM_BACK")}
      </button>
    </>;
  }

  const q = etat.question;
  const numero = Math.min(score.posees + 1, total || score.posees + 1);
  return <>
    <div className="exam-bar">
      <button className="btn" onClick={onClose}>{I18N.t("ACADEMY_EXAM_QUIT")}</button>
      <span className="q-prog">{I18N.t("ACADEMY_EXAM_PROGRESS", numero, total)}</span>
    </div>
    <div className="q-bar">
      <div className="q-fill" style={{ width: (total ? (score.posees / total) * 100 : 0) + "%" }} />
    </div>
    <p className="q-name exam-q">{q.q}</p>
    <div className="q-list">
      {q.c.map((choice, i) => <button key={i} disabled={!!verdict || envoi}
        className={cx("q-row", "exam-choice",
          verdict && i === verdict.answer && "exam-juste",
          verdict && i === choix && !verdict.correct && "exam-faux")}
        onClick={() => repondre(i)}>
        <span className="q-name">{choice}</span>
      </button>)}
    </div>
    {souci && <div className="exam-souci" role="alert">
      <p className="exam-ko">{I18N.t(souci === "auth" ? "ACADEMY_CONNECT" : "ACADEMY_ERROR")}</p>
      <button className="btn" onClick={() => repondre(choix)}>{I18N.t("ACADEMY_RETRY")}</button>
    </div>}
    {verdict && <div className="exam-verdict">
      <p className={verdict.correct ? "exam-ok" : "exam-ko"}>
        {I18N.t(verdict.correct ? "ACADEMY_EXAM_CORRECT" : "ACADEMY_EXAM_WRONG")}
      </p>
      {!verdict.correct && <p className="exam-ok">
        {I18N.t("ACADEMY_EXAM_ANSWER_WAS", q.c[verdict.answer])}
      </p>}
      {verdict.explanation && <p className="muted">{verdict.explanation}</p>}
      {verdict.source && <p className="muted">
        {I18N.t("ACADEMY_EXAM_SOURCE")}{" : "}
        <a href={verdict.source} target="_blank" rel="noopener noreferrer"
          className="exam-source">{verdict.source}</a>
      </p>}
      <button className="btn solid btn-gold block" style={{ marginTop: 12 }} onClick={suite}>
        {score.posees >= total ? I18N.t("ACADEMY_EXAM_FINISH") : I18N.t("ACADEMY_EXAM_NEXT")}
      </button>
    </div>}
  </>;
}

function AcademyModule({ id, revision, retry }) {
  const { g, actions } = useFA();
  const [st, setSt] = useState({ loading: true, error: false, module: null });
  const [open, setOpen] = useState(undefined);
  // L'examen remplace le contenu du module : c'est un écran, pas une bulle.
  const [examen, setExamen] = useState(false);
  useEffect(() => {
    let active = true;
    setSt({ loading: true, error: false, module: null });
    (async () => {
      const r = await actions.fetchAcademyModule(id);
      if (!active) return;
      const module = r.ok && r.data?.module;
      setSt({ loading: false, error: !module, missing: r.status === 404, module });
      if (module) setOpen((previous) => previous === undefined ? module.lessons[0]?.id : previous);
    })();
    return () => { active = false; };
  }, [id, g.lang, g.wallet, revision]);

  if (st.loading) return <p role="status" className="muted">{I18N.t("ACADEMY_LOADING")}</p>;
  if (st.error) return <AcademyError retry={retry} missing={st.missing} />;
  const module = st.module;
  if (examen) return <AcademyExam module={module}
    onClose={() => { setExamen(false); retry(); }} />;
  const progress = module.progress;
  const locked = progress?.unlocked === false;
  return <>
    <SectionHead title={module.title} />
    <p className="muted">{module.tagline}</p>
    {progress && <p className="q-prog">
      {academyStatus(progress)}{" · "}
      {I18N.t("ACADEMY_SCORE", progress.correct, module.exam.question_count)}
    </p>}
    <div className="q-list">
      {module.lessons.map((lesson) => <div key={lesson.id} className="q-row">
        <button className="q-info" style={{ width: "100%", padding: 0, border: 0,
          background: "none", textAlign: "left", cursor: "pointer" }}
          aria-expanded={open === lesson.id} aria-controls={"academy-lesson-" + lesson.id}
          onClick={() => setOpen(open === lesson.id ? null : lesson.id)}>
          <span className="q-name">{lesson.title}</span>
          <span className="muted">{I18N.t("ACADEMY_MINUTES", lesson.minutes)}</span>
        </button>
        <div id={"academy-lesson-" + lesson.id} hidden={open !== lesson.id}>
          {lesson.body.map((paragraph, i) => <p key={i}>{paragraph}</p>)}
          {!!lesson.sources.length && <>
            <p className="muted">{I18N.t("ACADEMY_SOURCES")}</p>
            <ul>{lesson.sources.filter((url) => /^https?:\/\//i.test(url)).map((url, i) =>
              <li key={i}><a href={url} target="_blank" rel="noopener noreferrer"
                style={{ overflowWrap: "anywhere" }}>{url}</a></li>)}</ul>
          </>}
        </div>
      </div>)}
    </div>
    {locked && <p className="muted">{I18N.t("ACADEMY_LOCKED_HELP")}</p>}
    <button className="btn solid btn-gold block" style={{ marginTop: 16 }}
      disabled={locked} onClick={() => setExamen(true)}>{I18N.t("ACADEMY_EXAM")}</button>
  </>;
}

// Une demande ouverte AILLEURS (résultat du quiz : « lire la fiche ») arrive
// pendant que cet écran n'est pas monté — le module demandé attend donc dans une
// variable de module, consommée au montage. Le navigateur pointe l'écran en même
// temps (fa:academy-module est écouté par la barre de nav).
let demandeModule = null;
// Écouteur de module : la demande peut arriver avant le montage (le quiz est une
// modale qui vit sur un autre écran). Il ne fait que mémoriser.
window.addEventListener("fa:academy-module", (event) => {
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
  const { g } = useFA();
  const [selected, setSelected] = useState(consommerDemande);
  const [revision, setRevision] = useState(0);
  const retry = () => setRevision((n) => n + 1);
  useEffect(() => {
    demandeModule = null;
    window.__faAcademyModule = null;
    const ouvrir = (event) => {
      const id = event && event.detail && event.detail.module;
      if (id) { demandeModule = null; window.__faAcademyModule = null; setSelected(id); }
    };
    window.addEventListener("fa:academy-refresh", retry);
    window.addEventListener("fa:academy-module", ouvrir);
    return () => {
      window.removeEventListener("fa:academy-refresh", retry);
      window.removeEventListener("fa:academy-module", ouvrir);
    };
  }, []);
  const scope = `${g.lang}:${g.wallet || ""}`;
  return <div className="container" style={{ maxWidth: 640 }}>
    {selected !== null ? <>
      <button className="exq-back exq-mono" onClick={() => setSelected(null)}>
        {I18N.t("ACADEMY_BACK")}
      </button>
      <AcademyModule key={scope + ":" + selected} id={selected} revision={revision} retry={retry} />
    </> : <AcademyList key={scope} revision={revision} retry={retry} select={setSelected} />}
  </div>;
}

Object.assign(window, { Academie, AcademyExam });
