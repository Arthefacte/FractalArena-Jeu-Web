/* Généré par tools/precompile.mjs depuis maj.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Bandeau « nouvelle version »
   Les decisions (comparaison, memoire du « plus tard ») vivent dans maj-ui.js,
   testees sans DOM ; ici on sonde et on peint.

   Ce que ca repare : le joueur qui execute un client perime dans le navigateur
   integre de l'app UniSat (ou une PWA installee qui n'a jamais repris son
   index.html). Le jeu ne peut pas se remplacer tout seul — mais il peut le dire.
   ============================================================ */
const {
  useState,
  useEffect,
  useCallback
} = React;
const I18N = window.FA_I18N;
const MAJ = window.FA_MAJ;
function MiseAJourBanner() {
  const [servie, setServie] = useState(null);
  const [vue, setVue] = useState(() => MAJ ? MAJ.vueLe() : "");
  const [occupe, setOccupe] = useState(false);
  const verifier = useCallback(() => {
    if (!MAJ) return;
    // Une signature UniSat ou un combat en cours : recharger maintenant le perdrait.
    // Le drapeau vit sur <body> (quiz.jsx) et couvre aussi les surcouches pleine page.
    setOccupe(typeof window.quizEstOccupe === "function" ? !!window.quizEstOccupe() : false);
    /* `cache: "no-store"` n'est pas un detail : sans lui, le cache HTTP du webview
       repondrait avec la version qu'on cherche justement a detecter, et la sonde ne
       verrait jamais rien. Le parametre aleatoire sert les caches intermediaires. */
    fetch(MAJ.FICHIER + "?cb=" + Date.now(), {
      cache: "no-store"
    }).then(r => r && r.ok ? r.text() : null).then(t => {
      if (t === null) return;
      const v = MAJ.parseVersion(t);
      if (v !== null) setServie(v);
    }).catch(() => {}); // injoignable : aucune consequence, le prochain sondage reessaiera
  }, []);
  useEffect(() => {
    verifier();
    /* Deux declencheurs, et pas de sondage en boucle courte : le retour au premier
       plan est le moment ou un webview vient de recharger sa page (donc le cas le
       plus frequent), et l'intervalle couvre une session laissee ouverte. */
    const surVisibilite = () => {
      if (!document.hidden) verifier();
    };
    document.addEventListener("visibilitychange", surVisibilite);
    const id = setInterval(verifier, MAJ ? MAJ.INTERVALLE_MS : 600000);
    return () => {
      document.removeEventListener("visibilitychange", surVisibilite);
      clearInterval(id);
    };
  }, [verifier]);
  const locale = MAJ ? MAJ.versionLocale() : null;
  if (!MAJ || !MAJ.doitProposer({
    servie,
    locale,
    vueLe: vue,
    occupe
  })) return null;
  const plusTard = () => {
    MAJ.marquerVue(servie);
    setVue(String(servie));
  };
  const recharger = () => {
    window.location.reload();
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "maj-bar",
    role: "status"
  }, /*#__PURE__*/React.createElement("span", {
    className: "maj-bar-txt mono"
  }, I18N.t("MAJ_DISPO", servie)), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "maj-bar-btn",
    onClick: recharger
  }, I18N.t("MAJ_RECHARGER")), /*#__PURE__*/React.createElement("button", {
    type: "button",
    className: "maj-bar-x",
    title: I18N.t("MAJ_PLUS_TARD"),
    "aria-label": I18N.t("MAJ_PLUS_TARD"),
    onClick: plusTard
  }, "\u2715"));
}
Object.assign(window, {
  MiseAJourBanner
});
})();
