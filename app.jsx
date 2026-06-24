/* ============================================================
   FRACTAL ARENA — App root: state, actions, shell
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { FA_Ctx, useFA, cx, fmt, Coin, Bar } = window;
const { Team, Fosse, Arene, Forge, Wallet, Boosts, Perso, Options, ChatFab, RoomFab, Leaderboard, Quests, Campaign, LoginGate, TutorialGate, Link, Cinematique } = window;
const SAVE_KEY = "fractal_arena_v1";
// Le bearer authToken vit en sessionStorage (et JAMAIS dans le blob localStorage) : il survit
// au rechargement de l'onglet (pas de re-signature à chaque F5) mais est effacé à la fermeture
// de l'onglet → bien moins exposé qu'un token persisté en localStorage (audit 2026-06-24).
const TOKEN_KEY = "fa_auth_token";
function readToken() { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (e) { return ""; } }
function writeToken(t) { try { if (t) sessionStorage.setItem(TOKEN_KEY, t); else sessionStorage.removeItem(TOKEN_KEY); } catch (e) {} }
function clearToken() { try { sessionStorage.removeItem(TOKEN_KEY); } catch (e) {} }
const API_URL = "https://fractal-arena-server-production.up.railway.app";
const CLIENT_SECRET = "pastouche";
const HAS_UNISAT = () => typeof window.unisat !== "undefined";
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
  const roster = Array.isArray(save.creatures) && save.creatures.length > 0 ? save.creatures : D.starterRoster();
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
    selected: s.selected.filter((id) => rosterIds.has(id)), // retire les ids absents du nouveau roster
    playerName: save.player_name || (addr.slice(0, 6) + "…" + addr.slice(-4)),
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
    player_name: g.playerName,
    ordinal_name: g.ordinalName,
    lang: g.lang,
    airdrop_claimed: false,
    creatures: g.roster,
  };
}

function freshState() {
  return {
    lang: "FR",
    wallet: null,
    liquid: 0,
    locked: 0,
    useLocked: false,
    roster: [],
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
    options: { sound: true, anim: true, speed: 1 },
    view: "team",
    authToken: "",
    serverFight: null,
    totem: null,   // { type, tier, active, loyaltyDays, worldsCompleted, paidWins, aura }
    pvp: {},
    pvpPrizes: [],
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return Object.assign(freshState(), s, {
      view: "team",
      // Token restauré depuis sessionStorage (survit au rechargement de l'onglet, effacé à
      // sa fermeture — bien moins exposé que localStorage). JAMAIS dans le blob localStorage.
      authToken: readToken(),
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
        let token = gRef.current.authToken;        // restauré depuis sessionStorage
        if (!token) token = await actions.authenticate(w);
        await actions.connectWallet(w, token);
      })();
    }
  }, []);

  // persist
  useEffect(() => {
    // authToken EXCLU du blob localStorage (sinon volable trivialement par une XSS) ; il est
    // stocké à part en sessionStorage (effacé à la fermeture de l'onglet, survit au F5).
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...g, authToken: "" })); } catch (e) { }
    writeToken(g.authToken);
  }, [g]);

  // Fetch non-vu des prix PvP dès que le token est établi
  useEffect(() => { if (g.authToken) actions.pvpPrizes(); }, [g.authToken]);

  // language
  useEffect(() => { I18N.setLang(g.lang); }, [g.lang]);

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

  function toast(msg, kind) {
    const id = Math.random();
    setToasts((T) => [...T, { id, msg, kind }]);
    setTimeout(() => setToasts((T) => T.filter((t) => t.id !== id)), 2600);
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
            return next;
          });
          return false; // joueur existant
        } else if (saveResp.status === 404) {
          setG((s) => ({
            ...freshState(),
            lang: s.lang,
            options: s.options,
            wallet: addr,
            view: "team",
            playerName: addr.slice(0, 6) + "…" + addr.slice(-4),
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
              wallet: addr, view: "team",
              playerName: addr.slice(0, 6) + "…" + addr.slice(-4),
              roster: D.starterRoster(),
              locked: D.ECON.WELCOME_LOCKED,
              liquid: D.ECON.WELCOME_LIQUID,
              ticketsSilver: D.ECON.WELCOME_TICKETS_SILVER,
              ticketsGold: 0,
              freeFights: D.ECON.FREE_FIGHTS_PER_DAY,
              freeResetTs: Date.now(),
            };
          }
          return { ...s, wallet: addr, playerName: addr.slice(0, 6) + "…" + addr.slice(-4), ordinalName: "", selected: [], view: "team" };
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
    async authenticate(addr) {
      if (typeof window.unisat === "undefined") return "";
      try {
        const cr = await fetch(`${API_URL}/auth/challenge?wallet=${encodeURIComponent(addr)}&scope=session`);
        if (!cr.ok) return "";
        const ch = await cr.json();
        // Signe le message lié au scope si le serveur le fournit, sinon le nonce brut
        // (rétro-compat : le serveur actuel ne renvoie que `nonce`).
        const signature = await window.unisat.signMessage(ch.message || ch.nonce);
        const vr = await fetch(`${API_URL}/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: addr, signature }),
        });
        if (!vr.ok) return "";
        const { token } = await vr.json();
        if (token) setG((s) => ({ ...s, authToken: token }));
        return token || "";
      } catch (e) {
        return "";
      }
    },
    async connectUnisat() {
      if (typeof window.unisat === "undefined") return { ok: false, reason: "no-unisat" };
      try {
        const accounts = await window.unisat.requestAccounts();
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
    async authForWithdraw() {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "wallet" };
      if (typeof window.unisat === "undefined") return { ok: false, reason: "unisat" };
      try {
        const cr = await fetch(`${API_URL}/auth/challenge?wallet=${encodeURIComponent(s.wallet)}&scope=withdraw`);
        if (!cr.ok) return { ok: false, reason: "challenge" };
        const ch = await cr.json();
        // Signe le message lié au scope « withdraw » si le serveur le fournit, sinon le nonce
        // brut (rétro-compat). Lie la signature à l'intention de retrait une fois le serveur à jour.
        const signature = await window.unisat.signMessage(ch.message || ch.nonce);
        const vr = await fetch(`${API_URL}/auth/verify`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: s.wallet, signature, scope: "withdraw" }),
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
    async resetProgress() {
      const w = gRef.current.wallet;
      if (w) {
        try { await fetch(`${API_URL}/save/${w}/reset`, { method: "POST", headers: { "x-client-secret": CLIENT_SECRET } }); } catch (e) { }
      }
      try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
      setG(freshState());
    },

    toggleSelect(id) {
      setG((s) => {
        const has = s.selected.includes(id);
        let selected = has ? s.selected.filter((x) => x !== id) : (s.selected.length < 3 ? [...s.selected, id] : s.selected);
        return { ...s, selected };
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
      if (!s.authToken) return { ok: false, reason: "Connexion UniSat requise pour jouer" };
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
      const summary = { payout: 0, net: 0, xp: 0, pool: 0, burn: 0, milestone: false, luckyBonus: 0, insuranceUsed: false, betAmount, levelUps: [], rarityUps: [] };
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
            const pool = Math.floor(betAmount * D.ECON.DEFEAT_POOL_RATIO);
            const burn = betAmount - pool;
            summary.pool = pool; summary.burn = burn;
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

    async reroll(id) {
      const s = gRef.current;
      const beast = s.roster.find((b) => b.id === id);
      if (!beast) return { ok: false, reason: I18N.t("FG_PICK1") };
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/reroll`, {
          method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ wallet: s.wallet, beast_id: id }),
        });
        const data = await resp.json();
        if (data.status === "insufficient_balance") return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, data.cost || 0) };
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        // Mode pending : rien n'est appliqué ; on resynchronise le solde (débité) et on renvoie l'aperçu.
        const sv = await fetch(`${API_URL}/save/${s.wallet}`, svOpts());
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true, preview: { old_stats: data.old_stats, new_stats: data.new_stats, cost: data.cost, next_reroll_cost: data.next_reroll_cost } };
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
    async campaignFight(worldIndex, floorIndex, selectedIds) {
      const s = gRef.current;
      if (!s.authToken) return { ok: false, reason: I18N.t("CAMP_NO_TICKET") };
      try {
        const resp = await fetch(`${API_URL}/campaign/fight`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ world_index: worldIndex, floor_index: floorIndex, selected: selectedIds }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          const reason = data.error === "no_entry" ? I18N.t("CAMP_NO_TICKET")
            : data.error === "étage verrouillé" ? I18N.t("CAMP_LOCKED") || "Étage verrouillé"
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
          opponents: opp.opponents || [], ladder: ladder.ladder || [],
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
    async pvpAttacksSeen() {
      if (!gRef.current.authToken) return;
      try {
        await fetch(`${API_URL}/pvp/attacks-seen`, { method: "POST", headers: { "Authorization": "Bearer " + gRef.current.authToken } });
      } catch (e) { /* silencieux */ }
      setG((s) => ({ ...s, pvp: { ...s.pvp, attacksUnseen: 0 } }));
    },
    async pvpSetDefense() {
      const authHeaders = () => ({ "Authorization": "Bearer " + gRef.current.authToken });
      const sel = gRef.current.selected; if (sel.length !== 3) return { ok: false, error: "3 bêtes requises" };
      const r = await fetch(`${API_URL}/pvp/defense`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ selected: sel }) });
      const j = await r.json().catch(() => ({})); return j;
    },
    async pvpAttack(target, entry) {
      const authHeaders = () => ({ "Authorization": "Bearer " + gRef.current.authToken });
      const r = await fetch(`${API_URL}/pvp/attack`, { method: "POST", headers: { ...authHeaders(), "Content-Type": "application/json" }, body: JSON.stringify({ target, entry }) });
      const j = await r.json().catch(() => ({}));
      // Déduction optimiste à l'écran : le serveur a déjà débité (FA → liquid, ou 1 ticket or).
      // pvpRefresh ne recharge pas le solde, donc pas de double-comptage.
      if (j && j.ok) {
        if (j.entry === "fa") {
          const cost = (gRef.current.pvp && gRef.current.pvp.fa_cost) || 50;
          setG((s) => ({ ...s, liquid: Math.max(0, (s.liquid || 0) - cost) }));
        } else if (j.entry === "ticket") {
          setG((s) => ({ ...s, ticketsGold: Math.max(0, (s.ticketsGold || 0) - 1) }));
        }
      }
      return j;
    },
  }), []);

  const ctx = { g, actions, toast };

  if (!g.wallet) {
    if (!cineDone && Cinematique) {
      return (
        <FA_Ctx.Provider value={ctx}>
          <Cinematique onEnter={() => setCineDone(true)} />
        </FA_Ctx.Provider>
      );
    }
    return (
      <FA_Ctx.Provider value={ctx}>
        <Ambient />
        <Onboarding />
        <Toasts toasts={toasts} />
      </FA_Ctx.Provider>
    );
  }

  const VIEWS = { team: Team, fosse: Fosse, arene: Arene, campaign: Campaign, quests: Quests, forge: Forge, wallet: Wallet, boosts: Boosts, perso: Perso, leaderboard: Leaderboard, options: Options, lien: Link };

  const View = VIEWS[g.view] || Team;

  return (
    <FA_Ctx.Provider value={ctx}>
      <Ambient />
      <div className="app-shell">
        <Header chipPop={chipPop} />
        <BuybackTicker />
        <Nav />
        <View />
      </div>
      <ChatFab />
      <RoomFab />
      <Toasts toasts={toasts} />
      {g.wallet && <TutorialGate />}
      {g.wallet && <LoginGate />}
      {Array.isArray(g.pvpPrizes) && g.pvpPrizes.length > 0 && <window.PrizeModal prizes={g.pvpPrizes} onClaim={() => actions.pvpPrizesSeen()} />}
    </FA_Ctx.Provider>
  );
}

function Ambient() {
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
        : <img className="hdr-logo" src="assets/LOGO_cut.png" alt="Fractal Arena" />}
      <div className="hdr-word">
        <span className="hdr-title">FRACTAL ARENA</span>
        <span className="hdr-sub">FRACTAL BITCOIN · AUTO-BATTLER</span>
      </div>
      <div className="hdr-spacer" />
      <div className="flex gap8 center wrap" style={{ justifyContent: "flex-end" }}>
        <span key={chipPop} className="chip pop"><span className="coin">◎</span> {fmt(g.liquid)}</span>
        {g.locked > 0 && <span className="chip locked"><span className="ico">🔒</span> {fmt(g.locked)} {I18N.t("LOCKED_CHIP")}</span>}
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
    ["team", "NAV_TEAM"], ["fosse", "NAV_FOSSE"], ["arene", "NAV_ARENE"], ["campaign", "NAV_CAMPAIGN"], ["quests", "NAV_QUESTS"], ["forge", "NAV_FORGE"],
    ["wallet", "NAV_WALLET"], ["boosts", "NAV_BOOSTS"], ["perso", "NAV_PERSO"], ["leaderboard", "NAV_LEADERBOARD"], ["options", "NAV_OPTIONS"],
  ];
  return (
    <nav className="nav">
      {tabs.map(([k, key]) => (
        <button key={k} className={cx("nav-tab", g.view === k && "on")} onClick={() => actions.setView(k)}>
          {I18N.t(key)}
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

function Onboarding() {
  const { actions, toast } = useFA();
  const [addr, setAddr] = useState("");
  const [checking, setChecking] = useState(false);
  const [manual, setManual] = useState(false);
  const hasWallet = HAS_UNISAT();
  const mobile = IS_MOBILE();

  async function connectUnisat() {
    setChecking(true);
    const r = await actions.connectUnisat();
    setChecking(false);
    if (!r.ok) toast(I18N.t("OB_CONNECT_FAIL"), "bad");
  }
  async function connectManual() {
    const a = addr.trim();
    if (a.length < 20 || !/^bc1/i.test(a)) { toast(I18N.t("OB_INVALID"), "bad"); return; }
    setChecking(true);
    try {
      const token = await actions.authenticate(a);
      const isNew = await actions.connectWallet(a, token);
      await actions.claimAirdropIfNew(a, token, isNew);
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", position: "relative", zIndex: 1 }}>
      <div style={{ textAlign: "center", maxWidth: 540, padding: 28, position: "relative" }}>
        <div className="ob-logo" style={{ position: "relative", width: 168, height: 168, margin: "0 auto 26px", animation: "obFloat 4.5s ease-in-out infinite" }}>
          {window.Emblem3D
            ? <window.Emblem3D style={{ filter: "drop-shadow(0 0 18px rgba(247,147,26,0.35))" }} />
            : <img src="assets/LOGO_cut.png" alt="Fractal Arena" style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 18px rgba(247,147,26,0.35))" }} />}
        </div>
        <div className="eyebrow">{I18N.t("OB_TAG")}</div>
        <div className="hdr-title" style={{ fontSize: 40, letterSpacing: 6, display: "block", margin: "8px 0 18px" }}>FRACTAL ARENA</div>

        {hasWallet ? (
          <>
            <div className="h2" style={{ fontSize: 18, marginBottom: 8 }}>{I18N.t("OB_CONNECT")}</div>
            <div className="muted mono" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 22 }}>{I18N.t("OB_SUB")}</div>
            <button className="btn btn-fire block lg" disabled={checking} onClick={connectUnisat}>{checking ? I18N.t("OB_CHECKING") : I18N.t("OB_BTN")}</button>
            <div className="pill" style={{ marginTop: 18, color: "var(--gold)", borderColor: "rgba(255,230,0,0.3)" }}>🎁 {I18N.t("OB_GIFT")}</div>
          </>
        ) : mobile ? (
          <>
            <div className="h2" style={{ fontSize: 18, marginBottom: 8 }}>{I18N.t("OB_MOBILE_TITLE")}</div>
            <div className="muted mono" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>{I18N.t("OB_MOBILE_MSG")}</div>
          </>
        ) : (
          <>
            <div className="h2" style={{ fontSize: 18, marginBottom: 8 }}>{I18N.t("OB_INSTALL_EXT_TITLE")}</div>
            <div className="muted mono" style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 18 }}>{I18N.t("OB_INSTALL_EXT_SUB")}</div>
            <a className="btn btn-fire block lg" href="https://unisat.io/download" target="_blank" rel="noopener noreferrer">{I18N.t("OB_INSTALL_EXT_BTN")}</a>
          </>
        )}

        <div style={{ marginTop: 16 }}>
          <button className="btn-link" style={{ background: "none", border: "none", color: "var(--text-dim)", fontSize: 11, cursor: "pointer", textDecoration: "underline" }} onClick={() => setManual(!manual)}>{I18N.t("OB_MANUAL_TOGGLE")}</button>
        </div>
        {manual && (
          <div style={{ marginTop: 10 }}>
            <input className="field" style={{ textAlign: "center", marginBottom: 10 }} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={I18N.t("OB_PLACEHOLDER")} onKeyDown={(e) => e.key === "Enter" && connectManual()} />
            <button className="btn block" disabled={checking} onClick={connectManual}>{checking ? I18N.t("OB_CHECKING") : I18N.t("OB_BTN")}</button>
          </div>
        )}

        <div className="lang-switch" style={{ margin: "16px auto 0", width: "fit-content" }}>
          {[["FR", "Français"], ["EN", "English"], ["ZH", "中文"]].map(([code, lbl]) => (
            <button key={code} className={I18N.getLang() === code ? "on" : ""} onClick={() => actions.setLang(code)}>{lbl}</button>
          ))}
        </div>
      </div>
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
