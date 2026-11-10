/* Généré par tools/precompile.mjs depuis minage.jsx — NE PAS ÉDITER. */
(function () {
/* Minage : simulation locale uniquement, sans requête ni récompense. */
const {
  useFA
} = window;
const I18N = window.FA_I18N;
const MU = window.FA_MINAGE_UI;
const GPU = window.FA_GPU_HASHRATE;
function Minage() {
  const {
    g
  } = useFA();
  const lang = g.lang;
  // Lecture unique au montage : le nom du renderer, puis sa ligne de table.
  // Aucune mesure de charge, aucune requête : c'est la puissance d'usage courant.
  const [carte] = React.useState(() => GPU.resolveGpu(GPU.detectGpu()));
  const monGh = carte.gh;
  // Solitaire : le joueur est seul, sa part vaut 1. Aucun réseau simulé n'entre
  // dans ce calcul — seule sa machine et la cadence de bloc comptent.
  const PART_SOLO = 1;
  const chance = carte.connu ? MU.formaterProba(MU.probaParBloc(PART_SOLO), lang) : null;
  const nom = carte.nom === "Intel" ? I18N.t("minage.intel") : carte.nom;
  return /*#__PURE__*/React.createElement("main", {
    className: "container minage",
    "aria-labelledby": "minage-title"
  }, /*#__PURE__*/React.createElement("header", {
    className: "minage-heading"
  }, /*#__PURE__*/React.createElement("h1", {
    id: "minage-title"
  }, I18N.t("minage.titre")), /*#__PURE__*/React.createElement("span", null, I18N.t("minage.simulateur"))), carte.connu ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("section", {
    className: "minage-machine",
    "aria-labelledby": "minage-machine-title"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "minage-machine-title"
  }, I18N.t("minage.machine")), /*#__PURE__*/React.createElement("div", {
    className: "minage-machine-values"
  }, /*#__PURE__*/React.createElement("strong", null, nom), /*#__PURE__*/React.createElement("strong", {
    className: "mono"
  }, MU.formaterGh(monGh, lang))), /*#__PURE__*/React.createElement("p", {
    className: "minage-caption"
  }, I18N.t("minage.table"))), /*#__PURE__*/React.createElement("section", {
    className: "minage-chance",
    "aria-labelledby": "minage-chance-title"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "minage-chance-title"
  }, I18N.t("minage.chanceBloc")), /*#__PURE__*/React.createElement("strong", {
    className: "minage-percent mono"
  }, chance), /*#__PURE__*/React.createElement("div", {
    className: "minage-gauge",
    role: "meter",
    "aria-labelledby": "minage-chance-title",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": PART_SOLO * 100,
    "aria-valuetext": chance
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: `${PART_SOLO * 100}%`
    }
  })), /*#__PURE__*/React.createElement("p", {
    className: "minage-caption"
  }, I18N.t("minage.parBloc"))), /*#__PURE__*/React.createElement("section", {
    className: "minage-estimates",
    "aria-labelledby": "minage-estimates-title"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "minage-estimates-title"
  }, I18N.t("minage.estimations")), /*#__PURE__*/React.createElement("dl", null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, I18N.t("minage.temps")), /*#__PURE__*/React.createElement("dd", null, MU.formaterDuree(MU.tempsMoyenMs(PART_SOLO), lang) || I18N.t("minage.indisponible"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, I18N.t("minage.fbJour")), /*#__PURE__*/React.createElement("dd", null, MU.formaterFb(MU.fbParJour(PART_SOLO), lang))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, I18N.t("minage.chanceJour")), /*#__PURE__*/React.createElement("dd", null, MU.formaterProba(MU.probaJour(PART_SOLO), lang))))), /*#__PURE__*/React.createElement("p", {
    className: "minage-network"
  }, I18N.t("minage.solo"))) : /*#__PURE__*/React.createElement("section", {
    className: "minage-unavailable",
    "aria-labelledby": "minage-unavailable-title"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "minage-unavailable-title"
  }, I18N.t("minage.nonDetectee")), /*#__PURE__*/React.createElement("p", null, I18N.t("minage.pcRequis"))), /*#__PURE__*/React.createElement("p", {
    className: "minage-note",
    role: "note"
  }, I18N.t("minage.note")));
}
Object.assign(window, {
  Minage
});
})();
