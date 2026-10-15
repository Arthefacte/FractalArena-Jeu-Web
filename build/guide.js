/* Généré par tools/precompile.mjs depuis guide.jsx — NE PAS ÉDITER. */
(function () {
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
const {
  useState,
  useEffect,
  useRef
} = React;
const {
  useFA,
  Modal
} = window;
const I18N = window.FA_I18N;
const GU = window.FA_GUIDE_UI;
const ACC = window.FA_ACCOUNT;

// La fenêtre de fin dit ce qu'il reste à faire du volet CRYPTO. La décision vit
// dans account-ui.js (`discoveryNextAction`) : ici on ne fait que choisir le
// texte correspondant — deux dérivations de la même règle finiraient par
// diverger, et un écran décrirait une étape déjà franchie.
const CRYPTO_KEY = {
  link: "GUIDE_FIN_CRYPTO_LINK",
  dust: "GUIDE_FIN_CRYPTO_DUST",
  txid: "GUIDE_FIN_CRYPTO_TXID"
};

// Repli local — plus la source. La vérité est sur le COMPTE (ui_state,
// player-ui.js) : ces clés ne servent qu'à ne pas réafficher un guide déjà
// masqué sur ce navigateur avant la bascule, et pendant la seconde où l'état du
// compte n'est pas encore arrivé.
const HIDDEN_KEY = "fractal_arena_guide_hidden_v1";
const TABS_KEY = w => "fractal_arena_guide_tabs_" + w;
// Compteur d'échecs par étape, par compte. C'est un garde-fou d'ERGONOMIE, pas
// une vérité de jeu : il ne donne aucune récompense, il libère seulement le
// passage quand l'étape résiste (le serveur, lui, refuse de passer une étape qui
// n'est pas la courante).
const TRIES_KEY = w => "fractal_arena_guide_tries_" + w;
function lsGet(k, dflt) {
  try {
    const v = localStorage.getItem(k);
    return v == null ? dflt : JSON.parse(v);
  } catch (e) {
    return dflt;
  }
}
function lsSet(k, v) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {}
}
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
window.FA_GUIDE_SHOW = () => {
  try {
    localStorage.removeItem(HIDDEN_KEY);
  } catch (e) {}
  window.dispatchEvent(new Event("fa-guide-show"));
};
function GuideBar() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [disc, setDisc] = useState(null);
  const [hidden, setHidden] = useState(() => lsGet(HIDDEN_KEY, false) === true);
  const [seenTabs, setSeenTabs] = useState(() => unionListe(lsGet(TABS_KEY(g.wallet), []), []));
  const [hintOpen, setHintOpen] = useState(false);
  // Fenêtre de FIN de parcours (« bien joué »), ouverte une fois par compte.
  const [fin, setFin] = useState(false);
  const annonce = useRef(false);
  // État du volet crypto, pour dire à la fin du parcours ce qu'il reste à faire
  // (lier le portefeuille, valider le txid). Chargé une fois par compte : c'est
  // une lecture, et le montant de l'épreuve comme la destination viennent du
  // serveur, jamais du client.
  const [crypto, setCrypto] = useState(null);
  const alive = useRef(true);
  // Verdict courant, lisible depuis un écouteur d'événement : une fermeture
  // d'effet garde l'ancien `res`, le compteur d'échecs viserait l'étape d'avant.
  const resRef = useRef(null);
  const encaisse = useRef({}); // étapes dont l'encaissement est en vol
  const passees = useRef({}); // étapes dont le passage d'office est en vol
  const recale = useRef(null); // dernière étape sur laquelle l'onglet a été recadré

  // État du parcours : à l'arrivée, à chaque changement d'onglet, et après
  // chaque action de jeu (événement posé par l'instrumentation fetch d'app.jsx
  // sur les POST de combat / réclamation). Le serveur recompte à chaque appel :
  // le client ne calcule aucune étape lui-même.
  const refresh = () => {
    actions.guideState().then(r => {
      if (alive.current && r.ok) setDisc(r.data);
    }).catch(() => {});
  };
  useEffect(() => {
    alive.current = true;
    refresh();
    return () => {
      alive.current = false;
    };
  }, [g.wallet]);
  useEffect(() => {
    refresh();
  }, [g.view, g.totalFights]);

  // État d'interface du COMPTE : guide masqué, onglets déjà vus. Il arrive avec
  // la sauvegarde (GET /save → ui_state), donc après le premier rendu — d'où cet
  // effet plutôt qu'un initialiseur de useState. Union avec le repli local : un
  // masquage ou une astuce vue avant la bascule compte pour les deux mondes.
  useEffect(() => {
    const ui = g && g.uiState || {};
    if (ui.guide_hidden === true) setHidden(true);
    setSeenTabs(prev => unionListe(prev, unionListe(lsGet(TABS_KEY(g.wallet), []), ui.guide_tabs)));
  }, [g.wallet, g.uiState]);
  useEffect(() => {
    // Les drapeaux « Tour jouée » / « Arène jouée » ont disparu : les étapes
    // viennent du serveur, il suffit de relire son verdict après un combat.
    //
    // `detail.won === false` : le combat qui vient de se terminer est perdu (la
    // réponse est lue par l'instrumentation fetch d'app.jsx). C'est le seul signal
    // d'échec dont le guide a besoin — un rail ne peut pas laisser sans issue un
    // joueur qui perd trois fois de suite.
    const onProgress = e => {
      if (e && e.detail && e.detail.won === false) compteEchec();
      refresh();
    };
    const onShow = () => {
      setHidden(false);
      lsSet(HIDDEN_KEY, false);
      // Le joueur a demandé à revoir le guide : le drapeau du compte suit, sinon
      // le prochain appareil (ou le prochain rechargement) le remasquerait.
      actions.pushUiState({
        guide_hidden: false
      });
    };
    window.addEventListener("fa-guide-progress", onProgress);
    window.addEventListener("fa-guide-show", onShow);
    return () => {
      window.removeEventListener("fa-guide-progress", onProgress);
      window.removeEventListener("fa-guide-show", onShow);
    };
  }, [g.wallet]);

  // Phrase de contexte : une fois par onglet et par compte.
  useEffect(() => {
    const key = GU.tabHintKey(g.view);
    setHintOpen(!!key && !seenTabs.includes(g.view));
  }, [g.view, seenTabs]);
  const closeHint = () => {
    const next = unionListe(seenTabs, [g.view]);
    setSeenTabs(next);
    lsSet(TABS_KEY(g.wallet), next);
    setHintOpen(false);
    actions.pushUiState({
      guide_tabs: [g.view]
    });
  };
  const res = GU.computeGuide({
    disc,
    g,
    view: g.view
  });
  // Le verdict courant, pour les écouteurs d'événements : ils sont posés une fois
  // et ne peuvent pas lire un `res` recalculé à chaque rendu.
  resRef.current = res;

  // ── Rail : on publie les onglets autorisés (app.jsx refuse tous les autres) ──
  // `window.FA_GUIDE_LOCK` est la SEULE source du verrou : la barre de navigation
  // n'a rien à recalculer et ne fait aucune requête de plus. Un guide MASQUÉ ne
  // verrouille rien — un verrou sans consigne visible serait une prison.
  useEffect(() => {
    const vues = hidden ? null : GU.allowedViews(res);
    window.FA_GUIDE_LOCK = vues ? {
      on: true,
      views: vues,
      step: res.step.id,
      label: I18N.t(GU.instructionKey(res))
    } : {
      on: false,
      views: [],
      step: null,
      label: ""
    };
    try {
      window.dispatchEvent(new Event("fa-guide-lock"));
    } catch (e) {/* ancien navigateur */}
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
    actions.claimDiscovery(id).then(r => {
      if (!alive.current) return;
      if (r && r.ok) {
        toast(I18N.t("GUIDE_PAID", r.reward || res.reward), "good");
        refresh();
      } else delete encaisse.current[id];
    }).catch(() => {
      delete encaisse.current[id];
    });
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
    store[id] = n;
    lsSet(TRIES_KEY(g.wallet), store);
    if (n < GU.FAIL_SKIP || passees.current[id]) return;
    passees.current[id] = true;
    actions.skipGuideStep(id).then(rep => {
      if (!alive.current) return;
      if (rep && rep.ok) {
        toast(I18N.t("GUIDE_SKIPPED"), "info");
        refresh();
      } else delete passees.current[id];
    }).catch(() => {
      delete passees.current[id];
    });
  }

  // ── Un parcours en cours ne reste pas masqué ──
  // Un ✕ cliqué AVANT cette livraison a posé guide_hidden sur le COMPTE : sans ce
  // rattrapage, le joueur garderait un guide invisible et donc plus aucun rail —
  // ni consigne ni verrou, exactement ce qu'on vient corriger.
  useEffect(() => {
    if (!disc || !res.rewarded || res.mode === "done" || !hidden) return;
    setHidden(false);
    lsSet(HIDDEN_KEY, false);
    actions.pushUiState({
      guide_hidden: false
    });
  }, [disc, hidden, res.rewarded, res.mode]);

  // Mise en avant de l'élément à cliquer. Les écrans se re-rendent à leur
  // rythme : on ré-applique la classe toutes les 400 ms tant qu'une cible
  // existe, et on nettoie tout en partant.
  const target = hidden || res.mode === "done" ? null : res.target;
  useEffect(() => {
    const apply = () => {
      document.querySelectorAll("[data-guide].guide-hl").forEach(el => {
        if (el.getAttribute("data-guide") !== target) el.classList.remove("guide-hl");
      });
      if (target) document.querySelectorAll(`[data-guide="${target}"]`).forEach(el => el.classList.add("guide-hl"));
    };
    apply();
    const id = setInterval(apply, 400);
    return () => {
      clearInterval(id);
      document.querySelectorAll("[data-guide].guide-hl").forEach(el => el.classList.remove("guide-hl"));
    };
  }, [target, g.view]);

  // Parcours terminé : le joueur a fini les six étapes. C'est LE moment où on lui
  // dit « bien joué » et où les onglets se déverrouillent (allowedViews rend null
  // sur `done`) : une fenêtre de sortie s'ouvre, une fois par compte.
  //
  // Un dispositif compte : `guide_hidden` est le drapeau DÉJÀ en place pour
  // « parcours fini, on ne réaffiche plus la barre » (il suit le compte, pas le
  // navigateur). La fermer le pose donc pour de bon — ni au rechargement, ni sur
  // un autre appareil la fenêtre ne revient. `annonce` ne sert qu'à éviter de la
  // rouvrir dans la même session si le joueur rappelle le guide par le bouton ?.
  useEffect(() => {
    if (hidden || !disc || !res.rewarded || res.mode !== "done" || annonce.current) return;
    annonce.current = true;
    setFin(true);
  }, [hidden, disc, res.rewarded, res.mode]);
  const fermerFin = () => {
    setFin(false);
    setHidden(true);
    lsSet(HIDDEN_KEY, true);
    actions.pushUiState({
      guide_hidden: true
    });
  };

  // Volet crypto : chargé avec le compte (une lecture, pas de sondage), pour que
  // la fenêtre de fin sache s'il reste quelque chose à faire de ce côté.
  useEffect(() => {
    if (!g.wallet) return;
    actions.discoveryState().then(r => {
      if (alive.current && r.ok) setCrypto(r.data);
    }).catch(() => {});
  }, [g.wallet]);
  // La RÈGLE est appelée, jamais réécrite : « link », « dust », « txid » ou rien.
  const resteCrypto = ACC && crypto ? ACC.discoveryNextAction(crypto, g.linkedWallet, g.accountKind === ACC.KIND_UNISAT) : null;

  // Parcours terminé : un dernier message, puis on s'efface pour de bon (et le
  // compte retient qu'il est terminé, pour les autres appareils). Tant que la
  // fenêtre de fin est ouverte, on ne s'efface pas : elle disparaîtrait avec la
  // barre (le composant rend `null` dès que `hidden` passe à vrai).
  useEffect(() => {
    if (res.mode === "done" && disc && !hidden && !fin) {
      const t = setTimeout(() => {
        setHidden(true);
        lsSet(HIDDEN_KEY, true);
        actions.pushUiState({
          guide_hidden: true
        });
      }, 8000);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [res.mode, disc, hidden, fin]);
  const hide = () => {
    setHidden(true);
    lsSet(HIDDEN_KEY, true);
    actions.pushUiState({
      guide_hidden: true
    });
  };
  const go = () => {
    if (res.view && res.view !== g.view) actions.setView(res.view);
  };
  const hintKey = GU.tabHintKey(g.view);
  const showHint = hintOpen && hintKey && !hidden;
  if (hidden) return null;
  if (res.mode === "done" && !disc) return null; // rien à guider tant que l'état n'est pas connu

  // Le passage en « claim » dure le temps de l'encaissement : plus de « va
  // réclamer dans Quêtes », la somme arrive sur l'écran où le joueur se trouve.
  const text = res.mode === "claim" ? I18N.t("GUIDE_CLAIM_AUTO", res.reward) : I18N.t(GU.instructionKey(res)) + (res.mode === "do" && res.rewarded ? " " + I18N.t("GUIDE_REWARD", res.reward) : "");
  const onRightTab = res.view === g.view;
  return /*#__PURE__*/React.createElement("div", {
    className: "guide-wrap"
  }, /*#__PURE__*/React.createElement("div", {
    className: "guide-bar" + (res.mode === "claim" ? " claim" : "") + (res.mode === "done" ? " done" : ""),
    role: "status"
  }, /*#__PURE__*/React.createElement("span", {
    className: "guide-step"
  }, res.mode === "done" ? I18N.t("GUIDE_LABEL") : I18N.t("GUIDE_STEP", res.index + 1, res.total)), /*#__PURE__*/React.createElement("span", {
    className: "guide-text"
  }, res.mode === "done" ? I18N.t("GUIDE_DONE") : text), res.mode !== "done" && !onRightTab && /*#__PURE__*/React.createElement("button", {
    className: "btn sm btn-fire guide-go",
    onClick: go
  }, I18N.t("GUIDE_GO")), (!res.rewarded || res.mode === "done") && /*#__PURE__*/React.createElement("button", {
    className: "guide-close",
    title: I18N.t("GUIDE_HIDE"),
    "aria-label": I18N.t("GUIDE_HIDE"),
    onClick: hide
  }, "\u2715")), showHint && /*#__PURE__*/React.createElement("div", {
    className: "guide-hint",
    role: "note"
  }, /*#__PURE__*/React.createElement("span", null, "\uD83D\uDCA1 ", I18N.t(hintKey)), /*#__PURE__*/React.createElement("button", {
    className: "guide-hint-ok",
    onClick: closeHint
  }, I18N.t("GUIDE_OK"))), fin && /*#__PURE__*/React.createElement(Modal, {
    onClose: fermerFin,
    accent: "var(--fire)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      textAlign: "center"
    }
  }, I18N.t("GUIDE_FIN_EYEBROW")), /*#__PURE__*/React.createElement("div", {
    className: "tut-icon"
  }, "\uD83C\uDFC6"), /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      textAlign: "center"
    }
  }, I18N.t("GUIDE_FIN_T")), /*#__PURE__*/React.createElement("div", {
    className: "tut-body muted"
  }, I18N.t("GUIDE_FIN_B")), resteCrypto && CRYPTO_KEY[resteCrypto] && /*#__PURE__*/React.createElement("div", {
    className: "guide-fin-reste"
  }, I18N.t(CRYPTO_KEY[resteCrypto])), /*#__PURE__*/React.createElement("div", {
    className: "guide-fin-arene"
  }, I18N.t("GUIDE_FIN_ARENE")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-fire block",
    style: {
      marginTop: 16
    },
    onClick: fermerFin
  }, I18N.t("GUIDE_FIN_OK"))));
}
Object.assign(window, {
  GuideBar
});
})();
