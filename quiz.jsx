/* ============================================================
   FRACTAL ARENA — Quiz éducatif : bulle de question et bandeau des dons.
   La logique décidable vit dans quiz-ui.js (pure, testée sans DOM) ; ici on
   ne fait que peindre et appeler le serveur.
   Spec : repo serveur, docs/superpowers/specs/2026-08-06-quiz-educatif-design.md
   ============================================================ */
const { useState, useEffect, useRef } = React;
const { useFA, cx, FaText } = window;
const I18N = window.FA_I18N;
const QUIZ = window.FA_QUIZ_UI;

// ---- drapeau d'occupation ----
// Un seul point de vérité : la classe `fa-busy` sur <body>. Les écrans qui
// jouent un combat en ligne (Fosse, Campagne) et les actions qui ouvrent une
// signature UniSat la posent le temps qu'il faut ; le quiz la lit avant de
// proposer une bulle. Un Set de sources, sinon deux sources concurrentes se
// retireraient mutuellement le drapeau.
const _busy = new Set();
function setBusy(source, actif) {
  if (actif) _busy.add(source); else _busy.delete(source);
  if (typeof document !== "undefined" && document.body) {
    document.body.classList.toggle("fa-busy", _busy.size > 0);
  }
}
window.FA_SET_BUSY = setBusy;

// Occupé = drapeau explicite, ou n'importe quelle surcouche plein écran :
// `.overlay` couvre à la fois les modales (components.jsx) et l'écran de
// combat d'Arène (arene-battle.jsx). Une bulle par-dessus serait une coupure.
function estOccupe() {
  if (typeof document === "undefined") return false;
  if (document.body && document.body.classList.contains("fa-busy")) return true;
  return !!document.querySelector(".overlay");
}

// ---- la bulle ----

function QuizToast() {
  const { g, actions, toast } = useFA();
  const [question, setQuestion] = useState(null);   // { id, q, c[], revision }
  const [verdict, setVerdict] = useState(null);     // réponse du serveur
  const [envoi, setEnvoi] = useState(false);        // une seule réponse à la fois
  const [donne, setDonne] = useState(false);        // don déjà effectué
  const [restant, setRestant] = useState(0);       // secondes affichées par le décompte
  const [pret, setPret] = useState(false);          // un quiz attend d'être ouvert
  const lastAskAt = useRef(0);
  const finAt = useRef(0);

  const ouvert = !!question;
  // Une bonne réponse hors révision rapporte : le joueur doit alors choisir la
  // destination des FA. Tant que ce choix est à l'écran, la bulle l'attend.
  // Révisions incluses (décision user 26-08) : tout gain réel ouvre le choix.
  const gagne = !!(verdict && verdict.correct && verdict.reward > 0);
  const choixEnAttente = gagne && !donne;
  // Le minuteur vit dans une closure figée au rendu où il a démarré ; sans cette
  // ref il lirait un choixEnAttente périmé et confirmerait une conservation après
  // un don réussi.
  const choixRef = useRef(false);
  choixRef.current = choixEnAttente;

  // Plus aucune bulle spontanée (retour joueur, 15/08 : « les notifications qui
  // popent, c'est relou ») : la minuterie ne fait qu'allumer la pastille ❓.
  // shouldAsk() tranche toujours — même logique pure, seul le geste d'ouvrir
  // a changé de main : il appartient au joueur.
  useEffect(() => {
    const id = setInterval(() => {
      const etat = {
        lastAskAt: lastAskAt.current,
        toastOpen: !!question,
        busy: estOccupe(),
        wallet: g.wallet,
      };
      // La pastille est COLLANTE : une fois allumée elle ne s'éteint que quand le
      // joueur ouvre le quiz (ouvrirRef) ou se déconnecte. Sans ça elle clignotait
      // (constat joueur, 21/08) : shouldAsk retombe à false dès qu'un .overlay est
      // dans le DOM — une modale, un combat d'Arène — et se rallume à sa
      // fermeture, une fois par seconde. Le critère `busy` gardait la BULLE de
      // s'ouvrir par-dessus le jeu ; il a survécu au passage en pastille du 15/08,
      // où il n'a plus de raison d'être : une pastille discrète n'interrompt
      // personne. On le laisse décider du PREMIER allumage, pas de l'extinction.
      setPret((p) => {
        if (!etat.wallet) return false;
        return p || QUIZ.shouldAsk(etat, Date.now());
      });
    }, 1000);
    return () => clearInterval(id);
  }, [g.wallet, question]);

  // Le header mobile peint la pastille : il apprend l'état par événement,
  // comme le badge de non-lus du salon (fa:room-unread).
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("fa:quiz-ready", { detail: pret }));
  }, [pret]);

  // Ouverture à la demande : pastille du header (fa:open-quiz) ou bulle
  // flottante desktop. La question n'est fetchée qu'à ce moment-là.
  const ouvrirRef = useRef(null);
  ouvrirRef.current = async () => {
    if (question || envoi || !pret) return;
    lastAskAt.current = Date.now(); // le cooldown repart, même si le fetch échoue
    setPret(false);
    const r = await actions.fetchQuizQuestion();
    if (!r.ok || !r.data || !r.data.question) return;
    setVerdict(null);
    setDonne(false);
    setQuestion(r.data.question);
  };
  useEffect(() => {
    const h = () => { if (ouvrirRef.current) ouvrirRef.current(); };
    window.addEventListener("fa:open-quiz", h);
    return () => window.removeEventListener("fa:open-quiz", h);
  }, []);

  // Le décompte EST l'horloge de la bulle : ce que le joueur voit descendre est
  // ce qui la ferme. Il repart à 30 s quand la réponse arrive — lire l'explication
  // et choisir la destination est une étape à part entière. Une question qu'on
  // laisse expirer n'est PAS consommée (rien n'est envoyé au serveur) ; un choix
  // qu'on laisse expirer vaut « garder » : les FA sont déjà crédités, rien n'est
  // offert au pool.
  useEffect(() => {
    if (!ouvert) { setRestant(0); return undefined; }
    finAt.current = Date.now() + QUIZ.QUIZ_TOAST_MS;
    setRestant(QUIZ.restantSecondes(finAt.current, Date.now()));
    const id = setInterval(() => {
      const r = QUIZ.restantSecondes(finAt.current, Date.now());
      setRestant(r);
      // Laisser filer le décompte, c'est garder : même confirmation qu'un clic,
      // sinon le cas où le joueur est le plus perdu est celui qui ne dit rien.
      if (r <= 0) { if (choixRef.current) garder(); else fermer(); }
    }, 250);
    return () => clearInterval(id);
  }, [ouvert, verdict]);

  function fermer() {
    setQuestion(null);
    setVerdict(null);
    setEnvoi(false);
    setDonne(false);
    lastAskAt.current = Date.now(); // la prochaine bulle repart d'un intervalle plein
  }

  async function repondre(i) {
    if (envoi || verdict) return;
    setEnvoi(true);
    let r = await actions.answerQuiz(question.id, i);
    if (!r.ok && r.reason === "retry") r = await actions.answerQuiz(question.id, i);
    setEnvoi(false);
    if (!r.ok) { fermer(); return; }
    setVerdict(r.data);
  }

  // Les deux issues se confirment pareil. « Garder » n'a rien à envoyer — les FA
  // sont déjà crédités en base par /quiz/answer — mais c'est ICI que le bandeau
  // les affiche : tant que le choix est ouvert, le solde ne bouge pas, sinon
  // « garder » ressemble à un acquis et « offrir » à une reprise.
  function garder() {
    actions.creditQuizGain((verdict && verdict.reward) || 0);
    toast(<FaText text={I18N.t("QUIZ_KEPT", (verdict && verdict.reward) || 0)} s={12} />, "good");
    fermer();
  }

  // « Offrir » reprend les 10 FA déjà crédités et les verse au pool (fenêtre de
  // 60 s côté serveur).
  async function offrir() {
    if (donne) return;
    let r = await actions.donateQuiz(question.id);
    if (!r.ok && r.reason === "retry") r = await actions.donateQuiz(question.id);
    if (r.ok) {
      setDonne(true);
      // Message factuel, jamais « tu soutiens le cours ». Le montant passe par
      // FaText (le toast rend son message tel quel) : logo du token, pas « FA ».
      toast(<FaText text={I18N.t("QUIZ_GIVEN", (r.data && r.data.granted_pool) || 0)} s={12} />, "good");
      // Les jauges de rachat n'interrogent le serveur qu'une fois par minute :
      // sans ce signal, la jauge ne bougerait que bien après le clic et
      // l'animation ne se rattacherait plus au geste du joueur.
      window.dispatchEvent(new CustomEvent("fa:buyback-refresh"));
    } else if (r.reason === "network") {
      // La requête est partie sans que la réponse revienne : le serveur a pu
      // commettre le don. Annoncer « tes FA sont restés » serait un mensonge une
      // fois sur deux — on renvoie le joueur à la seule source de vérité.
      toast(I18N.t("QUIZ_GIVE_UNSURE"), "bad");
    } else {
      // Le serveur a répondu non (compte non vérifié, fenêtre écoulée, 429…) : là on
      // sait que rien n'est parti — les FA restent au joueur, le bandeau doit donc
      // les afficher comme s'il avait gardé. Jamais l'erreur brute au joueur.
      //
      // Le compte non vérifié on-chain est LA cause fréquente, et la seule qui
      // demande un geste au joueur (les pools de rachat déclenchent des rachats
      // réels : ils n'acceptent que les comptes vérifiés). Le fondre dans « don
      // impossible » lui laissait croire à une panne du quiz.
      const cle = r.reason === "compte_non_verifie" ? "QUIZ_GIVE_UNVERIFIED" : "QUIZ_GIVE_REFUSED";
      actions.creditQuizGain((verdict && verdict.reward) || 0);
      toast(<FaText text={I18N.t(cle, (verdict && verdict.reward) || 0)} s={12} />, "bad");
    }
    fermer();
  }

  if (!g.wallet) return null;

  // Desktop : une petite bulle ❓ apparaît quand un quiz est prêt (le header
  // mobile a sa propre pastille, cette bulle y est masquée par mobile.css).
  if (!question) {
    return pret ? (
      <button
        className="quiz-fab"
        aria-label={I18N.t("QUIZ_FAB_LABEL")}
        onClick={() => { if (ouvrirRef.current) ouvrirRef.current(); }}
      >
        <span aria-hidden="true">❓</span>
      </button>
    ) : null;
  }

  return (
    <div className="quiz-toast" role="dialog" aria-live="polite">
      {/* Le décompte : une barre qui se vide et les secondes en clair. La bulle
          ne disparaît jamais sans que le joueur ait pu la voir venir. */}
      <div className="quiz-countdown" aria-hidden="true">
        <div
          className="quiz-countdown-bar"
          style={{ width: (restant / (QUIZ.QUIZ_TOAST_MS / 1000)) * 100 + "%" }}
        />
      </div>
      <div className="quiz-head">
        {/* Révision : la bulle annonce ce qu'elle peut encore payer (le serveur
            envoie review_left/review_reward ; absents = vieux serveur → plafond). */}
        {question.revision
          ? <div className="quiz-tag">{question.review_left > 0
              ? I18N.t("QUIZ_REVIEW_PAID", question.review_reward || 5)
              : I18N.t("QUIZ_REVIEW")}</div>
          : <span />}
        <div className="quiz-timer">{I18N.t("QUIZ_SECONDS", restant)}</div>
        {/* La croix n'apparaît qu'une fois l'explication lue et rien à décider.
            Tant que garder/offrir est à l'écran elle serait une troisième sortie
            valant « garder » : garder aurait deux portes, offrir une seule, et
            les deux options cesseraient de peser pareil. */}
        {verdict && !choixEnAttente && (
          <button className="quiz-close" aria-label={I18N.t("QUIZ_CLOSE")} onClick={fermer}>
            ×
          </button>
        )}
      </div>
      <div className="quiz-q">{question.q}</div>

      {!verdict && (
        <div className="quiz-answers">
          {question.c.map((choix, i) => (
            <button key={i} className="quiz-answer" disabled={envoi} onClick={() => repondre(i)}>
              {choix}
            </button>
          ))}
        </div>
      )}

      {verdict && (
        <div className="quiz-explain">
          <div className={cx("quiz-verdict", verdict.correct ? "ok" : "ko")}>
            {I18N.t(verdict.correct ? "QUIZ_CORRECT" : "QUIZ_WRONG")}
          </div>
          <div className="quiz-why">{verdict.explanation}</div>
          {/* Le gain de révision passe par le même choix garder/offrir que les
              questions neuves (le montant s'affiche dans le bouton « Garder »). */}
          {/* Les deux destinations, même classe, même largeur : le joueur voit
              deux options équivalentes, jamais une injonction à donner. */}
          {choixEnAttente && (
            <React.Fragment>
              <div className="quiz-dest">
                <button className="quiz-choice" onClick={garder}>
                  <FaText text={I18N.t("QUIZ_KEEP", verdict.reward)} s={12} />
                </button>
                <button className="quiz-choice" onClick={offrir}>
                  {I18N.t("QUIZ_GIVE")}
                </button>
              </div>
              {/* Ce qui se passe si le joueur ne tranche pas : dit d'avance, en
                  clair, sans presser — l'inaction n'offre rien, elle garde. */}
              <div className="quiz-timeout">{I18N.t("QUIZ_TIMEOUT")}</div>
            </React.Fragment>
          )}
        </div>
      )}
    </div>
  );
}

// ---- le bandeau des dons ----

function texteDon(it) {
  return it.type === "don"
    ? I18N.t("QUIZ_TICKER_DON", it.nom, it.amount)
    : I18N.t("QUIZ_TICKER_TOTAL", it.total);
}

// Les dons réels — agrégés par donateur — défilent comme la tape boursière du
// dessus (mêmes classes .fa-tape : piste dupliquée, couture invisible), avec le
// cumul communautaire en fin de cycle. tickerItems() tranche (quiz-ui.js) : le
// composant n'invente jamais de joueur pour remplir la barre. Un seul item
// n'aurait rien à faire défiler : il s'affiche en ligne fixe, comme avant.
function QuizTicker() {
  const { actions } = useFA();
  const [data, setData] = useState(null);

  useEffect(() => {
    let vivant = true;
    async function charger() {
      const r = await actions.fetchQuizTicker();
      if (vivant && r.ok) setData(r.data);
    }
    charger();
    // Même cadence que les bulles ; le serveur cache sa réponse 30 s de son côté.
    const id = setInterval(charger, QUIZ.QUIZ_INTERVAL_MS);
    return () => { vivant = false; clearInterval(id); };
  }, [actions]);

  const items = QUIZ.tickerItems(data);
  // Pas de don, pas de cumul : pas de barre. Une barre vide serait un bandeau
  // qui occupe l'écran pour ne rien dire.
  if (!items.length) return null;

  if (items.length === 1) {
    return (
      <div className="quiz-ticker">
        <FaText text={texteDon(items[0])} s={11} />
      </div>
    );
  }

  const piste = (cle) => (
    <span className="fa-tape-run" aria-hidden={cle === "b" ? "true" : undefined}>
      {items.map((it, i) => (
        <span className="fa-tape-item" key={cle + i}><FaText text={texteDon(it)} s={10} /></span>
      ))}
    </span>
  );
  return (
    <div className="quiz-ticker">
      {/* `toujours` : contrairement à la tape boursière, celle-ci reste visible
          sur mobile — elle EST le contenu du bandeau, pas un bonus. */}
      <div className="fa-tape toujours">
        <div className="fa-tape-track">{piste("a")}{piste("b")}</div>
      </div>
    </div>
  );
}

Object.assign(window, { QuizToast, QuizTicker, quizEstOccupe: estOccupe });
