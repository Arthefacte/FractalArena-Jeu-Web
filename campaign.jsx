/* ============================================================
   FRACTAL ARENA — PvE Campaign (Mode Histoire)
   6 mondes × 10 étages. Le combat est résolu CÔTÉ SERVEUR (le moteur client
   FA_ENGINE/engine.js est obsolète et retiré) ; l'UI rejoue les events renvoyés.
   La progression est reflétée dans g.campaignProgress / g.campaignTitles.
   ============================================================ */
const { useState, useEffect, useRef, useMemo } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { useFA, cx, fmt, presetLabel, rarityLabel, Bar, Modal, SectionHead, PostureSelect, TokenIcon } = window;

// ---- helpers progression ----
function worldStarsArr(g, i) {
  const w = g.campaignProgress[i];
  return w ? w.stars : new Array(D.FLOORS_PER_WORLD).fill(0);
}
function worldStarTotal(g, i) {
  return worldStarsArr(g, i).reduce((a, b) => a + b, 0);
}
function totalStarsAll(g) {
  let t = 0;
  for (let i = 0; i < D.WORLDS.length; i++) t += worldStarTotal(g, i);
  return t;
}
// Un étage est jouable si c'est le 1er ou si le précédent a ≥ 1 étoile.
function floorUnlocked(stars, floorIndex) {
  return floorIndex === 0 || (stars[floorIndex - 1] || 0) >= 1;
}

// Durée ms → compte à rebours complet « 7h32m15s » / « 42m15s » / « 15s »
// (borné à 0). Nom unique : le scope global est partagé entre les .jsx,
// on n'écrase pas fmtFreeCountdown.
function campFreeCompact(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}m${String(sec).padStart(2, "0")}s`;
  if (m > 0) return `${m}m${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

// ---- petits visuels ----
function Stars({ n, max, size }) {
  max = max || 3;
  const fs = size || 14;
  const out = [];
  for (let i = 0; i < max; i++) {
    out.push(<span key={i} style={{ color: i < n ? "var(--gold)" : "var(--text-faint)", fontSize: fs, lineHeight: 1 }}>{i < n ? "★" : "☆"}</span>);
  }
  return <span style={{ letterSpacing: 1 }}>{out}</span>;
}

function campMeta(b) {
  return b ? {
    name: D.displayName(b), rarity: b.rarity, image_key: b.image_key, rank: b.rank, preset: b.preset,
    level: b.level, maxHp: D.eff(b, "hp"), atk: D.eff(b, "atk"), def: D.eff(b, "def"),
    spd: D.eff(b, "spd"), mag: D.eff(b, "mag"), boss: !!b.is_boss,
  } : null;
}

// Aperçu du champion avant le combat : la projection serveur (championEntry)
// n'expose jamais les stats brutes — on montre image/nom tout de suite, les
// chiffres restent « ? » jusqu'aux events du premier combat.
function champIdleMeta(champ) {
  const b = champ.beast;
  return { name: b.name, rarity: b.rarity, image_key: b.image_key, rank: b.rank, preset: b.preset,
    level: b.level, maxHp: null, atk: null, def: null, spd: null, mag: null, boss: false };
}

function CampCombatCard({ meta, live, side, cref }) {
  if (!meta) {
    return (
      <div className="card" ref={cref} style={{ "--rc": "var(--line)", opacity: 0.5 }}>
        <div className="art" style={{ display: "grid", placeItems: "center" }}>
          <span className="mono" style={{ color: "var(--text-faint)", fontSize: 30 }}>?</span>
        </div>
        <div className="body"><div className="cname muted">—</div></div>
      </div>
    );
  }
  const rc = D.RARITY_COLORS[meta.rarity];
  const maxRarity = meta.rarity === "Legendary";   // hors du cycle des raretés
  const frac = live ? live.hp / live.maxHp : 1;
  const dead = live && !live.alive;
  return (
    <div className={cx("card", dead && "dead", meta.boss && "camp-boss-card")} ref={cref}
      style={{ "--rc": meta.boss ? "var(--gold)" : rc, boxShadow: meta.boss ? "0 0 22px rgba(247,147,26,0.5)" : undefined }}>
      <div className="art">
        <img src={D.artFor(meta)} alt={meta.name} draggable="false"
          onError={(e) => { const fb = D.ART[meta.image_key]; if (fb && !e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = fb; } }}
          style={meta.boss ? { transform: "scale(1.08)", filter: "drop-shadow(0 0 10px rgba(247,147,26,0.7))" } : undefined} />
        {meta.boss && <div style={{ position: "absolute", top: 6, left: 6, fontSize: 9, fontWeight: 700, color: "var(--gold)", background: "rgba(0,0,0,0.6)", padding: "2px 5px", borderRadius: 4, letterSpacing: 1 }}>{I18N.t("CAMP_BOSS")}</div>}
      </div>
      <div className="body">
        <div className="flex between center" style={{ gap: 6 }}>
          <div className="cname">{meta.name}</div>
          <div className="cpreset" style={{ color: D.PRESET_COLORS[meta.preset] }}>{presetLabel(meta.preset)}</div>
        </div>
        <div style={{ marginTop: 8 }}>
          <div className="bar-label">
            <span style={{ color: side === "p1" ? "var(--elec)" : "var(--alert)" }}>HP</span>
            <span style={{ color: "var(--text)" }}>{live ? D.fmtStat(Math.max(0, Math.ceil(live.hp))) + "/" + D.fmtStat(live.maxHp) : meta.maxHp == null ? "?/?" : D.fmtStat(meta.maxHp) + "/" + D.fmtStat(meta.maxHp)}</span>
          </div>
          <Bar frac={frac} kind="hp" />
        </div>
        {/* Même ligne qu'en Fosse : à 100 la rareté monte d'un cran et le
            niveau repart à 1 (data.js, MAX_LEVEL_UPGRADE), donc la jauge mesure
            la marche vers la rareté suivante. La Légendaire en est exclue :
            niveau nu et jauge pleine. Jauge côté joueur seulement. */}
        <div style={{ marginTop: 6 }}>
          <div className="bar-label">
            <span style={{ color: rc }}>{rarityLabel(meta.rarity)}</span>
            <span style={{ color: "var(--text)" }}>{maxRarity ? "LV " + meta.level : meta.level + "/" + D.ECON.MAX_LEVEL_UPGRADE}</span>
          </div>
          {side === "p1" && <Bar frac={maxRarity ? 1 : meta.level / D.ECON.MAX_LEVEL_UPGRADE} kind="rar" />}
        </div>
        <div className="stat-row">
          {[["ATK", meta.atk], ["DEF", meta.def], ["SPD", meta.spd], ["MAG", meta.mag]].map(([k, v]) => (
            <div className="stat" key={k}>
              <div className="k">{k}</div>
              <div className="v" title={String(v)}>{v == null ? "?" : D.fmtStat(v)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- ÉCRAN COMBAT PvE ---------------- */
function CampaignCombat({ worldIndex, floorIndex, onBack, onCleared }) {
  const { g, actions, toast } = useFA();
  // Champion de soutien : avec un champion loué, 2 entités propres suffisent —
  // le serveur insère le snapshot du prêteur au slot 2 (champion-ui.js).
  const CU = window.FA_CHAMPION_UI;
  const champ = g.championBorrow;
  const ownNeeded = CU.requiredOwnCount(!!champ);
  const selectedBeasts = g.selected.map((id) => g.roster.find((b) => b.id === id)).filter(Boolean).slice(0, ownNeeded);
  const ready = selectedBeasts.length === ownNeeded;
  const isBoss = floorIndex === D.BOSS_FLOOR;
  const bossName = I18N.t("CAMP_W" + (worldIndex + 1) + "_BOSS");

  const [playing, setPlaying] = useState(false);
  const [p1Live, setP1Live] = useState(null);
  const [p2Live, setP2Live] = useState(null);
  const [p1Meta, setP1Meta] = useState(selectedBeasts.map(campMeta));
  const [p2Meta, setP2Meta] = useState([null, null, null]);
  const [logLines, setLogLines] = useState([]);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState(null);
  const [posture, setPosture] = useState("equilibre");

  const runIdRef = useRef(0);
  const stepRef = useRef(null);
  const battleRef = useRef(null);
  const logRef = useRef(null);
  const p1Refs = useRef([]);
  const p2Refs = useRef([]);
  const boardRef = useRef(null);

  // La liste d'emprunt se charge en entrant dans l'écran de combat (cache serveur 60 s).
  useEffect(() => { actions.championsList(); }, []);

  // aperçu idle synchronisé avec la sélection — le slot champion montre image
  // et nom tout de suite, stats « ? » (la projection serveur n'expose pas les
  // stats brutes ; les vraies valeurs arrivent avec les events du combat).
  useEffect(() => {
    if (!playing) {
      const metas = selectedBeasts.map(campMeta);
      const lives = selectedBeasts.map((b) => ({ hp: D.eff(b, "hp"), maxHp: D.eff(b, "hp"), alive: true }));
      if (champ) { metas.push(champIdleMeta(champ)); lives.push(null); }
      setP1Meta(metas);
      setP1Live(lives);
    }
  }, [g.selected.join(","), playing, champ && champ.owner_wallet]);

  // Même règle que la Fosse : pas de bulle de quiz pendant la résolution d'un
  // combat (quiz.jsx lit le drapeau `fa-busy` sur <body>).
  useEffect(() => {
    const set = window.FA_SET_BUSY;
    if (set) set("campagne", playing);
    return () => { if (set) set("campagne", false); };
  }, [playing]);

  useEffect(() => () => { runIdRef.current++; if (stepRef.current) clearTimeout(stepRef.current); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logLines]);
  // rafraîchit le compte à rebours « prochaine entrée gratuite » sans recharger
  const [, setTick] = useState(0);
  useEffect(() => { const id = setInterval(() => setTick((t) => t + 1), 1000); return () => clearInterval(id); }, []);

  function log(text, cls) { setLogLines((L) => [...L.slice(-120), { text, cls }]); }

  async function startFight() {
    if (playing) return;
    if (!ready) { toast(I18N.t(champ ? "CHAMP_NEED2" : "CAMP_NEED3"), "bad"); return; }
    setPlaying(true); // verrou anti double-clic pendant l'appel serveur

    // Combat SERVEUR-AUTORITATIF : entrée, combat et récompenses gérés côté serveur.
    const resp = await actions.campaignFight(worldIndex, floorIndex, g.selected.slice(0, ownNeeded), posture, champ);
    if (!resp.ok) {
      setPlaying(false);
      // Champion disparu entre l'affichage et le combat : on retire l'emprunt et on re-liste.
      if (resp.reason === "champion_indisponible") {
        toast(I18N.t("CHAMP_ERR_champion_indisponible"), "bad");
        actions.championClearBorrow();
        actions.championsList();
        return;
      }
      // bete_en_expedition : garde serveur des Expéditions — code traduit, pas brut.
      toast(resp.reason === "bete_en_expedition" ? I18N.t("EXP_ERR_bete_en_expedition") : resp.reason, "bad");
      return;
    }

    const enemies = resp.enemy;
    enemies.forEach((e) => { if (e.is_boss) e.custom_name = bossName; });
    const events = resp.events || [];

    setResult(null);
    setLogLines([]);
    setRound(0);
    // Le meta du slot champion se construit depuis l'unité serveur du 1er event
    // (toUnit : name/maxHp/atk/def/spd/mag réels du snapshot du prêteur).
    const metas = selectedBeasts.map(campMeta);
    if (champ) {
      const u = events.length ? events[0].state.p1[CU.CHAMPION_SLOT] : null;
      metas.push(u ? {
        name: champ.beast.name, rarity: champ.beast.rarity, image_key: champ.beast.image_key,
        rank: champ.beast.rank, preset: champ.beast.preset, level: champ.beast.level,
        maxHp: u.maxHp, atk: u.atk, def: u.def, spd: u.spd, mag: u.mag, boss: false,
      } : null);
    }
    setP1Meta(metas);
    setP2Meta(enemies.map(campMeta));
    if (events.length) { setP1Live(events[0].state.p1); setP2Live(events[0].state.p2); }
    log(resp.free ? I18N.t("CAMP_FREE_TODAY") : I18N.t("CAMP_TICKET_COST"), "lc-gold");
    log(I18N.t("L_START"), "lc-elec");

    const spd = g.options.speed || 1;
    const baseDelay = 165; // animations toujours actives : cadence plancher du déroulé de combat
    battleRef.current = { battle: { events, winner: resp.won ? "p1" : "p2" }, i: 0, spd, baseDelay, serverResult: resp };
    if (stepRef.current) clearTimeout(stepRef.current);
    stepRef.current = setTimeout(stepBattle, 220 / spd);
  }

  function stepBattle() {
    const ctx = battleRef.current;
    if (!ctx) return;
    const { battle, spd, baseDelay } = ctx;
    if (ctx.i >= battle.events.length) { settle(); return; }
    const ev = battle.events[ctx.i++];
    let delay = baseDelay / spd;
    switch (ev.t) {
      case "round":
        setRound(ev.round);
        log("── " + I18N.t("AR_ROUND", ev.round) + " ──", "lc-yellow");
        delay = baseDelay * 0.6 / spd;
        break;
      case "atk": case "sp": case "crit": {
        const J = window.FA_JUICE;
        const aEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
        const tEl = (ev.tside === "p1" ? p1Refs : p2Refs).current[ev.tidx];
        const tLive = (ev.tside === "p1" ? ev.state.p1 : ev.state.p2)[ev.tidx];
        if (J) {
          J.lunge(aEl, ev.side);
          J.hit(tEl, { dmg: ev.dmg, maxHp: tLive ? tLive.maxHp : 0, kind: ev.t === "sp" ? "sp" : "atk", crit: ev.crit, boardEl: boardRef.current });
        }
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        const key = ev.crit ? "L_CRIT" : ev.t === "sp" ? "L_SP" : "L_ATK";
        log(I18N.t(key, ev.name, ev.tname, ev.dmg), ev.crit ? "lc-gold" : ev.t === "sp" ? "lc-purple" : "lc-red");
        if (ev.down) { if (J) J.ko(tEl); log(I18N.t("L_DOWN", ev.tname), "lc-yellow"); }
        if (J) delay += J.hitStopMs(ev.crit) / spd;
        break;
      }
      case "miss":
        log(I18N.t("L_MISS", ev.name), "lc-dim");
        delay = baseDelay * 0.6 / spd;
        break;
      case "heal": {
        const hEl = (ev.side === "p1" ? p1Refs : p2Refs).current[ev.idx];
        if (window.FA_JUICE) window.FA_JUICE.heal(hEl, { amount: ev.heal });
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        log(I18N.t("L_HEAL", ev.name, ev.heal), "lc-green");
        delay = baseDelay * 0.5 / spd;
        break;
      }
      case "timeout":
        log(I18N.t("L_TIMEOUT"), "lc-dim");
        delay = 80 / spd;
        break;
      case "win": case "lose":
        setP1Live(ev.state.p1); setP2Live(ev.state.p2);
        delay = 40 / spd;
        break;
    }
    stepRef.current = setTimeout(stepBattle, delay);
  }

  function settle() {
    const ctx = battleRef.current;
    if (!ctx) return;
    const r = ctx.serverResult || {};
    const win = !!r.won;
    const survivors = r.survivors || 0;
    log(win ? I18N.t("L_WIN") : I18N.t("L_LOSE"), win ? "lc-green" : "lc-red");

    // État (locked/tickets/progression) déjà appliqué par actions.campaignFight.
    setPlaying(false);
    battleRef.current = null;
    const summary = {
      win, survivors, stars: r.stars || 0,
      lockedGain: (r.reward && r.reward.lockedGain) || 0,
      silver: (r.reward && r.reward.silver) || 0,
      gold: (r.reward && r.reward.gold) || 0,
      // Commission du champion : le pseudo vient de l'entrée de liste (jamais le wallet).
      commission: (r.champion && r.champion.commission) || 0,
      champName: (g.championBorrow && g.championBorrow.name) || "",
      titleUnlocked: r.titleUnlocked || null, legend: !!r.legend,
    };
    // Le finisher précède la modale, et joue le victory/defeat que la Campagne
    // n'avait jamais eu (elle tombait sur le son 'open' générique).
    const showResult = () => setResult(summary);
    if (window.FA_FINISHER) window.FA_FINISHER.play({ win, onDone: showResult }); else showResult();
  }

  const worldName = I18N.t("CAMP_W" + (worldIndex + 1) + "_NAME");
  const stars = worldStarsArr(g, worldIndex);
  const curStars = stars[floorIndex] || 0;
  const freeReady = Date.now() - (g.campaignFreeTs || 0) >= 86400000;

  return (
    <div className="container wide">
      <div className="flex between center wrap" style={{ marginBottom: 14, gap: 12 }}>
        <div>
          <button className="btn ghost sm" onClick={onBack} disabled={playing}>{I18N.t("CAMP_BACK_FLOORS")}</button>
          <div className="h1" style={{ marginBottom: 0, marginTop: 8 }}>
            {worldName} · {I18N.t("CAMP_FLOOR", floorIndex + 1, D.FLOORS_PER_WORLD)}
            {isBoss && <span style={{ color: "var(--gold)", marginLeft: 10, fontSize: 16 }}>{I18N.t("CAMP_BOSS")}</span>}
          </div>
          <div style={{ marginTop: 6 }}><Stars n={curStars} /></div>
        </div>
        <div className="flex gap8 wrap">
          <span className="pill" style={{ color: "var(--elec)" }}>{I18N.t("CAMP_TICKETS", g.ticketsSilver, g.ticketsGold)}</span>
        </div>
      </div>

      {/* Plateau */}
      <div ref={boardRef} className="panel oct" style={{ position: "relative", overflow: "hidden", border: "1px solid var(--line)", padding: "26px 22px 22px" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "var(--filigrane)", backgroundSize: "cover", backgroundPosition: "center", opacity: 0.16, mixBlendMode: "luminosity" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(6,9,18,0.55), rgba(6,9,18,0.82))" }} />
        <div style={{ position: "relative" }}>
          <div className="flex center arena-board-row" style={{ gap: 18, alignItems: "stretch" }}>
            <div style={{ flex: 1 }}>
              <div className="flex between center" style={{ marginBottom: 10 }}>
                <span className="h2" style={{ color: "var(--elec)", fontSize: 15 }}>{g.ordinalName || g.playerName || I18N.t("AR_YOU")}</span>
                {round > 0 && <span className="pill mono" style={{ fontSize: 10 }}>{I18N.t("AR_ROUND", round)}</span>}
              </div>
              {/* minmax(0,1fr) : avec 1fr nu, le min-content de l'étiquette
                  « Prêté par X » (nowrap) élargissait la colonne du champion
                  et écrasait les deux autres cartes sur mobile. */}
              <div className="team-row" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={champ && i === CU.CHAMPION_SLOT ? { border: "1px solid var(--elec)", borderRadius: 10, padding: 2, minWidth: 0 } : undefined}>
                    {champ && i === CU.CHAMPION_SLOT && (
                      <div className="mono" style={{ fontSize: 9, color: "var(--elec)", textAlign: "center", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {I18N.t("CHAMP_BORROWED_TAG", champ.name)}
                      </div>
                    )}
                    <CampCombatCard side="p1" meta={p1Meta[i]} live={p1Live && p1Live[i]} cref={(el) => (p1Refs.current[i] = el)} />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex center arena-vs" style={{ flexDirection: "column", justifyContent: "center", flex: "none", width: 70 }}>
              <div className="hex" style={{ width: 64, height: 70, background: "linear-gradient(160deg, var(--fire), #7a1f0a)", display: "grid", placeItems: "center", boxShadow: "0 0 30px rgba(247,147,26,0.4)" }}>
                <div className="hex" style={{ width: 56, height: 62, background: "var(--bg-0)", display: "grid", placeItems: "center" }}>
                  <span style={{ fontWeight: 700, fontSize: 18, letterSpacing: 1, color: "var(--fire)" }}>VS</span>
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div className="flex between center" style={{ marginBottom: 10 }}>
                <span className="h2" style={{ color: "var(--alert)", fontSize: 15 }}>{I18N.t("CAMP_VS")}</span>
              </div>
              <div className="team-row" style={{ gridTemplateColumns: "repeat(3,minmax(0,1fr))" }}>
                {[0, 1, 2].map((i) => (
                  <CampCombatCard key={i} side="p2" meta={p2Meta[i]} live={p2Live && p2Live[i]} cref={(el) => (p2Refs.current[i] = el)} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Log + actions */}
      <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16, marginTop: 16 }} className="arena-lower">
        <div className="panel oct" style={{ border: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 240 }}>
          <div className="flex between center arena-log-head" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
            <span className="h2" style={{ fontSize: 14, color: "var(--fire)" }}>{I18N.t("AR_LOG")}</span>
            <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>campaign://pve</span>
          </div>
          <div className="log" ref={logRef} style={{ flex: 1, maxHeight: 300 }}>
            {logLines.length === 0 && <div className="lc-dim">&gt; {I18N.t("CAMP_FIGHT")}…</div>}
            {logLines.map((l, i) => <div key={i} className={cx("log-line", l.cls)}>{l.text}</div>)}
          </div>
        </div>

        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 18, display: "flex", flexDirection: "column", gap: 14, justifyContent: "center" }}>
          {!ready ? (
            <>
              <div className="mono" style={{ fontSize: 12, color: "var(--alert)", textAlign: "center" }}>{I18N.t(champ ? "CHAMP_NEED2" : "CAMP_NEED3")}</div>
              <button className="btn btn-elec block lg" onClick={() => actions.setView("team")}>{I18N.t("CAMP_GOTO_TEAM")}</button>
            </>
          ) : (
            <>
              <div className="mono" style={{ fontSize: 11, textAlign: "center", color: freeReady ? "var(--success)" : "var(--text-dim)" }}>
                {freeReady
                  ? I18N.t("CAMP_FREE_TODAY")
                  : I18N.t("CAMP_FREE_NEXT", campFreeCompact((g.campaignFreeTs || 0) + 86400000 - Date.now()))}
              </div>
              <PostureSelect value={posture} onChange={setPosture} disabled={playing} />
              <button className="btn btn-fire block lg" disabled={playing} onClick={startFight}>
                {isBoss ? "⚔️ " + bossName : I18N.t("CAMP_FIGHT")}
              </button>
            </>
          )}
          {!playing && (
            <window.ChampionRow champions={g.championsList} activeOwner={champ ? champ.owner_wallet : null}
              onPick={(e) => actions.championPickBorrow(e)} onClear={() => actions.championClearBorrow()} />
          )}
        </div>
      </div>

      {result && (
        <CampResultModal data={result} bossName={bossName} isBoss={isBoss}
          onClose={() => setResult(null)}
          onNext={result.win && floorIndex < D.FLOORS_PER_WORLD - 1 ? () => { setResult(null); onCleared(floorIndex + 1); } : null}
          onRetry={() => { setResult(null); }} />
      )}
    </div>
  );
}

function CampResultModal({ data, isBoss, onClose, onNext, onRetry }) {
  const win = data.win;
  return (
    <Modal onClose={onClose} accent={win ? "var(--success)" : "var(--alert)"} openSound={null}>
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div className="h1" style={{ fontSize: 30, color: win ? "var(--success)" : "var(--alert)", margin: "4px 0" }}>
          {win ? I18N.t("CAMP_VICTORY") : I18N.t("CAMP_DEFEAT")}
        </div>
        {win && <div style={{ margin: "8px 0" }}><Stars n={data.stars} size={30} /></div>}
      </div>
      {win ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          <CampResRow label={I18N.t("CAMP_STARS_EARNED", data.stars)} value={"★".repeat(data.stars)} color="var(--gold)" />
          {data.lockedGain > 0 && <CampResRow fa label="FRACTALARENA 🔒" value={"+" + fmt(data.lockedGain)} color="var(--success)" />}
          {data.commission > 0 && <CampResRow fa label={I18N.t("CHAMP_COMMISSION_ROW", data.champName)} value={fmt(data.commission)} color="var(--elec)" />}
          {data.silver > 0 && <CampResRow label={I18N.t("CAMP_REWARD_SILVER", data.silver)} value="🎟" color="var(--elec)" />}
          {data.gold > 0 && <CampResRow label={I18N.t("CAMP_REWARD_GOLD", data.gold)} value="🎟" color="var(--gold)" />}
          {data.titleUnlocked && (
            <div className="oct-sm" style={{ marginTop: 6, padding: "12px 14px", background: "rgba(255,230,0,0.08)", border: "1px solid rgba(255,230,0,0.4)", textAlign: "center" }}>
              <span className="mono" style={{ color: "var(--gold)", fontSize: 13 }}>{I18N.t("CAMP_WORLD_CLEAR", I18N.t(data.titleUnlocked))}</span>
            </div>
          )}
          {data.legend && (
            <div className="oct-sm" style={{ marginTop: 6, padding: "12px 14px", background: "rgba(247,147,26,0.12)", border: "1px solid rgba(247,147,26,0.5)", textAlign: "center" }}>
              <span className="mono" style={{ color: "var(--fire)", fontSize: 13 }}>{I18N.t("CAMP_ALL_CLEAR", I18N.t("CAMP_LEGEND_TITLE"))}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mono" style={{ textAlign: "center", color: "var(--text-dim)", fontSize: 13, padding: "8px 0 4px" }}>{I18N.t("CAMP_DEFEAT_HINT")}</div>
      )}
      <div className="flex gap8" style={{ marginTop: 20 }}>
        {win && onNext
          ? <button className="btn btn-success block lg" style={{ flex: 1 }} onClick={onNext}>{I18N.t("CAMP_NEXT_FLOOR")}</button>
          : <button className={cx("btn block lg", win ? "btn-elec" : "btn-fire")} style={{ flex: 1 }} onClick={win ? onClose : onRetry}>{win ? I18N.t("CAMP_CONTINUE") : I18N.t("CAMP_RETRY")}</button>}
      </div>
    </Modal>
  );
}
function CampResRow({ label, value, color, fa }) {
  return (
    <div className="flex between center" style={{ padding: "9px 14px", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line-soft)" }}>
      <span className="mono" style={{ fontSize: 13, color: "var(--text-dim)" }}>{label}</span>
      <span className="mono" style={{ fontSize: 16, fontWeight: 700, color }}>{fa && <TokenIcon s={14} />} {value}</span>
    </div>
  );
}

/* ---------------- SÉLECTEUR D'ÉTAGE ---------------- */
function FloorSelect({ worldIndex, onBack, onPickFloor }) {
  const { g } = useFA();
  const stars = worldStarsArr(g, worldIndex);
  const worldName = I18N.t("CAMP_W" + (worldIndex + 1) + "_NAME");
  const total = stars.reduce((a, b) => a + b, 0);
  const world = D.WORLDS[worldIndex];

  return (
    <div className="container">
      <div className="flex between center wrap" style={{ marginBottom: 18, gap: 12 }}>
        <div>
          <button className="btn ghost sm" onClick={onBack}>{I18N.t("CAMP_BACK_WORLDS")}</button>
          <div className="h1" style={{ marginBottom: 0, marginTop: 8 }}>{worldName}</div>
          <div className="muted mono" style={{ fontSize: 13, marginTop: 4 }}>{I18N.t("CAMP_STARS", total, D.STARS_PER_WORLD)}</div>
        </div>
        <span className="pill" style={{ color: "var(--gold)" }}>{I18N.t("CAMP_STARS", total, D.STARS_PER_WORLD)}</span>
      </div>

      <div className="camp-floor-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {Array.from({ length: D.FLOORS_PER_WORLD }).map((_, i) => {
          const unlocked = floorUnlocked(stars, i);
          const isBoss = i === D.BOSS_FLOOR;
          const fs = stars[i] || 0;
          return (
            <button key={i} disabled={!unlocked}
              onClick={() => unlocked && onPickFloor(i)}
              className="panel oct"
              style={{
                border: "1px solid " + (isBoss ? "rgba(247,147,26,0.5)" : "var(--line)"),
                padding: "16px 12px", textAlign: "center", cursor: unlocked ? "pointer" : "not-allowed",
                opacity: unlocked ? 1 : 0.45, position: "relative",
                background: isBoss ? "rgba(247,147,26,0.06)" : undefined,
              }}>
              {isBoss && <div style={{ fontSize: 10, fontWeight: 700, color: "var(--gold)", letterSpacing: 1, marginBottom: 4 }}>{I18N.t("CAMP_BOSS")}</div>}
              <div className="h2" style={{ fontSize: 22, color: isBoss ? "var(--gold)" : "var(--text)" }}>{i + 1}</div>
              <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)", margin: "2px 0 8px" }}>{I18N.t("CAMP_FLOOR_N", i + 1)}</div>
              {unlocked
                ? <Stars n={fs} size={16} />
                : <div className="mono" style={{ fontSize: 16 }}>🔒</div>}
              {isBoss && unlocked && (
                <div style={{ position: "absolute", inset: 0, pointerEvents: "none", boxShadow: "inset 0 0 18px rgba(247,147,26,0.18)" }} />
              )}
            </button>
          );
        })}
      </div>

      <div className="muted mono" style={{ fontSize: 12, marginTop: 16, textAlign: "center", color: "var(--text-faint)" }}>
        {world.type === "MIX" ? "★ Legendary · " : ""}{I18N.t("CAMP_FLOOR_LOCKED")}
      </div>
      <div className="mono" style={{ fontSize: 11, marginTop: 8, textAlign: "center", color: "var(--elec)" }}>
        💡 {I18N.t("CAMP_TICKET_HINT")}
      </div>
    </div>
  );
}

/* ---------------- SÉLECTEUR DE MONDE ---------------- */
function WorldSelect({ onPickWorld }) {
  const { g } = useFA();
  const allStars = totalStarsAll(g);

  return (
    <div className="container">
      <SectionHead eyebrow="📜 PVE" title={I18N.t("CAMP_TITLE")} sub={I18N.t("CAMP_SUB")} />

      <div className="flex between center wrap" style={{ marginBottom: 16, gap: 10 }}>
        <span className="pill" style={{ color: "var(--gold)" }}>{I18N.t("CAMP_TOTAL_STARS", allStars)}</span>
        <span className="pill" style={{ color: "var(--elec)" }}>{I18N.t("CAMP_TICKETS", g.ticketsSilver, g.ticketsGold)}</span>
      </div>

      <div className="camp-world-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
        {D.WORLDS.map((w) => {
          const unlocked = allStars >= w.starsReq;
          const total = worldStarTotal(g, w.id);
          const done = total === D.STARS_PER_WORLD;
          const name = I18N.t("CAMP_W" + (w.id + 1) + "_NAME");
          return (
            <button key={w.id} disabled={!unlocked} onClick={() => unlocked && onPickWorld(w.id)}
              className="panel oct"
              style={{
                border: "1px solid " + (done ? "rgba(247,147,26,0.6)" : "var(--line)"),
                padding: 0, textAlign: "left", cursor: unlocked ? "pointer" : "not-allowed",
                opacity: unlocked ? 1 : 0.5, overflow: "hidden", position: "relative",
              }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center", padding: 14 }}>
                <div style={{ width: 64, height: 64, flex: "none", display: "grid", placeItems: "center", background: "rgba(0,0,0,0.3)", borderRadius: 8, border: "1px solid " + w.color }}>
                  <img src={D.ART[w.img]} alt={name} draggable="false" style={{ width: 52, height: 52, objectFit: "contain", filter: unlocked ? "none" : "grayscale(1)" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{I18N.t("CAMP_FLOOR_N", w.id + 1)}</div>
                  <div className="h2" style={{ fontSize: 17, color: unlocked ? "var(--text)" : "var(--text-dim)" }}>{name}</div>
                  {unlocked ? (
                    <div style={{ marginTop: 4 }}>
                      <Stars n={Math.round(total / 10)} size={13} />
                      <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginLeft: 8 }}>{I18N.t("CAMP_STARS", total, D.STARS_PER_WORLD)}</span>
                    </div>
                  ) : (
                    <div className="mono" style={{ fontSize: 12, color: "var(--alert)", marginTop: 4 }}>{I18N.t("CAMP_LOCKED", w.starsReq)}</div>
                  )}
                </div>
              </div>
              {done && <div style={{ position: "absolute", top: 8, right: 10, fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>100% ✓</div>}
            </button>
          );
        })}
      </div>

      <CampaignTitles />
    </div>
  );
}

function CampaignTitles() {
  const { g } = useFA();
  const titles = g.campaignTitles || [];
  return (
    <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 16, marginTop: 20 }}>
      <div className="h2" style={{ fontSize: 14, color: "var(--fire)", marginBottom: 10 }}>🏅 {I18N.t("CAMP_TITLES")}</div>
      {titles.length === 0 ? (
        <div className="muted mono" style={{ fontSize: 12 }}>{I18N.t("CAMP_NO_TITLES")}</div>
      ) : (
        <div className="flex gap8 wrap">
          {titles.map((tk) => (
            <span key={tk} className="pill" style={{ color: tk === "CAMP_LEGEND_TITLE" ? "var(--fire)" : "var(--gold)" }}>
              {tk === "CAMP_LEGEND_TITLE" ? "👑 " : "★ "}{I18N.t(tk)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- RACINE CAMPAGNE ---------------- */
function Campaign() {
  // nav interne : { screen: "worlds" | "floors" | "combat", world, floor }
  const [nav, setNav] = useState({ screen: "worlds", world: 0, floor: 0 });

  if (nav.screen === "combat") {
    return (
      <CampaignCombat
        worldIndex={nav.world} floorIndex={nav.floor}
        onBack={() => setNav({ screen: "floors", world: nav.world, floor: 0 })}
        onCleared={(nextFloor) => setNav({ screen: "combat", world: nav.world, floor: nextFloor })}
      />
    );
  }
  if (nav.screen === "floors") {
    return (
      <FloorSelect worldIndex={nav.world}
        onBack={() => setNav({ screen: "worlds", world: 0, floor: 0 })}
        onPickFloor={(f) => setNav({ screen: "combat", world: nav.world, floor: f })}
      />
    );
  }
  return <WorldSelect onPickWorld={(w) => setNav({ screen: "floors", world: w, floor: 0 })} />;
}

Object.assign(window, { Campaign });
