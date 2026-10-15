/* ============================================================
   FRACTAL ARENA — Barre de guidage de la première session
   ============================================================
   Affiche, sous la navigation, l'étape en cours du parcours « Tes premiers
   pas » avec un bouton qui amène au bon onglet, met en avant l'élément à
   cliquer ([data-guide="…"] → classe .guide-hl), et glisse une phrase de
   contexte la première fois qu'un onglet s'ouvre. La décision (quelle étape,
   quelle cible) vit dans guide-ui.js ; ici, uniquement l'affichage.

   Les étapes viennent du SERVEUR, pour tous les comptes (GET /guide/state, qui
   les recompte depuis l'historique réel du joueur). Jusqu'au 26/09/2026, les
   comptes non éligibles au parcours découverte étaient guidés par une lecture
   LOCALE — dont deux drapeaux « Tour jouée » / « Arène jouée » posés en
   localStorage. Dans le navigateur intégré de l'app UniSat (où le joueur va
   pour retirer ses gains), ces deux étapes étaient donc présentées comme à
   faire à quelqu'un qui les avait faites sur son ordinateur : le jeu semblait
   « pas à jour ». Plus rien ici ne dépend du navigateur.

   RAIL DE LA PREMIÈRE SESSION (2026-10-15). La barre disait l'étape sans rien
   retenir : les 14 onglets restaient ouverts au premier écran, le ✕ masquait le
   guide pour de bon (drapeau du COMPTE), et la récompense d'une étape obligeait
   à sortir du rail pour aller la réclamer dans Quêtes. Trois choses ont changé,
   et elles vont ensemble :
   - le verrou d'onglets (guide-ui.allowedViews) est publié sur `window` pour
     app.jsx, qui refuse toute navigation hors de l'étape en cours ;
   - la récompense est encaissée ICI, à l'instant où le serveur dit l'étape
     accomplie : le joueur ne quitte plus son écran pour être payé ;
   - le ✕ disparaît pendant le parcours (un rail qu'on peut masquer n'est pas un
     rail) et une étape qui résiste FAIL_SKIP fois se valide d'office, sinon le
     verrou ferait mur.
   ============================================================ */
const { useState, useEffect, useRef } = React;
const { useFA } = window;
const I18N = window.FA_I18N;
const GU = window.FA_GUIDE_UI;

// Repli local — plus la source. La vérité est sur le COMPTE (ui_state,
// player-ui.js) : ces clés ne servent qu'à ne pas réafficher un guide déjà
// masqué sur ce navigateur avant la bascule, et pendant la seconde où l'état du
// compte n'est pas encore arrivé.
const HIDDEN_KEY = "fractal_arena_guide_hidden_v1";
const TABS_KEY = (w) => "fractal_arena_guide_tabs_" + w;
// Compteur d'échecs par étape, par compte. C'est un garde-fou d'ERGONOMIE, pas
// une vérité de jeu : il ne donne aucune récompense, il libère seulement le
// passage quand l'étape résiste (le serveur, lui, refuse de passer une étape qui
// n'est pas la courante).
const TRIES_KEY = (w) => "fractal_arena_guide_tries_" + w;

function lsGet(k, dflt) { try { const v = localStorage.getItem(k); return v == null ? dflt : JSON.parse(v); } catch (e) { return dflt; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function unionListe(a, b) {
  const out = [];
  for (const x of (Array.isArray(a) ? a : []).concat(Array.isArray(b) ? b : [])) {
    if (typeof x === "string" && !out.includes(x)) out.push(x);
  }
  return out;
}

// Ré-affiche le guide (appelé à la fermeture du tutoriel « ? »). Le drapeau du
// COMPTE est remis à false par le composant, seul à avoir les actions réseau ;
// ici on libère le repli local et on prévient l'écouteur.
window.FA_GUIDE_SHOW = () => { try { localStorage.removeItem(HIDDEN_KEY); } catch (e) {} window.dispatchEvent(new Event("fa-guide-show")); };

function GuideBar() {
  const { g, actions, toast } = useFA();
  const [disc, setDisc] = useState(null);
  const [hidden, setHidden] = useState(() => lsGet(HIDDEN_KEY, false) === true);
  const [seenTabs, setSeenTabs] = useState(() => unionListe(lsGet(TABS_KEY(g.wallet), []), []));
  const [hintOpen, setHintOpen] = useState(false);
  const alive = useRef(true);
  // Verdict courant, lisible depuis un écouteur d'événement : une fermeture
  // d'effet garde l'ancien `res`, le compteur d'échecs viserait l'étape d'avant.
  const resRef = useRef(null);
  const encaisse = useRef({});   // étapes dont l'encaissement est en vol
  const passees = useRef({});    // étapes dont le passage d'office est en vol
  const recale = useRef(null);   // dernière étape sur laquelle l'onglet a été recadré

  // État du parcours : à l'arrivée, à chaque changement d'onglet, et après
  // chaque action de jeu (événement posé par l'instrumentation fetch d'app.jsx
  // sur les POST de combat / réclamation). Le serveur recompte à chaque appel :
  // le client ne calcule aucune étape lui-même.
  const refresh = () => {
    actions.guideState().then((r) => { if (alive.current && r.ok) setDisc(r.data); }).catch(() => {});
  };
  useEffect(() => { alive.current = true; refresh(); return () => { alive.current = false; }; }, [g.wallet]);
  useEffect(() => { refresh(); }, [g.view, g.totalFights]);

  // État d'interface du COMPTE : guide masqué, onglets déjà vus. Il arrive avec
  // la sauvegarde (GET /save → ui_state), donc après le premier rendu — d'où cet
  // effet plutôt qu'un initialiseur de useState. Union avec le repli local : un
  // masquage ou une astuce vue avant la bascule compte pour les deux mondes.
  useEffect(() => {
    const ui = (g && g.uiState) || {};
    if (ui.guide_hidden === true) setHidden(true);
    setSeenTabs((prev) => unionListe(prev, unionListe(lsGet(TABS_KEY(g.wallet), []), ui.guide_tabs)));
  }, [g.wallet, g.uiState]);

  useEffect(() => {
    // Les drapeaux « Tour jouée » / « Arène jouée » ont disparu : les étapes
    // viennent du serveur, il suffit de relire son verdict après un combat.
    //
    // `detail.won === false` : le combat qui vient de se terminer est perdu (la
    // réponse est lue par l'instrumentation fetch d'app.jsx). C'est le seul signal
    // d'échec dont le guide a besoin — un rail ne peut pas laisser sans issue un
    // joueur qui perd trois fois de suite.
    const onProgress = (e) => {
      if (e && e.detail && e.detail.won === false) compteEchec();
      refresh();
    };
    const onShow = () => {
      setHidden(false);
      lsSet(HIDDEN_KEY, false);
      // Le joueur a demandé à revoir le guide : le drapeau du compte suit, sinon
      // le prochain appareil (ou le prochain rechargement) le remasquerait.
      actions.pushUiState({ guide_hidden: false });
    };
    window.addEventListener("fa-guide-progress", onProgress);
    window.addEventListener("fa-guide-show", onShow);
    return () => { window.removeEventListener("fa-guide-progress", onProgress); window.removeEventListener("fa-guide-show", onShow); };
  }, [g.wallet]);

  // Phrase de contexte : une fois par onglet et par compte.
  useEffect(() => {
    const key = GU.tabHintKey(g.view);
    setHintOpen(!!key && !seenTabs.includes(g.view));
  }, [g.view, seenTabs]);
  const closeHint = () => {
    const next = unionListe(seenTabs, [g.view]);
    setSeenTabs(next); lsSet(TABS_KEY(g.wallet), next); setHintOpen(false);
    actions.pushUiState({ guide_tabs: [g.view] });
  };

  const res = GU.computeGuide({ disc, g, view: g.view });
  // Le verdict courant, pour les écouteurs d'événements : ils sont posés une fois
  // et ne peuvent pas lire un `res` recalculé à chaque rendu.
  resRef.current = res;

  // ── Rail : on publie les onglets autorisés (app.jsx refuse tous les autres) ──
  // `window.FA_GUIDE_LOCK` est la SEULE source du verrou : la barre de navigation
  // n'a rien à recalculer et ne fait aucune requête de plus. Un guide MASQUÉ ne
  // verrouille rien — un verrou sans consigne visible serait une prison.
  useEffect(() => {
    const vues = hidden ? null : GU.allowedViews(res);
    window.FA_GUIDE_LOCK = vues
      ? { on: true, views: vues, step: res.step.id, label: I18N.t(GU.instructionKey(res)) }
      : { on: false, views: [], step: null, label: "" };
    try { window.dispatchEvent(new Event("fa-guide-lock")); } catch (e) { /* ancien navigateur */ }
  }, [hidden, res.mode, res.rewarded, res.view, res.target, res.step && res.step.id]);

  // Le rail ne laisse pas le joueur ailleurs qu'où l'étape se joue : un état
  // sauvegardé (ou un onglet ouvert avant l'arrivée du verdict) peut être hors
  // parcours. On recale UNE fois par étape, et seulement si l'onglet courant n'est
  // pas autorisé — sur Équipe alors que la consigne y vit, on ne bouge personne.
  useEffect(() => {
    if (hidden || res.mode !== "do" || !res.view) return;
    if (recale.current === res.step.id) return;
    const vues = GU.allowedViews(res) || [];
    if (g.view !== res.view && !vues.includes(g.view)) {
      recale.current = res.step.id;
      actions.setView(res.view);
    }
  }, [g.view, hidden, res.mode, res.view, res.step && res.step.id]);

  // ── Récompense encaissée ICI (plus d'aller-retour dans Quêtes) ──
  // Le serveur reste seul juge (POST /discovery/claim recompte l'étape et
  // connaît le montant) ; ce qu'on supprime, c'est la sortie de rail. Le garde
  // `encaisse` empêche deux appels pour la même étape pendant que la réponse
  // voyage, et un échec réseau se réessaie au verdict suivant.
  useEffect(() => {
    if (hidden || !res.rewarded || res.mode !== "claim" || !res.step) return;
    const id = res.step.id;
    if (encaisse.current[id]) return;
    encaisse.current[id] = true;
    actions.claimDiscovery(id).then((r) => {
      if (!alive.current) return;
      if (r && r.ok) {
        toast(I18N.t("GUIDE_PAID", r.reward || res.reward), "good");
        refresh();
      } else delete encaisse.current[id];
    }).catch(() => { delete encaisse.current[id]; });
  }, [hidden, res.rewarded, res.mode, res.reward, res.step && res.step.id]);

  // ── Trois échecs et l'étape se valide d'office ──
  // Un rail verrouillé ne doit JAMAIS faire mur. Un échec = un combat perdu
  // pendant que cette étape est la courante (signal `fa-guide-progress` porté par
  // `won === false`). Le compteur vit par compte et par étape : trois échecs
  // répartis sur trois visites restent trois échecs. AUCUNE récompense n'est
  // versée au passage — sinon il suffirait de perdre exprès pour encaisser les
  // 675 FA du parcours. Le serveur tranche quand même : il refuse de passer une
  // étape qui n'est pas la courante.
  function compteEchec() {
    const r = resRef.current;
    if (!r || !r.step || !r.rewarded || r.mode !== "do") return;
    const id = r.step.id;
    const store = lsGet(TRIES_KEY(g.wallet), {});
    const n = Number(store[id] || 0) + 1;
    store[id] = n; lsSet(TRIES_KEY(g.wallet), store);
    if (n < GU.FAIL_SKIP || passees.current[id]) return;
    passees.current[id] = true;
    actions.skipGuideStep(id).then((rep) => {
      if (!alive.current) return;
      if (rep && rep.ok) { toast(I18N.t("GUIDE_SKIPPED"), "info"); refresh(); }
      else delete passees.current[id];
    }).catch(() => { delete passees.current[id]; });
  }

  // ── Un parcours en cours ne reste pas masqué ──
  // Un ✕ cliqué AVANT cette livraison a posé guide_hidden sur le COMPTE : sans ce
  // rattrapage, le joueur garderait un guide invisible et donc plus aucun rail —
  // ni consigne ni verrou, exactement ce qu'on vient corriger.
  useEffect(() => {
    if (!disc || !res.rewarded || res.mode === "done" || !hidden) return;
    setHidden(false); lsSet(HIDDEN_KEY, false);
    actions.pushUiState({ guide_hidden: false });
  }, [disc, hidden, res.rewarded, res.mode]);

  // Mise en avant de l'élément à cliquer. Les écrans se re-rendent à leur
  // rythme : on ré-applique la classe toutes les 400 ms tant qu'une cible
  // existe, et on nettoie tout en partant.
  const target = hidden || res.mode === "done" ? null : res.target;
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll("[data-guide].guide-hl").forEach((el) => { if (el.getAttribute("data-guide") !== target) el.classList.remove("guide-hl"); });
      if (target) document.querySelectorAll(`[data-guide="${target}"]`).forEach((el) => el.classList.add("guide-hl"));
    };
    apply();
    const id = setInterval(apply, 400);
    return () => { clearInterval(id); document.querySelectorAll("[data-guide].guide-hl").forEach((el) => el.classList.remove("guide-hl")); };
  }, [target, g.view]);

  // Parcours terminé : un dernier message, puis on s'efface pour de bon (et le
  // compte retient qu'il est terminé, pour les autres appareils).
  useEffect(() => {
    if (res.mode === "done" && disc && !hidden) {
      const t = setTimeout(() => { setHidden(true); lsSet(HIDDEN_KEY, true); actions.pushUiState({ guide_hidden: true }); }, 8000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [res.mode, disc, hidden]);

  const hide = () => {
    setHidden(true); lsSet(HIDDEN_KEY, true);
    actions.pushUiState({ guide_hidden: true });
  };
  const go = () => { if (res.view && res.view !== g.view) actions.setView(res.view); };

  const hintKey = GU.tabHintKey(g.view);
  const showHint = hintOpen && hintKey && !hidden;
  if (hidden) return null;
  if (res.mode === "done" && !disc) return null; // rien à guider tant que l'état n'est pas connu

  // Le passage en « claim » dure le temps de l'encaissement : plus de « va
  // réclamer dans Quêtes », la somme arrive sur l'écran où le joueur se trouve.
  const text = res.mode === "claim"
    ? I18N.t("GUIDE_CLAIM_AUTO", res.reward)
    : I18N.t(GU.instructionKey(res)) + (res.mode === "do" && res.rewarded ? " " + I18N.t("GUIDE_REWARD", res.reward) : "");
  const onRightTab = res.view === g.view;
  return (
    <div className="guide-wrap">
      <div className={"guide-bar" + (res.mode === "claim" ? " claim" : "") + (res.mode === "done" ? " done" : "")} role="status">
        <span className="guide-step">{res.mode === "done" ? I18N.t("GUIDE_LABEL") : I18N.t("GUIDE_STEP", res.index + 1, res.total)}</span>
        <span className="guide-text">{res.mode === "done" ? I18N.t("GUIDE_DONE") : text}</span>
        {res.mode !== "done" && !onRightTab && (
          <button className="btn sm btn-fire guide-go" onClick={go}>{I18N.t("GUIDE_GO")}</button>
        )}
        {/* Un rail qu'on peut masquer n'est pas un rail : pendant le parcours
            récompensé, le ✕ n'existe pas. Il revient pour les comptes hors
            parcours (vétérans) et sur le dernier message, à la fin. */}
        {(!res.rewarded || res.mode === "done") && (
          <button className="guide-close" title={I18N.t("GUIDE_HIDE")} aria-label={I18N.t("GUIDE_HIDE")} onClick={hide}>✕</button>
        )}
      </div>
      {showHint && (
        <div className="guide-hint" role="note">
          <span>💡 {I18N.t(hintKey)}</span>
          <button className="guide-hint-ok" onClick={closeHint}>{I18N.t("GUIDE_OK")}</button>
        </div>
      )}
    </div>
  );
}

Object.assign(window, { GuideBar });
