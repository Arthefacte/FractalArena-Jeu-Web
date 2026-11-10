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
  // Solitaire : le joueur est seul, sa part vaut 1. Aucun réseau simulé n'entre
  // dans ce calcul — seule sa machine et la cadence de bloc comptent.
  const PART_SOLO = 1;
  const chance = carte.connu ? MU.formaterProba(MU.probaParBloc(PART_SOLO), lang) : null;
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
          <strong className="minage-percent mono">{chance}</strong>
          <div className="minage-gauge" role="meter" aria-labelledby="minage-chance-title"
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={PART_SOLO * 100} aria-valuetext={chance}>
            <span style={{ width: `${PART_SOLO * 100}%` }} />
          </div>
          <p className="minage-caption">{I18N.t("minage.parBloc")}</p>
        </section>

        <section className="minage-estimates" aria-labelledby="minage-estimates-title">
          <h2 id="minage-estimates-title">{I18N.t("minage.estimations")}</h2>
          <dl>
            <div><dt>{I18N.t("minage.temps")}</dt><dd>{MU.formaterDuree(MU.tempsMoyenMs(PART_SOLO), lang) || I18N.t("minage.indisponible")}</dd></div>
            <div><dt>{I18N.t("minage.fbJour")}</dt><dd>{MU.formaterFb(MU.fbParJour(PART_SOLO), lang)}</dd></div>
            <div><dt>{I18N.t("minage.chanceJour")}</dt><dd>{MU.formaterProba(MU.probaJour(PART_SOLO), lang)}</dd></div>
          </dl>
        </section>

        <p className="minage-network">{I18N.t("minage.solo")}</p>
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
