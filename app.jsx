/* ============================================================
   FRACTAL ARENA — App root: state, actions, shell
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { FA_Ctx, useFA, cx, fmt, Coin, Bar } = window;
const { Team, Fosse, Arene, Forge, Wallet, Boosts, Perso, Options, ChatFab, RoomFab, Leaderboard, Quests, Campaign, Tour, LoginGate, TutorialGate, Link, Cinematique, Market, LockedBanner } = window;
const SAVE_KEY = "fractal_arena_v1";
// Stockage du bearer : delegue a FA_ACCOUNT (account-ui.js), qui applique la regle
// decidee le 2026-07-27 — sessionStorage pour un compte UniSat (efface a la fermeture
// de l'onglet, il peut re-signer a tout moment ; audit 2026-06-24), localStorage pour
// un compte genere (il n'a rien a re-signer, sinon il faudrait ressaisir le code de
// recuperation a chaque fermeture d'onglet). JAMAIS dans le blob localStorage.
const ACC = window.FA_ACCOUNT;
const readToken = () => ACC.readToken();
const writeToken = (t, kind) => ACC.writeToken(t, kind);
const clearToken = () => ACC.clearToken();
const API_URL = window.FA_API_URL;
// Toujours via ACC : `window.unisat` peut être un portefeuille FORKÉ qui a squatté
// le global. Voir ACC.provider() dans account-ui.js.
const HAS_UNISAT = () => ACC.hasProvider();
// Dernier échec d'authentification, sous la forme { cle, detail } rendue par
// ACC.authFailure. Hors du state React à dessein : c'est un fait de diagnostic,
// il ne doit pas provoquer de rendu ni disparaître au remontage d'un écran.
let lastAuthReason = null;
const IS_MOBILE = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || "");

// Progression campagne serveur (plat "w-f" → stars) vers le format client imbriqué.
function nestProgress(flat) {
  const out = {};
  for (const k in (flat || {})) {
    const parts = k.split("-"); const w = +parts[0], f = +parts[1];
    if (!out[w]) out[w] = { stars: new Array(D.FLOORS_PER_WORLD).fill(0) };
    out[w].stars[f] = flat[k];
  }
  return out;
}

function serverToState(save, addr, s) {
  // Le roster vient du serveur, toujours : il le génère à la création du compte
  // (accounts.js et server.js, « creatures SERVER-OWNED ») et le client ne doit pas
  // pouvoir s'en forger un. Pas de repli fabriqué ici : il a masqué pendant tout le
  // lot « compte sans wallet » un compte qui n'avait aucune créature en base, et
  // auquel le serveur refusait donc tous les combats — l'écran paraissait normal.
  // Une collection vide est un symptôme lisible ; une équipe fantôme ne l'est pas.
  const roster = Array.isArray(save.creatures) ? save.creatures : [];
  const rosterIds = new Set(roster.map((b) => b.id));
  return {
    ...s,
    wallet: addr,
    liquid: save.arte_liquid ?? 0,
    locked: save.arte_locked ?? 0,
    freeFights: save.free_fights_remaining ?? D.ECON.FREE_FIGHTS_PER_DAY,
    freeResetTs: Number(save.free_fights_reset_timestamp) || Date.now(),
    totalFights: save.total_combat_count ?? 0,
    loopSilverToday: save.loop_silver_today ?? 0,
    loopGoldToday: save.loop_gold_today ?? 0,
    ticketsSilver: save.tickets_silver ?? 0,
    ticketsGold: save.tickets_gold ?? 0,
    campaignProgress: nestProgress(save.campaign_progress),
    campaignFreeTs: Number(save.campaign_free_ts) || 0,
    session: { wins: save.session_wins ?? 0, losses: save.session_losses ?? 0, net: save.session_arte_net ?? 0 },
    roster,
    equipment: Array.isArray(save.equipment) ? save.equipment : [],
    selected: s.selected.filter((id) => rosterIds.has(id)), // retire les ids absents du nouveau roster
    // Le nom affiché vient du serveur (`display_name`, names.js) : lui seul sait si
    // `addr` est un portefeuille du joueur ou une adresse fabriquée à la création d'un
    // compte sans wallet. Le recalculer ici réaffichait cette adresse-là au joueur.
    // `player_name` n'est plus consulté : aucun écran n'en fait saisir un, et la valeur
    // figée en base par l'ancien client (le nom qu'il fabriquait) repassait devant.
    playerName: save.display_name || "",
    playerTitle: save.player_title || "",
    holderDays: save.holder_badge_days ?? 0,
    lang: save.lang || s.lang || "FR",
    // Préserve la vue courante : ce helper sert aussi à resynchroniser après une
    // action (reroll/fusion/boosts…) ; forcer "team" éjectait l'utilisateur de la
    // forge et démontait l'aperçu de reroll. L'atterrissage "team" au login est
    // déjà garanti par freshState()/loadState().
    view: s.view || "team",
  };
}

function stateToServer(g) {
  return {
    arte_liquid: g.liquid,
    arte_locked: g.locked,
    free_fights_remaining: g.freeFights,
    free_fights_reset_timestamp: g.freeResetTs,
    total_combat_count: g.totalFights,
    loop_silver_today: g.loopSilverToday,
    loop_gold_today: g.loopGoldToday,
    loop_reset_timestamp: 0,
    tickets_silver: g.ticketsSilver,
    tickets_gold: g.ticketsGold,
    session_wins: g.session.wins,
    session_losses: g.session.losses,
    session_arte_net: g.session.net,
    session_combat_count: g.totalFights,
    next_creature_id: 0,
    // player_name n'est plus envoyé : c'est le serveur qui décide du nom affiché
    // (`display_name`). Le renvoyer figeait en base un nom fabriqué par le client, qui
    // reprenait ensuite le dessus — pour un compte sans portefeuille, son adresse serveur.
    ordinal_name: g.ordinalName,
    lang: g.lang,
    airdrop_claimed: false,
    creatures: g.roster,
  };
}

function freshState() {
  return {
    lang: I18N.detectLang(navigator.language),
    wallet: null,
    liquid: 0,
    locked: 0,
    useLocked: false,
    roster: [],
    equipment: [],
    selected: [],
    freeFights: D.ECON.FREE_FIGHTS_PER_DAY,
    freeResetTs: Date.now(),
    totalFights: 0,
    loopSilverToday: 0,
    loopGoldToday: 0,
    ticketsSilver: 0,
    ticketsGold: 0,
    session: { wins: 0, losses: 0, net: 0 },
    boosts: { xp_boost: 0, insurance: 0, lucky_strike: 0 },
    // Progression Campagne PvE (locale uniquement, persistée dans localStorage).
    // campaignProgress : { [worldIndex]: { stars: number[10] } }
    campaignProgress: {},
    campaignTitles: [],     // clés i18n des titres débloqués (ex "CAMP_W1_TITLE")
    campaignFreeTs: 0,      // dernier usage de l'entrée gratuite quotidienne
    playerName: "",
    playerTitle: "",
    ordinalName: "",
    holderDays: 0,
    options: { sound: true, speed: 1 },
    view: "team",
    authToken: "",
    accountKind: "",      // "generated" | "unisat" | "" — decide ou vit le jeton
    onchainVerified: true, // optimiste : un compte UniSat l'est ; /save le corrige
    serverFight: null,
    totem: null,   // { type, tier, active, loyaltyDays, worldsCompleted, paidWins, aura }
    pvp: {},
    pvpPrizes: [],
    towerPrizes: [],
    market: { listings: [], mine: null },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return Object.assign(freshState(), s, {
      view: "team",
      // Token restauré depuis le stockage adapté au type de compte (cf. ACC en tête de
      // fichier) : sessionStorage pour UniSat, localStorage pour un compte généré.
      // JAMAIS dans le blob localStorage (ce blob-ci).
      authToken: readToken(),
      accountKind: ACC.readKind(),
      selected: [],     // ids orphelins d'une session précédente → vidés, réconciliés à la connexion
      ordinalName: "",  // sera écrasé par le nom serveur à la connexion (branche 200)
      options: Object.assign(freshState().options, s.options || {}, { speed: 1 }),
      session: Object.assign({ wins: 0, losses: 0, net: 0 }, s.session || {}),
      boosts: Object.assign({ xp_boost: 0, insurance: 0, lucky_strike: 0 }, s.boosts || {}),
    });
  } catch (e) { return null; }
}

function App() {
  const [g, setG] = useState(() => { const s = loadState() || freshState(); I18N.setLang(s.lang); return s; });
  const [toasts, setToasts] = useState([]);
  const [chipPop, setChipPop] = useState(0);
  const [, setNow] = useState(Date.now()); // tic 1s pour le compte à rebours combats gratuits
  const [cineDone, setCineDone] = useState(false); // cinématique d'ouverture : jouée à chaque visite déconnecté
  // Secrets d'un compte tout juste créé (seed + code de récupération). Vit ICI, au niveau du
  // shell, et pas dans Onboarding : createAccount() pose g.wallet AVANT que playNow() ait fini,
  // donc App bascule hors d'Onboarding au rendu suivant et démonterait tout état local qui y
  // vivrait. SecretsGate doit rester monté malgré cette bascule → il est rendu ici, dans les
  // deux branches du if (!g.wallet) ci-dessous, jamais à l'intérieur d'Onboarding.
  const [accSecrets, setAccSecrets] = useState(null);
  const gRef = useRef(g);
  gRef.current = g;
  // Options fetch pour les lectures /save : joint le Bearer du joueur connecté (preuve de
  // propriété). Rétro-compatible : le serveur l'ignore tant que la route n'est pas auth-gatée,
  // et le prendra en compte ensuite (corrige l'IDOR en lecture sur /save/:wallet — audit 2026-06-24).
  const svOpts = () => {
    const t = gRef.current && gRef.current.authToken;
    return t ? { headers: { Authorization: `Bearer ${t}` } } : {};
  };
  const saveTimerRef = useRef(null);

  // Reconnexion à l'ouverture : si un token est encore valide en sessionStorage (rechargement
  // de l'onglet), on l'utilise directement → pas de re-signature, et la save se recharge AVEC
  // (lecture /save auth-gatée → solde serveur à jour). Sinon (nouvel onglet / token absent),
  // on re-signe (popup UniSat). Sans UniSat, pas de token → l'UI invite à se (re)connecter.
  const didAutoConnectRef = useRef(false);
  useEffect(() => {
    if (didAutoConnectRef.current) return;
    didAutoConnectRef.current = true;
    const w = gRef.current.wallet;
    if (w) {
      (async () => {
        let token = gRef.current.authToken;        // restauré depuis le stockage adapté
        // Un compte généré n'a aucune clé dans le navigateur : authenticate() ouvrirait
        // une popup UniSat inexistante et rendrait "". Son jeton persiste en
        // localStorage ; s'il a expiré, l'UI le renverra vers l'écran de récupération.
        const generated = gRef.current.accountKind === ACC.KIND_GENERATED;
        if (!token && !generated) token = await actions.authenticate(w);
        if (!token && generated) { clearToken(); setG((s) => ({ ...s, wallet: "", accountKind: "" })); return; }
        await actions.connectWallet(w, token);
      })();
    }
  }, []);

  // persist
  useEffect(() => {
    // authToken EXCLU du blob localStorage (sinon volable trivialement par une XSS) ; il est
    // stocké à part via ACC, dans le storage adapté au type de compte (accountKind).
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...g, authToken: "" })); } catch (e) { }
    writeToken(g.authToken, g.accountKind);
  }, [g]);

  // Fetch non-vu des prix PvP dès que le token est établi
  useEffect(() => { if (g.authToken) actions.pvpPrizes(); }, [g.authToken]);
  useEffect(() => { if (g.authToken) actions.towerPrizes(); }, [g.authToken]);

  // language
  useEffect(() => { I18N.setLang(g.lang); }, [g.lang]);

  // #4 accent contextuel : chaque écran teinte l'UI via body[data-view] (cascade CSS pure)
  useEffect(() => { document.body.dataset.view = g.view || "team"; }, [g.view]);

  // server save debounced 1.5s
  useEffect(() => {
    if (!g.wallet || !g.authToken) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return;
      fetch(`${API_URL}/save/${s.wallet}`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
        body: JSON.stringify(stateToServer(s)),
      }).then((r) => (r.ok ? r.json() : null)).then((data) => {
        // creatures SERVER-OWNED : on adopte le roster faisant foi renvoyé par le serveur
        // (roster de départ généré serveur pour un nouveau joueur, resync sinon). Compare
        // par signature pour ne PAS reboucler l'autosave quand c'est déjà synchrone.
        if (data && Array.isArray(data.creatures)) {
          const sig = (arr) => arr.map((b) => `${b.id}:${b.level}:${b.xp}:${b.rarity}`).join("|");
          setG((st) => (sig(st.roster) === sig(data.creatures) ? st : { ...st, roster: data.creatures }));
        }
      }).catch(() => {});
    }, 1500);
  }, [g.liquid, g.locked, g.roster, g.freeFights, g.totalFights,
      g.ticketsSilver, g.ticketsGold, g.session.wins, g.session.losses,
      g.playerName, g.ordinalName, g.playerTitle, g.lang, g.authToken]);

  // daily reset
  useEffect(() => {
    if (!g.wallet) return;
    if (Date.now() - g.freeResetTs >= 86400000) {
      setG((s) => ({ ...s, freeFights: D.ECON.FREE_FIGHTS_PER_DAY, loopSilverToday: 0, loopGoldToday: 0, freeResetTs: Date.now() }));
    }
  }, [g.wallet]);

  // Tic 1s UNIQUEMENT quand le compteur est à 0 : met à jour le compte à rebours
  // et recrédite les combats en direct quand les 24 h sont écoulées (sans reload).
  useEffect(() => {
    if (!g.wallet || g.freeFights > 0) return;
    const t = setInterval(() => {
      if (Date.now() - gRef.current.freeResetTs >= 86400000) {
        setG((s) => ({ ...s, freeFights: D.ECON.FREE_FIGHTS_PER_DAY, loopSilverToday: 0, loopGoldToday: 0, freeResetTs: Date.now() }));
      } else {
        setNow(Date.now());
      }
    }, 1000);
    return () => clearInterval(t);
  }, [g.wallet, g.freeFights]);

  // chip pop on liquid change
  const prevLiquid = useRef(g.liquid);
  useEffect(() => { if (g.liquid !== prevLiquid.current) { prevLiquid.current = g.liquid; setChipPop((n) => n + 1); } }, [g.liquid]);

  // SFX : synchronise le module son avec le toggle options.sound (charge + bascule).
  useEffect(() => { if (window.FA_SFX) window.FA_SFX.setEnabled(g.options.sound); }, [g.options.sound]);

  /* PWA — installation sur l'écran d'accueil. Le navigateur n'émet
     beforeinstallprompt que s'il juge le site installable, et il faut le
     RETENIR : l'événement n'est rejouable qu'une fois, et seulement sur un
     geste du joueur. Sans lui, install() serait refusé — d'où la règle de
     pwa-ui.js : pas d'invite tant qu'on ne détient pas l'événement. */
  const [pwaPrompt, setPwaPrompt] = useState(null);
  useEffect(() => {
    const capte = (e) => { e.preventDefault(); setPwaPrompt(e); };
    const installe = () => setPwaPrompt(null);
    window.addEventListener("beforeinstallprompt", capte);
    window.addEventListener("appinstalled", installe);
    return () => {
      window.removeEventListener("beforeinstallprompt", capte);
      window.removeEventListener("appinstalled", installe);
    };
  }, []);

  /* PWA — perte de réseau. Les combats sont calculés sur le serveur : sans
     réseau il n'y a pas de partie, et le dire vaut mieux que laisser un bouton
     tourner dans le vide. On ne se fie pas qu'à navigator.onLine, qui ment
     volontiers (wifi capté mais sans Internet) : les échecs consécutifs des
     appels au jeu comptent aussi. */
  const [enLigne, setEnLigne] = useState(() => navigator.onLine !== false);
  useEffect(() => {
    const perdu = () => setEnLigne(false);
    const revenu = () => setEnLigne(true);
    window.addEventListener("offline", perdu);
    window.addEventListener("online", revenu);
    return () => {
      window.removeEventListener("offline", perdu);
      window.removeEventListener("online", revenu);
    };
  }, []);
  const etatReseau = window.FA_PWA.etatReseau({ online: enLigne, echecsApi: 0 });

  function toast(msg, kind) {
    const id = Math.random();
    setToasts((T) => [...T, { id, msg, kind }]);
    setTimeout(() => setToasts((T) => T.filter((t) => t.id !== id)), 2600);
    if (window.FA_SFX) window.FA_SFX.play(kind === "bad" ? "error" : "success");
  }

  // ---- spending helper: liquid first then locked ----
  function spendAny(s, amount) {
    if (s.liquid + s.locked < amount) return null;
    let liquid = s.liquid, locked = s.locked;
    if (liquid >= amount) liquid -= amount;
    else { const rem = amount - liquid; liquid = 0; locked -= rem; }
    return { liquid, locked };
  }

  const actions = useMemo(() => ({
    setLang(l) { I18N.setLang(l); setG((s) => ({ ...s, lang: l })); },
    setOption(k, v) { setG((s) => ({ ...s, options: { ...s.options, [k]: v } })); },
    setUseLocked(v) { setG((s) => ({ ...s, useLocked: v })); },
    setView(v) { setG((s) => ({ ...s, view: v })); },

    // Révélation d'un palier (après la cinématique). Écrit serveur, puis MAJ g.totem.
    async invokeTotem(tier) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false };
      const doPost = () => fetch(`${API_URL}/totem/invoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${gRef.current.authToken}` },
        body: JSON.stringify({ wallet: s.wallet, tier }),
      });
      let resp = await doPost();
      if (resp.status === 401) { const re = await actions.authenticate(s.wallet); if (!re) return { ok: false }; resp = await doPost(); }
      if (!resp.ok) return { ok: false };
      const totem = await resp.json();
      setG((st) => ({ ...st, totem }));
      return { ok: true };
    },
    // Choix COSMÉTIQUE de l'image affichée (n'affecte jamais la puissance).
    async pickTotemImage(tier) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false };
      const doPost = () => fetch(`${API_URL}/totem/display`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${gRef.current.authToken}` },
        body: JSON.stringify({ wallet: s.wallet, tier }),
      });
      let resp = await doPost();
      if (resp.status === 401) { const re = await actions.authenticate(s.wallet); if (!re) return { ok: false }; resp = await doPost(); }
      if (!resp.ok) return { ok: false };
      const totem = await resp.json();
      setG((st) => ({ ...st, totem }));
      return { ok: true };
    },

    async connectWallet(addr, token) {
      try {
        // token explicite (juste après authenticate) sinon celui en mémoire : la lecture
        // /save est authentifiée dès la connexion (le state React n'est pas encore à jour).
        const saveOpts = token ? { headers: { Authorization: `Bearer ${token}` } } : svOpts();
        const [saveResp, boostsResp, totemResp] = await Promise.all([
          fetch(`${API_URL}/save/${addr}`, saveOpts),
          fetch(`${API_URL}/boosts/status/${addr}`),
          fetch(`${API_URL}/totem/${addr}`),
        ]);
        // État du Totem (déterministe + dérivé serveur) — non bloquant
        const totem = totemResp.ok ? await totemResp.json() : null;
        if (saveResp.ok) {
          const { save } = await saveResp.json();
          const boostsData = boostsResp.ok ? await boostsResp.json() : null;
          setG((s) => {
            const next = serverToState(save, addr, s);
            if (boostsData) next.boosts = { xp_boost: boostsData.xp_boost?.charges ?? 0, insurance: boostsData.insurance?.charges ?? 0, lucky_strike: boostsData.lucky_strike?.charges ?? 0 };
            next.ordinalName = save.ordinal_name || ""; // nom ordinal du serveur, vide si absent
            next.totem = totem;
            next.onchainVerified = save.onchain_verified !== false;
            // Le portefeuille lié n'était écrit qu'au moment de la liaison : au
            // rechargement, l'état le perdait. Le serveur l'expose désormais.
            next.linkedWallet = save.linked_wallet || "";
            return next;
          });
          return false; // joueur existant
        } else if (saveResp.status === 404) {
          setG((s) => ({
            ...freshState(),
            lang: s.lang,
            options: s.options,
            wallet: addr,
            accountKind: s.accountKind,
            // Preserve le jeton deja pose en state avant cet appel (createAccount/
            // recoverAccount le fixent en un seul setG juste avant d'appeler connectWallet,
            // cf. IMPORTANT 4b) : sans ce champ, freshState() le remettrait a "" ici meme
            // pour un compte tout juste cree, et la persistance suivante l'effacerait du
            // storage (writeToken("", ...) => clearToken()).
            authToken: s.authToken,
            onchainVerified: false,
            view: "team",
            playerName: ACC.localDisplayName(addr, s.accountKind),
            roster: D.starterRoster(),
            locked: D.ECON.WELCOME_LOCKED,
            liquid: D.ECON.WELCOME_LIQUID,
            ticketsSilver: D.ECON.WELCOME_TICKETS_SILVER,
            ticketsGold: 0,
            freeFights: D.ECON.FREE_FIGHTS_PER_DAY,
            freeResetTs: Date.now(),
            totem,
          }));
          return true; // nouveau joueur → l'airdrop est réclamé APRÈS authentification (token requis)
        } else if (saveResp.status === 401 || saveResp.status === 403) {
          // Jeton présent mais invalide/expiré (sessions serveur = 30 jours, rien ne les
          // renouvelle pour un compte généré). Un compte généré n'a aucune clé à re-signer :
          // sans ce garde-fou, le code tombait dans le catch générique ci-dessous, qui
          // CONSERVAIT wallet+jeton mort → joueur "connecté" en apparence, autosave muette
          // en 401, et écran de récupération inatteignable (audit CRITICAL 2, 2026-07-27).
          const generated = gRef.current.accountKind === ACC.KIND_GENERATED;
          if (generated) {
            clearToken();
            setG((s) => ({ ...s, wallet: "", accountKind: "", authToken: "" }));
            return false;
          }
          // Compte UniSat : re-signature, comme déjà fait pour /totem/invoke et /totem/display.
          const fresh = await actions.authenticate(addr);
          if (fresh) return await actions.connectWallet(addr, fresh);
          throw new Error("server " + saveResp.status);
        } else {
          throw new Error("server " + saveResp.status);
        }
      } catch (e) {
        // fallback local si réseau KO
        setG((s) => {
          const isNew = !s.roster.length;
          if (isNew) {
            return {
              ...freshState(),
              lang: s.lang, options: s.options,
              // Contrairement à la branche 404 (réponse serveur normale), ce fallback ne
              // s'exécute QUE si le réseau a lâché — fréquent sur mobile. Sans reinjecter
              // accountKind/onchainVerified/authToken depuis s, freshState() les remet à
              // ""/true/"" : un compte généré perdrait sa nature (son jeton part alors en
              // sessionStorage, effacé à la fermeture d'onglet, et disparaît carrément du
              // state ici) et le bandeau gains-verrouillés disparaîtrait pour de bon
              // (audit IMPORTANT 4a, 2026-07-27).
              accountKind: s.accountKind, onchainVerified: s.onchainVerified, authToken: s.authToken,
              wallet: addr, view: "team",
              playerName: ACC.localDisplayName(addr, s.accountKind),
              roster: D.starterRoster(),
              locked: D.ECON.WELCOME_LOCKED,
              liquid: D.ECON.WELCOME_LIQUID,
              ticketsSilver: D.ECON.WELCOME_TICKETS_SILVER,
              ticketsGold: 0,
              freeFights: D.ECON.FREE_FIGHTS_PER_DAY,
              freeResetTs: Date.now(),
            };
          }
          return { ...s, wallet: addr, playerName: ACC.localDisplayName(addr, s.accountKind), ordinalName: "", selected: [], view: "team" };
        });
      }
    },
    // Réclame l'airdrop de bienvenue APRÈS authentification (le serveur exige désormais
    // un token wallet sur /claim-airdrop). Best-effort : un échec sera retenté à la
    // prochaine connexion tant que airdrop_claimed reste FALSE côté serveur.
    async claimAirdropIfNew(addr, token, isNew) {
      if (!isNew || !addr || !token) return;
      try {
        await fetch(`${API_URL}/claim-airdrop`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
          body: JSON.stringify({ wallet: addr }),
        });
      } catch (e) { /* retentable à la prochaine connexion */ }
    },
    // NE JAMAIS échouer en silence ici. Les quatre causes possibles (pas
    // d'extension, extension verrouillée, signature refusée, serveur en panne)
    // appellent quatre gestes différents du joueur ; les confondre dans un `""`
    // muet nous a fait diagnostiquer à l'aveugle et livrer une régression
    // (v111 → retour arrière v112). Chaque sortie nomme désormais sa cause :
    // en console pour nous, et dans `lastAuthReason` pour l'afficher au joueur.
    async authenticate(addr) {
      const echec = (etape, err, status) => {
        const r = ACC.authFailure(etape, err, status);
        lastAuthReason = r;
        console.error("[auth] échec —", r.detail, err || "");
        return "";
      };
      // Résolu UNE fois : la garde et la signature doivent porter sur le même objet.
      const uni = ACC.provider();
      if (!uni) return echec("extension", null, 0);
      try {
        const cr = await fetch(`${API_URL}/auth/challenge?wallet=${encodeURIComponent(addr)}&scope=session`);
        if (!cr.ok) return echec("challenge", null, cr.status);
        const ch = await cr.json();
        // En fenêtre installée, la popup d'UniSat ne s'affiche PAS d'elle-même :
        // la demande part, l'extension la met en attente, et rien n'apparaît —
        // il n'y a ni barre d'adresse ni barre d'extensions pour aller la
        // chercher. Le joueur restait donc devant un écran qui ne lui demandait
        // rien. On le dit AVANT de bloquer sur la promesse, pas après.
        if (ACC.estAppInstallee()) toast(I18N.t("AUTHDIAG_PENDING_APP"), "info");
        // Signe le message lié au scope si le serveur le fournit, sinon le nonce brut
        // (rétro-compat : le serveur actuel ne renvoie que `nonce`).
        const signature = await uni.signMessage(ch.message || ch.nonce);
        const vr = await fetch(`${API_URL}/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: addr, signature }),
        });
        if (!vr.ok) return echec("verify", null, vr.status);
        const { token } = await vr.json();
        if (token) { lastAuthReason = null; setG((s) => ({ ...s, authToken: token })); }
        return token || echec("verify", null, 0);
      } catch (e) {
        // C'est ici que tout se perdait : l'erreur de signMessage (verrouillé,
        // refusé, popup avalée par la fenêtre PWA) arrivait et repartait muette.
        return echec("signature", e, 0);
      }
    },
    async connectUnisat() {
      const uni = ACC.provider();
      if (!uni) return { ok: false, reason: "no-unisat" };
      try {
        const accounts = await uni.requestAccounts();
        const addr = (accounts && accounts[0]) || "";
        if (!/^bc1/i.test(addr)) return { ok: false, reason: "bad-address" };
        // Authentifier D'ABORD (obtenir le token) puis charger la save AVEC le token :
        // la lecture /save est auth-gatée côté serveur (anti-IDOR).
        const token = await actions.authenticate(addr);
        const isNew = await actions.connectWallet(addr, token);
        await actions.claimAirdropIfNew(addr, token, isNew);
        return token ? { ok: true } : { ok: false, reason: "auth" };
      } catch (e) {
        return { ok: false, reason: "rejected" };
      }
    },
    // Crée un compte + wallet côté serveur. Les deux secrets rendus ici ne sont
    // JAMAIS persistés : ils vivent dans l'état de l'écran des secrets, puis
    // disparaissent. Aucune autre route ne les relit.
    async createAccount() {
      try {
        const r = await fetch(`${API_URL}/account/create`, {
          method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
        });
        if (r.status === 429) return { ok: false, reason: "rate" };
        if (!r.ok) return { ok: false, reason: "server" };
        const d = await r.json();
        if (!d.wallet || !d.token) return { ok: false, reason: "server" };
        // accountKind + authToken en UN SEUL setG : entre deux setG separes par un await,
        // l'effet de persistance (qui depend de [g]) peut s'executer avec authToken encore
        // vide et appeler clearToken(), effacant le jeton tout juste ecrit. Un onglet ferme
        // dans cette fenetre laisse un blob avec wallet mais zero jeton -> meme impasse que
        // 4(a) (audit IMPORTANT 4b, 2026-07-27).
        writeToken(d.token, ACC.KIND_GENERATED);
        setG((s) => ({ ...s, accountKind: ACC.KIND_GENERATED, onchainVerified: false, authToken: d.token }));
        await actions.connectWallet(d.wallet, d.token);
        return { ok: true, wallet: d.wallet, recovery_code: d.recovery_code };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    // Retour sur un compte généré depuis un autre appareil ou après vidage du cache.
    async recoverAccount(code) {
      // Garde anti-phishing AVANT tout appel réseau : une seed ne doit jamais
      // quitter la machine du joueur, y compris vers nous.
      if (ACC.looksLikeSeed(code)) return { ok: false, reason: "seed" };
      if (!ACC.isValidRecoveryCode(code)) return { ok: false, reason: "invalid" };
      try {
        const r = await fetch(`${API_URL}/auth/recover`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ recovery_code: String(code).trim() }),
        });
        if (r.status === 429) return { ok: false, reason: "rate" };
        if (!r.ok) {
          // 4xx (hors 429) = le serveur a explicitement rejeté le code : invalide.
          // 5xx/autre = panne côté serveur, PAS un verdict sur le code — même soin
          // que pour verifyOnchain (98082b1) : sans distinguer les deux, un code
          // CORRECT frappé par un 500 passager s'affichait comme « Code invalide »,
          // et le joueur pouvait en conclure que son compte était perdu (IMPORTANT 7).
          return { ok: false, reason: r.status >= 500 ? "server" : "invalid" };
        }
        const d = await r.json();
        if (!d.wallet || !d.token) return { ok: false, reason: "server" };
        // accountKind + authToken en UN SEUL setG (meme raison qu'en 4b/createAccount) :
        // deux setG separes par un await laissent l'effet de persistance s'executer avec
        // authToken encore vide -> clearToken() efface le jeton tout juste ecrit.
        writeToken(d.token, ACC.KIND_GENERATED);
        setG((s) => ({ ...s, accountKind: ACC.KIND_GENERATED, authToken: d.token }));
        await actions.connectWallet(d.wallet, d.token);
        return { ok: true };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    // Demande au serveur de constater une activité on-chain (solde FB > 0). Le
    // client ne décide jamais : il ne fait que déclencher la vérification.
    async verifyOnchain() {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const r = await fetch(`${API_URL}/account/verify-onchain`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: "{}",
        });
        if (!r.ok) return { ok: false, reason: "server" };
        const d = await r.json();
        if (d.verified) setG((st) => ({ ...st, onchainVerified: true }));
        return { ok: true, verified: !!d.verified };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    // Lie au compte de jeu le portefeuille UniSat que le joueur a créé LUI-MÊME, et
    // vers lequel partiront ses retraits. On ne lui demande JAMAIS d'importer la seed
    // du compte : elle ne lui donne accès à rien, et lui faire saisir 12 mots quelque
    // part contredirait notre propre avertissement anti-phishing.
    //
    // Le serveur exige une double preuve : le Bearer prouve la possession du compte,
    // la signature prouve la possession du portefeuille. Scope « withdraw » — lier
    // un portefeuille EST l'autorisation d'y envoyer des fonds.
    // Étape 1 — demander à UniSat quelle adresse est active, et RIEN d'autre :
    // aucune signature, aucun appel serveur. C'est ce qui permet de la montrer au
    // joueur avant d'engager quoi que ce soit.
    //
    // Pourquoi ce découpage (incident du 2026-07-30) : `linkWallet` prenait
    // `accounts[0]` — le compte actif de l'extension — et enchaînait signature +
    // POST sans jamais afficher l'adresse. Le user a ainsi lié son compte de test
    // à l'adresse de son compte de jeu principal, sans l'avoir voulu ni vue. Lier
    // est irréversible côté jeu (« un compte = un portefeuille »), redirige les
    // retraits futurs et déclenche un envoi on-chain : il a fallu un accès direct
    // à la base pour le défaire.
    async requestWalletAddress() {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      const uni = ACC.provider();
      if (!uni) return { ok: false, reason: "no-unisat" };
      try {
        const accounts = await uni.requestAccounts();
        const addr = (accounts && accounts[0]) || "";
        if (!/^bc1/i.test(addr)) return { ok: false, reason: "bad-address" };
        if (addr === s.wallet) return { ok: false, reason: "same" };
        return { ok: true, wallet: addr };
      } catch (e) {
        return { ok: false, reason: "rejected" };
      }
    },
    // Étape 2 — lier l'adresse CONFIRMÉE. Elle est passée en paramètre et n'est
    // jamais redemandée à UniSat : entre la confirmation et l'envoi, le compte
    // actif de l'extension a pu changer, et on lierait alors une adresse que le
    // joueur n'a jamais vue — en pire, puisqu'il croirait avoir confirmé.
    async linkWallet(addr) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      const uni = ACC.provider();
      if (!uni) return { ok: false, reason: "no-unisat" };
      if (!/^bc1/i.test(addr || "")) return { ok: false, reason: "bad-address" };
      if (addr === s.wallet) return { ok: false, reason: "same" };
      try {
        const cr = await fetch(`${API_URL}/auth/challenge?wallet=${encodeURIComponent(addr)}&scope=withdraw`);
        if (!cr.ok) return { ok: false, reason: "server" };
        const ch = await cr.json();
        const signature = await uni.signMessage(ch.message || ch.nonce);
        const r = await fetch(`${API_URL}/account/link-wallet`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: addr, signature }),
        });
        if (r.status === 409) return { ok: false, reason: "taken" };
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          if (j.error === "portefeuille_identique") return { ok: false, reason: "same" };
          return { ok: false, reason: r.status >= 500 ? "server" : "refused" };
        }
        const d = await r.json();
        // Le portefeuille est lié : le compte est vérifié et les gains mis en attente
        // viennent d'être libérés côté serveur. On reflète les deux immédiatement.
        setG((st) => ({ ...st, onchainVerified: true, linkedWallet: d.wallet,
                        liquid: Number(d.liquid), locked: Number(d.locked) }));
        return { ok: true, wallet: d.wallet };
      } catch (e) {
        // Rejet de la popup UniSat compris : le joueur a simplement annulé.
        return { ok: false, reason: "rejected" };
      }
    },
    // Step-up de retrait. Le signataire n'est pas toujours le compte : un compte créé
    // sans wallet signe avec le portefeuille qu'il a lié, et le serveur émet le jeton
    // pour le compte (paramètre `account`). Sans ça, le client demandait une signature
    // de l'adresse du compte — que le joueur ne peut pas produire, le serveur en
    // détenant seul la seed : 401 systématique, retrait impossible.
    async authForWithdraw() {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "wallet" };
      const qui = ACC.withdrawSigner(s);
      // Compte généré sans portefeuille lié : rien à signer, et rien où envoyer. On
      // s'arrête AVANT tout appel réseau, avec un motif que la modale sait traduire en
      // « lie ton portefeuille » — et non en « signature requise », qui n'indique rien.
      if (!qui) return { ok: false, reason: "not-linked" };
      const uni = ACC.provider();
      if (!uni) return { ok: false, reason: "unisat" };
      try {
        const cr = await fetch(`${API_URL}/auth/challenge?wallet=${encodeURIComponent(qui.signer)}&scope=withdraw`
          + (qui.account ? `&account=${encodeURIComponent(qui.account)}` : ""));
        if (!cr.ok) return { ok: false, reason: "challenge" };
        const ch = await cr.json();
        // Signe le message lié au scope « withdraw » si le serveur le fournit, sinon le nonce
        // brut (rétro-compat). Lie la signature à l'intention de retrait une fois le serveur à jour.
        const signature = await uni.signMessage(ch.message || ch.nonce);
        // Le compte visé doit accompagner le verify autant que le challenge : il fait
        // partie du texte signé, l'omettre ici ferait reconstruire au serveur un message
        // différent de celui que le joueur a signé.
        const vr = await fetch(`${API_URL}/auth/verify`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: qui.signer, signature, scope: "withdraw",
                                 ...(qui.account ? { account: qui.account } : {}) }),
        });
        if (!vr.ok) return { ok: false, reason: "verify" };
        const { token } = await vr.json();
        return token ? { ok: true, token } : { ok: false, reason: "verify" };
      } catch (e) {
        return { ok: false, reason: "sign" };
      }
    },
    disconnect() {
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
      clearToken();
      setG((s) => ({ ...freshState(), lang: s.lang, options: s.options }));
    },

    toggleSelect(id) {
      setG((s) => {
        const has = s.selected.includes(id);
        let selected = has ? s.selected.filter((x) => x !== id) : (s.selected.length < 3 ? [...s.selected, id] : s.selected);
        return { ...s, selected };
      });
    },

    // Réordonne l'équipe sélectionnée (= ordre de formation : index 0 Avant / 1 Milieu / 2 Arrière).
    // Échange local ; la persistance se fait via pvpSetDefense (qui poste `selected` dans l'ordre).
    pvpReorderDefense(from, to) {
      setG((s) => {
        const sel = [...s.selected];
        if (from < 0 || to < 0 || from >= sel.length || to >= sel.length || from === to) return s;
        [sel[from], sel[to]] = [sel[to], sel[from]];
        return { ...s, selected: sel };
      });
    },

    startBet({ free, betTier, isLoop }) {
      const s = gRef.current;
      if (free) {
        if (s.freeFights <= 0) return { ok: false, reason: I18N.t("AR_FREE_EMPTY") };
        setG((st) => ({ ...st, freeFights: st.freeFights - 1 }));
        return { ok: true, free: true, betTier: "", betAmount: 0, fromLocked: false };
      }
      let tier = betTier;
      let note = null;
      if (isLoop && tier === "silver" && s.loopSilverToday >= D.ECON.LOOP_SILVER_MAX) { tier = "bronze"; note = I18N.t("AR_LOOP_CAP"); }
      if (isLoop && tier === "gold" && s.loopGoldToday >= D.ECON.LOOP_GOLD_MAX) { tier = "bronze"; note = I18N.t("AR_LOOP_CAP"); }
      const amount = D.ECON.BET[tier];
      // deduction with useLocked logic
      // Verrouillage ON : la mise sort UNIQUEMENT du verrouillé, jamais du disponible.
      let fromLocked = false, liquid = s.liquid, locked = s.locked;
      if (s.useLocked) {
        if (s.locked < amount) return { ok: false, reason: I18N.t("AR_LOCKED_EMPTY") };
        locked -= amount; fromLocked = true;
      } else if (s.liquid >= amount) { liquid -= amount; }
      else return { ok: false, reason: I18N.t("AR_INSUFF") };
      setG((st) => {
        const patch = { ...st, liquid, locked };
        if (isLoop && tier === "silver") patch.loopSilverToday = st.loopSilverToday + 1;
        if (isLoop && tier === "gold") patch.loopGoldToday = st.loopGoldToday + 1;
        return patch;
      });
      return { ok: true, free: false, betTier: tier, betAmount: amount, fromLocked, note };
    },

    async callFight({ free, betTier, isLoop }) {
      const s = gRef.current;
      // Tous les combats (gratuits ET payants) sont joués par le serveur
      //
      // On NE tente PAS de re-signer ici : en v111 cet appel partait vers
      // window.unisat.signMessage(), dont la popup ne s'ouvre pas dans la
      // fenêtre PWA — la promesse ne revenait jamais et le combat restait
      // suspendu, sans message. On refuse donc tout de suite, mais en DISANT
      // pourquoi : sans la raison, le joueur est devant un mur sans porte.
      if (!s.authToken) {
        const r = lastAuthReason;
        // Pas de raison enregistrée + fenêtre installée = le cas le plus courant
        // ici : la signature demandée au démarrage est TOUJOURS en attente dans
        // l'extension, invisible. Rien n'a échoué, donc rien n'a été consigné —
        // et sans ce cas le joueur ne lirait que le message générique, qui ne
        // lui dit pas le seul geste qui débloque.
        const detail = r ? I18N.t(r.cle) : (ACC.estAppInstallee() ? I18N.t("AUTHDIAG_PENDING_APP") : "");
        return { ok: false, reason: detail ? `${I18N.t("AUTHDIAG_TITLE")} ${detail}` : I18N.t("AUTHDIAG_TITLE"), authReason: r };
      }
      if (s.selected.length !== 3) return { ok: false, reason: "Sélectionne 3 bêtes" };
      if (free && s.freeFights <= 0) return { ok: false, reason: "Plus de combats gratuits" };
      let tier = betTier;
      if (!free) {
        if (isLoop && tier === "silver" && s.loopSilverToday >= D.ECON.LOOP_SILVER_MAX) tier = "bronze";
        if (isLoop && tier === "gold" && s.loopGoldToday >= D.ECON.LOOP_GOLD_MAX) tier = "bronze";
        // Verrouillage ON : on refuse côté client si le verrouillé ne couvre plus la
        // mise — message localisé, et le serveur applique le même garde-fou.
        if (s.useLocked && s.locked < (D.ECON.BET[tier] || 0)) {
          return { ok: false, reason: I18N.t("AR_LOCKED_EMPTY") };
        }
      }
      try {
        const resp = await fetch(`${API_URL}/fight`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ bet_tier: free ? "" : tier, is_free: free, selected: s.selected, use_locked: s.useLocked, is_loop: isLoop }),
        });
        if (resp.status === 401) {
          // session expirée → tenter une re-signature silencieuse (1 clic UniSat)
          const re = await actions.authenticate(gRef.current.wallet);
          if (!re) { toast(I18N.t("AUTH_EXPIRED"), "bad"); return { ok: false, reason: "auth" }; }
          return { ok: false, reason: "retry" };
        }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return { ok: false, reason: err.error || `Erreur serveur ${resp.status}` };
        }
        const data = await resp.json();
        // Solde + résultat serveur (events + enemy pour le replay côté client)
        setG((st) => {
          // Au lancement : on prélève SEULEMENT la mise (déduction optimiste, liquid puis
          // locked) pour que le joueur voie son stake partir. Le GAIN reste différé à
          // resolveFight (fin du replay) — solde final dans serverFight.new_liquid/new_locked.
          const patch = { ...st, serverFight: data };
          if (free) {
            patch.freeFights = Math.max(0, st.freeFights - 1);
          } else {
            const bet = D.ECON.BET[tier] || 0;
            // Doit refléter computeBetDeduction côté serveur (fight.js) : useLocked ON
            // → mise prélevée UNIQUEMENT sur le verrouillé (le serveur a déjà validé
            // que locked >= bet, sinon il aurait renvoyé 400) ; OFF → liquide d'abord.
            if (st.useLocked) {
              patch.locked = st.locked - bet;
            } else {
              const fromLiquid = Math.min(st.liquid, bet);
              patch.liquid = st.liquid - fromLiquid;
              patch.locked = st.locked - (bet - fromLiquid);
            }
          }
          // Compteurs loop : SERVER-OWNED (plafond + reset quotidien tranchés par le
          // serveur, infalsifiables). On reflète simplement les valeurs renvoyées.
          if (!free && data.loop_silver_today !== undefined) patch.loopSilverToday = data.loop_silver_today;
          if (!free && data.loop_gold_today !== undefined) patch.loopGoldToday = data.loop_gold_today;
          return patch;
        });
        return {
          ok: true, free, betTier: free ? "" : tier,
          betAmount: free ? 0 : D.ECON.BET[tier], fromLocked: false,
          events: data.events, enemy: data.enemy, won: data.won,
        };
      } catch (e) {
        return { ok: false, reason: "Erreur réseau" };
      }
    },

    resolveFight({ win, free, betTier, betAmount, fromLocked, isLoop }) {
      // Le résultat (gratuit ET payant) vient du serveur (déjà appliqué côté DB)
      const srv = gRef.current.serverFight;
      if (srv !== null) {
        win = srv.won ?? false;  // override le résultat local par le résultat serveur
      }
      const summary = { payout: 0, net: 0, xp: 0, milestone: false, luckyBonus: 0, insuranceUsed: false, betAmount, levelUps: [], rarityUps: [] };
      setG((s) => {
        // Solde final serveur appliqué ICI (fin du combat), pas au lancement → le gain
        // n'apparaît qu'une fois le replay terminé.
        let liquid = srv ? (srv.new_liquid ?? s.liquid) : s.liquid;
        let locked = srv ? (srv.new_locked ?? s.locked) : s.locked;
        // Compteur, tickets et milestone : SERVER-OWNED — repris de la réponse /fight
        // (récompense de milestone déjà incluse dans srv.new_locked / srv.tickets_silver).
        let totalFights = srv ? (srv.total_combat_count ?? s.totalFights + 1) : s.totalFights + 1;
        let ticketsSilver = srv ? (srv.tickets_silver ?? s.ticketsSilver) : s.ticketsSilver;
        let ticketsGold = srv ? (srv.tickets_gold ?? s.ticketsGold) : s.ticketsGold;
        const session = { ...s.session };
        const boosts = { ...s.boosts };
        if (srv && srv.milestone) summary.milestone = true;
        if (win) {
          session.wins += 1;
          const base = free ? D.ECON.BET.bronze : betAmount;
          const payout = Math.floor(base * D.ECON.PAYOUT_MULT);
          const net = payout - betAmount;
          // liquid/locked = solde serveur, initialisé en tête de ce setG (au settle)
          summary.payout = payout; summary.net = net;
          if (!free) session.net += net;
          // lucky strike : appliqué et crédité CÔTÉ SERVEUR (déjà inclus dans le solde srv)
          if (srv && srv.lucky_bonus > 0) summary.luckyBonus = srv.lucky_bonus;
          // xp / level-ups : ATTRIBUÉS CÔTÉ SERVEUR (infalsifiable). On affiche les valeurs
          // renvoyées ; le roster serveur est adopté plus bas (plus de calcul d'XP local).
          summary.xp = srv ? (srv.xp ?? 0) : 0;
          const lvEvents = (srv && srv.level_events) ? srv.level_events : [];
          summary.levelUps = lvEvents.filter((e) => e.type === "levelup");
          summary.rarityUps = lvEvents.filter((e) => e.type === "rarity_up");
        } else {
          session.losses += 1;
          if (srv && srv.insurance_used) {
            // remboursement de la mise géré CÔTÉ SERVEUR (solde srv déjà à jour)
            summary.insuranceUsed = true;
          } else if (!free) {
            // Mise perdue : 100 % → rachat (réparti côté serveur dans les 4 pools).
            session.net -= betAmount;
          }
        }
        // boosts : TOUTES les charges (lucky/insurance/xp_boost) sont consommées CÔTÉ
        // SERVEUR dans /fight, uniquement sur victoire → on resynchronise simplement.
        if (srv && srv.boosts) {
          if (srv.boosts.lucky_strike !== undefined) boosts.lucky_strike = srv.boosts.lucky_strike;
          if (srv.boosts.insurance !== undefined) boosts.insurance = srv.boosts.insurance;
          if (srv.boosts.xp_boost !== undefined) boosts.xp_boost = srv.boosts.xp_boost;
        }
        // roster SERVER-OWNED : on adopte les creatures renvoyées (XP/niveaux serveur).
        const roster = (srv && srv.creatures) ? srv.creatures : s.roster;
        return { ...s, liquid, locked, totalFights, ticketsSilver, ticketsGold, session, boosts, roster };
      });
      // record-pool / record-airdrop / record-burn supprimés : le serveur route les pools dans POST /fight
      setG((st) => ({ ...st, serverFight: null }));
      return summary;
    },

    async buyBoost(key) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      const def = D.BOOSTS[key];
      if (s.liquid + s.locked < def.cost) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, def.cost) };
      try {
        const resp = await fetch(`${API_URL}/boosts/activate`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, boost_type: key }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const [svResp, bResp] = await Promise.all([fetch(`${API_URL}/save/${s.wallet}`, svOpts()), fetch(`${API_URL}/boosts/status/${s.wallet}`)]);
        if (svResp.ok && bResp.ok) {
          const [{ save }, bd] = await Promise.all([svResp.json(), bResp.json()]);
          setG((st) => { const n = serverToState(save, s.wallet, st); n.boosts = { xp_boost: bd.xp_boost?.charges ?? 0, insurance: bd.insurance?.charges ?? 0, lucky_strike: bd.lucky_strike?.charges ?? 0 }; return n; });
        }
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async fuse(id1, id2, useGold) {
      const s = gRef.current;
      const a = s.roster.find((b) => b.id === id1), b = s.roster.find((b) => b.id === id2);
      if (!a || !b) return { ok: false, reason: I18N.t("FG_PICK2") };
      if (a.rarity === "Legendary") return { ok: false, reason: I18N.t("FG_NOT_FUSABLE") };
      if (a.rarity !== b.rarity) return { ok: false, reason: I18N.t("FG_PICK2") };
      const cost = D.FORGE.FUSION_COST[a.rarity];
      const premium = !!useGold;
      // Fusion premium : 1 ticket Or = 100% réussite, sans coût FA — gérée SERVEUR
      // (consommation du ticket + upgrade préservant les stats). Plus de mint local.
      if (premium) {
        if (s.ticketsGold < 1) return { ok: false, reason: "Pas de ticket Or" };
      } else {
        if (s.liquid + s.locked < cost) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      }
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/fusion`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, primary_id: id1, secondary_id: id2, use_gold: premium }),
        });
        const data = await resp.json();
        if (data.status === "insufficient_balance") return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
        if (data.status === "error" && data.reason === "no_gold_ticket") return { ok: false, reason: "Pas de ticket Or" };
        if (data.status !== "success" && data.status !== "fail") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) {
          const { save } = await sv.json();
          setG((st) => { const n = serverToState(save, s.wallet, st); n.selected = st.selected.filter((x) => n.roster.some((r) => r.id === x)); return n; });
        }
        return { ok: true, success: data.status === "success", result: { rarity: data.new_rarity || a.rarity, premium } };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async reroll(id, locks = []) {
      const s = gRef.current;
      const beast = s.roster.find((b) => b.id === id);
      if (!beast) return { ok: false, reason: I18N.t("FG_PICK1") };
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/reroll`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, beast_id: id, locks }),
        });
        const data = await resp.json();
        if (data.status === "insufficient_balance") return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, data.cost || 0) };
        if (data.error === "locks_invalide") return { ok: false, reason: I18N.t("FG_ERR_LOCKS") };
        if (data.error === "budget_insuffisant") return { ok: false, reason: I18N.t("FG_ERR_BUDGET") };
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        // Mode pending : rien n'est appliqué ; on resynchronise le solde (débité) et on renvoie l'aperçu.
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true, preview: { old_stats: data.old_stats, new_stats: data.new_stats, cost: data.cost, next_reroll_cost: data.next_reroll_cost, locks: Array.isArray(data.locks) ? data.locks : [] } };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },
    async rerollConfirm(id) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/reroll/confirm`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, beast_id: id }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },
    async rerollDiscard(id) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/reroll/discard`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, beast_id: id }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true, refunded: data.refunded };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async summon() {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      const cost = D.ECON.MINT_COST;
      if (s.liquid + s.locked < cost) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      try {
        const resp = await fetch(`${API_URL}/forge/summon`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet }),
        });
        const data = await resp.json();
        if (data.status === "insufficient_balance") return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true, beast: data.beast };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async relicSummon() {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "Wallet requis" };
      const cost = 8000; // RELIC_SUMMON_COST serveur
      if (s.liquid + s.locked < cost) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      try {
        const resp = await fetch(`${API_URL}/forge/relic-summon`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet }),
        });
        const data = await resp.json();
        if (data.status === "insufficient_balance") return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true, relic: data.relic };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async relicEquip(beastId, relicId) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/relic-equip`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, beast_id: beastId, relic_id: relicId }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        if (Array.isArray(data.creatures)) setG((st) => ({ ...st, roster: data.creatures }));
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    // Talents : choix / respec d'un talent de palier. Le serveur renvoie creatures
    // directement ; un respec payant change aussi le solde → re-fetch /save complet.
    async chooseTalent(beastId, tier, talentId) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/talents/choose`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ beast_id: beastId, tier: tier | 0, talent_id: talentId }),
        });
        const data = await resp.json();
        if (data.status !== "ok") {
          const map = { palier_verrouille: "TAL_ERR_LOCKED", deja_choisi: "TAL_ERR_ALREADY", solde_insuffisant: "TAL_ERR_BALANCE" };
          return { ok: false, reason: map[data.error] ? I18N.t(map[data.error]) : "Erreur serveur" };
        }
        if (Array.isArray(data.creatures)) setG((st) => ({ ...st, roster: data.creatures }));
        if (data.cost > 0) {
          // Resync best-effort : le choix est déjà commité serveur — un échec ici
          // ne doit pas se présenter comme un échec du pick (solde resynchronisé plus tard).
          try {
            const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
            if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
          } catch (e) { /* solde momentanément non resynchronisé */ }
        }
        return { ok: true, cost: data.cost };
      } catch (e) {
        return { ok: false, reason: "Erreur réseau" };
      }
    },

    async callChat(messages) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "Wallet requis" };
      const last20 = messages
        .slice(-20)
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
      try {
        const resp = await fetch(`${API_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ messages: last20 }),
        });
        if (resp.status === 429) return { ok: false, rateLimited: true };
        const data = await resp.json();
        if (!resp.ok) return { ok: false, reason: data.error || "Erreur serveur" };
        return { ok: true, reply: data.reply };
      } catch (e) {
        return { ok: false, reason: "Erreur réseau" };
      }
    },

    async fetchRoomMessages(afterId) {
      try {
        const q = (afterId !== undefined && afterId !== null) ? `?after=${afterId}` : "";
        const resp = await fetch(`${API_URL}/chat-room/messages${q}`);
        if (!resp.ok) return { ok: false, messages: [] };
        const data = await resp.json();
        return { ok: true, messages: data.messages || [] };
      } catch (e) {
        return { ok: false, messages: [] };
      }
    },
    async fetchLeaderboard(board) {
      const s = gRef.current;
      try {
        const q = `board=${encodeURIComponent(board)}` + (s.wallet ? `&wallet=${encodeURIComponent(s.wallet)}` : "");
        const resp = await fetch(`${API_URL}/leaderboard?${q}`);
        if (!resp.ok) return { ok: false };
        const data = await resp.json();
        return { ok: true, top: data.top || [], you: data.you || null };
      } catch (e) {
        return { ok: false };
      }
    },
    async fetchQuests() {
      const s = gRef.current;
      if (!s.wallet) return { ok: false };
      try {
        const resp = await fetch(`${API_URL}/quests/${encodeURIComponent(s.wallet)}`);
        if (!resp.ok) return { ok: false };
        const data = await resp.json();
        return { ok: true, data };
      } catch (e) {
        return { ok: false };
      }
    },
    async claimQuest(questId) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/quests/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ quest_id: questId }),
        });
        if (resp.status === 401) {
          const re = await actions.authenticate(gRef.current.wallet);
          if (!re) { toast(I18N.t("AUTH_EXPIRED"), "bad"); return { ok: false, reason: "auth" }; }
          return { ok: false, reason: "retry" };
        }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return { ok: false, reason: err.error || `Erreur ${resp.status}` };
        }
        const data = await resp.json();
        setG((st) => ({ ...st, locked: data.new_locked }));
        return { ok: true, data };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    // --- Quiz éducatif ---
    // Tire la prochaine question. Lecture seule : le serveur n'écrit rien ici et
    // ne renvoie jamais la bonne réponse — seulement l'énoncé et les trois choix.
    async fetchQuizQuestion() {
      const s = gRef.current;
      if (!s.wallet) return { ok: false };
      try {
        const lang = encodeURIComponent(I18N.getLang() || "FR");
        const resp = await fetch(`${API_URL}/quiz/next/${encodeURIComponent(s.wallet)}?lang=${lang}`);
        if (!resp.ok) return { ok: false };
        return { ok: true, data: await resp.json() };
      } catch (e) {
        return { ok: false };
      }
    },
    // Répond. La destination ne se choisit pas ici : le serveur crédite toujours
    // le joueur d'abord (il ne peut pas décider avant de savoir s'il a juste), et
    // c'est donateQuiz qui convertit ensuite ce gain en don.
    async answerQuiz(questionId, choice) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const lang = encodeURIComponent(I18N.getLang() || "FR");
        const resp = await fetch(`${API_URL}/quiz/answer?lang=${lang}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ question_id: questionId, choice }),
        });
        if (resp.status === 401) {
          const re = await actions.authenticate(gRef.current.wallet);
          if (!re) { toast(I18N.t("AUTH_EXPIRED"), "bad"); return { ok: false, reason: "auth" }; }
          return { ok: false, reason: "retry" };
        }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return { ok: false, reason: err.error || `Erreur ${resp.status}` };
        }
        const data = await resp.json();
        if (data.reward > 0) setG((st) => ({ ...st, locked: (st.locked || 0) + data.reward }));
        return { ok: true, data };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    // Convertit le gain déjà crédité en don au pool de rachat (fenêtre de 60 s
    // côté serveur). Le solde verrouillé redescend d'autant.
    async donateQuiz(questionId) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/quiz/donate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ question_id: questionId }),
        });
        if (resp.status === 401) {
          const re = await actions.authenticate(gRef.current.wallet);
          if (!re) { toast(I18N.t("AUTH_EXPIRED"), "bad"); return { ok: false, reason: "auth" }; }
          return { ok: false, reason: "retry" };
        }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return { ok: false, reason: err.error || `Erreur ${resp.status}` };
        }
        const data = await resp.json();
        const donne = data.granted_pool || 0;
        if (donne > 0) setG((st) => ({ ...st, locked: Math.max(0, (st.locked || 0) - donne) }));
        return { ok: true, data };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    // Bandeau public : aucune authentification, réponse déjà cachée 30 s côté serveur.
    async fetchQuizTicker() {
      try {
        const resp = await fetch(`${API_URL}/quiz/ticker`);
        if (!resp.ok) return { ok: false };
        return { ok: true, data: await resp.json() };
      } catch (e) {
        return { ok: false };
      }
    },
    // Fiche de prestige : deux compteurs (savoir, contribution) et leurs titres.
    async fetchQuizProfile() {
      const s = gRef.current;
      if (!s.wallet) return { ok: false };
      try {
        const resp = await fetch(`${API_URL}/quiz/profile/${encodeURIComponent(s.wallet)}`);
        if (!resp.ok) return { ok: false };
        return { ok: true, data: await resp.json() };
      } catch (e) {
        return { ok: false };
      }
    },
    // --- Parcours de découverte ---
    // État du parcours. Le serveur recompte la progression à chaque appel : le
    // client n'en garde aucune trace et n'en calcule jamais. `eligible: false`
    // (compte venu avec UniSat) est une réponse normale, pas une erreur.
    async discoveryState() {
      const s = gRef.current;
      if (!s.authToken) return { ok: false };
      try {
        const r = await fetch(`${API_URL}/discovery/state`, {
          headers: { "Authorization": `Bearer ${s.authToken}` },
        });
        if (!r.ok) return { ok: false };
        return { ok: true, data: await r.json() };
      } catch (e) {
        return { ok: false };
      }
    },
    // Réclame une étape. On n'envoie QUE son identifiant : c'est le serveur qui
    // décide si elle est accomplie, et qui connaît le montant.
    async claimDiscovery(stepId) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const r = await fetch(`${API_URL}/discovery/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ step: stepId }),
        });
        if (r.status === 409) return { ok: false, reason: "deja" };
        if (!r.ok) return { ok: false, reason: r.status >= 500 ? "server" : "refuse" };
        const d = await r.json();
        // Appliquer le solde RENVOYÉ par le serveur, jamais locked + reward : le
        // gain part en liquide ou en verrouillé selon que le compte est vérifié, et
        // d'autres sources créditent en parallèle. Sans cette mise à jour l'écran
        // gardait l'ancien chiffre et le joueur croyait sa récompense perdue —
        // « Réclamé ✓ » sans rien voir arriver (signalé en parcours le 28/07).
        setG((st) => ({
          ...st,
          liquid: d.new_liquid != null ? Number(d.new_liquid) : st.liquid,
          locked: d.new_locked != null ? Number(d.new_locked) : st.locked,
        }));
        return { ok: true, reward: Number(d.reward) || 0 };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    // Soumet le txid de la poussière reçue. Le serveur connaît la valeur attendue.
    async submitDustTxid(txid) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const r = await fetch(`${API_URL}/discovery/txid`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ txid: String(txid || "").trim() }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          if (j.error === "poussiere_non_envoyee") return { ok: false, reason: "dust" };
          if (j.error === "txid_invalide") return { ok: false, reason: "bad" };
          return { ok: false, reason: r.status >= 500 ? "server" : "refuse" };
        }
        const d = await r.json();
        setG((st) => ({ ...st, onchainVerified: true }));
        // Le serveur ne déclenche PAS l'envoi de l'airdrop lui-même (discovery.js
        // ne peut pas requérir server.js — cycle — et le chemin d'envoi d'argent
        // réel ne doit pas être dupliqué). C'est à nous d'enchaîner, sinon le
        // message « ton airdrop est en route » serait un mensonge.
        //
        // On poste `s.wallet`, l'adresse du compte : /claim-airdrop exige que le
        // wallet du corps soit celui du jeton, et c'est LUI qui redirige ensuite
        // l'envoi vers le portefeuille lié. Poster `d.wallet` donnerait un 403.
        if (d.airdrop_pending) await actions.claimAirdropIfNew(s.wallet, s.authToken, true);
        return { ok: true, airdrop_pending: !!d.airdrop_pending };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    async fetchLoginReward() {
      const s = gRef.current;
      if (!s.wallet) return { ok: false };
      try {
        const resp = await fetch(`${API_URL}/login-reward/${encodeURIComponent(s.wallet)}`);
        if (!resp.ok) return { ok: false };
        const data = await resp.json();
        return { ok: true, data };
      } catch (e) {
        return { ok: false };
      }
    },
    async claimLoginReward() {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/login-reward/claim`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({}),
        });
        if (resp.status === 401) {
          const re = await actions.authenticate(gRef.current.wallet);
          if (!re) { toast(I18N.t("AUTH_EXPIRED"), "bad"); return { ok: false, reason: "auth" }; }
          return { ok: false, reason: "retry" };
        }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          return { ok: false, reason: err.error || `Erreur ${resp.status}` };
        }
        const data = await resp.json();
        setG((st) => ({ ...st, locked: data.new_locked }));
        toast(I18N.t("LOGIN_REWARD_GRANTED", data.reward_granted), "good");
        return { ok: true, data };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },
    async sendRoomMessage(content) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/chat-room/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ content }),
        });
        if (resp.status === 429) return { ok: false, reason: "rate" };
        const data = await resp.json();
        if (data.status === "ok") return { ok: true };
        return { ok: false, reason: data.reason || "blocked" };
      } catch (e) {
        return { ok: false, reason: "network" };
      }
    },

    async rename(id, name) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      const cost = D.ECON.VANITY_RENAME;
      if (s.liquid + s.locked < cost) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      try {
        const resp = await fetch(`${API_URL}/vanity/rename-creature`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, beast_id: id, new_name: name }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },
    async setTitle(title) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      const cost = D.ECON.VANITY_TITLE;
      if (s.liquid + s.locked < cost) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      try {
        const resp = await fetch(`${API_URL}/vanity/set-title`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, title }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    deposit(n) { setG((s) => ({ ...s, liquid: s.liquid + n })); return { ok: true }; },
    setOrdinalName(name) { setG((s) => ({ ...s, ordinalName: name })); return { ok: true }; },
    withdraw(n) {
      const s = gRef.current;
      if (n < D.ECON.WITHDRAW_MIN) return { ok: false, reason: I18N.t("WL_WD_MIN", D.ECON.WITHDRAW_MIN) };
      if (n > D.ECON.WITHDRAW_MAX) return { ok: false, reason: I18N.t("WL_WD_MAX", D.ECON.WITHDRAW_MAX) };
      if (n > s.liquid) return { ok: false, reason: I18N.t("WL_WD_INSUFF") };
      setG((st) => ({ ...st, liquid: st.liquid - n }));
      return { ok: true };
    },

    // ---- Campagne PvE (local) ----
    // Combat de campagne SERVEUR-AUTORITATIF : le serveur paie l'entrée (free/24h ou
    // ticket Argent), exécute le combat, crédite les récompenses en delta et persiste
    // la progression. Renvoie { ok, events, enemy, won, survivors, stars, reward, free,
    // titleUnlocked, legend } ou { ok:false, reason }.
    async campaignFight(worldIndex, floorIndex, selectedIds, posture) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: I18N.t("CAMP_NO_TICKET") };
      try {
        const resp = await fetch(`${API_URL}/campaign/fight`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ world_index: worldIndex, floor_index: floorIndex, selected: selectedIds, posture: posture || "equilibre" }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          const reason = data.error === "no_entry" ? I18N.t("CAMP_NO_TICKET")
            : data.error === "étage verrouillé" ? I18N.t("CAMP_LOCKED")
            : data.error || "Erreur serveur";
          return { ok: false, reason };
        }
        const nested = nestProgress(data.progress);
        // Titres : dérivés de la progression serveur (cosmétique)
        const titles = s.campaignTitles.slice();
        let titleUnlocked = null, legend = false;
        D.WORLDS.forEach((_, i) => {
          const wp = nested[i];
          const total = wp ? wp.stars.reduce((a, b) => a + b, 0) : 0;
          const key = "CAMP_W" + (i + 1) + "_TITLE";
          if (total === D.STARS_PER_WORLD && !titles.includes(key)) { titles.push(key); titleUnlocked = key; }
        });
        const allDone = D.WORLDS.every((_, i) => {
          const wp = nested[i];
          return wp && wp.stars.reduce((a, b) => a + b, 0) === D.STARS_PER_WORLD;
        });
        if (allDone && !titles.includes("CAMP_LEGEND_TITLE")) { titles.push("CAMP_LEGEND_TITLE"); legend = true; }

        setG((st) => ({
          ...st,
          locked: data.new_locked ?? st.locked,
          ticketsSilver: data.tickets_silver ?? st.ticketsSilver,
          ticketsGold: data.tickets_gold ?? st.ticketsGold,
          campaignProgress: nested,
          campaignFreeTs: data.campaign_free_ts ?? st.campaignFreeTs,
          campaignTitles: titles,
        }));
        return {
          ok: true, events: data.events || [], enemy: data.enemy || [],
          won: !!data.won, survivors: data.survivors || 0, stars: data.stars || 0,
          reward: data.reward || { lockedGain: 0, silver: 0, gold: 0 }, free: !!data.free,
          titleUnlocked, legend,
        };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    // ---- Tour infinie (serveur-autoritaire, routes /tower/*) ----
    // reason = code serveur brut ("run_actif", "solde_insuffisant", "pas_de_run",
    // "betes_invalides") ou "auth"/"Erreur réseau" — mappé en i18n par tour.jsx.
    async towerState() {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/tower/state`, { headers: { "Authorization": `Bearer ${s.authToken}` } });
        const data = await resp.json();
        if (!resp.ok) return { ok: false, reason: data.error || "Erreur serveur" };
        return { ok: true, weekKey: data.week_key, weekEndsAt: data.week_ends_at, run: data.run, score: data.score, mutators: data.mutators || [] };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async towerStart() {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/tower/start`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` }, body: "{}",
        });
        const data = await resp.json();
        if (!resp.ok || data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        if ((data.cost || 0) > 0) {
          // Miroir EXACT de deductBalance serveur : liquide d'abord, puis verrouillé.
          setG((st) => {
            const dl = Math.min(data.cost, st.liquid);
            return { ...st, liquid: st.liquid - dl, locked: st.locked - (data.cost - dl) };
          });
        }
        return { ok: true, freeUsed: !!data.free_used, cost: data.cost || 0, run: data.run };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async towerFight(selectedIds, posture) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/tower/fight`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ beast_ids: selectedIds, posture: posture || "equilibre" }),
        });
        const data = await resp.json();
        if (!resp.ok || data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const rw = data.rewards || { fa: 0, silver: 0, gold: 0, tiers: [] };
        if ((rw.fa || 0) > 0 || (rw.silver || 0) > 0 || (rw.gold || 0) > 0) {
          // Paliers crédités serveur en FA LIQUIDES (contrairement à la campagne) + tickets.
          setG((st) => ({
            ...st,
            liquid: st.liquid + (rw.fa || 0),
            ticketsSilver: st.ticketsSilver + (rw.silver || 0),
            ticketsGold: st.ticketsGold + (rw.gold || 0),
          }));
        }
        return {
          ok: true, won: !!data.won, floor: data.floor, bestFloor: data.best_floor || 0,
          rewards: rw, runOver: !!data.run_over, rosterState: data.roster_state || {},
          events: data.events || [], enemy: data.enemy || [],
        };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async towerAbandon() {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { ok: false, reason: "auth" };
      try {
        const resp = await fetch(`${API_URL}/tower/abandon`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` }, body: "{}",
        });
        const data = await resp.json();
        if (!resp.ok || data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async towerLeaderboard() {
      try {
        const resp = await fetch(`${API_URL}/tower/leaderboard`);
        const data = await resp.json();
        if (!resp.ok) return { ok: false };
        return { ok: true, weekKey: data.week_key, weekEndsAt: data.week_ends_at, top: data.top || [] };
      } catch (e) { return { ok: false }; }
    },

    async pvpRefresh() {
      const w = gRef.current.wallet; if (!w) return;
      const authHeaders = () => ({ "Authorization": "Bearer " + gRef.current.authToken });
      try {
        const [cad, season, opp, ladder, atk] = await Promise.all([
          fetch(`${API_URL}/pvp/cadence`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({})),
          fetch(`${API_URL}/pvp/season`).then((r) => r.json()).catch(() => ({})),
          fetch(`${API_URL}/pvp/opponents`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({})),
          fetch(`${API_URL}/pvp/ladder?wallet=${encodeURIComponent(w)}`).then((r) => r.json()).catch(() => ({})),
          fetch(`${API_URL}/pvp/attacks-on-me`, { headers: authHeaders() }).then((r) => r.json()).catch(() => ({})),
        ]);
        const myRow = (ladder.ladder || []).find((x) => x.wallet === w);
        setG((s) => ({ ...s, pvp: {
          league: (myRow && myRow.league) || ladder.league,
          rating: myRow ? myRow.rating : undefined,
          free_remaining: cad.free_remaining, fa_cost: cad.fa_cost, revanches: cad.revanches || [],
          season: season && season.ok ? season : undefined,
          opponents: opp.opponents || [], power: opp.power || 0, ladder: ladder.ladder || [],
          attacks: atk.attacks || [], attacksUnseen: atk.unseen || 0,
        } }));
      } catch (e) { /* silencieux */ }
    },
    async pvpPrizes() {
      if (!gRef.current.authToken) return;
      try {
        const r = await fetch(`${API_URL}/pvp/prizes`, { headers: { "Authorization": "Bearer " + gRef.current.authToken } });
        const data = await r.json().catch(() => ({}));
        if (data.ok) setG((s) => ({ ...s, pvpPrizes: data.prizes || [] }));
      } catch (e) { /* silencieux */ }
    },
    async pvpPrizesSeen() {
      try {
        await fetch(`${API_URL}/pvp/prizes/seen`, { method: "POST", headers: { "Authorization": "Bearer " + gRef.current.authToken } });
      } catch (e) { /* silencieux */ }
      setG((s) => ({ ...s, pvpPrizes: [] }));
    },
    async towerPrizes() {
      if (!gRef.current.authToken) return;
      try {
        const r = await fetch(`${API_URL}/tower/prizes`, { headers: { "Authorization": "Bearer " + gRef.current.authToken } });
        const data = await r.json().catch(() => ({}));
        if (data.ok) setG((s) => ({ ...s, towerPrizes: data.prizes || [] }));
      } catch (e) { /* silencieux */ }
    },
    async towerPrizesSeen() {
      try {
        await fetch(`${API_URL}/tower/prizes/seen`, { method: "POST", headers: { "Authorization": "Bearer " + gRef.current.authToken } });
      } catch (e) { /* silencieux */ }
      setG((s) => ({ ...s, towerPrizes: [] }));
    },
    async pvpAttacksSeen() {
      if (!gRef.current.authToken) return;
      try {
        await fetch(`${API_URL}/pvp/attacks-seen`, { method: "POST", headers: { "Authorization": "Bearer " + gRef.current.authToken } });
      } catch (e) { /* silencieux */ }
      setG((s) => ({ ...s, pvp: { ...s.pvp, attacksUnseen: 0 } }));
    },
    async pvpSetDefense(posture) {
      const authHeaders = () => ({ "Authorization": "Bearer " + gRef.current.authToken });
      const sel = gRef.current.selected; if (sel.length !== 3) return { ok: false, error: "3 bêtes requises" };
      const r = await fetch(`${API_URL}/pvp/defense`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ selected: sel, posture: posture || "equilibre" }) });
      const j = await r.json().catch(() => ({})); return j;
    },
    async pvpDefenseOf(wallet) {
      if (!wallet) return { posture: "equilibre" };
      try {
        const r = await fetch(`${API_URL}/pvp/defense/${encodeURIComponent(wallet)}`);
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !j) return { posture: "equilibre" };
        return { team: j.team || [], posture: j.posture || "equilibre" };
      } catch (e) { return { posture: "equilibre" }; }
    },
    async pvpAttack(target, entry, attackers, posture) {
      const authHeaders = () => ({ "Authorization": "Bearer " + gRef.current.authToken });
      const body = { target, entry, posture: posture || "equilibre" };
      if (Array.isArray(attackers) && attackers.length === 3) body.attackers = attackers;
      const r = await fetch(`${API_URL}/pvp/attack`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      // Déduction optimiste à l'écran : le serveur a déjà débité (FA → liquid, ou 1 ticket Argent).
      // pvpRefresh ne recharge pas le solde, donc pas de double-comptage.
      if (j && j.ok) {
        if (j.entry === "fa") {
          const cost = (gRef.current.pvp && gRef.current.pvp.fa_cost) || 50;
          setG((s) => ({ ...s, liquid: Math.max(0, (s.liquid || 0) - cost) }));
        } else if (j.entry === "ticket") {
          setG((s) => ({ ...s, ticketsSilver: Math.max(0, (s.ticketsSilver || 0) - 1) }));
        }
      }
      return j;
    },

    // ---- Marché (hôtel des ventes reliques) ----
    async marketRefresh() {
      const s = gRef.current;
      try {
        const r = await fetch(`${API_URL}/market/listings`);
        const j = await r.json().catch(() => ({}));
        let mine = null;
        if (s.authToken) {
          const rm = await fetch(`${API_URL}/market/mine`, { headers: { "Authorization": "Bearer " + s.authToken } });
          if (rm.ok) mine = await rm.json().catch(() => null);
        }
        setG((st) => ({ ...st, market: { listings: (j && j.listings) || [], mine } }));
      } catch (e) { /* réseau : on garde l'état précédent */ }
    },
    // Après toute mutation : resync du save (solde + inventaire), pattern relicSummon.
    async marketResync() {
      const s = gRef.current;
      if (!s.wallet) return;
      try {
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
      } catch (e) { /* silencieux */ }
    },
    async marketList(relicId, price) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { error: "auth" };
      const r = await fetch(`${API_URL}/market/list`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.authToken },
        body: JSON.stringify({ wallet: s.wallet, relic_id: relicId, price }),
      });
      const j = await r.json().catch(() => ({ error: "erreur_serveur" }));
      if (j && j.status === "ok") { await actions.marketResync(); await actions.marketRefresh(); }
      return j;
    },
    async marketBuy(listingId) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { error: "auth" };
      const r = await fetch(`${API_URL}/market/buy`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.authToken },
        body: JSON.stringify({ wallet: s.wallet, listing_id: listingId }),
      });
      const j = await r.json().catch(() => ({ error: "erreur_serveur" }));
      if (j && j.status === "ok") { await actions.marketResync(); await actions.marketRefresh(); }
      return j;
    },
    async marketCancel(listingId) {
      const s = gRef.current;
      if (!s.wallet || !s.authToken) return { error: "auth" };
      const r = await fetch(`${API_URL}/market/cancel`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.authToken },
        body: JSON.stringify({ wallet: s.wallet, listing_id: listingId }),
      });
      const j = await r.json().catch(() => ({ error: "erreur_serveur" }));
      if (j && j.status === "ok") { await actions.marketResync(); await actions.marketRefresh(); }
      return j;
    },
  }), []);

  const ctx = { g, actions, toast };

  if (!g.wallet) {
    if (!cineDone && Cinematique) {
      return (
        <FA_Ctx.Provider value={ctx}>
          <Cinematique onEnter={() => setCineDone(true)} />
          {accSecrets && <window.SecretsGate secrets={accSecrets} onDone={() => setAccSecrets(null)} />}
        </FA_Ctx.Provider>
      );
    }
    return (
      <FA_Ctx.Provider value={ctx}>
        <Ambient />
        <Onboarding onAccountCreated={(s) => setAccSecrets(s)} />
        <Toasts toasts={toasts} />
        {/* Aussi avant connexion : sans réseau, on ne peut même pas créer de
            compte — le dire tout de suite vaut mieux qu'un bouton qui échoue. */}
        <window.PwaOfflineGate etat={etatReseau} onReessayer={() => setEnLigne(navigator.onLine !== false)} />
        {accSecrets && <window.SecretsGate secrets={accSecrets} onDone={() => setAccSecrets(null)} />}
      </FA_Ctx.Provider>
    );
  }

  const VIEWS = { team: Team, fosse: Fosse, arene: Arene, campaign: Campaign, tour: Tour, quests: Quests, forge: Forge, market: Market, wallet: Wallet, boosts: Boosts, perso: Perso, leaderboard: Leaderboard, options: Options, lien: Link };

  const View = VIEWS[g.view] || Team;

  return (
    <FA_Ctx.Provider value={ctx}>
      <Ambient />
      <div className="app-shell">
        <Header chipPop={chipPop} />
        {/* Contrepartie économique du compte sans wallet : doit être vue, pas juste exister.
            Rendu ICI (dans .app-shell, sous le Header) plutôt qu'en frère du shell — sinon
            elle atterrit tout en bas du document (.app-shell fait min-height: 100vh) et,
            sur mobile, sous la barre de nav fixe (audit IMPORTANT 5, 2026-07-27). */}
        {g.wallet && <LockedBanner />}
        {g.wallet && <window.PwaInstallBanner prompt={pwaPrompt} onInstalled={() => setPwaPrompt(null)} />}
        <BuybackTicker />
        <Nav />
        <div className="view-anim" key={g.view}><View /></div>
      </div>
      <ChatFab />
      <RoomFab />
      <Toasts toasts={toasts} />
      <window.PwaOfflineGate etat={etatReseau} onReessayer={() => setEnLigne(navigator.onLine !== false)} />
      {g.wallet && <TutorialGate />}
      {g.wallet && <LoginGate />}
      {accSecrets && <window.SecretsGate secrets={accSecrets} onDone={() => setAccSecrets(null)} />}
      {(() => {
        const pz = [
          ...(Array.isArray(g.pvpPrizes) ? g.pvpPrizes.map((p) => ({ ...p, kind: "pvp" })) : []),
          ...(Array.isArray(g.towerPrizes) ? g.towerPrizes.map((p) => ({ ...p, kind: "tower" })) : []),
        ];
        return pz.length > 0 && <window.PrizeModal prizes={pz} onClaim={() => {
          if (g.pvpPrizes && g.pvpPrizes.length) actions.pvpPrizesSeen();
          if (g.towerPrizes && g.towerPrizes.length) actions.towerPrizesSeen();
        }} />;
      })()}
    </FA_Ctx.Provider>
  );
}

function Ambient() {
  // Fond blockchain vivante (esthétique #5 volet 2) — repli silencieux si module absent
  useEffect(() => { window.FA_CHAIN_BG?.mount(); }, []);
  const embers = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 26; i++) {
      arr.push({
        left: Math.random() * 100,
        dur: 7 + Math.random() * 9,
        delay: -Math.random() * 14,
        drift: (Math.random() * 80 - 40) + "px",
        cy: Math.random() < 0.4,
        size: 2 + Math.random() * 2.5,
      });
    }
    return arr;
  }, []);
  return (
    <>
      <div className="app-bg" />
      <div className="embers">
        {embers.map((e, i) => (
          <span key={i} className={cx("ember", e.cy && "cy")} style={{ left: e.left + "%", width: e.size, height: e.size, animationDuration: e.dur + "s", animationDelay: e.delay + "s", "--drift": e.drift }} />
        ))}
      </div>
    </>
  );
}

function Header({ chipPop }) {
  const { g, actions } = useFA();
  return (
    <header className="hdr">
      {window.Emblem3D
        ? <span className="hdr-logo" style={{ display: "inline-block" }}><window.Emblem3D /></span>
        : <img className="hdr-logo" src="assets/LOGO_cut.webp" alt="Fractal Arena" />}
      <div className="hdr-word">
        <span className="hdr-title">FRACTAL ARENA</span>
        <span className="hdr-sub">FRACTAL BITCOIN · AUTO-BATTLER</span>
      </div>
      {window.FA_API_URL && window.FA_API_URL.includes("localhost") &&
        <span className="pill mono" style={{ background: "rgba(255,59,92,0.14)", border: "1px solid var(--alert)", color: "var(--alert)", fontSize: 10, letterSpacing: 2, padding: "3px 8px" }}>LOCAL</span>}
      <div className="hdr-spacer" />
      <div className="flex gap8 center wrap" style={{ justifyContent: "flex-end" }}>
        <span key={chipPop} className="chip pop"><img src="assets/TOKEN.png" alt="" width="16" height="16" style={{ borderRadius: 3, border: "1px solid var(--line)" }} /> {fmt(g.liquid)}</span>
        {g.locked > 0 && <span className="chip locked"><img src="assets/TOKEN.png" alt="" width="16" height="16" style={{ borderRadius: 3, border: "1px solid var(--line)" }} /> {fmt(g.locked)} {I18N.t("LOCKED_CHIP")}</span>}
        <div className="lang-switch">
          {[["FR", "FR"], ["EN", "EN"], ["ZH", "中文"]].map(([code, lbl]) => (
            <button key={code} className={g.lang === code ? "on" : ""} onClick={() => actions.setLang(code)}>{lbl}</button>
          ))}
        </div>
        <button
          className="btn ghost sm tut-help"
          title={I18N.t("TUT_HELP")}
          aria-label={I18N.t("TUT_HELP")}
          onClick={() => window.dispatchEvent(new Event("fa-open-tutorial"))}
        >?</button>
      </div>
    </header>
  );
}

function Nav() {
  const { g, actions } = useFA();
  const tabs = [
    ["team", "NAV_TEAM"], ["fosse", "NAV_FOSSE"], ["arene", "NAV_ARENE"], ["campaign", "NAV_CAMPAIGN"], ["tour", "NAV_TOUR"], ["quests", "NAV_QUESTS"], ["forge", "NAV_FORGE"], ["market", "NAV_MARKET"],
    ["wallet", "NAV_WALLET"], ["boosts", "NAV_BOOSTS"], ["perso", "NAV_PERSO"], ["leaderboard", "NAV_LEADERBOARD"], ["options", "NAV_OPTIONS"],
  ];
  return (
    <nav className="nav">
      {tabs.map(([k, key]) => (
        <button key={k} className={cx("nav-tab", g.view === k && "on")} onClick={() => { if (window.FA_SFX) window.FA_SFX.play("tab"); actions.setView(k); }}>
          <img className="nav-icon" src={`assets/nav-icons/${k}.png?v=74`} alt="" aria-hidden="true" draggable="false" />
          <span className="nav-label">{I18N.t(key)}</span>
          {k === "arene" && g.pvp && g.pvp.attacksUnseen > 0 && (
            <span className="nav-badge" style={{ marginLeft: 4, background: "var(--alert)", color: "#fff", borderRadius: 9, fontSize: 10, padding: "0 5px", fontWeight: 700 }}>
              {g.pvp.attacksUnseen}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

function Onboarding({ onAccountCreated }) {
  const { actions, toast } = useFA();
  const [addr, setAddr] = useState("");
  // Quelle action est en cours : null | "create" | "connect" | "manual".
  // Un booléen partagé ne suffit pas — il bloque bien les trois boutons, mais il
  // ne dit pas LAQUELLE tourne, et « Création… » s'affichait alors sur « Jouer
  // maintenant » quand le joueur cliquait « J'ai déjà un wallet » (constaté en
  // prod le 28/07). Voir aussi que tout bouton reste gardé par `busy`, sinon un
  // double-clic créerait deux comptes dont un orphelin.
  const [busy, setBusy] = useState(null);
  const [manual, setManual] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const hasWallet = HAS_UNISAT();
  const mobile = IS_MOBILE();

  async function connectUnisat() {
    setBusy("connect");
    let r;
    try { r = await actions.connectUnisat(); } finally { setBusy(null); }
    if (!r.ok) toast(I18N.t("OB_CONNECT_FAIL"), "bad");
  }
  async function connectManual() {
    const a = addr.trim();
    if (a.length < 20 || !/^bc1/i.test(a)) { toast(I18N.t("OB_INVALID"), "bad"); return; }
    setBusy("manual");
    try {
      const token = await actions.authenticate(a);
      const isNew = await actions.connectWallet(a, token);
      await actions.claimAirdropIfNew(a, token, isNew);
    } finally {
      setBusy(null);
    }
  }
  // Entrée sans friction : on crée le compte, puis on remonte les secrets vers App —
  // createAccount() pose déjà g.wallet, donc Onboarding peut être démonté au rendu
  // suivant. L'écran des secrets vit au niveau du shell (App), pas ici, pour lui survivre.
  async function playNow() {
    setBusy("create");
    let r;
    try { r = await actions.createAccount(); } finally { setBusy(null); }
    if (!r.ok) { toast(I18N.t("ACC_CREATE_FAIL"), "bad"); return; }
    onAccountCreated && onAccountCreated({ recovery_code: r.recovery_code });
  }

  return (
    <div className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", position: "relative", zIndex: 1 }}>
      <div style={{ textAlign: "center", maxWidth: 540, padding: 28, position: "relative" }}>
        <div className="ob-logo" style={{ position: "relative", width: 168, height: 168, margin: "0 auto 26px", animation: "obFloat 4.5s ease-in-out infinite" }}>
          {window.Emblem3D
            ? <window.Emblem3D style={{ filter: "drop-shadow(0 0 18px rgba(247,147,26,0.35))" }} />
            : <img src="assets/LOGO_cut.webp" alt="Fractal Arena" style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 18px rgba(247,147,26,0.35))" }} />}
        </div>
        <div className="eyebrow">{I18N.t("OB_TAG")}</div>
        <div className="hdr-title" style={{ fontSize: 40, letterSpacing: 6, display: "block", margin: "8px 0 18px" }}>FRACTAL ARENA</div>

        <div className="h2" style={{ fontSize: 18, marginBottom: 8 }}>{I18N.t("ACC_PLAY_NOW")}</div>
        <div className="muted mono" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 18 }}>{I18N.t("ACC_PLAY_NOW_SUB")}</div>
        <button className="btn btn-fire block lg" disabled={!!busy} onClick={playNow}>
          {busy === "create" ? I18N.t("ACC_CREATING") : I18N.t("ACC_PLAY_NOW")}
        </button>
        <div className="pill" style={{ marginTop: 14, color: "var(--gold)", borderColor: "rgba(255,230,0,0.3)" }}>🎁 {I18N.t("OB_GIFT")}</div>

        {/* Action secondaire : le joueur qui a deja un wallet garde son flux d'avant. Sur
            mobile, UniSat n'existe pas en extension : pas de lien mort, on n'affiche rien —
            « Jouer maintenant » ci-dessus est deja l'action complete, plus de cul-de-sac. */}
        {hasWallet ? (
          <button className="btn block" style={{ marginTop: 12 }} disabled={!!busy} onClick={connectUnisat}>
            {I18N.t("ACC_HAVE_WALLET")}
          </button>
        ) : (
          !mobile && (
            <a className="btn block" style={{ marginTop: 12 }} href="https://unisat.io/download" target="_blank" rel="noopener noreferrer">
              {I18N.t("OB_INSTALL_EXT_BTN")}
            </a>
          )
        )}

        <div style={{ marginTop: 14 }}>
          <button className="btn-link" style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }}
                  onClick={() => setRecovering(true)}>{I18N.t("ACC_RECOVER_LINK")}</button>
        </div>

        <div style={{ marginTop: 16 }}>
          <button className="btn-link" style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }} onClick={() => setManual(!manual)}>{I18N.t("OB_MANUAL_TOGGLE")}</button>
        </div>
        {manual && (
          <div style={{ marginTop: 10 }}>
            <input className="field" style={{ textAlign: "center", marginBottom: 10 }} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={I18N.t("OB_PLACEHOLDER")} onKeyDown={(e) => e.key === "Enter" && connectManual()} />
            <button className="btn block" disabled={!!busy} onClick={connectManual}>{busy === "manual" ? I18N.t("OB_CHECKING") : I18N.t("OB_BTN")}</button>
          </div>
        )}

        <div className="lang-switch" style={{ margin: "16px auto 0", width: "fit-content" }}>
          {[["FR", "Français"], ["EN", "English"], ["ZH", "中文"]].map(([code, lbl]) => (
            <button key={code} className={I18N.getLang() === code ? "on" : ""} onClick={() => actions.setLang(code)}>{lbl}</button>
          ))}
        </div>
      </div>

      {recovering && <window.RecoverScreen onClose={() => setRecovering(false)} />}
    </div>
  );
}

function Toasts({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => <div key={t.id} className={cx("toast", t.kind)}>{t.msg}</div>)}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
