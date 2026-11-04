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
    onClick: () => {
      window.dispatchEvent(new CustomEvent("fa:open-quiz", {
        detail: {
          module
        }
      }));
    }
  }, I18N.t("ACADEMY_EXAM")));
}
function Academie() {
  const {
    g
  } = useFA();
  const [selected, setSelected] = useState(null);
  const [revision, setRevision] = useState(0);
  const retry = () => setRevision(n => n + 1);
  useEffect(() => {
    window.addEventListener("fa:academy-refresh", retry);
    return () => window.removeEventListener("fa:academy-refresh", retry);
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
  Academie
});
})();
