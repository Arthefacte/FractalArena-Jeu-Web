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
  const [manuel, setManuel] = useState(() => !carte.connu);
  const [ghManuel, setGhManuel] = useState(5);
  const monGh = manuel ? ghManuel : carte.gh;
  // Le classement n'expose que top/you, aucun total : ces 1 000 autres mineurs
  // sont TOUJOURS une hypothèse fixe, jamais un nombre de joueurs mesuré.
  const mineurs = MU.COMPTES_FALLBACK;
  const autresGh = mineurs * MU.GH_PAR_COMPTE;
  const part = MU.partReseau(monGh, autresGh);
  const chance = MU.formaterProba(MU.probaParBloc(part), lang);
  const nom = carte.connu ? (carte.nom === "Intel" ? I18N.t("minage.intel") : carte.nom) : I18N.t("minage.inconnue");

  return (
    <main className="container minage" aria-labelledby="minage-title">
      <header className="minage-heading">
        <h1 id="minage-title">{I18N.t("minage.titre")}</h1>
        <span>{I18N.t("minage.simulateur")}</span>
      </header>

      <section className="minage-machine" aria-labelledby="minage-machine-title">
        <h2 id="minage-machine-title">{I18N.t("minage.machine")}</h2>
        <div className="minage-machine-values">
          <strong>{nom}</strong>
          <strong className="mono">{MU.formaterGh(monGh, lang)}</strong>
        </div>
        <p className="minage-caption">{I18N.t(manuel ? "minage.manuelle" : "minage.table")}</p>
        {manuel && (
          <div className="minage-manual">
            <label htmlFor="minage-gh">{I18N.t("minage.curseur")}</label>
            <input id="minage-gh" type="range" min="1" max="30" step="0.1" value={ghManuel}
              aria-valuetext={MU.formaterGh(ghManuel, lang)}
              onChange={(e) => setGhManuel(Math.max(1, Math.min(30, Number(e.target.value) || 5)))} />
            <div className="minage-range-labels"><span>{MU.formaterGh(1, lang)}</span><span>{MU.formaterGh(30, lang)}</span></div>
          </div>
        )}
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
      <p className="minage-note" role="note">{I18N.t("minage.note")}</p>
      {!manuel && <button type="button" className="minage-toggle" onClick={() => setManuel(true)}>{I18N.t("minage.carteAbsente")}</button>}
      {manuel && carte.connu && <button type="button" className="minage-toggle" onClick={() => setManuel(false)}>{I18N.t("minage.revenir")}</button>}
    </main>
  );
}

Object.assign(window, { Minage });
