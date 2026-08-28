/* Généré par tools/precompile.mjs depuis arene.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Écran Arène (PvP classé, ligues)
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
  useEffect(() => {
    if (g.wallet) {
      actions.pvpRefresh().then(() => actions.pvpAttacksSeen());
      actions.pvpDefenseOf(g.wallet).then(r => setDefPosture(r && r.posture || "equilibre"));
    }
  }, [g.wallet]);
  useEffect(() => {
    const id = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  // Bascule auto en mode jouable quand l'heure d'ouverture est atteinte.
  useEffect(() => {
    if (pvp.season && pvp.season.live === false && Date.now() >= Number(pvp.season.starts_at)) actions.pvpRefresh();
  }, [nowTs]);
  const defenseReady = g.selected.length === 3;
  const sc = AU.seasonCountdown(pvp.season, nowTs);
  async function onSetDefense() {
    if (!defenseReady) {
      toast(I18N.t("AR2_NO_DEFENSE"), "bad");
      return;
    }
    setBusy(true);
    const r = await actions.pvpSetDefense(defPosture);
    setBusy(false);
    if (r && r.ok) toast(I18N.t("AR2_SET_DEFENSE"), "good");else toast(r && r.error || "error", "bad");
  }
  async function onAttack(target, useRevanche, attackers, myPosture, enemyPosture) {
    if (attackLock.current || busy) return; // le ref bloque les clics de la même rafale avant que `busy` ne re-render
    attackLock.current = true;
    setBusy(true);
    try {
      const prev = g.pvp && typeof g.pvp.rating === "number" ? g.pvp.rating : null;
      const r = await actions.pvpAttack(target, useRevanche ? "revanche" : entry, attackers, myPosture);
      if (!r || !r.ok) {
        toast(r && r.error || "error", "bad");
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
        p2Posture: enemyPosture || "equilibre"
      });
      // Pas de refresh PvP ici (différé au onClose du rejeu) : rafraîchir maintenant
      // mettrait à jour le pill ELO du header et le ladder pendant le combat → résultat spoilé.
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
  }, /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: AU.leagueColor(pvp.league)
    }
  }, AU.leagueLabel(pvp.league)), /*#__PURE__*/React.createElement("span", {
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
  }, I18N.t("AR2_SEASON", pvp.season.season), " \xB7 ", I18N.t("AR2_ENDS_IN", AU.fmtCountdown(seasonMs))), /*#__PURE__*/React.createElement("button", {
    className: "btn sm",
    onClick: () => actions.pvpRefresh()
  }, I18N.t("AR2_REFRESH")))), /*#__PURE__*/React.createElement("div", {
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
    team: g.selected.map(id => g.roster.find(b => b.id === id)).filter(Boolean)
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-forge",
    disabled: busy || !defenseReady,
    onClick: onSetDefense
  }, I18N.t("AR2_SET_DEFENSE"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(PostureSelect, {
    value: defPosture,
    onChange: setDefPosture,
    disabled: busy
  })), !defenseReady && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--alert)",
      marginTop: 8
    }
  }, I18N.t("AR2_NO_DEFENSE")), defenseReady && (() => {
    const selTeam = g.selected.map(id => g.roster.find(b => b.id === id)).filter(Boolean);
    const syns = AU.computeSynergiesLabels(selTeam);
    return /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 11,
        color: "var(--text-dim)",
        marginTop: 10
      }
    }, ["Avant", "Milieu", "Arrière"].map((pos, i) => {
      const b = g.selected[i] && g.roster.find(x => x.id === g.selected[i]);
      return /*#__PURE__*/React.createElement("div", {
        key: i,
        className: "flex between center",
        style: {
          gap: 8,
          padding: "2px 0"
        }
      }, /*#__PURE__*/React.createElement("span", null, pos, " : ", b ? b.custom_name || b.name : "—"), /*#__PURE__*/React.createElement("span", {
        className: "flex gap8"
      }, /*#__PURE__*/React.createElement("button", {
        className: "btn xs",
        disabled: busy || i === 0,
        onClick: () => actions.pvpReorderDefense(i, i - 1)
      }, "\u2191"), /*#__PURE__*/React.createElement("button", {
        className: "btn xs",
        disabled: busy || i === 2,
        onClick: () => actions.pvpReorderDefense(i, i + 1)
      }, "\u2193")));
    }), syns.length > 0 && /*#__PURE__*/React.createElement("div", {
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
  })()), sc.prelaunch ? /*#__PURE__*/React.createElement("div", {
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
    text: I18N.t("AR2_FA", pvp.fa_cost || 0),
    s: 12
  }) : I18N.t("AR2_TICKET"))))), (!pvp.opponents || pvp.opponents.length === 0) && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      color: "var(--text-dim)",
      fontSize: 13
    }
  }, I18N.t("AR2_NO_OPPONENTS")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, (pvp.opponents || []).map(o => {
    const canRevanche = Array.isArray(pvp.revanches) && pvp.revanches.includes(o.wallet);
    // L'appariement se fait sur la puissance : c'est l'écart qui dit si le
    // combat est jouable, pas l'ELO (tout le monde y démarre à 1000).
    const gap = AU.powerGapPct(pvp.power, o.power);
    const tone = AU.powerGapTone(gap);
    const gapColor = tone === "even" ? "var(--success)" : tone === "edge" ? "var(--gold)" : "var(--alert)";
    return /*#__PURE__*/React.createElement("div", {
      key: o.wallet,
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
    }, o.name || (o.wallet || "").slice(0, 6) + "…" + (o.wallet || "").slice(-4)), /*#__PURE__*/React.createElement("div", {
      className: "flex gap8 center"
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 12,
        color: AU.leagueColor(o.league)
      }
    }, AU.leagueLabel(o.league)), o.implicit ? /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 12,
        color: "var(--text-dim)"
      }
    }, I18N.t("AR2_UNRANKED")) : /*#__PURE__*/React.createElement("span", {
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
    }, I18N.t("AR2_POWER", o.power || 0), gap !== 0 && ` (${gap > 0 ? "+" : "−"}${Math.abs(gap)} %)`), canRevanche && /*#__PURE__*/React.createElement("span", {
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
      disabled: busy,
      onClick: async () => {
        const r = await actions.pvpDefenseOf(o.wallet);
        setPick({
          target: o.wallet,
          revanche: true,
          ids: [...g.selected],
          oppTeam: o.team,
          posture: "equilibre",
          oppPosture: r && r.posture || "equilibre"
        });
      }
    }, I18N.t("AR2_REVANCHE")) : /*#__PURE__*/React.createElement("button", {
      className: "btn btn-elec sm",
      disabled: busy,
      onClick: async () => {
        const r = await actions.pvpDefenseOf(o.wallet);
        setPick({
          target: o.wallet,
          revanche: false,
          ids: [...g.selected],
          oppTeam: o.team,
          posture: "equilibre",
          oppPosture: r && r.posture || "equilibre"
        });
      }
    }, I18N.t("AR2_ATTACK")));
  }))), /*#__PURE__*/React.createElement("div", {
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
  }, I18N.t("AR2_LADDER"), " \u2014 ", AU.leagueLabel(pvp.league)), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      display: "flex",
      flexDirection: "column",
      gap: 4
    }
  }, (pvp.ladder || []).map(row => /*#__PURE__*/React.createElement("div", {
    key: row.wallet,
    className: "flex between",
    style: {
      padding: "5px 8px",
      background: row.wallet === g.wallet ? "rgba(0,240,255,0.08)" : "transparent",
      fontSize: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono"
  }, row.rank, ". ", row.wallet === g.wallet ? "➤ " : "", (row.name || "").slice(0, 14)), /*#__PURE__*/React.createElement("span", {
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
  })))), /*#__PURE__*/React.createElement("div", {
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
  }, a.attacker_name || (a.attacker || "").slice(0, 6) + "…" + (a.attacker || "").slice(-4)), /*#__PURE__*/React.createElement("span", {
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
  }, D.displayName(b)), /*#__PURE__*/React.createElement("div", null, I18N.t("LINK_TIER"), b.level, " \xB7 ", D.fmtStat(D.eff(b, "atk")), "/", D.fmtStat(D.eff(b, "def"))))))))), pick && (() => {
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
    }, I18N.t("POSTURE_ENEMY"), " : ", I18N.t("POSTURE_" + (pick.oppPosture || "equilibre").toUpperCase())), /*#__PURE__*/React.createElement(PostureSelect, {
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
      disabled: !ready || busy,
      onClick: () => {
        const ids = [...pick.ids];
        const t = pick.target,
          rv = pick.revanche,
          myPosture = pick.posture || "equilibre",
          oppPosture = pick.oppPosture || "equilibre";
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
    opponentName: result.opponent_name,
    p1Posture: result.p1Posture,
    p2Posture: result.p2Posture,
    onClose: () => {
      setResult(null);
      actions.pvpRefresh();
    }
  }));
}
function PrizeModal({
  prizes,
  onClaim
}) {
  const {
    Modal
  } = window;
  const AU = window.FA_ARENE_UI;
  const total = prizes.reduce((s, p) => s + (p.reward || 0), 0);
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClaim,
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
  }, I18N.t("PRIZE_SEASON_RANK", p.season, p.rank, AU.leagueLabel(p.league))), /*#__PURE__*/React.createElement("div", {
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
  }, I18N.t("PRIZE_CLAIM")));
}
Object.assign(window, {
  Arene,
  PrizeModal
});
})();
