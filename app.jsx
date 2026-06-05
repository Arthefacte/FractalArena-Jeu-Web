/* ============================================================
   FRACTAL ARENA — App root: state, actions, shell
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { FA_Ctx, useFA, cx, fmt, Coin, Bar } = window;
const { Team, Arena, Forge, Wallet, Boosts, Perso, Options, ChatFab, RoomFab, Leaderboard, Quests } = window;
const SAVE_KEY = "fractal_arena_v1";
const API_URL = "https://fractal-arena-server-production.up.railway.app";
const CLIENT_SECRET = "pastouche";

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
    session: { wins: save.session_wins ?? 0, losses: save.session_losses ?? 0, net: save.session_arte_net ?? 0 },
    roster,
    selected: s.selected.filter((id) => rosterIds.has(id)), // retire les ids absents du nouveau roster
    playerName: save.player_name || (addr.slice(0, 6) + "…" + addr.slice(-4)),
    playerTitle: save.player_title || "",
    holderDays: save.holder_badge_days ?? 0,
    lang: save.lang || s.lang || "FR",
    view: "team",
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
    playerName: "",
    playerTitle: "",
    ordinalName: "",
    holderDays: 0,
    options: { sound: true, anim: true, speed: 1 },
    view: "team",
    authToken: "",
    serverFight: null,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    return Object.assign(freshState(), s, {
      view: "team",
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
  const gRef = useRef(g);
  gRef.current = g;
  const saveTimerRef = useRef(null);

  // Reconnexion silencieuse : si un wallet est mémorisé, on recharge la sauvegarde serveur fraîche
  const didAutoConnectRef = useRef(false);
  useEffect(() => {
    if (didAutoConnectRef.current) return;
    didAutoConnectRef.current = true;
    const w = gRef.current.wallet;
    if (w) { actions.connectWallet(w); }
  }, []);

  // persist
  useEffect(() => {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(g)); } catch (e) { }
  }, [g]);

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

    async connectWallet(addr) {
      try {
        const [saveResp, boostsResp] = await Promise.all([
          fetch(`${API_URL}/save/${addr}`),
          fetch(`${API_URL}/boosts/status/${addr}`),
        ]);
        if (saveResp.ok) {
          const { save } = await saveResp.json();
          const boostsData = boostsResp.ok ? await boostsResp.json() : null;
          setG((s) => {
            const next = serverToState(save, addr, s);
            if (boostsData) next.boosts = { xp_boost: boostsData.xp_boost?.charges ?? 0, insurance: boostsData.insurance?.charges ?? 0, lucky_strike: boostsData.lucky_strike?.charges ?? 0 };
            next.ordinalName = save.ordinal_name || ""; // nom ordinal du serveur, vide si absent
            return next;
          });
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
            freeFights: D.ECON.FREE_FIGHTS_PER_DAY,
            freeResetTs: Date.now(),
          }));
          fetch(`${API_URL}/claim-airdrop`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: addr }),
          }).catch(() => {});
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
              freeFights: D.ECON.FREE_FIGHTS_PER_DAY,
              freeResetTs: Date.now(),
            };
          }
          return { ...s, wallet: addr, playerName: addr.slice(0, 6) + "…" + addr.slice(-4), ordinalName: "", selected: [], view: "team" };
        });
      }
    },
    async authenticate(addr) {
      if (typeof window.unisat === "undefined") return "";
      try {
        const cr = await fetch(`${API_URL}/auth/challenge?wallet=${encodeURIComponent(addr)}`);
        if (!cr.ok) return "";
        const { nonce } = await cr.json();
        const signature = await window.unisat.signMessage(nonce);
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
    async authForWithdraw() {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "wallet" };
      if (typeof window.unisat === "undefined") return { ok: false, reason: "unisat" };
      try {
        const cr = await fetch(`${API_URL}/auth/challenge?wallet=${encodeURIComponent(s.wallet)}`);
        if (!cr.ok) return { ok: false, reason: "challenge" };
        const { nonce } = await cr.json();
        const signature = await window.unisat.signMessage(nonce);
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
      let fromLocked = false, liquid = s.liquid, locked = s.locked;
      if (s.useLocked && s.locked >= amount) { locked -= amount; fromLocked = true; }
      else if (s.liquid >= amount) { liquid -= amount; }
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
      }
      try {
        const resp = await fetch(`${API_URL}/fight`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${s.authToken}` },
          body: JSON.stringify({ bet_tier: free ? "" : tier, is_free: free, selected: s.selected }),
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
          const patch = { ...st, liquid: data.new_liquid, locked: data.new_locked, serverFight: data };
          if (free) patch.freeFights = Math.max(0, st.freeFights - 1);
          if (!free && isLoop && tier === "silver") patch.loopSilverToday = st.loopSilverToday + 1;
          if (!free && isLoop && tier === "gold") patch.loopGoldToday = st.loopGoldToday + 1;
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
        win = srv.won;  // override le résultat local par le résultat serveur
      }
      const summary = { payout: 0, net: 0, xp: 0, pool: 0, burn: 0, milestone: false, luckyBonus: 0, insuranceUsed: false, betAmount, levelUps: [], rarityUps: [] };
      setG((s) => {
        let { liquid, locked, totalFights, ticketsSilver, ticketsGold } = s;
        const session = { ...s.session };
        const boosts = { ...s.boosts };
        totalFights += 1;
        // milestone
        if (totalFights % D.ECON.MILESTONE_EVERY === 0) {
          locked += D.ECON.MILESTONE_REWARD;
          ticketsSilver += D.ECON.TICKET_SILVER_PER_MS;
          ticketsGold += D.ECON.TICKET_GOLD_PER_MS;
          summary.milestone = true;
        }
        // roster (xp mutates in place; clone array for React)
        const selBeasts = s.selected.map((id) => s.roster.find((b) => b.id === id)).filter(Boolean);

        if (win) {
          session.wins += 1;
          const base = free ? D.ECON.BET.bronze : betAmount;
          const payout = Math.floor(base * D.ECON.PAYOUT_MULT);
          const net = payout - betAmount;
          // liquid ET locked déjà mis à jour par callFight() depuis la réponse serveur
          summary.payout = payout; summary.net = net;
          if (!free) session.net += net;
          // lucky strike
          if (boosts.lucky_strike > 0 && Math.random() < 0.25) {
            const bonus = Math.floor(payout * 0.5);
            liquid += bonus; summary.luckyBonus = bonus;
          }
          // xp
          const xpAmt = D.ECON.XP_PER_VICTORY * (boosts.xp_boost > 0 ? 2 : 1);
          summary.xp = xpAmt;
          const events = D.grantXp(selBeasts, xpAmt);
          summary.levelUps = events.filter((e) => e.type === "levelup");
          summary.rarityUps = events.filter((e) => e.type === "rarity_up");
        } else {
          session.losses += 1;
          if (!free && !isLoop && boosts.insurance > 0) {
            // pas de remboursement local — déjà géré par le serveur si non implémenté côté /fight
            boosts.insurance -= 1;
            summary.insuranceUsed = true;
          } else if (!free) {
            const pool = Math.floor(betAmount * D.ECON.DEFEAT_POOL_RATIO);
            const burn = betAmount - pool;
            summary.pool = pool; summary.burn = burn;
            session.net -= betAmount;
          }
        }
        // decrement timed boosts each fight
        if (boosts.xp_boost > 0) boosts.xp_boost -= 1;
        if (boosts.lucky_strike > 0) boosts.lucky_strike -= 1;

        return { ...s, liquid, locked, totalFights, ticketsSilver, ticketsGold, session, boosts, roster: [...s.roster] };
      });
      // consommation des boosts côté serveur
      const prevBoosts = gRef.current.boosts;
      const w2 = gRef.current.wallet;
      if (w2) {
        const hb = { "Content-Type": "application/json" };
        if (prevBoosts.xp_boost > 0) fetch(`${API_URL}/boosts/use`, { method: "POST", headers: hb, body: JSON.stringify({ wallet: w2, boost_type: "xp_boost" }) }).catch(() => {});
        if (prevBoosts.lucky_strike > 0) fetch(`${API_URL}/boosts/use`, { method: "POST", headers: hb, body: JSON.stringify({ wallet: w2, boost_type: "lucky_strike" }) }).catch(() => {});
        if (summary.insuranceUsed) fetch(`${API_URL}/boosts/use`, { method: "POST", headers: hb, body: JSON.stringify({ wallet: w2, boost_type: "insurance" }) }).catch(() => {});
      }
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
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: s.wallet, boost_type: key }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const [svResp, bResp] = await Promise.all([fetch(`${API_URL}/save/${s.wallet}`), fetch(`${API_URL}/boosts/status/${s.wallet}`)]);
        if (svResp.ok && bResp.ok) {
          const [{ save }, bd] = await Promise.all([svResp.json(), bResp.json()]);
          setG((st) => { const n = serverToState(save, s.wallet, st); n.boosts = { xp_boost: bd.xp_boost?.charges ?? 0, insurance: bd.insurance?.charges ?? 0, lucky_strike: bd.lucky_strike?.charges ?? 0 }; return n; });
        }
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async fuse(id1, id2) {
      const s = gRef.current;
      const a = s.roster.find((b) => b.id === id1), b = s.roster.find((b) => b.id === id2);
      if (!a || !b) return { ok: false, reason: I18N.t("FG_PICK2") };
      if (a.rarity === "Legendary") return { ok: false, reason: I18N.t("FG_NOT_FUSABLE") };
      if (a.rarity !== b.rarity) return { ok: false, reason: I18N.t("FG_PICK2") };
      const cost = D.FORGE.FUSION_COST[a.rarity];
      if (s.liquid + s.locked < cost) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/fusion`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: s.wallet, primary_id: id1, secondary_id: id2 }),
        });
        const data = await resp.json();
        if (data.status === "insufficient_balance") return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
        if (data.status !== "success" && data.status !== "fail") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`);
        if (sv.ok) {
          const { save } = await sv.json();
          setG((st) => { const n = serverToState(save, s.wallet, st); n.selected = st.selected.filter((x) => n.roster.some((r) => r.id === x)); return n; });
        }
        return { ok: true, success: data.status === "success", result: { rarity: data.new_rarity || a.rarity } };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async reroll(id) {
      const s = gRef.current;
      const beast = s.roster.find((b) => b.id === id);
      if (!beast) return { ok: false, reason: I18N.t("FG_PICK1") };
      const cost = Math.round(D.FORGE.REROLL_BASE[beast.rarity] * (1 + 0.5 * beast.reroll_count));
      if (s.liquid + s.locked < cost) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      try {
        const resp = await fetch(`${API_URL}/forge/reroll`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: s.wallet, beast_id: id }),
        });
        const data = await resp.json();
        if (data.status === "insufficient_balance") return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`);
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async summon() {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      const cost = D.ECON.MINT_COST;
      if (s.liquid + s.locked < cost) return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
      try {
        const resp = await fetch(`${API_URL}/forge/summon`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: s.wallet }),
        });
        const data = await resp.json();
        if (data.status === "insufficient_balance") return { ok: false, reason: I18N.t("INSUFFICIENT", s.liquid + s.locked, cost) };
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`);
        if (sv.ok) { const { save } = await sv.json(); setG((st) => serverToState(save, s.wallet, st)); }
        return { ok: true, beast: data.beast };
      } catch (e) { return { ok: false, reason: "Erreur réseau" }; }
    },

    async callChat(messages) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "Wallet requis" };
      const last20 = messages
        .slice(-20)
        .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
      try {
        const resp = await fetch(`${API_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: s.wallet, messages: last20 }),
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
    async sendRoomMessage(content) {
      const s = gRef.current;
      if (!s.wallet) return { ok: false, reason: "wallet" };
      try {
        const resp = await fetch(`${API_URL}/chat-room/send`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-client-secret": CLIENT_SECRET },
          body: JSON.stringify({ wallet: s.wallet, content }),
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
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: s.wallet, beast_id: id, new_name: name }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`);
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
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: s.wallet, title }),
        });
        const data = await resp.json();
        if (data.status !== "ok") return { ok: false, reason: data.error || "Erreur serveur" };
        const sv = await fetch(`${API_URL}/save/${s.wallet}`);
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
  }), []);

  const ctx = { g, actions, toast };

  if (!g.wallet) {
    return (
      <FA_Ctx.Provider value={ctx}>
        <Ambient />
        <Onboarding />
        <Toasts toasts={toasts} />
      </FA_Ctx.Provider>
    );
  }

  const VIEWS = { team: Team, arena: Arena, quests: Quests, forge: Forge, wallet: Wallet, boosts: Boosts, perso: Perso, leaderboard: Leaderboard, options: Options };
  const View = VIEWS[g.view] || Team;

  return (
    <FA_Ctx.Provider value={ctx}>
      <Ambient />
      <div className="app-shell">
        <Header chipPop={chipPop} />
        <Nav />
        <View />
      </div>
      <ChatFab />
      <RoomFab />
      <Toasts toasts={toasts} />
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
      <img className="hdr-logo" src="assets/LOGO_cut.png" alt="Fractal Arena" />
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
      </div>
    </header>
  );
}

function Nav() {
  const { g, actions } = useFA();
  const tabs = [
    ["team", "NAV_TEAM"], ["arena", "NAV_ARENA"], ["quests", "NAV_QUESTS"], ["forge", "NAV_FORGE"],
    ["wallet", "NAV_WALLET"], ["boosts", "NAV_BOOSTS"], ["perso", "NAV_PERSO"], ["leaderboard", "NAV_LEADERBOARD"], ["options", "NAV_OPTIONS"],
  ];
  return (
    <nav className="nav">
      {tabs.map(([k, key]) => (
        <button key={k} className={cx("nav-tab", g.view === k && "on")} onClick={() => actions.setView(k)}>
          {I18N.t(key)}
        </button>
      ))}
    </nav>
  );
}

function Onboarding() {
  const { actions, toast } = useFA();
  const [addr, setAddr] = useState("");
  const [checking, setChecking] = useState(false);
  async function connect() {
    const a = addr.trim();
    if (a.length < 20 || !/^bc1/i.test(a)) { toast(I18N.t("OB_INVALID"), "bad"); return; }
    setChecking(true);
    await actions.connectWallet(a);
    await actions.authenticate(a);
  }
  return (
    <div className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", position: "relative", zIndex: 1 }}>
      <div style={{ textAlign: "center", maxWidth: 540, padding: 28, position: "relative" }}>
        <div className="ob-logo" style={{ position: "relative", width: 168, height: 168, margin: "0 auto 26px", animation: "obFloat 4.5s ease-in-out infinite" }}>
          <img src="assets/LOGO_cut.png" alt="Fractal Arena" style={{ position: "relative", width: "100%", height: "100%", objectFit: "contain", filter: "drop-shadow(0 0 18px rgba(247,147,26,0.35))" }} />
        </div>
        <div className="eyebrow">{I18N.t("OB_TAG")}</div>
        <div className="hdr-title" style={{ fontSize: 40, letterSpacing: 6, display: "block", margin: "8px 0 18px" }}>FRACTAL ARENA</div>
        <div className="h2" style={{ fontSize: 18, marginBottom: 8 }}>{I18N.t("OB_CONNECT")}</div>
        <div className="muted mono" style={{ fontSize: 13, lineHeight: 1.6, marginBottom: 22 }}>{I18N.t("OB_SUB")}</div>
        <input className="field" style={{ textAlign: "center", marginBottom: 14 }} value={addr} onChange={(e) => setAddr(e.target.value)} placeholder={I18N.t("OB_PLACEHOLDER")} onKeyDown={(e) => e.key === "Enter" && connect()} />
        <button className="btn btn-fire block lg" disabled={checking} onClick={connect}>{checking ? I18N.t("OB_CHECKING") : I18N.t("OB_BTN")}</button>
        <div className="pill" style={{ marginTop: 18, color: "var(--gold)", borderColor: "rgba(255,230,0,0.3)" }}>🎁 {I18N.t("OB_GIFT")}</div>
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
