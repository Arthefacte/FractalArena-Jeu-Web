/* Minage : simulation locale uniquement, sans requête ni récompense. */
const { useFA } = window;
const I18N = window.FA_I18N;
const MU = window.FA_MINAGE_UI;
const GPU = window.FA_GPU_HASHRATE;

function Minage() {
  const { g } = useFA();
  const lang = g.lang;
  // Lecture unique au montage : le nom du renderer, puis sa ligne de table.
  // Aucune mesure de charge, aucune requête : c'est la puissance d'usage courant.
  const [carte] = React.useState(() => GPU.resolveGpu(GPU.detectGpu()));
  const monGh = carte.gh;
  // Réseau Fractal RÉEL, lu en direct (mempool.fractalbitcoin.io) : difficulté du
  // dernier bloc, cible de bloc de 10 min et récompense de tête. Aucune donnée inventée.
  const [reseau, setReseau] = React.useState({ etat: "chargement", difficulte: null, reward: null, hauteur: null });
  React.useEffect(() => {
    let vivant = true;
    MU.lireReseau((typeof window !== "undefined" && window.fetch) || (typeof fetch !== "undefined" ? fetch : null))
      .then((r) => { if (vivant) setReseau(r); })
      .catch(() => { if (vivant) setReseau({ etat: "erreur", difficulte: null, reward: null, hauteur: null }); });
    return () => { vivant = false; };
  }, []);
  const reseauH = MU.hashrateReseau(reseau.difficulte, MU.BLOC_MS / 1000);
  const temps = carte.connu && reseauH ? MU.tempsMoyenReseau(monGh, reseauH, MU.BLOC_MS / 1000) : null;
  const fbJour = temps ? (reseau.reward || 0) / 1e8 * 86400000 / temps : null;
  // Chance sur un bloc : monGh / réseau. Elle est minuscule, donc affichée en notation exacte.
  const chance = temps ? MU.formaterProba((monGh * 1e9) / reseauH, lang) : null;
  const nom = carte.nom === "Intel" ? I18N.t("minage.intel") : carte.nom;

  return (
    <main className="container minage" aria-labelledby="minage-title">
      <header className="minage-heading">
        <h1 id="minage-title">{I18N.t("minage.titre")}</h1>
        <span>{I18N.t("minage.simulateur")}</span>
      </header>

      {carte.connu ? <>
        <section className="minage-machine" aria-labelledby="minage-machine-title">
          <h2 id="minage-machine-title">{I18N.t("minage.machine")}</h2>
          <div className="minage-machine-values">
            <strong>{nom}</strong>
            <strong className="mono">{MU.formaterGh(monGh, lang)}</strong>
          </div>
          <p className="minage-caption">{I18N.t("minage.table")}</p>
        </section>

        <section className="minage-chance" aria-labelledby="minage-chance-title">
          <h2 id="minage-chance-title">{I18N.t("minage.chanceBloc")}</h2>
          <strong className="minage-percent mono">{chance || (reseau.etat === "erreur" ? I18N.t("minage.reseauErreur") : "…")}</strong>
          <div className="minage-gauge" role="meter" aria-labelledby="minage-chance-title"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, temps ? (monGh * 1e9) / reseauH * 100 : 0)}
            aria-valuetext={chance || I18N.t("minage.reseauErreur")}>
            {/* La part réelle est de l'ordre de 1e-11 : un trait de 2 px la rend visible,
                la valeur accessible porte le chiffre exact. */}
            <span style={{ width: "2px" }} />
          </div>
          <p className="minage-caption">{I18N.t("minage.parBloc")}</p>
        </section>

        <section className="minage-estimates" aria-labelledby="minage-estimates-title">
          <h2 id="minage-estimates-title">{I18N.t("minage.estimations")}</h2>
          <dl>
            <div><dt>{I18N.t("minage.temps")}</dt><dd>{MU.formaterDuree(temps, lang) || I18N.t("minage.indisponible")}</dd></div>
            <div><dt>{I18N.t("minage.fbJour")}</dt><dd>{MU.formaterFb(fbJour, lang) || I18N.t("minage.indisponible")}</dd></div>
            <div><dt>{I18N.t("minage.reward")}</dt><dd>{reseau.reward ? MU.formaterFb(reseau.reward / 1e8, lang) || "6,25 FB" : I18N.t("minage.indisponible")}</dd></div>
          </dl>
        </section>

        <p className="minage-network">
          {reseau.etat === "ok"
            ? <>{I18N.t("minage.reseauReel", reseau.hauteur ? MU.formaterNombre(reseau.hauteur, lang) : "—")}<br />
              {I18N.t("minage.reseauPuissance", MU.formaterHashrate(reseauH, lang))}</>
            : reseau.etat === "erreur" ? I18N.t("minage.reseauErreur") : I18N.t("minage.reseauChargement")}
        </p>
      </> : (
        <section className="minage-unavailable" aria-labelledby="minage-unavailable-title">
          <h2 id="minage-unavailable-title">{I18N.t("minage.nonDetectee")}</h2>
          <p>{I18N.t("minage.pcRequis")}</p>
        </section>
      )}
      <p className="minage-note" role="note">{I18N.t("minage.note")}</p>
    </main>
  );
}

Object.assign(window, { Minage });
