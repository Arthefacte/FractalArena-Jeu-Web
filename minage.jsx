/* Minage : simulation locale uniquement, sans requête ni récompense. */
const { useState } = React;
const { useFA } = window;
const I18N = window.FA_I18N;
const MU = window.FA_MINAGE_UI;
const GPU = window.FA_GPU_HASHRATE;

function Minage() {
  const { g } = useFA();
  const lang = g.lang;
  const [carte] = useState(() => GPU.resolveGpu(GPU.detectGpu()));
  const monGh = carte.gh;
  // Le classement n'expose que top/you, aucun total : ces 1 000 autres mineurs
  // sont TOUJOURS une hypothèse fixe, jamais un nombre de joueurs mesuré.
  const mineurs = MU.COMPTES_FALLBACK;
  const autresGh = mineurs * MU.GH_PAR_COMPTE;
  const part = carte.connu ? MU.partReseau(monGh, autresGh) : null;
  const chance = carte.connu ? MU.formaterProba(MU.probaParBloc(part), lang) : null;
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
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={part * 100} aria-valuetext={chance}>
            {/* Un trait de 2 px garde une part positive visible ; le texte et la valeur
                accessible portent la probabilité, sans arrondir une petite chance à zéro. */}
            <span style={{ width: `${part * 100}%`, minWidth: part > 0 ? 2 : 0 }} />
          </div>
          <p className="minage-caption">{I18N.t("minage.parBloc")}</p>
        </section>

        <section className="minage-estimates" aria-labelledby="minage-estimates-title">
          <h2 id="minage-estimates-title">{I18N.t("minage.estimations")}</h2>
          <dl>
            <div><dt>{I18N.t("minage.chanceJour")}</dt><dd>{MU.formaterProba(MU.probaJour(part), lang)}</dd></div>
            <div><dt>{I18N.t("minage.fbJour")}</dt><dd>{MU.formaterFb(MU.fbParJour(part), lang)}</dd></div>
            <div><dt>{I18N.t("minage.temps")}</dt><dd>{MU.formaterDuree(MU.tempsMoyenMs(part), lang) || I18N.t("minage.indisponible")}</dd></div>
          </dl>
        </section>

        <p className="minage-network">
          {I18N.t("minage.reseau", MU.formaterNombre(mineurs, lang))}<br />
          {I18N.t("minage.total", MU.formaterGh(autresGh + monGh, lang), chance)}
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
