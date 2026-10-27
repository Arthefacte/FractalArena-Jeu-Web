/* Généré par tools/precompile.mjs depuis arene.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Écran Arène (PvP classé)
   ============================================================ */
const {
  useState,
  useEffect,
  useRef
} = React;
const D = window.FA_DATA,
  I18N = window.FA_I18N;
const {
  useFA,
  cx,
  fmt,
  presetLabel,
  rarityLabel,
  AreneBattle,
  PostureSelect,
  FaText
} = window;
const AU = window.FA_ARENE_UI;

// E3 (clôture de l'audit complet 2026-09, D10/M4, emplacement 5) : « c'est toi » se décide sur
// l'identifiant OPAQUE, avec repli sur l'adresse tant que le serveur sert les deux (phase 1). Une
// seule fonction, pour que l'arène et son classement répondent la même chose.
function estMoi(row, g) {
  if (!row) return false;
  if (g.publicId && row.player_id) return row.player_id === g.publicId;
  return !!row.wallet && row.wallet === g.wallet;
}
function TeamPreview({
  team
}) {
  const list = Array.isArray(team) ? team.slice(0, 3) : [];
  return /*#__PURE__*/React.createElement("div", {
    className: "flex gap8",
    style: {
      flexWrap: "nowrap"
    }
  }, list.map((b, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "oct-sm",
    style: {
      width: 40,
      height: 40,
      overflow: "hidden",
      border: "1px solid var(--line)"
    }
  }, D.ART[b.image_key] ? /*#__PURE__*/React.createElement("img", {
    src: D.artFor(b),
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "contain"
    },
    draggable: "false",
    onError: e => {
      const fb = D.ART[b.image_key];
      if (fb && !e.currentTarget.dataset.fb) {
        e.currentTarget.dataset.fb = "1";
        e.currentTarget.src = fb;
      }
    }
  }) : null)));
}
function Arene() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const pvp = g.pvp || {};
  const [entry, setEntry] = useState("free");
  const [busy, setBusy] = useState(false);
  const attackLock = useRef(false); // verrou synchrone anti double-clic (le state `busy` ne se met à jour qu'au re-render)
  const [result, setResult] = useState(null);
  const [pick, setPick] = useState(null); // { target, revanche, ids:[id,id,id], oppTeam, posture, oppPosture } ou null
  const [nowTs, setNowTs] = useState(Date.now());
  const [defPosture, setDefPosture] = useState("equilibre");
  // Arène V2 : seule une défense confirmée par le serveur ouvre les adversaires.
  // undefined = lecture en cours ; null = absence explicite (404), jamais une panne réseau.
  const [myDefense, setMyDefense] = useState(undefined);
  const [defenseError, setDefenseError] = useState(null);
  // Fenêtre de l'historique des paiements (25/10/2026). La liste était étalée sous les
  // saisons : le fondateur a tranché — « pas très joli, étalé là comme ça, ça serait mieux
  // que ce soit un truc que tu cliques et qu'après tu scroll pour regarder ».
  const [histOpen, setHistOpen] = useState(false);
  const [replacementIndex, setReplacementIndex] = useState(null);
  const defenseRequest = useRef(0);
  const defenseLock = useRef(false);
  const recoveryChecked = useRef(null);
  const seasonFlipTried = useRef(false); // anti-rafale : une seule tentative + backoff

  const serverError = code => I18N.localizeServerError(code, {
    pair_limit: pvp.pair_limit
  });
  async function loadMyDefense() {
    const request = ++defenseRequest.current;
    try {
      const r = await actions.pvpDefenseOf(g.publicId || g.wallet);
      if (request !== defenseRequest.current) return;
      if (r && r.status === 404 && r.error === "pas_de_fantome") {
        setMyDefense(null);
        setDefenseError(null);
        setPick(null);
      } else if (r && r.ok && Array.isArray(r.team) && r.team.length === 3) {
        setMyDefense(r);
        setDefenseError(null);
        setDefPosture(r.posture || "equilibre");
      } else {
        setDefenseError(r && r.error || "network");
      }
    } catch (e) {
      if (request === defenseRequest.current) setDefenseError("network");
    }
  }

  // E4 : mon propre identifiant opaque quand il est là — la route accepte les deux formes
  // (adresse ou identifiant), et l'identifiant n'apprend rien sur moi si la requête traînait.
  useEffect(() => {
    setMyDefense(undefined);
    setDefenseError(null);
    setReplacementIndex(null);
    recoveryChecked.current = null;
    if (g.wallet) {
      loadMyDefense();
      actions.pvpRefresh().then(() => actions.pvpAttacksSeen());
    }
    return () => {
      ++defenseRequest.current;
    };
  }, [g.wallet, g.publicId]);
  // Historique des paiements de saison : la donnée vit dans pvp_season_archive, elle
  // n'était visible nulle part. Lue avec l'écran, indépendamment du popup.
  useEffect(() => {
    if (g.wallet) actions.pvpPrizesHistory();
  }, [g.wallet]);
  // Historique de la Tour : même logique, lu à l'ouverture de l'écran pour que le bouton
  // affiche son compteur sans attendre un clic.
  useEffect(() => {
    if (g.authToken) actions.towerPrizesHistory();
  }, [g.authToken]);
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Bascule auto en mode jouable quand l'heure d'ouverture est atteinte.
  // Sans garde, chaque client martelait pvpRefresh() (5 fetchs) à CHAQUE seconde
  // tant que le serveur n'avait pas basculé `live` (audit web 2026-09-08, P2#10).
  // Une seule tentative, puis on n'insiste que toutes les ~30 s.
  useEffect(() => {
    const open = pvp.season && pvp.season.live === false && Date.now() >= Number(pvp.season.starts_at);
    if (!open) return;
    if (seasonFlipTried.current && Date.now() - seasonFlipTried.current < 30000) return;
    seasonFlipTried.current = Date.now();
    actions.pvpRefresh();
  }, [nowTs]);
  const defenseReady = g.selected.length === 3;
  // Comme l'onglet Équipe, partir uniquement du roster actif renvoyé par le serveur.
  const rankedRoster = AU.rankedRoster(g.roster);
  const replacements = rankedRoster.filter(b => !g.selected.includes(b.id));
  const formationPositions = ["AR2_FORMATION_FRONT", "AR2_FORMATION_MIDDLE", "AR2_FORMATION_BACK"];
  const currentReplacement = replacementIndex === null ? null : g.roster.find(b => b.id === g.selected[replacementIndex]);
  const myDefensePosted = !!myDefense;
  const defense = AU.defenseStatus(myDefense, nowTs);
  const defensePostedDate = AU.defensePostedDate(myDefense && myDefense.posted_at, I18N.getLang());
  const canAttack = myDefensePosted && defense.hpKnown && !defense.down && !defenseError;
  const healCostKnown = pvp.heal_cost != null && Number.isFinite(Number(pvp.heal_cost));
  const refreshCostKnown = pvp.refresh_cost != null && Number.isFinite(Number(pvp.refresh_cost));
  const sc = AU.seasonCountdown(pvp.season, nowTs);
  // L'échéance invite à RELIRE la défense : elle ne rend jamais des PV côté client.
  useEffect(() => {
    const deadline = myDefense && myDefense.down_until;
    if (!deadline || defense.remainingMs > 0 || recoveryChecked.current === deadline) return;
    recoveryChecked.current = deadline;
    loadMyDefense();
  }, [nowTs, myDefense && myDefense.down_until]);
  function onChooseReplacement(id) {
    if (busy || replacementIndex === null || g.selected.includes(id) || !g.roster.some(b => b.id === id)) return;
    if (defenseReady) actions.replaceSelected(replacementIndex, id);else actions.toggleSelect(id);
    setReplacementIndex(null);
  }
  function onTakeTopThree() {
    if (busy || rankedRoster.length < 3) return;
    actions.selectTopThree();
    setReplacementIndex(null);
  }

  // Rafraîchit la liste d'adversaires : le serveur fait tourner le vivier (un tour gratuit par
  // fenêtre de 24 h, puis payant) et on relit la tranche suivante.
  async function onRefreshList() {
    if (busy || defenseLock.current || attackLock.current || !myDefensePosted || defenseError || !(pvp.refresh_free > 0) && !refreshCostKnown) return;
    defenseLock.current = true;
    setBusy(true);
    try {
      const r = await actions.pvpRefreshList();
      if (!r || !r.ok) {
        toast(serverError(r && r.error || null), "bad");
        return;
      }
      await actions.pvpRefresh();
      await loadMyDefense();
      toast(r.charged > 0 ? I18N.t("AR2_REFRESH_PAID", r.charged) : I18N.t("AR2_REFRESH_OK"), "good");
    } catch (e) {
      toast(serverError("network"), "bad");
    } finally {
      defenseLock.current = false;
      setBusy(false);
    }
  }
  async function onSetDefense() {
    if (busy || defenseLock.current || attackLock.current) return;
    if (!defenseReady) {
      toast(I18N.t("AR2_NO_DEFENSE"), "bad");
      return;
    }
    defenseLock.current = true;
    setBusy(true);
    try {
      const r = await actions.pvpSetDefense(defPosture);
      if (r && r.ok) {
        await loadMyDefense();
        await actions.pvpRefresh();
        toast(I18N.t("AR2_SET_DEFENSE"), "good");
      } else {
        toast(serverError(r && r.error), "bad");
        if (r && (r.error === "pas_de_defense" || r.error === "defense_tombee")) await loadMyDefense();
      }
    } catch (e) {
      toast(serverError("network"), "bad");
    } finally {
      defenseLock.current = false;
      setBusy(false);
    }
  }
  async function onHeal() {
    if (busy || defenseLock.current || attackLock.current || !canAttack || defense.full || !healCostKnown) return;
    defenseLock.current = true;
    setBusy(true);
    const request = ++defenseRequest.current;
    try {
      const r = await actions.pvpHeal();
      if (request !== defenseRequest.current) return;
      if (r && r.ok) {
        setMyDefense(d => d && {
          ...d,
          hp_left: r.hp_left,
          hp_max: r.hp_max
        });
        toast(I18N.t("AR2_HEAL_OK"), "good");
      } else {
        toast(serverError(r && r.error), "bad");
        await loadMyDefense();
      }
    } catch (e) {
      toast(serverError("network"), "bad");
    } finally {
      defenseLock.current = false;
      setBusy(false);
    }
  }
  async function onPickOpponent(o, revanche) {
    if (busy || attackLock.current || defenseLock.current || !canAttack) return;
    attackLock.current = true;
    setBusy(true);
    const request = defenseRequest.current;
    try {
      const ref = o.opponent_id || o.wallet;
      const r = await actions.pvpDefenseOf(ref);
      if (request !== defenseRequest.current) return;
      if (!r || !r.ok) {
        toast(serverError(r && r.error === "pas_de_fantome" ? "cible_sans_fantome" : r && r.error), "bad");
        return;
      }
      setPick({
        target: ref,
        revanche,
        ids: [...g.selected],
        oppTeam: r.team || o.team,
        posture: "equilibre",
        oppPosture: r.posture || null
      });
    } catch (e) {
      toast(serverError("network"), "bad");
    } finally {
      attackLock.current = false;
      setBusy(false);
    }
  }
  async function onAttack(target, useRevanche, attackers, myPosture, enemyPosture) {
    if (attackLock.current || defenseLock.current || busy || !canAttack) return; // bloque aussi une défense tombée pendant la sélection
    attackLock.current = true;
    setBusy(true);
    try {
      const prev = g.pvp && typeof g.pvp.rating === "number" ? g.pvp.rating : null;
      const r = await actions.pvpAttack(target, useRevanche ? "revanche" : entry, attackers, myPosture);
      if (!r || !r.ok) {
        toast(serverError(r && (r.error || r.reason) || null), "bad");
        if (r && (r.error === "pas_de_defense" || r.error === "defense_tombee")) await loadMyDefense();
        return;
      }
      const delta = prev != null && typeof r.rating === "number" ? r.rating - prev : null;
      const myTeam = (attackers || g.selected).map(id => g.roster.find(b => b.id === id)).filter(Boolean);
      setResult({
        ...r,
        delta,
        p1Team: myTeam,
        p2Team: r.enemy || [],
        p1Posture: myPosture || "equilibre",
        p2Posture: enemyPosture || null
      });
      // Pas de refresh PvP ici (différé au onClose du rejeu) : rafraîchir maintenant
      // mettrait à jour le pill ELO du header et le ladder pendant le combat → résultat spoilé.
    } catch (e) {
      toast(serverError("network"), "bad");
    } finally {
      attackLock.current = false;
      setBusy(false);
    }
  }
  const seasonMs = pvp.season ? Number(pvp.season.ends_at) - Date.now() : 0;
  const modes = AU.entryModes(pvp);
  return /*#__PURE__*/React.createElement("div", {
    className: "container wide"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      marginBottom: 14,
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, I18N.t("AR2_TAG")), /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      marginBottom: 0
    }
  }, I18N.t("AR2_TITLE"))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8 wrap"
  }, myDefensePosted && /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: AU.leagueColor(pvp.league)
    }
  }, AU.leagueLabel(pvp.league)), myDefensePosted && /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: "var(--elec)"
    }
  }, "ELO ", pvp.rating != null ? pvp.rating : "—"), /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: "var(--success)"
    }
  }, "\u26A1 ", pvp.free_remaining != null ? pvp.free_remaining : 0), pvp.season && /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: "var(--gold)"
    }
  }, I18N.t("AR2_SEASON", pvp.season.season), " \xB7 ", I18N.t("AR2_ENDS_IN", AU.fmtCountdown(seasonMs))), myDefensePosted && /*#__PURE__*/React.createElement("button", {
    className: "btn sm",
    "data-guide": "arene-refresh",
    disabled: busy || !!defenseError || !(pvp.refresh_free > 0) && !refreshCostKnown,
    onClick: onRefreshList
  }, I18N.t("AR2_REFRESH"), " \xB7 ", (pvp.refresh_free || 0) > 0 ? I18N.t("AR2_REFRESH_FREE") : refreshCostKnown ? `${pvp.refresh_cost} FA` : "—"))), defenseError ? /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    role: "alert",
    style: {
      border: "1px solid var(--alert)",
      padding: 20,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("p", null, I18N.t("AR2_DEFENSE_ERROR")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      marginBottom: 12
    }
  }, serverError(defenseError)), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec",
    disabled: busy,
    onClick: loadMyDefense
  }, I18N.t("AR2_DEFENSE_RETRY"))) : myDefense === undefined ? /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    role: "status",
    style: {
      padding: 20,
      marginBottom: 14
    }
  }, I18N.t("AR2_DEFENSE_LOADING")) : myDefense === null ? /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    "data-fa": "arene-entry",
    style: {
      border: "1px solid var(--elec)",
      padding: 24,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("h2", {
    className: "h2",
    style: {
      color: "var(--elec)",
      marginBottom: 12
    }
  }, I18N.t("AR2_ENTRY_TITLE")), /*#__PURE__*/React.createElement("p", {
    style: {
      color: "var(--text-dim)",
      lineHeight: 1.6
    }
  }, I18N.t("AR2_ENTRY_HINT")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap12 wrap",
    style: {
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec",
    onClick: () => actions.setView("team")
  }, I18N.t("AR2_OPEN_TEAM")), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    disabled: busy,
    onClick: () => setReplacementIndex(0)
  }, I18N.t("AR2_CHOOSE_THREE")))) : null, /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex center gap12"
  }, /*#__PURE__*/React.createElement("span", {
    className: "h2",
    style: {
      fontSize: 14
    }
  }, I18N.t("AR2_MY_DEFENSE")), /*#__PURE__*/React.createElement(TeamPreview, {
    team: myDefensePosted ? myDefense.team : g.selected.map(id => g.roster.find(b => b.id === id)).filter(Boolean)
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-forge",
    disabled: busy || !defenseReady,
    onClick: onSetDefense
  }, I18N.t("AR2_SET_DEFENSE"))), myDefensePosted && /*#__PURE__*/React.createElement("div", {
    "data-fa": "arene-defense-provenance",
    style: {
      marginTop: 10
    }
  }, defensePostedDate && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      color: "var(--text-dim)",
      fontSize: 11,
      marginBottom: 6
    }
  }, I18N.t("AR2_DEFENSE_POSTED_AT", defensePostedDate)), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      lineHeight: 1.6,
      overflowWrap: "anywhere"
    }
  }, myDefense.team.map(b => D.displayName(b)).join(" · ")), myDefense.stale && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    role: "status",
    style: {
      color: "var(--alert)",
      fontSize: 11,
      marginTop: 6
    }
  }, I18N.t("AR2_DEFENSE_STALE"))), myDefensePosted && /*#__PURE__*/React.createElement("div", {
    "data-fa": "arene-defense-hp",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, I18N.t("AR2_DEFENSE_HP", defense.hpKnown ? defense.hpLeft : "—", defense.hpKnown ? defense.hpMax : "—")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-success",
    disabled: busy || !canAttack || defense.full || !healCostKnown,
    onClick: onHeal
  }, defense.full ? I18N.t("AR2_DEFENSE_FULL") : I18N.t("AR2_HEAL", healCostKnown ? pvp.heal_cost : "—"))), /*#__PURE__*/React.createElement("div", {
    role: "progressbar",
    "aria-label": I18N.t("AR2_MY_DEFENSE"),
    "aria-valuemin": 0,
    "aria-valuemax": defense.hpKnown ? defense.hpMax : undefined,
    "aria-valuenow": defense.hpKnown ? defense.hpLeft : undefined,
    style: {
      height: 10,
      marginTop: 10,
      background: "var(--line-soft)",
      borderRadius: 5,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: `${defense.hpPct}%`,
      height: "100%",
      background: defense.down ? "var(--alert)" : "var(--success)",
      transition: "width .2s"
    }
  })), defense.down && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    "data-fa": "arene-defense-down",
    style: {
      color: "var(--alert)",
      marginTop: 10
    }
  }, defense.remainingMs > 0 ? I18N.t("AR2_DEFENSE_DOWN", `${Math.floor(Math.ceil(defense.remainingMs / 1000) / 60)}:${String(Math.ceil(defense.remainingMs / 1000) % 60).padStart(2, "0")}`) : I18N.t("AR2_DEFENSE_RAISE"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(PostureSelect, {
    value: defPosture,
    onChange: setDefPosture,
    disabled: busy
  })), !myDefensePosted && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--alert)",
      marginTop: 8
    }
  }, I18N.t("AR2_DEFENSE_HINT")), (() => {
    const selTeam = g.selected.map(id => g.roster.find(b => b.id === id)).filter(Boolean);
    const syns = AU.computeSynergiesLabels(selTeam);
    return /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 11,
        color: "var(--text-dim)",
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex between center wrap",
      style: {
        gap: 8,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("span", null, I18N.t("AR2_FORMATION_HINT")), /*#__PURE__*/React.createElement("button", {
      className: "btn sm",
      disabled: busy || rankedRoster.length < 3,
      onClick: onTakeTopThree
    }, I18N.t("AR2_TAKE_TOP_THREE"))), formationPositions.map((pos, i) => {
      const b = g.selected[i] && g.roster.find(x => x.id === g.selected[i]);
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        className: "flex between center",
        style: {
          gap: 8,
          padding: "4px 0"
        }
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn sm",
        "data-fa": "arene-defense-slot",
        "data-slot": i,
        disabled: busy,
        "aria-expanded": replacementIndex === i,
        "aria-controls": "arene-defense-replacements",
        onClick: () => setReplacementIndex(i),
        style: {
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          whiteSpace: "normal",
          overflowWrap: "anywhere"
        }
      }, I18N.t(pos), " : ", b ? D.displayName(b) : I18N.t("AR2_SLOT_EMPTY"), b && /*#__PURE__*/React.createElement("span", {
        style: {
          display: "block",
          fontSize: 11,
          color: "var(--text-dim)",
          marginTop: 4
        }
      }, I18N.t("AR2_POWER", Math.round(AU.entityPower(b))))), /*#__PURE__*/React.createElement("span", {
        className: "flex gap8"
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn xs",
        "aria-label": I18N.t("AR2_MOVE_UP", I18N.t(pos)),
        disabled: busy || !defenseReady || i === 0,
        onClick: () => {
          actions.pvpReorderDefense(i, i - 1);
          setReplacementIndex(null);
        }
      }, "\u2191"), /*#__PURE__*/React.createElement("button", {
        className: "btn xs",
        "aria-label": I18N.t("AR2_MOVE_DOWN", I18N.t(pos)),
        disabled: busy || !defenseReady || i === 2,
        onClick: () => {
          actions.pvpReorderDefense(i, i + 1);
          setReplacementIndex(null);
        }
      }, "\u2193")));
    }), replacementIndex !== null && /*#__PURE__*/React.createElement("section", {
      id: "arene-defense-replacements",
      "data-fa": "arene-defense-replacements",
      "aria-labelledby": "arene-replacement-title",
      style: {
        border: "1px solid var(--elec)",
        padding: 12,
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex between center wrap",
      style: {
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("h3", {
      id: "arene-replacement-title",
      style: {
        fontSize: 13,
        margin: 0
      }
    }, defenseReady ? I18N.t("AR2_REPLACEMENT_TITLE", I18N.t(formationPositions[replacementIndex])) : I18N.t("AR2_SELECTION_ADD")), /*#__PURE__*/React.createElement("button", {
      className: "btn sm",
      onClick: () => setReplacementIndex(null)
    }, I18N.t("AR2_REPLACEMENT_CANCEL"))), /*#__PURE__*/React.createElement("p", null, I18N.t("AR2_SLOT_POWER", currentReplacement ? Math.round(AU.entityPower(currentReplacement)) : "—")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gap: 8,
        maxHeight: 320,
        overflowY: "auto"
      }
    }, replacements.map(b => /*#__PURE__*/React.createElement("button", {
      key: b.id,
      className: "btn sm",
      "data-fa": "arene-defense-candidate",
      "data-id": b.id,
      disabled: busy,
      onClick: () => onChooseReplacement(b.id),
      style: {
        display: "block",
        textAlign: "left",
        whiteSpace: "normal",
        overflowWrap: "anywhere"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block"
      }
    }, D.displayName(b), " \xB7 ", I18N.t("AR2_POWER", Math.round(AU.entityPower(b)))), /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontSize: 11,
        color: "var(--text-dim)",
        marginTop: 4
      }
    }, I18N.t("AR2_ENTITY_STATS", b.level, rarityLabel(b.rarity), D.maxHp(b))))), replacements.length === 0 && /*#__PURE__*/React.createElement("p", {
      role: "status"
    }, I18N.t("AR2_REPLACEMENT_NONE")))), syns.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6
      }
    }, syns.map(s => /*#__PURE__*/React.createElement("span", {
      key: s.key,
      className: "pill",
      style: {
        color: "var(--success)",
        marginRight: 6
      }
    }, s.label, " \xB7 ", s.effect))));
  })()), myDefensePosted && !defenseError && AU.defenseOutdated(myDefense) && /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    "data-fa": "arene-defense-outdated",
    role: "status",
    style: {
      border: "1px solid var(--gold)",
      padding: 14,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      color: "var(--gold)",
      fontSize: 12,
      lineHeight: 1.6
    }
  }, I18N.t("AR2_DEFENSE_OUTDATED")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8 wrap",
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec sm",
    disabled: busy,
    onClick: () => actions.setView("team")
  }, I18N.t("AR2_OPEN_TEAM")), /*#__PURE__*/React.createElement("button", {
    className: "btn sm",
    disabled: busy || rankedRoster.length < 3,
    onClick: onTakeTopThree
  }, I18N.t("AR2_TAKE_TOP_THREE")))), myDefensePosted && !defenseError && (sc.prelaunch ? /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 24,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      color: "var(--elec)",
      marginBottom: 8
    }
  }, I18N.t("AR2_PRELAUNCH_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 28,
      color: "var(--gold)",
      margin: "12px 0"
    }
  }, I18N.t("AR2_STARTS_IN", AU.fmtCountdownSec(sc.ms))), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 13,
      color: "var(--text-dim)"
    }
  }, I18N.t("AR2_PRELAUNCH_HINT"))) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1.2fr 0.8fr",
      gap: 16
    },
    className: "arena-lower"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "h2",
    style: {
      fontSize: 14,
      color: "var(--fire)"
    }
  }, I18N.t("AR2_OPPONENTS")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8"
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      alignSelf: "center"
    }
  }, I18N.t("AR2_ENTRY"), " :"), modes.map(m => /*#__PURE__*/React.createElement("button", {
    key: m.key,
    className: cx("btn sm", entry === m.key && "on"),
    disabled: !m.available,
    onClick: () => setEntry(m.key)
  }, m.key === "free" ? I18N.t("AR2_FREE") : m.key === "fa" ? /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("AR2_FA", pvp.fa_cost ?? "—"),
    s: 12
  }) : I18N.t("AR2_TICKET"))))), (!pvp.opponents || pvp.opponents.length === 0) && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      color: "var(--text-dim)",
      fontSize: 13
    }
  }, I18N.t("AR2_NO_OPPONENTS")), (() => {
    // Arène V2 : un seul vivier de défenses posées, six cartes au maximum.
    const carte = o => {
      // E3 (D10/M4, emplacements 2 et 3) : l'identifiant opaque de l'adversaire devient la
      // CLÉ de cette liste. La liste de revanches de l'appareil contient encore des adresses
      // (elles y étaient écrites avant cette phase) : on accepte donc les deux formes, pour
      // qu'aucune revanche déjà gagnée ne disparaisse du jour au lendemain.
      // C'est AUSSI la cible envoyée à l'attaque : `/pvp/opponents` publie `opponent_id`,
      // jamais `player_id` (ce nom-là est celui du CLASSEMENT, /pvp/ladder). Lire
      // `player_id` ici envoyait `target: undefined` ; le serveur répondait alors
      // `cible_invalide` (« 对手无效 ») à CHAQUE attaque d'Arène (panne du 01/10/2026).
      const oId = o.opponent_id || o.wallet;
      const canRevanche = Array.isArray(pvp.revanches) && (pvp.revanches.includes(oId) || o.opponent_id && pvp.revanches.includes(o.wallet));
      // L'appariement se fait sur la puissance : c'est l'écart qui dit si le
      // combat est jouable, pas l'ELO (tout le monde y démarre à 1000).
      // Le contrat V2 ne garantit pas `power` sur une carte : son absence ne vaut pas zéro.
      const powerKnown = Number.isFinite(o.power);
      const gap = powerKnown && pvp.power > 0 ? AU.powerGapPct(pvp.power, o.power) : null;
      const tone = AU.powerGapTone(gap);
      const gapColor = gap === null ? "var(--text-dim)" : tone === "even" ? "var(--success)" : tone === "edge" ? "var(--gold)" : "var(--alert)";
      // Au-delà de ±50 %, le pourcentage sature (« −100 % » sur toutes les cartes) : on
      // nomme l'écart au lieu de le chiffrer.
      const ecart = gap === null ? null : AU.powerGapLabel(gap);
      return /*#__PURE__*/React.createElement("div", {
        key: oId,
        className: "oct-sm",
        style: {
          border: "1px solid var(--line-soft)",
          padding: 10,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          minWidth: 0
        }
      }, /*#__PURE__*/React.createElement("div", {
        className: "mono",
        style: {
          fontWeight: 700,
          fontSize: 13,
          marginBottom: 4,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis"
        }
      }, o.name || oId), /*#__PURE__*/React.createElement("div", {
        className: "flex gap8 center"
      }, /*#__PURE__*/React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 12,
          color: AU.leagueColor(o.league)
        }
      }, AU.leagueLabel(o.league)), /*#__PURE__*/React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 12,
          color: "var(--elec)"
        }
      }, "ELO ", o.rating), /*#__PURE__*/React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 12,
          color: gapColor
        }
      }, I18N.t("AR2_POWER", powerKnown ? o.power : "—"), ecart ? ` · ${I18N.t(ecart)}` : gap !== null && gap !== 0 && ` (${gap > 0 ? "+" : "−"}${Math.abs(gap)} %)`), canRevanche && /*#__PURE__*/React.createElement("span", {
        className: "mono",
        style: {
          fontSize: 11,
          color: "var(--success)"
        }
      }, "\uD83D\uDD25 ", I18N.t("AR2_REVANCHE"))), /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 6
        }
      }, /*#__PURE__*/React.createElement(TeamPreview, {
        team: o.team
      }))), canRevanche ? /*#__PURE__*/React.createElement("button", {
        className: "btn btn-success sm",
        disabled: busy || !canAttack,
        onClick: () => onPickOpponent(o, true)
      }, I18N.t("AR2_REVANCHE")) : /*#__PURE__*/React.createElement("button", {
        className: "btn btn-elec sm",
        "data-guide": "arene-attack",
        disabled: busy || !canAttack,
        onClick: () => onPickOpponent(o, false)
      }, I18N.t("AR2_ATTACK")));
    };
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 10
      }
    }, (pvp.opponents || []).slice(0, 6).map(carte));
  })()), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "h2",
    style: {
      fontSize: 14,
      color: "var(--gold)"
    }
  }, I18N.t("AR2_LADDER")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, (pvp.ladder || []).map(row => /*#__PURE__*/React.createElement("div", {
    key: row.player_id || row.wallet,
    className: "flex between",
    style: {
      padding: "5px 8px",
      background: estMoi(row, g) ? "rgba(0,240,255,0.08)" : "transparent",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, row.rank, ". ", estMoi(row, g) ? "➔ " : "", (row.name || "").slice(0, 24), (row.name || "").length > 24 ? "…" : ""), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      color: "var(--elec)"
    }
  }, row.rating, " \xB7 ", row.wins || 0, "-", row.losses || 0)))), pvp.season && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginTop: 12
    }
  }, /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("AR2_PRIZE", pvp.season.dotation || 0),
    s: 11
  })), pvp.season && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("AR2_PRIZE_FLAT"),
    s: 11
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "card",
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: "0 0 8px"
    }
  }, I18N.t("AR2_ATTACKS_TITLE")), !pvp.attacks || pvp.attacks.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      color: "var(--text-dim)",
      fontSize: 12
    }
  }, I18N.t("AR2_ATTACKS_NONE")) : pvp.attacks.map((a, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      borderTop: i ? "1px solid var(--line,#1c2740)" : "none",
      padding: "8px 0"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700
    }
  }, a.attacker_name || a.attacker_id || "…"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: a.attacker_won ? "var(--alert)" : "var(--success)"
    }
  }, a.attacker_won ? I18N.t("AR2_ATTACKS_BEAT") : I18N.t("AR2_ATTACKS_REPELLED"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginTop: 4
    }
  }, (a.team || []).map((b, j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    style: {
      flex: 1,
      textAlign: "center",
      fontSize: 10,
      color: "var(--text-dim)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      margin: "0 auto",
      borderRadius: 6,
      overflow: "hidden",
      background: "#0b1020"
    }
  }, D.ART[b.image_key] ? /*#__PURE__*/React.createElement("img", {
    src: D.artFor(b),
    alt: "",
    style: {
      width: "100%",
      height: "100%",
      objectFit: "contain"
    },
    onError: e => {
      const fb = D.ART[b.image_key];
      if (fb && !e.currentTarget.dataset.fb) {
        e.currentTarget.dataset.fb = "1";
        e.currentTarget.src = fb;
      }
    }
  }) : null), /*#__PURE__*/React.createElement("div", {
    style: {
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "ellipsis"
    }
  }, D.displayName(b)), /*#__PURE__*/React.createElement("div", null, I18N.t("LINK_TIER"), b.level, " \xB7 ", D.fmtStat(D.eff(b, "atk")), "/", D.fmtStat(D.eff(b, "def"))))))))), /*#__PURE__*/React.createElement("button", {
    className: "btn block",
    style: {
      marginTop: 14
    },
    "data-fa": "hist-prix-open",
    onClick: () => setHistOpen(true)
  }, I18N.t("AR2_HIST_TITLE"), (Array.isArray(g.pvpPrizesHistory) ? g.pvpPrizesHistory.length : 0) > 0 && /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      opacity: .7
    }
  }, " \xB7 ", g.pvpPrizesHistory.length)), histOpen && (() => {
    const hist = Array.isArray(g.pvpPrizesHistory) ? g.pvpPrizesHistory : [];
    const totalHist = hist.reduce((s, h) => s + (h.reward || 0), 0);
    return /*#__PURE__*/React.createElement(Modal, {
      onClose: () => setHistOpen(false),
      accent: "var(--gold)"
    }, /*#__PURE__*/React.createElement("h3", {
      style: {
        margin: "0 0 10px"
      }
    }, I18N.t("AR2_HIST_TITLE")), hist.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        color: "var(--text-dim)",
        fontSize: 12
      }
    }, I18N.t("AR2_HIST_NONE")) :
    /*#__PURE__*/
    /* La fenêtre défile : une saison par ligne, la plus récente en haut. Le plafond
       de hauteur garde le bouton de fermeture accessible sur un petit écran. */
    React.createElement("div", {
      style: {
        maxHeight: "55vh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch"
      },
      "data-fa": "hist-prix"
    }, hist.map((h, i) => /*#__PURE__*/React.createElement("div", {
      key: h.season + "-" + i,
      className: "flex between",
      style: {
        borderTop: i ? "1px solid var(--line,#1c2740)" : "none",
        padding: "8px 0",
        fontSize: 12,
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        color: AU.leagueColor(h.league)
      }
    }, I18N.t("PRIZE_SEASON_RANK", h.season, h.rank, AU.leagueLabel(h.league))), /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        color: h.locked ? "var(--text-dim)" : "var(--success)",
        whiteSpace: "nowrap"
      }
    }, /*#__PURE__*/React.createElement(FaText, {
      text: "+" + (h.reward || 0) + " FA" + (h.locked ? " 🔒" : ""),
      s: 12
    }))))), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        marginTop: 10,
        fontSize: 11,
        color: "var(--text-dim)",
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement(FaText, {
      text: I18N.t("AR2_HIST_TOTAL", totalHist),
      s: 11
    })), /*#__PURE__*/React.createElement("button", {
      className: "btn block",
      style: {
        marginTop: 14
      },
      onClick: () => setHistOpen(false)
    }, I18N.t("CLOSE")));
  })(), pick && (() => {
    const byId = id => g.roster.find(b => b.id === id);
    // Affinités face à l'équipe adverse affichée — cosmétique (arene-ui.js).
    const oppTypes = (pick.oppTeam || []).map(b => b && b.type);
    const affArrow = b => {
      const aff = b && AU.affinityIndicator(b.type, oppTypes);
      if (!aff) return null;
      return /*#__PURE__*/React.createElement("span", {
        title: I18N.t(aff.tipKey, b.type, aff.vsType, aff.pct),
        "aria-label": I18N.t(aff.ariaKey),
        style: {
          color: aff.color,
          fontWeight: 700,
          marginLeft: 3
        }
      }, aff.arrow);
    };
    const toggle = id => setPick(p => {
      if (!p) return p;
      const has = p.ids.includes(id);
      const ids = has ? p.ids.filter(x => x !== id) : p.ids.length < 3 ? [...p.ids, id] : p.ids;
      return {
        ...p,
        ids
      };
    });
    const move = (i, j) => setPick(p => {
      if (!p || j < 0 || j >= p.ids.length || i < 0 || i >= p.ids.length) return p;
      const ids = [...p.ids];
      [ids[i], ids[j]] = [ids[j], ids[i]];
      return {
        ...p,
        ids
      };
    });
    const ready = pick.ids.length === 3;
    return /*#__PURE__*/React.createElement("div", {
      className: "modal-backdrop",
      style: {
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 16
      },
      onClick: () => setPick(null)
    }, /*#__PURE__*/React.createElement("div", {
      className: "panel oct",
      style: {
        border: "1px solid var(--line)",
        padding: 16,
        maxWidth: 560,
        width: "100%",
        maxHeight: "90vh",
        overflow: "auto",
        background: "var(--bg)"
      },
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement("div", {
      className: "h2",
      style: {
        fontSize: 14,
        color: "var(--fire)",
        marginBottom: 8
      }
    }, I18N.t("AR2_ATTACK")), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 11,
        color: "var(--text-dim)",
        marginBottom: 4
      }
    }, I18N.t("AR2_OPPONENTS"), " :"), /*#__PURE__*/React.createElement("div", {
      className: "flex gap8",
      style: {
        marginBottom: 4
      }
    }, (pick.oppTeam || []).slice(0, 3).map((b, i) => /*#__PURE__*/React.createElement("span", {
      key: i,
      className: "pill",
      style: {
        color: "var(--fire)"
      }
    }, D.TYPE_LABEL ? D.TYPE_LABEL[b.type] || b.type : b.type))), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 11,
        color: "var(--text-dim)",
        marginBottom: 8
      }
    }, I18N.t("POSTURE_ENEMY"), " : ", pick.oppPosture ? I18N.t("POSTURE_" + pick.oppPosture.toUpperCase()) : I18N.t("AR2_POS_UNKNOWN")), /*#__PURE__*/React.createElement(PostureSelect, {
      value: pick.posture || "equilibre",
      onChange: k => setPick(p => ({
        ...p,
        posture: k
      })),
      disabled: busy
    }), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 11,
        color: "var(--text-dim)",
        margin: "8px 0 2px"
      }
    }, "\u2694\uFE0F ", I18N.t("AR2_ATTACK"), " \u2014 Avant / Milieu / Arri\xE8re"), [0, 1, 2].map(i => {
      const b = byId(pick.ids[i]);
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        className: "flex between center",
        style: {
          gap: 8,
          padding: "2px 0",
          fontSize: 12
        }
      }, /*#__PURE__*/React.createElement("span", null, ["Avant", "Milieu", "Arrière"][i], " : ", b ? b.custom_name || b.name : "—", " ", b ? /*#__PURE__*/React.createElement("span", {
        style: {
          color: "var(--text-dim)"
        }
      }, "(", D.TYPE_LABEL ? D.TYPE_LABEL[b.type] || b.type : b.type, ")") : null, affArrow(b)), /*#__PURE__*/React.createElement("span", {
        className: "flex gap8"
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn xs",
        disabled: i === 0,
        onClick: () => move(i, i - 1)
      }, "\u2191"), /*#__PURE__*/React.createElement("button", {
        className: "btn xs",
        disabled: i === 2,
        onClick: () => move(i, i + 1)
      }, "\u2193")));
    }), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 11,
        color: "var(--text-dim)",
        margin: "8px 0 2px"
      }
    }, I18N.t("AR2_DEFENDER_EDGE_HINT")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexWrap: "wrap",
        gap: 6,
        marginTop: 6
      }
    }, (g.roster || []).map(b => {
      const on = pick.ids.includes(b.id);
      return /*#__PURE__*/React.createElement("button", {
        key: b.id,
        className: cx("btn xs", on && "on"),
        onClick: () => toggle(b.id),
        style: {
          opacity: on ? 1 : 0.7
        }
      }, b.custom_name || b.name, " \xB7 ", D.TYPE_LABEL ? D.TYPE_LABEL[b.type] || b.type : b.type, affArrow(b));
    })), /*#__PURE__*/React.createElement("div", {
      className: "flex gap8",
      style: {
        marginTop: 12,
        justifyContent: "flex-end"
      }
    }, /*#__PURE__*/React.createElement("button", {
      className: "btn sm",
      onClick: () => setPick(null)
    }, I18N.t("CANCEL")), /*#__PURE__*/React.createElement("button", {
      className: "btn btn-elec sm",
      disabled: !ready || busy || !canAttack,
      onClick: () => {
        const ids = [...pick.ids];
        const t = pick.target,
          rv = pick.revanche,
          myPosture = pick.posture || "equilibre",
          oppPosture = pick.oppPosture || null;
        setPick(null);
        onAttack(t, rv, ids, myPosture, oppPosture);
      }
    }, I18N.t("AR2_ATTACK")))));
  })(), result && /*#__PURE__*/React.createElement(AreneBattle, {
    events: result.events,
    p1Team: result.p1Team || [],
    p2Team: result.p2Team || [],
    won: result.won,
    delta: result.delta,
    elo: result.elo,
    opponentName: result.opponent_name,
    p1Posture: result.p1Posture,
    p2Posture: result.p2Posture,
    onClose: () => {
      setResult(null);
      actions.pvpRefresh();
      loadMyDefense();
    }
  }));
}
function PrizeModal({
  prizes,
  onClaim,
  onClose
}) {
  const {
    Modal
  } = window;
  const AU = window.FA_ARENE_UI;
  const total = prizes.reduce((s, p) => s + (p.reward || 0), 0);
  return (
    /*#__PURE__*/
    /* Fermer (✕, Échap, clic à côté) n'est PAS récupérer. Avant, `onClose` valait
       `onClaim` : un clic à côté posait `seen = TRUE` sur tous les prix, et
       `/pvp/prizes` (filtre `seen = FALSE`) ne les renvoyait plus jamais — le joueur
       perdait la trace d'un gain pourtant crédité (26/10/2026 : 492 FA, saison 18).
       Seul le bouton « Récupérer » appelle `onClaim`. */
    React.createElement(Modal, {
      onClose: onClose,
      accent: "var(--gold)"
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        marginBottom: 16
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "h1",
      style: {
        fontSize: 28,
        color: "var(--gold)"
      }
    }, I18N.t(prizes.every(p => p.kind === "tower") ? "PRIZE_TOWER_TITLE" : "PRIZE_TITLE"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: 12
      }
    }, prizes.map((p, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      className: "panel oct",
      style: {
        border: "1px solid var(--line)",
        padding: "10px 14px"
      }
    }, p.kind === "tower" ? /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        color: "var(--elec)",
        marginBottom: 6,
        fontWeight: "bold"
      }
    }, "\uD83D\uDDFC ", I18N.t("PRIZE_TOWER_RANK", p.week_key, p.rank, p.best_floor)) : /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        color: AU.leagueColor(p.league),
        marginBottom: 6,
        fontWeight: "bold"
      }
    }, I18N.t("PRIZE_SEASON_RANK", p.season, p.rank, AU.leagueLabel(p.league))), p.dotation != null && /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 13,
        color: "var(--text-dim)"
      }
    }, /*#__PURE__*/React.createElement(FaText, {
      text: I18N.t("PRIZE_TOWER_DOTATION", p.dotation)
    })), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement(FaText, {
      text: I18N.t("PRIZE_BEFORE", p.balance_before)
    })), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 13,
        color: "var(--success)"
      }
    }, /*#__PURE__*/React.createElement(FaText, {
      text: I18N.t(p.locked ? "PRIZE_REWARD_LOCKED" : "PRIZE_REWARD", p.reward)
    })), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement(FaText, {
      text: I18N.t("PRIZE_AFTER", p.balance_after)
    }))))), prizes.length > 1 && /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        textAlign: "center",
        marginTop: 12,
        color: "var(--success)",
        fontWeight: "bold"
      }
    }, /*#__PURE__*/React.createElement(FaText, {
      text: I18N.t("PRIZE_TOTAL", total)
    })), /*#__PURE__*/React.createElement("button", {
      className: "btn block lg btn-elec",
      style: {
        marginTop: 16
      },
      onClick: onClaim
    }, I18N.t("PRIZE_CLAIM")), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        textAlign: "center",
        marginTop: 8,
        fontSize: 11,
        color: "var(--text-dim)"
      }
    }, I18N.t("PRIZE_KEEP_HINT")))
  );
}
Object.assign(window, {
  Arene,
  PrizeModal
});
})();
