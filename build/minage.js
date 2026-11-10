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
  // Réseau Fractal RÉEL, lu en direct (mempool.fractalbitcoin.io) : difficulté du
  // dernier bloc, cible de bloc de 10 min et récompense de tête. Aucune donnée inventée.
  const [reseau, setReseau] = React.useState({
    etat: "chargement",
    difficulte: null,
    reward: null,
    hauteur: null
  });
  React.useEffect(() => {
    let vivant = true;
    MU.lireReseau(typeof window !== "undefined" && window.fetch || (typeof fetch !== "undefined" ? fetch : null)).then(r => {
      if (vivant) setReseau(r);
    }).catch(() => {
      if (vivant) setReseau({
        etat: "erreur",
        difficulte: null,
        reward: null,
        hauteur: null
      });
    });
    return () => {
      vivant = false;
    };
  }, []);
  const reseauH = MU.hashrateReseau(reseau.difficulte, MU.BLOC_MS / 1000);
  const temps = carte.connu && reseauH ? MU.tempsMoyenReseau(monGh, reseauH, MU.BLOC_MS / 1000) : null;
  const fbJour = temps ? (reseau.reward || 0) / 1e8 * 86400000 / temps : null;
  // Chance sur un bloc : monGh / réseau. Elle est minuscule, donc affichée en notation exacte.
  const chance = temps ? MU.formaterProba(monGh * 1e9 / reseauH, lang) : null;
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
  }, I18N.t(carte.mesure ? "minage.tableMesure" : "minage.tableEstime"))), /*#__PURE__*/React.createElement("section", {
    className: "minage-chance",
    "aria-labelledby": "minage-chance-title"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "minage-chance-title"
  }, I18N.t("minage.chanceBloc")), /*#__PURE__*/React.createElement("strong", {
    className: "minage-percent mono"
  }, chance || (reseau.etat === "erreur" ? I18N.t("minage.reseauErreur") : "…")), /*#__PURE__*/React.createElement("div", {
    className: "minage-gauge",
    role: "meter",
    "aria-labelledby": "minage-chance-title",
    "aria-valuemin": 0,
    "aria-valuemax": 100,
    "aria-valuenow": Math.min(100, temps ? monGh * 1e9 / reseauH * 100 : 0),
    "aria-valuetext": chance || I18N.t("minage.reseauErreur")
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: "2px"
    }
  })), /*#__PURE__*/React.createElement("p", {
    className: "minage-caption"
  }, I18N.t("minage.parBloc"))), /*#__PURE__*/React.createElement("section", {
    className: "minage-estimates",
    "aria-labelledby": "minage-estimates-title"
  }, /*#__PURE__*/React.createElement("h2", {
    id: "minage-estimates-title"
  }, I18N.t("minage.estimations")), /*#__PURE__*/React.createElement("dl", null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, I18N.t("minage.temps")), /*#__PURE__*/React.createElement("dd", null, MU.formaterDuree(temps, lang) || I18N.t("minage.indisponible"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, I18N.t("minage.fbJour")), /*#__PURE__*/React.createElement("dd", null, MU.formaterFb(fbJour, lang) || I18N.t("minage.indisponible"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("dt", null, I18N.t("minage.reward")), /*#__PURE__*/React.createElement("dd", null, reseau.reward ? MU.formaterFb(reseau.reward / 1e8, lang) || "6,25 FB" : I18N.t("minage.indisponible"))))), /*#__PURE__*/React.createElement("p", {
    className: "minage-network"
  }, reseau.etat === "ok" ? /*#__PURE__*/React.createElement(React.Fragment, null, I18N.t("minage.reseauReel", reseau.hauteur ? MU.formaterNombre(reseau.hauteur, lang) : "—"), /*#__PURE__*/React.createElement("br", null), I18N.t("minage.reseauPuissance", MU.formaterHashrate(reseauH, lang))) : reseau.etat === "erreur" ? I18N.t("minage.reseauErreur") : I18N.t("minage.reseauChargement"))) : /*#__PURE__*/React.createElement("section", {
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
