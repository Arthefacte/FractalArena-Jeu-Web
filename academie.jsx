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

function AcademyModule({ id, revision, retry }) {
  const { g, actions } = useFA();
  const [st, setSt] = useState({ loading: true, error: false, module: null });
  const [open, setOpen] = useState(undefined);
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
      disabled={locked} onClick={() => {
        window.dispatchEvent(new CustomEvent("fa:open-quiz", { detail: { module } }));
      }}>{I18N.t("ACADEMY_EXAM")}</button>
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

function Academie() {
  const { g } = useFA();
  const [selected, setSelected] = useState(() => demandeModule);
  const [revision, setRevision] = useState(0);
  const retry = () => setRevision((n) => n + 1);
  useEffect(() => {
    demandeModule = null;
    const ouvrir = (event) => {
      const id = event && event.detail && event.detail.module;
      if (id) setSelected(id);
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

Object.assign(window, { Academie });
