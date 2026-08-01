/* ============================================================
   FRACTAL ARENA — PWA : proposer l'installation, dire la perte de réseau
   Les décisions (qui, quand, quoi) vivent dans pwa-ui.js, éprouvé en node ;
   ici, l'affichage seulement.
   ============================================================ */
const { useState, useEffect } = React;
const { useFA, Modal, SectionHead } = window;
const I18N = window.FA_I18N;
const PWA = window.FA_PWA;

const REFUS_CLE = "fa_pwa_refus";
const lireRefus = () => { try { return Number(localStorage.getItem(REFUS_CLE)) || null; } catch (e) { return null; } };
const ecrireRefus = (t) => { try { localStorage.setItem(REFUS_CLE, String(t)); } catch (e) {} };

/* Le jeu tourne-t-il DÉJÀ depuis l'écran d'accueil ? Reproposer l'installation
   à quelqu'un qui est dans l'app est absurde. `navigator.standalone` est le
   marqueur d'iOS, display-mode celui de tous les autres. */
function estInstalle() {
  try {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true;
  } catch (e) { return false; }
}

function PwaInstallBanner({ prompt, onInstalled }) {
  const { g } = useFA();
  const [refusLe, setRefusLe] = useState(lireRefus);
  const [ferme, setFerme] = useState(false);

  const mode = PWA.installMode({ ua: navigator.userAgent, standalone: estInstalle(), prompt: !!prompt });
  const montrer = !ferme && PWA.doitProposer({
    mode, combats: Number(g.totalFights) || 0, refusLe, maintenant: Date.now(),
  });
  if (!montrer) return null;

  const plusTard = () => { const t = Date.now(); ecrireRefus(t); setRefusLe(t); setFerme(true); };

  /* Sur iOS il n'y a rien à déclencher : Safari n'expose aucune API
     d'installation, on ne peut qu'expliquer le geste. */
  const installer = async () => {
    if (!prompt) return;
    setFerme(true);
    try {
      prompt.prompt();
      const res = await prompt.userChoice;
      if (res && res.outcome === "accepted") onInstalled && onInstalled();
      else plusTard();
    } catch (e) { plusTard(); }
  };

  return (
    <div className="pwa-banner">
      <div className="grow">
        <div className="pwa-banner-t">{I18N.t("PWA_INSTALL_TITRE")}</div>
        <div className="pwa-banner-p">
          {mode === "ios" ? I18N.t("PWA_IOS_GESTE") : I18N.t("PWA_INSTALL_TEXTE")}
        </div>
      </div>
      {mode === "invite" && <button className="btn sm" onClick={installer}>{I18N.t("PWA_INSTALL_OUI")}</button>}
      <button className="btn sm ghost" onClick={plusTard}>{I18N.t("PWA_INSTALL_NON")}</button>
    </div>
  );
}

/* Perte de réseau. On n'invente aucune donnée et on ne rejoue rien depuis le
   cache : les combats sont calculés sur le serveur, sans réseau il n'y a
   simplement pas de partie. On le dit, et on laisse réessayer. */
function PwaOfflineGate({ etat, onReessayer }) {
  if (etat === "ok") return null;
  /* Pas de croix de fermeture : sans réseau il n'y a rien derrière cet écran.
     On ne laisse pas le joueur croire qu'il peut continuer. */
  return (
    <Modal onClose={null}>
      <SectionHead title={I18N.t("PWA_OFFLINE_TITRE")} />
      <p style={{ lineHeight: 1.55 }}>{I18N.t("PWA_OFFLINE_TEXTE")}</p>
      <div style={{ marginTop: 14, display: "flex", justifyContent: "flex-end" }}>
        <button className="btn" onClick={onReessayer}>{I18N.t("PWA_OFFLINE_REESSAYER")}</button>
      </div>
    </Modal>
  );
}

Object.assign(window, { PwaInstallBanner, PwaOfflineGate, estInstallePWA: estInstalle });
