/* Généré par tools/precompile.mjs depuis minage.jsx — NE PAS ÉDITER. */
(function () {
/* Minage : simulation locale uniquement, sans requête ni récompense. */
const {
  useState
} = React;
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
  const [carte] = useState(() => GPU.resolveGpu(GPU.detectGpu()));
  const [manuel, setManuel] = useState(() => !carte.connu);
  const [ghManuel, setGhManuel] = useState(5);
  const monGh = manuel ? ghManuel : carte.gh;
  // Le classement n'expose que top/you, aucun total : ces 1 000 autres mineurs
  // sont TOUJOURS une hypothèse fixe, jamais un nombre de joueurs mesuré.
  const mineurs = MU.COMPTES_FALLBACK;
  const autresGh = mineurs * MU.GH_PAR_COMPTE;
  const part = MU.partReseau(monGh, autresGh);
  const chance = MU.formaterProba(MU.probaParBloc(part), lang);
  const nom = carte.connu ? carte.nom === "Intel" ? I18N.t("minage.intel") : carte.nom : I18N.t("minage.inconnue");
  return /*#__PURE__*/React.createElement("main", {
    className: "container minage",
    "aria-labelledby": "minage-title"
  }, /*#__PURE__*/React.createElement("header", {
    className: "minage-heading"
  }, /*#__PURE__*/React.createElement("h1", {
    id: "minage-title"
  }, I18N.t("minage.titre")), /*#__PURE__*/React.createElement("span", null, I18N.t("minage.simulateur"))), /*#__PURE__*/React.createElement("section", {
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
  }, I18N.t(manuel ? "minage.manuelle" : "minage.table")), manuel && /*#__PURE__*/React.createElement("div", {
    className: "minage-manual"
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: "minage-gh"
  }, I18N.t("minage.curseur")), /*#__PURE__*/React.createElement("input", {
    id: "minage-gh",
    type: "range",
    min: "1",
    max: "30",
    step: "0.1",
    value: ghManuel,
    "aria-valuetext": MU.formaterGh(ghManuel, lang),
    onChange: e => setGhManuel(Math.max(1, Math.min(30, Number(e.target.value) || 5)))
  }), /*#__PURE__*/React.createElement("div", {
    className: "minage-range-labels"
  }, /*#__PURE__*/React.createElement("span", null, MU.formaterGh(1, lang)), /*#__PURE__*/React.createElement("span", null, MU.formaterGh(30, lang))))), /*#__PURE__*/React.createElement("section", {
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
    "aria-valuenow": part * 100,
    "aria-valuetext": chance
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: `${part * 100}%`,
      minWidth: part > 0 ? 2 : 0
    }
  })), /*#__PURE__*/React.createElement("p", {
    className: "minage-caption"
  }, I18N.t("minage.parBloc"))), /*#__PURE__*/React.createElement("section", {
    className: "minage-estimates",
    "aria-labelledby": "minage-estimates-title"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "minage-estimates-title"
  }, I18N.t("minage.estimations")), /*#__PURE__*/React.createElement("dl", null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, I18N.t("minage.chanceJour")), /*#__PURE__*/React.createElement("dd", null, MU.formaterProba(MU.probaJour(part), lang))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, I18N.t("minage.fbJour")), /*#__PURE__*/React.createElement("dd", null, MU.formaterFb(MU.fbParJour(part), lang))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, I18N.t("minage.temps")), /*#__PURE__*/React.createElement("dd", null, MU.formaterDuree(MU.tempsMoyenMs(part), lang) || I18N.t("minage.indisponible"))))), /*#__PURE__*/React.createElement("p", {
    className: "minage-network"
  }, I18N.t("minage.reseau", MU.formaterNombre(mineurs, lang)), /*#__PURE__*/React.createElement("br", null), I18N.t("minage.total", MU.formaterGh(autresGh + monGh, lang), chance)), /*#__PURE__*/React.createElement("p", {
    className: "minage-note",
    role: "note"
  }, I18N.t("minage.note")), !manuel && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "minage-toggle",
    onClick: () => setManuel(true)
  }, I18N.t("minage.carteAbsente")), manuel && carte.connu && /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "minage-toggle",
    onClick: () => setManuel(false)
  }, I18N.t("minage.revenir")));
}
Object.assign(window, {
  Minage
});
})();
