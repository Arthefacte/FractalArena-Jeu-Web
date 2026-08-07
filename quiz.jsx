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
  const lastAskAt = useRef(0);
  const finAt = useRef(0);

  const ouvert = !!question;
  // Une bonne réponse hors révision rapporte : le joueur doit alors choisir la
  // destination des FA. Tant que ce choix est à l'écran, la bulle l'attend.
  const gagne = !!(verdict && verdict.correct && !verdict.revision && verdict.reward > 0);
  const choixEnAttente = gagne && !donne;
  // Le minuteur vit dans une closure figée au rendu où il a démarré ; sans cette
  // ref il lirait un choixEnAttente périmé et confirmerait une conservation après
  // un don réussi.
  const choixRef = useRef(false);
  choixRef.current = choixEnAttente;

  // Minuterie : on regarde chaque seconde s'il est temps de proposer une bulle.
  // shouldAsk() tranche — le composant ne décide rien.
  useEffect(() => {
    const id = setInterval(async () => {
      const etat = {
        lastAskAt: lastAskAt.current,
        toastOpen: !!question,
        busy: estOccupe(),
        wallet: g.wallet,
      };
      if (!QUIZ.shouldAsk(etat, Date.now())) return;
      lastAskAt.current = Date.now();
      const r = await actions.fetchQuizQuestion();
      if (!r.ok || !r.data || !r.data.question) return;
      setVerdict(null);
      setDonne(false);
      setQuestion(r.data.question);
    }, 1000);
    return () => clearInterval(id);
  }, [g.wallet, question, actions]);

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
  // sont crédités par /quiz/answer — mais rester muet le faisait passer pour une
  // option qui ne donne rien : le gain va dans le solde verrouillé, que le bandeau
  // du haut n'affiche pas, donc aucun chiffre ne bougeait à l'écran.
  function garder() {
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
    } else if (r.reason === "network") {
      // La requête est partie sans que la réponse revienne : le serveur a pu
      // commettre le don. Annoncer « tes FA sont restés » serait un mensonge une
      // fois sur deux — on renvoie le joueur à la seule source de vérité.
      toast(I18N.t("QUIZ_GIVE_UNSURE"), "bad");
    } else {
      // Le serveur a répondu non (fenêtre écoulée, compte non vérifié, 429…) :
      // là on sait que rien n'est parti. Jamais l'erreur brute au joueur.
      toast(<FaText text={I18N.t("QUIZ_GIVE_REFUSED", (verdict && verdict.reward) || 0)} s={12} />, "bad");
    }
    fermer();
  }

  if (!g.wallet || !question) return null;

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
        {question.revision ? <div className="quiz-tag">{I18N.t("QUIZ_REVIEW")}</div> : <span />}
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

// Une ligne, un don réel — ou, à défaut, le cumul communautaire. tickerLine()
// tranche (quiz-ui.js) : le composant ne met rien en forme lui-même, et
// n'invente jamais de joueur pour remplir la barre.
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

  const ligne = QUIZ.tickerLine(data, (k, ...a) => I18N.t(k, ...a));
  // Pas de don, pas de cumul : pas de barre. Une barre vide serait un bandeau
  // qui occupe l'écran pour ne rien dire.
  if (!ligne) return null;

  return (
    <div className="quiz-ticker">
      <FaText text={ligne} s={11} />
    </div>
  );
}

Object.assign(window, { QuizToast, QuizTicker, quizEstOccupe: estOccupe });
