/* Généré par tools/precompile.mjs depuis screens.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — Team / Forge / Boosts / Wallet / Perso / Options
   ============================================================ */
const {
  useState,
  useEffect,
  useMemo
} = React;
const D = window.FA_DATA,
  I18N = window.FA_I18N;
const {
  useFA,
  cx,
  fmt,
  presetLabel,
  rarityLabel,
  Bar,
  StatGrid,
  CreatureCard,
  Modal,
  SectionHead,
  MiniStats,
  RelicIcon,
  TokenIcon,
  FaText,
  UnisatAppBridge
} = window;
const API_URL = window.FA_API_URL;

/* ---------------- PRESTIGE DU QUIZ ----------------
   Deux pistes indépendantes, servies par GET /quiz/profile : le savoir (bonnes
   réponses) et la contribution (FA versés aux pools de rachat, quiz et sinks de
   jeu confondus). Le joueur choisit lequel des deux titres il porte ; en v1 ce
   choix est local (localStorage) — aucune route serveur de plus. */
const QUIZ_TITLE_KEY = "fa_quiz_title_choice";
function litChoixTitre() {
  try {
    return localStorage.getItem(QUIZ_TITLE_KEY) || "none";
  } catch (e) {
    return "none";
  }
}

// Le titre à afficher à côté du nom, d'après le choix du joueur. Renvoie "" si
// le titre visé n'est pas encore débloqué : on n'affiche jamais un titre vide.
function titrePrestige(profil, choix) {
  if (!profil || !choix || choix === "none") return "";
  if (choix === "knowledge") return profil.knowledge_title || "";
  if (choix === "contribution") return profil.contribution_title || "";
  return "";
}
function QuizPrestige() {
  const {
    actions
  } = useFA();
  const [profil, setProfil] = useState(null);
  const [quizTitleChoice, setQuizTitleChoice] = useState(litChoixTitre);
  useEffect(() => {
    let vivant = true;
    actions.fetchQuizProfile().then(r => {
      if (vivant && r.ok) setProfil(r.data);
    });
    return () => {
      vivant = false;
    };
  }, [actions]);
  function choisir(v) {
    setQuizTitleChoice(v);
    try {
      localStorage.setItem(QUIZ_TITLE_KEY, v);
    } catch (e) {/* mode privé : le choix ne survit pas, tant pis */}
  }
  if (!profil) return null;
  const options = [["none", I18N.t("QUIZ_NONE"), ""], ["knowledge", I18N.t("QUIZ_TITLE_KNOWLEDGE"), profil.knowledge_title || ""], ["contribution", I18N.t("QUIZ_TITLE_CONTRIB"), profil.contribution_title || ""]];
  return /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 20,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      color: "var(--elec)",
      marginBottom: 12
    }
  }, I18N.t("QUIZ_PRESTIGE")), /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("QUIZ_TITLE_KNOWLEDGE")), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: profil.knowledge_title ? "var(--elec)" : "var(--text-faint)"
    }
  }, profil.knowledge_title || "—")), /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 11,
      marginBottom: 12
    }
  }, I18N.t("QUIZ_ANSWERED", profil.knowledge || 0, profil.total_questions || 0)), /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("QUIZ_TITLE_CONTRIB")), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: profil.contribution_title ? "var(--fire)" : "var(--text-faint)"
    }
  }, profil.contribution_title || "—")), /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 11,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("QUIZ_CONTRIBUTED", profil.contribution || 0),
    s: 11
  })), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)",
      marginBottom: 8
    }
  }, I18N.t("QUIZ_SHOWN")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap12 wrap"
  }, options.map(([v, label, titre]) => /*#__PURE__*/React.createElement("button", {
    key: v,
    className: cx("btn sm", quizTitleChoice === v && "on"),
    style: {
      flex: 1,
      minWidth: 96
    }
    // Un titre pas encore débloqué ne se choisit pas : il n'y a rien à porter.
    ,
    disabled: v !== "none" && !titre,
    onClick: () => choisir(v)
  }, label))));
}

/* ---------------- TEAM ---------------- */
function Team() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const sorted = useMemo(() => {
    return g.roster.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity] || b.level - a.level);
  }, [g.roster]);
  const selCount = g.selected.length;

  // Entités parties en expédition : non sélectionnables ici (même garde que le
  // serveur, qui refuse le combat avec bete_en_expedition — miroir d'expeditions.jsx).
  const busyIds = useMemo(() => new Set((g.expeditions || []).flatMap(e => Array.isArray(e.beast_ids) ? e.beast_ids : [])), [g.expeditions]);
  // Une entité déjà sélectionnée qui part en expédition est désélectionnée d'office :
  // sans ça, l'équipe garde un membre injouable et la Fosse échoue au lancement.
  useEffect(() => {
    g.selected.filter(id => busyIds.has(id)).forEach(id => actions.toggleSelect(id));
  }, [busyIds]);

  // Champion de soutien : ma designation courante (badge ★ + bande sous les cartes)
  // + l'historique des locations (panneau en bas d'écran — c'est ICI qu'on désigne
  // son champion, le user ne le trouvait pas dans Perso sous un onglet).
  useEffect(() => {
    if (g.authToken) {
      actions.championGet();
      actions.championUses();
    }
  }, [g.authToken]);
  async function designate(b) {
    if (g.championBeastId === b.id) return;
    const r = await actions.championSet(b.id);
    if (r.ok) toast(I18N.t("CHAMP_DESIGNATED_OK", D.displayName(b)), "good");else toast(r.reason || "error", "bad");
  }
  function toggle(b) {
    if (g.selected.includes(b.id)) actions.toggleSelect(b.id);else if (busyIds.has(b.id)) toast(I18N.t("EXP_ERR_bete_en_expedition"), "bad");else if (selCount >= 3) toast(I18N.t("TEAM_FULL"), "bad");else actions.toggleSelect(b.id);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      marginBottom: 22,
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, I18N.t("TEAM_COUNT", g.roster.length)), /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      marginBottom: 0
    }
  }, I18N.t("TEAM_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 13,
      marginTop: 4
    }
  }, I18N.t("TEAM_HINT"))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap12 center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: selCount === 3 ? "var(--success)" : "var(--text-dim)",
      fontSize: 13
    }
  }, I18N.t("TEAM_SELECTED", selCount)), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec lg",
    disabled: selCount !== 3,
    onClick: () => actions.setView("fosse")
  }, I18N.t("TEAM_ENTER"), " \u2192"))), (() => {
    const TU = window.FA_TOTEM_UI;
    const t = g.totem;
    return /*#__PURE__*/React.createElement("div", {
      className: "totem-slot",
      onClick: () => actions.setView("lien"),
      style: {
        cursor: "pointer",
        display: "flex",
        gap: 12,
        alignItems: "center",
        border: "1px solid var(--gold, #F7931A)",
        borderRadius: 12,
        padding: 10,
        marginBottom: 12
      }
    }, /*#__PURE__*/React.createElement("img", {
      alt: "Totem",
      src: t ? TU.totemArt(t) : "assets/HASHBYTE.webp",
      onError: e => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = t ? TU.totemArtFallback(t.type) : "assets/HASHBYTE.webp";
      },
      style: {
        width: 56,
        height: 56,
        borderRadius: 8,
        filter: t && t.tier > 0 ? "none" : "grayscale(1) opacity(0.5)"
      }
    }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 700
      }
    }, I18N.t("LINK_CAPTAIN"), " \xB7 ", t ? t.type : "—", " \xB7 ", t ? TU.tierName(t.tier) : TU.tierName(0)), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        opacity: 0.8
      }
    }, t ? TU.auraSummary(t.aura) : I18N.t("LINK_DORMANT_HINT"))), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: "auto",
        opacity: 0.6
      }
    }, "\u203A"));
  })(), /*#__PURE__*/React.createElement("div", {
    className: "grid-cards"
  }, sorted.map(b => {
    const busy = busyIds.has(b.id);
    const isChamp = g.championBeastId === b.id;
    return /*#__PURE__*/React.createElement("div", {
      key: b.id,
      style: {
        display: "flex",
        flexDirection: "column",
        ...(busy ? {
          opacity: 0.55,
          filter: "saturate(0.4)"
        } : {})
      }
    }, /*#__PURE__*/React.createElement(CreatureCard, {
      beast: b,
      selectable: !busy,
      selected: g.selected.includes(b.id),
      onClick: () => toggle(b),
      showXp: true,
      badge: busy ? /*#__PURE__*/React.createElement("div", {
        style: {
          position: "absolute",
          bottom: 8,
          left: 8,
          right: 8,
          textAlign: "center",
          background: "rgba(6,9,18,0.85)",
          border: "1px solid var(--elec)",
          color: "var(--elec)",
          fontSize: 11,
          padding: "3px 6px",
          borderRadius: 6
        },
        className: "mono"
      }, "\u23F3 ", I18N.t("TEAM_BUSY_EXP")) : isChamp ? /*#__PURE__*/React.createElement("div", {
        style: {
          position: "absolute",
          top: 8,
          left: 8,
          fontSize: 16,
          color: "var(--gold, #F7931A)",
          textShadow: "0 0 8px rgba(247,147,26,0.8)"
        }
      }, "\u2605") : null
    }), /*#__PURE__*/React.createElement(RelicSlot, {
      beast: b
    }), /*#__PURE__*/React.createElement(CoreSlot, {
      beast: b
    }), /*#__PURE__*/React.createElement(TalentSlot, {
      beast: b
    }), /*#__PURE__*/React.createElement("div", {
      className: "relic-slot mono",
      style: {
        cursor: isChamp ? "default" : "pointer",
        color: isChamp ? "var(--gold, #F7931A)" : "var(--text-dim)"
      },
      onClick: () => designate(b)
    }, isChamp ? "★ " + I18N.t("CHAMP_IS") : "☆ " + I18N.t("CHAMP_DESIGNATE")));
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 20,
      marginTop: 20,
      maxWidth: 560
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "h2"
  }, "\u2694\uFE0F ", I18N.t("CHAMP_USES_TITLE")), g.championUses.totals && g.championUses.totals.uses > 0 && /*#__PURE__*/React.createElement("span", {
    className: "pill mono",
    style: {
      color: "var(--gold)"
    }
  }, I18N.t("CHAMP_TOTAL_LINE", g.championUses.totals.uses, g.championUses.totals.commission))), (() => {
    // Chiffres exhaustifs du serveur (days), noms depuis les 20 dernières lignes.
    const agg = window.FA_CHAMPION_UI.mergeDays(g.championUses.days, g.championUses.uses);
    if (!agg.length) return /*#__PURE__*/React.createElement("div", {
      className: "muted mono",
      style: {
        fontSize: 11,
        marginTop: 8
      }
    }, I18N.t("CHAMP_USES_EMPTY"));
    return agg.map(a => /*#__PURE__*/React.createElement("div", {
      key: a.day,
      style: {
        marginTop: 10,
        borderBottom: "1px solid var(--line)",
        paddingBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 11,
        color: "var(--text-dim)"
      }
    }, a.day), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement(FaText, {
      text: I18N.t("CHAMP_USES_LINE", a.fights, a.commission, a.points)
    })), a.names.length > 0 && /*#__PURE__*/React.createElement("div", {
      className: "muted mono",
      style: {
        fontSize: 11,
        marginTop: 2
      }
    }, I18N.t("CHAMP_USES_BY", a.names.join(", ")))));
  })()));
}
function RelicSlot({
  beast
}) {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // L'écran d'équipe montre des vignettes de reliques : on amorce les modèles ici
  // plutôt qu'au boot, et seulement quand le navigateur est libre.
  useEffect(() => {
    const M = window.FA_RELIC_MODELS;
    if (M && M.preloadWhenIdle) M.preloadWhenIdle();
  }, []);
  const equipped = beast.relic_id ? (g.equipment || []).find(e => e.id === beast.relic_id) : null;
  const eff = equipped ? D.relicEffect(equipped.type, equipped.rarity) : null;
  // reliques équipables = non portées, ou déjà sur CETTE bête. Le tableau
  // `equipment` mêle reliques et cores : on ne garde que les reliques.
  const available = (g.equipment || []).filter(D.isRelicItem).filter(inst => {
    const holder = g.roster.find(b => b.relic_id === inst.id);
    return !holder || holder.id === beast.id;
  });
  async function doEquip(relicId) {
    if (busy) return;
    setBusy(true);
    const r = await actions.relicEquip(beast.id, relicId);
    setBusy(false);
    setOpen(false);
    if (!r || !r.ok) toast(r && r.reason || "error", "bad");
  }
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "relic-slot mono",
    onClick: () => setOpen(true),
    style: {
      cursor: "pointer",
      fontSize: 11,
      marginTop: 6,
      padding: "4px 8px",
      border: "1px solid var(--line)",
      borderRadius: 8,
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, equipped ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(RelicIcon, {
    type: equipped.type,
    rarity: equipped.rarity,
    size: 18
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: D.RARITY_COLORS[equipped.rarity]
    }
  }, I18N.t("RELIC_" + equipped.type.toUpperCase())), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-dim)"
    }
  }, D.relicStatDelta(eff))) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-faint)"
    }
  }, "\u25C7 ", I18N.t("RELIC_NONE"))), open && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "h2",
    style: {
      fontSize: 14,
      marginBottom: 10
    }
  }, I18N.t("RELIC_EQUIP"), " \u2014 ", D.displayName(beast)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      maxHeight: "50vh",
      overflow: "auto"
    }
  }, available.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 12
    }
  }, I18N.t("RELIC_INVENTORY"), ": \u2014"), available.map(inst => {
    const on = beast.relic_id === inst.id;
    const e = D.relicEffect(inst.type, inst.rarity);
    return /*#__PURE__*/React.createElement("button", {
      key: inst.id,
      className: cx("btn sm", on && "on"),
      disabled: busy,
      onClick: () => doEquip(on ? null : inst.id),
      style: {
        justifyContent: "flex-start",
        gap: 8
      }
    }, /*#__PURE__*/React.createElement(RelicIcon, {
      type: inst.type,
      rarity: inst.rarity,
      size: 18
    }), " ", I18N.t("RELIC_" + inst.type.toUpperCase()), " \xB7 ", rarityLabel(inst.rarity), " \xB7 ", D.relicStatDelta(e), " ", on ? "✓" : "");
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn sm block",
    style: {
      marginTop: 10
    },
    disabled: busy || !beast.relic_id,
    onClick: () => doEquip(null)
  }, I18N.t("RELIC_UNEQUIP"))));
}

/* --- Slot core sous la carte : effet déclenché en combat, un par bête ---
   Même présentation que RelicSlot. Un core d'inventaire porte `core_id` (le
   type, ex. fury_core) ; la bête porte `core_id` = id de l'INSTANCE équipée. */
function CoreSlot({
  beast
}) {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const equipped = beast.core_id ? (g.equipment || []).find(e => e.id === beast.core_id) : null;
  // cores équipables = non portés, ou déjà sur CETTE bête
  const available = (g.equipment || []).filter(D.isCoreItem).filter(inst => {
    const holder = g.roster.find(b => b.core_id === inst.id);
    return !holder || holder.id === beast.id;
  });
  async function doEquip(coreId) {
    if (busy) return;
    setBusy(true);
    const r = await actions.coreEquip(beast.id, coreId);
    setBusy(false);
    setOpen(false);
    if (!r || !r.ok) toast(r && r.reason || "error", "bad");
  }
  const coreLabel = inst => I18N.t("CORE_" + inst.core_id.toUpperCase());
  const coreDesc = inst => I18N.t("CORE_" + inst.core_id.toUpperCase() + "_D");
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "relic-slot mono",
    onClick: () => setOpen(true),
    style: {
      cursor: "pointer",
      fontSize: 11,
      marginTop: 6,
      padding: "4px 8px",
      border: "1px solid var(--line)",
      borderRadius: 8,
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, equipped ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--elec)"
    }
  }, "\u2B22"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: D.RARITY_COLORS[equipped.rarity] || "var(--text)"
    }
  }, coreLabel(equipped))) : /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text-faint)"
    }
  }, "\u2B21 ", I18N.t("CORE_NONE"))), open && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setOpen(false)
  }, /*#__PURE__*/React.createElement("div", {
    className: "h2",
    style: {
      fontSize: 14,
      marginBottom: 10
    }
  }, I18N.t("CORE_EQUIP"), " \u2014 ", D.displayName(beast)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      maxHeight: "50vh",
      overflow: "auto"
    }
  }, available.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 12
    }
  }, I18N.t("RELIC_INVENTORY"), ": \u2014"), available.map(inst => {
    const on = beast.core_id === inst.id;
    return /*#__PURE__*/React.createElement("button", {
      key: inst.id,
      className: cx("btn sm", on && "on"),
      disabled: busy,
      onClick: () => doEquip(on ? null : inst.id),
      style: {
        justifyContent: "flex-start",
        gap: 8,
        textAlign: "left"
      }
    }, "\u2B22 ", coreLabel(inst), " \xB7 ", /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, coreDesc(inst)), " ", on ? "✓" : "");
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn sm block",
    style: {
      marginTop: 10
    },
    disabled: busy || !beast.core_id,
    onClick: () => doEquip(null)
  }, I18N.t("CORE_UNEQUIP"))));
}

/* --- Bande talents sous la carte : 3 paliers L25/50/75, 1 choix parmi 2 --- */
function TalentSlot({
  beast
}) {
  const {
    actions,
    toast
  } = useFA();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const TAL = window.FA_TALENTS,
    TUI = window.FA_TALENTS_UI;
  const slots = TUI.slotState(beast);
  const nUnlocked = slots.filter(sl => sl.unlocked).length;
  const nChosen = slots.filter(sl => sl.unlocked && sl.chosen).length;
  const pick = async (tierKey, talentId) => {
    if (busy) return;
    setBusy(true);
    const r = await actions.chooseTalent(beast.id, Number(tierKey), talentId);
    setBusy(false);
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    toast(I18N.t("TAL_TITLE") + " ✓", "good");
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "relic-slot mono",
    onClick: () => setOpen(true),
    title: I18N.t("TAL_TITLE"),
    style: {
      cursor: "pointer",
      fontSize: 11,
      marginTop: 6,
      padding: "4px 8px",
      border: "1px solid var(--line)",
      borderRadius: 8,
      display: "flex",
      gap: 6,
      alignItems: "center"
    }
  }, nUnlocked === 0 ? /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "\u2726 ", I18N.t("TAL_NONE_UNLOCKED")) : /*#__PURE__*/React.createElement("span", null, "\u2726 ", I18N.t("TAL_TITLE"), " ", nChosen, "/", nUnlocked)), open && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setOpen(false),
    accent: D.RARITY_COLORS[beast.rarity],
    wide: true
  }, /*#__PURE__*/React.createElement("h3", null, I18N.t("TAL_TITLE"), " \u2014 ", D.displayName(beast)), slots.map(({
    key,
    unlocked,
    chosen
  }) => {
    const {
      cost,
      freeRespec
    } = TUI.chooseCost(beast, key);
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      className: "panel",
      style: {
        marginBottom: 8,
        opacity: unlocked ? 1 : 0.55
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex between center"
    }, /*#__PURE__*/React.createElement("b", null, I18N.t("TAL_TIER", key)), !unlocked && /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, I18N.t("TAL_TIER_LOCKED", key)), unlocked && !chosen && /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, I18N.t("TAL_PICK_FREE")), unlocked && chosen && (freeRespec ? /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, I18N.t("TAL_RESPEC_FREE")) : /*#__PURE__*/React.createElement("span", {
      className: "muted"
    }, /*#__PURE__*/React.createElement(FaText, {
      text: I18N.t("TAL_RESPEC_COST", cost),
      s: 12
    })))), unlocked && /*#__PURE__*/React.createElement("div", {
      className: "flex wrap",
      style: {
        gap: 6,
        marginTop: 6
      }
    }, TAL.talentsFor(beast.type, Number(key)).map(t => {
      const on = chosen === t.id;
      return /*#__PURE__*/React.createElement("button", {
        key: t.id,
        disabled: busy || on,
        className: cx("btn sm", on && "on"),
        onClick: () => pick(key, t.id),
        style: {
          flex: 1,
          minWidth: 150,
          textAlign: "left"
        }
      }, /*#__PURE__*/React.createElement("b", null, I18N.t("TAL_" + t.id)), on ? " ✓" : "", /*#__PURE__*/React.createElement("div", {
        className: "muted",
        style: {
          fontSize: 11,
          marginTop: 2
        }
      }, TUI.talentDesc(t, beast.rarity, I18N.t)));
    })));
  })));
}

/* ---------------- FORGE ---------------- */
function Forge() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [tab, setTab] = useState("fusion");
  const tabs = [{
    k: "fusion",
    c: "var(--forge)"
  }, {
    k: "reroll",
    c: "var(--elec)"
  }, {
    k: "summon",
    c: "var(--fire)"
  }, {
    k: "reliques",
    c: "var(--gold)"
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: I18N.t("FG_SUB"),
    title: I18N.t("FG_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "subtabs"
  }, tabs.map(t => /*#__PURE__*/React.createElement("button", {
    key: t.k,
    className: cx("subtab", tab === t.k && "on"),
    style: {
      "--c": t.c
    },
    onClick: () => setTab(t.k)
  }, I18N.t("FG_" + t.k.toUpperCase())))), tab === "fusion" && /*#__PURE__*/React.createElement(ForgeFusion, null), tab === "reroll" && /*#__PURE__*/React.createElement(ForgeReroll, null), tab === "summon" && /*#__PURE__*/React.createElement(ForgeSummon, null), tab === "reliques" && /*#__PURE__*/React.createElement(ForgeReliques, null));
}
function ForgeFusion() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [sel, setSel] = useState([]);
  const [fuseBusy, setFuseBusy] = useState(false);
  const [goldMode, setGoldMode] = useState(false);
  const elig = g.roster.filter(b => b.rarity !== "Legendary");
  const sorted = elig.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity]);
  const first = sel[0] ? g.roster.find(b => b.id === sel[0]) : null;
  function clickable(b) {
    if (!first) return true;
    if (b.id === first.id) return true;
    return b.rarity === first.rarity;
  }
  function toggle(b) {
    if (sel.includes(b.id)) setSel(sel.filter(x => x !== b.id));else if (sel.length < 2 && clickable(b)) setSel([...sel, b.id]);
  }
  async function doFuse(gold) {
    if (fuseBusy) return;
    setFuseBusy(true);
    const r = await actions.fuse(sel[0], sel[1], gold);
    setFuseBusy(false);
    // bete_en_expedition : garde serveur des Expéditions — code traduit, pas brut.
    if (!r.ok) {
      toast(r.reason === "bete_en_expedition" ? I18N.t("EXP_ERR_bete_en_expedition") : r.reason, "bad");
      return;
    }
    const showFuseResult = () => {
      if (r.success) {
        if (r.result?.premium) toast(I18N.t("FG_FUSE_PREMIUM", rarityLabel(r.result?.rarity)), "good");else toast(I18N.t("FG_FUSE_OK", rarityLabel(r.result?.rarity)), "good");
      } else toast(I18N.t("FG_FUSE_FAIL"), "bad");
    };
    if (window.FA_FORGE_CINE) {
      window.FA_FORGE_CINE.play({
        mode: "fuse",
        success: r.success,
        tier: r.result?.rarity,
        color: D.RARITY_COLORS[r.result?.rarity] || "#46e6ff",
        premium: r.result?.premium,
        onDone: showFuseResult
      });
    } else showFuseResult();
    setSel([]);
    setGoldMode(false);
  }
  const F = window.FA_FORGE_UI;
  const cost = first ? D.FORGE.FUSION_COST[first.rarity] : 0;
  const rate = first ? D.FORGE.FUSION_RATE[first.rarity] : 0;
  const canFuse = sel.length === 2;
  const btn = F.fusionButtonState({
    gold: goldMode,
    cost,
    balance: g.liquid + g.locked,
    ticketsGold: g.ticketsGold,
    busy: fuseBusy
  });
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      marginBottom: 16,
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 13
    }
  }, first ? I18N.t("FG_PICK_SAME", rarityLabel(first.rarity)) : I18N.t("FG_FUSION_HINT")), canFuse && /*#__PURE__*/React.createElement("div", {
    className: "flex gap12 center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: "var(--elec)"
    }
  }, I18N.t("FG_SUCCESS_RATE"), " ", goldMode ? 100 : Math.round(rate * 100), "%"), /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      cursor: "pointer"
    },
    onClick: () => setSel(F.fusionSwap(sel))
  }, "\u21C4 ", I18N.t("FG_SWAP")), /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: "var(--gold)",
      cursor: "pointer",
      opacity: g.ticketsGold >= 1 ? 1 : 0.4,
      border: goldMode ? "1px solid var(--gold)" : undefined
    },
    onClick: () => g.ticketsGold >= 1 && setGoldMode(!goldMode)
  }, "\uD83C\uDF9F ", I18N.t("FG_GOLD"), " ", goldMode ? "✓" : ""), /*#__PURE__*/React.createElement("button", {
    className: cx("btn", goldMode ? "btn-gold" : "btn-forge"),
    disabled: btn.disabled,
    onClick: () => doFuse(goldMode)
  }, fuseBusy ? "…" : goldMode ? I18N.t("FG_FUSE_BTN_GOLD") : /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("FG_FUSE_BTN", cost)
  })))), btn.showInsufficient && canFuse && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      color: "var(--alert)",
      fontSize: 12,
      marginBottom: 10
    }
  }, I18N.t("INSUFFICIENT", g.liquid + g.locked, cost)), /*#__PURE__*/React.createElement("div", {
    className: "grid-cards"
  }, sorted.map(b => {
    const role = sel[0] === b.id ? "kept" : sel[1] === b.id ? "sacrificed" : null;
    const roleColor = role === "kept" ? "var(--success)" : "var(--alert)";
    const roleBadge = role && /*#__PURE__*/React.createElement("div", {
      className: "pill",
      style: {
        position: "absolute",
        bottom: 8,
        left: "50%",
        transform: "translateX(-50%)",
        whiteSpace: "nowrap",
        background: "var(--bg)",
        color: roleColor,
        border: `1px solid ${roleColor}`
      }
    }, role === "kept" ? I18N.t("FG_KEPT") : I18N.t("FG_SACRIFICED"));
    return /*#__PURE__*/React.createElement("div", {
      key: b.id,
      style: {
        opacity: clickable(b) ? 1 : 0.32,
        pointerEvents: clickable(b) ? "auto" : "none",
        transition: "opacity .2s"
      }
    }, /*#__PURE__*/React.createElement(CreatureCard, {
      beast: b,
      selectable: true,
      selected: sel.includes(b.id),
      onClick: () => toggle(b),
      badge: roleBadge
    }));
  })));
}
function RerollPreviewModal({
  preview,
  busy,
  onValidate,
  onAgain,
  onKeep
}) {
  const {
    Modal
  } = window;
  const F = window.FA_FORGE_UI;
  const rows = F.rerollDiff(preview.old_stats, preview.new_stats, preview.locks);
  const color = dir => dir === "up" ? "var(--success)" : dir === "down" ? "var(--alert)" : "var(--text-dim)";
  const arrow = dir => dir === "up" ? "▲" : dir === "down" ? "▼" : "=";
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onKeep,
    accent: "var(--elec)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      fontSize: 24,
      color: "var(--elec)",
      textAlign: "center",
      marginBottom: 14
    }
  }, I18N.t("REROLL_PREVIEW_TITLE")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr auto auto",
      gap: "6px 14px",
      alignItems: "center",
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono muted",
    style: {
      fontSize: 11
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mono muted",
    style: {
      fontSize: 11,
      textAlign: "right"
    }
  }, I18N.t("REROLL_CURRENT")), /*#__PURE__*/React.createElement("span", {
    className: "mono muted",
    style: {
      fontSize: 11,
      textAlign: "right"
    }
  }, I18N.t("REROLL_PROPOSED")), rows.map(r => [/*#__PURE__*/React.createElement("span", {
    key: r.key + "l",
    className: "mono",
    style: {
      fontSize: 13,
      opacity: r.locked ? 0.6 : 1
    }
  }, r.locked ? "🔒 " : "", r.label), /*#__PURE__*/React.createElement("span", {
    key: r.key + "f",
    className: "mono",
    style: {
      fontSize: 13,
      textAlign: "right",
      color: "var(--text-dim)"
    }
  }, r.from), /*#__PURE__*/React.createElement("span", {
    key: r.key + "t",
    className: "mono",
    style: {
      fontSize: 13,
      textAlign: "right",
      color: r.locked ? "var(--text-dim)" : color(r.dir),
      opacity: r.locked ? 0.6 : 1
    }
  }, r.to, " ", r.locked ? "=" : arrow(r.dir))])), /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 11,
      marginBottom: 14
    }
  }, I18N.t("REROLL_REFUND_HINT")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8",
    style: {
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-success",
    disabled: busy,
    onClick: onValidate
  }, I18N.t("REROLL_VALIDATE")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec",
    disabled: busy,
    onClick: onAgain
  }, /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("REROLL_AGAIN", F.withLockCost(preview.next_reroll_cost || 0, (preview.locks || []).length))
  })), /*#__PURE__*/React.createElement("button", {
    className: "btn",
    disabled: busy,
    onClick: onKeep
  }, I18N.t("REROLL_KEEP_OLD"))));
}
function ForgeReroll() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [sel, setSel] = useState(null);
  const [rerollBusy, setRerollBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [locks, setLocks] = useState([]);
  const beast = sel ? g.roster.find(b => b.id === sel) : null;
  const F = window.FA_FORGE_UI;
  const baseCost = beast ? Math.round(D.FORGE.REROLL_BASE[beast.rarity] * (1 + 0.5 * beast.reroll_count)) : 0;
  const cost = F.withLockCost(baseCost, locks.length);
  const balOk = g.liquid + g.locked >= cost;
  async function doReroll() {
    if (rerollBusy) return;
    setRerollBusy(true);
    const r = await actions.reroll(sel, locks);
    setRerollBusy(false);
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    setPreview(r.preview);
  }
  async function onValidate() {
    setRerollBusy(true);
    const r = await actions.rerollConfirm(sel);
    setRerollBusy(false);
    setPreview(null);
    if (r.ok) toast(I18N.t("FG_REROLL_OK"), "good");else toast(r.reason, "bad");
  }
  async function onAgain() {
    setRerollBusy(true);
    const r = await actions.reroll(sel, locks);
    setRerollBusy(false);
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    setPreview(r.preview);
  }
  async function onKeep() {
    setRerollBusy(true);
    const r = await actions.rerollDiscard(sel);
    setRerollBusy(false);
    setPreview(null);
    if (r.ok) toast(I18N.t("REROLL_KEPT_OLD", r.refunded || 0), "good");else toast(r.reason, "bad");
  }
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex between center wrap",
    style: {
      marginBottom: 16,
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 13
    }
  }, I18N.t("FG_REROLL_HINT")), beast && /*#__PURE__*/React.createElement("div", {
    className: "flex gap12 center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "pill"
  }, "reroll #", beast.reroll_count + 1), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec",
    disabled: !balOk || rerollBusy,
    onClick: doReroll
  }, rerollBusy ? "…" : /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("FG_REROLL_BTN", cost)
  })))), beast && /*#__PURE__*/React.createElement("div", {
    className: "flex wrap center",
    style: {
      gap: 6,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono muted",
    style: {
      fontSize: 11
    }
  }, I18N.t("FG_LOCK_HINT")), F.LOCKABLE.map(({
    stat,
    key,
    label
  }) => {
    const on = locks.includes(stat);
    return /*#__PURE__*/React.createElement("span", {
      key: stat,
      className: "pill",
      onClick: () => {
        const next = F.toggleLock(locks, stat);
        if (next === null) {
          toast(I18N.t("FG_LOCK_MAX"), "bad");
          return;
        }
        setLocks(next);
      },
      style: {
        cursor: "pointer",
        userSelect: "none",
        border: on ? "1px solid var(--gold)" : undefined,
        color: on ? "var(--gold)" : undefined
      }
    }, on ? "🔒" : "🔓", " ", label, " ", beast[key]);
  })), !balOk && beast && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      color: "var(--alert)",
      fontSize: 12,
      marginBottom: 10
    }
  }, I18N.t("INSUFFICIENT", g.liquid + g.locked, cost)), /*#__PURE__*/React.createElement("div", {
    className: "grid-cards"
  }, g.roster.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity]).map(b => /*#__PURE__*/React.createElement(CreatureCard, {
    key: b.id,
    beast: b,
    selectable: true,
    selected: sel === b.id,
    onClick: () => {
      setSel(sel === b.id ? null : b.id);
      setLocks([]);
    }
  }))), preview && /*#__PURE__*/React.createElement(RerollPreviewModal, {
    preview: preview,
    busy: rerollBusy,
    onValidate: onValidate,
    onAgain: onAgain,
    onKeep: onKeep
  }));
}
function ForgeSummon() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [last, setLast] = useState(null);
  const [rolling, setRolling] = useState(false);
  const cost = D.ECON.MINT_COST;
  const balOk = g.liquid + g.locked >= cost;
  async function doSummon() {
    if (!balOk || rolling) return;
    setRolling(true);
    setLast(null);
    const r = await actions.summon();
    setRolling(false);
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    const reveal = () => {
      setLast(r.beast);
      toast(I18N.t("FG_SUMMON_OK", D.displayName(r.beast), I18N.t("FG_RANK") + " " + (r.beast.rank || "C")), "good");
    };
    if (window.FA_FORGE_CINE) {
      window.FA_FORGE_CINE.play({
        mode: "summon",
        success: true,
        tier: r.beast.rank || "C",
        color: D.RANK_COLORS[r.beast.rank || "C"] || "#46e6ff",
        onDone: reveal
      });
    } else reveal();
  }
  const odds = [["C", 55], ["B", 28], ["A", 13], ["S", 4]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 320px",
      gap: 26,
      alignItems: "start"
    },
    className: "summon-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 13,
      marginBottom: 16
    }
  }, I18N.t("FG_SUMMON_HINT")), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, odds.map(([r, p]) => /*#__PURE__*/React.createElement("div", {
    key: r,
    className: "flex between center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex center gap8"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      background: D.RANK_COLORS[r],
      display: "inline-block",
      clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: D.RANK_COLORS[r],
      fontWeight: 600
    }
  }, I18N.t("FG_RANK"), " ", r)), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      color: "var(--text-dim)"
    }
  }, p, "%")))), /*#__PURE__*/React.createElement("div", {
    className: "divider"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-fire block lg",
    disabled: !balOk || rolling,
    onClick: doSummon
  }, rolling ? "…" : /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("FG_SUMMON_BTN", cost)
  })))), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 18,
      minHeight: 300,
      display: "grid",
      placeItems: "center"
    }
  }, rolling ? /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      color: "var(--fire)",
      fontSize: 13,
      letterSpacing: 2
    }
  }, "FORGING\u2026") : last ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      textAlign: "center",
      marginBottom: 10,
      color: D.RANK_COLORS[last.rank || "C"]
    }
  }, I18N.t("MINT_TITLE")), /*#__PURE__*/React.createElement(CreatureCard, {
    beast: last
  })) : /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      color: "var(--text-faint)",
      fontSize: 12,
      textAlign: "center"
    }
  }, "\u2B21", /*#__PURE__*/React.createElement("br", null), I18N.t("FG_SUMMON"))));
}

// Fragments d'expédition → relique (rang du fragment = rareté de la relique).
// Compteurs dans g.expFragments (GET /expeditions/state), coût 0 FA.
function ForgeFragments({
  onForged
}) {
  const {
    g,
    actions,
    toast
  } = useFA();
  const XU = window.FA_EXPEDITIONS_UI;
  const [crafting, setCrafting] = useState(false);
  const frags = g.expFragments || {
    C: 0,
    B: 0,
    A: 0,
    S: 0
  };
  async function doCraft(rk) {
    if (crafting) return;
    setCrafting(true);
    let r = await actions.expeditionsCraftRelic(rk);
    if (!r.ok && r.reason === "retry") r = await actions.expeditionsCraftRelic(rk);
    setCrafting(false);
    // reason "auth" : app.jsx a déjà affiché AUTH_EXPIRED — pas de second toast.
    if (!r.ok) {
      if (r.reason !== "auth") toast(XU.errText(r.reason), "bad");
      return;
    }
    // Le reveal (toast + panneau) appartient au parent, DANS le onDone de la
    // cinématique — même séquencement que doSummon.
    if (onForged) onForged(r.relic);
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 22,
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 4
    }
  }, I18N.t("EXP_FORGE_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 12,
      marginBottom: 14
    }
  }, I18N.t("EXP_FORGE_SUB")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, ["C", "B", "A", "S"].map(rk => {
    const have = frags[rk] || 0;
    const need = XU.FRAGMENT_COSTS[rk];
    const col = D.RANK_COLORS[rk];
    return /*#__PURE__*/React.createElement("div", {
      key: rk,
      style: {
        display: "grid",
        gridTemplateColumns: "28px minmax(0,1fr) auto",
        gap: 12,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("b", {
      style: {
        color: col,
        fontSize: 16,
        textAlign: "center"
      }
    }, rk), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement(Bar, {
      frac: Math.min(1, have / need),
      kind: "xp"
    })), /*#__PURE__*/React.createElement("button", {
      className: "btn sm",
      disabled: have < need || crafting,
      onClick: () => doCraft(rk),
      style: have >= need ? {
        borderColor: col,
        color: col,
        fontWeight: 700
      } : {}
    }, I18N.t("EXP_FORGE_BTN"), " ", /*#__PURE__*/React.createElement("span", {
      className: "mono"
    }, have, "/", need)));
  })));
}
function ForgeReliques() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [last, setLast] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [detail, setDetail] = useState(null);
  const RV = window.RelicViewer;
  const cost = 8000;
  const balOk = g.liquid + g.locked >= cost;
  async function doSummon() {
    if (!balOk || rolling) return;
    setRolling(true);
    setLast(null);
    const r = await actions.relicSummon();
    setRolling(false);
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    const revealRelic = () => {
      setLast(r.relic);
      toast(I18N.t("FG_SUMMON_OK", I18N.t("RELIC_" + r.relic.type.toUpperCase()), rarityLabel(r.relic.rarity)), "good");
    };
    if (window.FA_FORGE_CINE) {
      window.FA_FORGE_CINE.play({
        mode: "summon",
        success: true,
        tier: r.relic.rarity,
        color: D.RARITY_COLORS[r.relic.rarity] || "#46e6ff",
        onDone: revealRelic
      });
    } else revealRelic();
  }
  const odds = [["Common", 70], ["Rare", 20], ["Epic", 8], ["Legendary", 2]];
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 320px",
      gap: 26,
      alignItems: "start"
    },
    className: "summon-grid"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 10
    }
  }, odds.map(([r, p]) => /*#__PURE__*/React.createElement("div", {
    key: r,
    className: "flex between center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "flex center gap8"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      background: D.RARITY_COLORS[r],
      display: "inline-block",
      clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: D.RARITY_COLORS[r],
      fontWeight: 600
    }
  }, rarityLabel(r))), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      color: "var(--text-dim)"
    }
  }, p, "%")))), /*#__PURE__*/React.createElement("div", {
    className: "divider"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold block lg",
    disabled: !balOk || rolling,
    onClick: doSummon
  }, rolling ? "…" : /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("FG_SUMMON_BTN", cost)
  })))), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 18,
      minHeight: 300,
      display: "grid",
      placeItems: "center"
    }
  }, rolling ? /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      color: "var(--gold)",
      fontSize: 13,
      letterSpacing: 2
    }
  }, "FORGING\u2026") : last ? /*#__PURE__*/React.createElement("div", {
    style: {
      width: "100%",
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 10,
      color: D.RARITY_COLORS[last.rarity]
    }
  }, I18N.t("RELIC_FORGED")), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: "0 auto 12px",
      display: "flex",
      justifyContent: "center"
    }
  }, RV ? /*#__PURE__*/React.createElement(RV, {
    type: last.type,
    rarity: last.rarity,
    size: 200
  }) : /*#__PURE__*/React.createElement(RelicIcon, {
    type: last.type,
    rarity: last.rarity,
    size: 48
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16
    }
  }, I18N.t("RELIC_" + last.type.toUpperCase())), /*#__PURE__*/React.createElement("div", {
    style: {
      color: D.RARITY_COLORS[last.rarity],
      fontWeight: 600,
      marginTop: 4
    }
  }, rarityLabel(last.rarity)), /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 13,
      marginTop: 8
    }
  }, D.relicStatDelta(D.relicEffect(last.type, last.rarity)))) : /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      color: "var(--text-faint)",
      fontSize: 12,
      textAlign: "center"
    }
  }, "\u2B21", /*#__PURE__*/React.createElement("br", null), I18N.t("RELIC_SUMMON")))), /*#__PURE__*/React.createElement(ForgeFragments, {
    onForged: relic => {
      // Reveal APRÈS la cinématique (même séquencement que doSummon) : le
      // panneau et le toast n'apparaissent pas sous l'animation.
      const reveal = () => {
        setLast(relic);
        toast(I18N.t("FG_SUMMON_OK", I18N.t("RELIC_" + relic.type.toUpperCase()), rarityLabel(relic.rarity)), "good");
      };
      if (window.FA_FORGE_CINE) {
        window.FA_FORGE_CINE.play({
          mode: "summon",
          success: true,
          tier: relic.rarity,
          color: D.RARITY_COLORS[relic.rarity] || "#46e6ff",
          onDone: reveal
        });
      } else reveal();
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 26
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      marginBottom: 10
    }
  }, I18N.t("RELIC_INVENTORY")), (g.equipment || []).filter(D.isRelicItem).length === 0 ? /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 13
    }
  }, I18N.t("RELIC_NONE")) : /*#__PURE__*/React.createElement("div", {
    className: "grid-cards"
  }, (g.equipment || []).filter(D.isRelicItem).map(inst => {
    const holder = g.roster.find(b => b.relic_id === inst.id);
    const effect = D.relicEffect(inst.type, inst.rarity);
    return /*#__PURE__*/React.createElement("div", {
      key: inst.id,
      className: "panel oct",
      onClick: () => setDetail(inst),
      style: {
        border: `1px solid ${D.RARITY_COLORS[inst.rarity]}`,
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex center gap8"
    }, /*#__PURE__*/React.createElement(RelicIcon, {
      type: inst.type,
      rarity: inst.rarity,
      size: 28
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700
      }
    }, I18N.t("RELIC_" + inst.type.toUpperCase()))), /*#__PURE__*/React.createElement("span", {
      style: {
        color: D.RARITY_COLORS[inst.rarity],
        fontWeight: 600,
        fontSize: 12
      }
    }, rarityLabel(inst.rarity)), /*#__PURE__*/React.createElement("span", {
      className: "mono muted",
      style: {
        fontSize: 12
      }
    }, D.relicStatDelta(effect)), holder && /*#__PURE__*/React.createElement("span", {
      className: "pill",
      style: {
        color: "var(--gold)",
        fontSize: 11
      }
    }, "\u2694 ", D.displayName(holder)));
  }))), detail && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setDetail(null),
    accent: D.RARITY_COLORS[detail.rarity]
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: 8
    }
  }, RV && /*#__PURE__*/React.createElement(RV, {
    type: detail.type,
    rarity: detail.rarity,
    size: 240
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 16,
      marginTop: 10
    }
  }, I18N.t("RELIC_" + detail.type.toUpperCase())), /*#__PURE__*/React.createElement("div", {
    style: {
      color: D.RARITY_COLORS[detail.rarity],
      fontWeight: 600,
      marginTop: 4
    }
  }, rarityLabel(detail.rarity)), /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 13,
      marginTop: 8
    }
  }, D.relicStatDelta(D.relicEffect(detail.type, detail.rarity))))));
}

/* ---------------- BOOSTS ---------------- */
// v2 : 4 boosts en packs de 50 charges. Les charges achetées restent INERTES tant
// que le joueur n'a pas armé le boost (interrupteur ici et dans la Fosse).
function BoostArmSwitch({
  armed,
  color,
  disabled,
  onToggle
}) {
  return /*#__PURE__*/React.createElement("span", {
    onClick: disabled ? undefined : onToggle,
    className: "oct-sm",
    style: {
      width: 42,
      height: 22,
      flex: "none",
      background: armed ? color : "#1a2238",
      position: "relative",
      transition: "background .2s",
      borderRadius: 11,
      cursor: disabled ? "not-allowed" : "pointer",
      opacity: disabled ? 0.45 : 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: armed ? 22 : 3,
      width: 16,
      height: 16,
      borderRadius: "50%",
      background: "#fff",
      transition: "left .2s"
    }
  }));
}
function Boosts() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const items = [{
    key: "xp_boost",
    name: I18N.t("BO_XP_NAME"),
    desc: I18N.t("BO_XP_DESC"),
    color: "var(--gold)"
  }, {
    key: "lucky_strike",
    name: I18N.t("BO_LUCKY_NAME"),
    desc: I18N.t("BO_LUCKY_DESC"),
    color: "var(--fire)"
  }, {
    key: "momentum",
    name: I18N.t("BO_MOM_NAME"),
    desc: I18N.t("BO_MOM_DESC"),
    color: "#9B5CFF"
  }, {
    key: "catalyst",
    name: I18N.t("BO_CAT_NAME"),
    desc: I18N.t("BO_CAT_DESC"),
    color: "var(--success)"
  }];
  const [buyingKey, setBuyingKey] = useState(null);
  const [togglingKey, setTogglingKey] = useState(null);
  async function buy(key) {
    if (buyingKey) return;
    setBuyingKey(key);
    const r = await actions.buyBoost(key);
    setBuyingKey(null);
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    toast(I18N.t("BO_BOUGHT"), "good");
  }
  async function arm(key) {
    if (togglingKey) return;
    setTogglingKey(key);
    const r = await actions.toggleBoost(key, !g.boostsArmed[key]);
    setTogglingKey(null);
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    toast(I18N.t(r.armed ? "BO_ARMED_ON" : "BO_ARMED_OFF"), r.armed ? "good" : "info");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: I18N.t("BO_SUB"),
    title: I18N.t("BO_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 13,
      marginBottom: 14
    }
  }, I18N.t("BO_ARM_HINT")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
      gap: 16
    }
  }, items.map(it => {
    const def = D.BOOSTS[it.key];
    const remaining = g.boosts[it.key] || 0;
    const armed = g.boostsArmed[it.key] === true;
    const lit = armed && remaining > 0;
    // Sans charge, rien à activer (le serveur le refuse aussi : no_charges).
    // Le Catalyseur exige en plus un compte vérifié on-chain.
    const armDisabled = togglingKey !== null || remaining <= 0 && !armed || it.key === "catalyst" && !g.onchainVerified && !armed;
    return /*#__PURE__*/React.createElement("div", {
      key: it.key,
      className: "panel oct",
      style: {
        border: `1px solid ${lit ? it.color : "var(--line)"}`,
        padding: 20,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxShadow: lit ? `0 0 24px color-mix(in srgb, ${it.color} 22%, transparent)` : "none"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex between center"
    }, /*#__PURE__*/React.createElement("span", {
      className: "h2",
      style: {
        color: it.color,
        fontSize: 17
      }
    }, it.name), /*#__PURE__*/React.createElement("span", {
      className: "pill",
      style: {
        color: remaining > 0 ? it.color : "var(--text-dim)",
        borderColor: remaining > 0 ? it.color : "var(--line)"
      }
    }, I18N.t("BO_CHARGES", remaining))), /*#__PURE__*/React.createElement("div", {
      className: "muted",
      style: {
        fontSize: 13,
        lineHeight: 1.5,
        minHeight: 56
      }
    }, it.desc), /*#__PURE__*/React.createElement("label", {
      className: "flex between center",
      style: {
        padding: "8px 0",
        borderTop: "1px solid var(--line-soft)"
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 12,
        color: armed ? it.color : "var(--text-dim)"
      }
    }, I18N.t(armed ? "BO_STATE_ARMED" : "BO_STATE_OFF")), /*#__PURE__*/React.createElement(BoostArmSwitch, {
      armed: armed,
      color: it.color,
      disabled: armDisabled,
      onToggle: () => arm(it.key)
    })), it.key === "catalyst" && !g.onchainVerified && /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 11,
        color: "var(--alert)"
      }
    }, I18N.t("BO_NEED_VERIFIED")), /*#__PURE__*/React.createElement("div", {
      className: "mono",
      style: {
        fontSize: 11,
        color: "var(--text-dim)"
      }
    }, `${def.charges} charges / pack`), /*#__PURE__*/React.createElement("button", {
      className: "btn block",
      style: {
        "--c": it.color,
        marginTop: "auto"
      },
      disabled: !!buyingKey,
      onClick: () => buy(it.key)
    }, buyingKey === it.key ? "…" : /*#__PURE__*/React.createElement(FaText, {
      text: I18N.t("BO_BUY", def.cost)
    })));
  })));
}

/* ---------------- WALLET ---------------- */
function Wallet() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [modal, setModal] = useState(null);
  // Où partiront réellement les jetons. Un compte créé sans wallet retire vers le
  // portefeuille qu'il a lié, jamais vers son adresse de compte (le serveur en détient
  // la seed). Cette adresse n'était affichée nulle part : le joueur devait faire
  // confiance sans pouvoir vérifier.
  const dest = window.FA_ACCOUNT.withdrawDestination(g);
  const peutRetirer = !!window.FA_ACCOUNT.withdrawSigner(g);
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "FRACTALARENA",
    title: I18N.t("WL_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 16
    },
    className: "wallet-grid"
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      color: "var(--gold)"
    }
  }, I18N.t("WL_LIQUID")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 36,
      fontWeight: 700,
      color: "var(--gold)",
      margin: "6px 0",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/TOKEN.png",
    alt: "FRACTALARENA",
    width: "30",
    height: "30",
    style: {
      borderRadius: 6,
      border: "1px solid var(--line)",
      flexShrink: 0
    }
  }), fmt(g.liquid)), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12
    }
  }, I18N.t("WL_LIQUID_DESC"))), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      color: "var(--fire)"
    }
  }, I18N.t("WL_LOCKED")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 36,
      fontWeight: 700,
      color: "var(--fire)",
      margin: "6px 0",
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "assets/TOKEN.png",
    alt: "FRACTALARENA",
    width: "30",
    height: "30",
    style: {
      borderRadius: 6,
      border: "1px solid var(--line)",
      flexShrink: 0
    }
  }), fmt(g.locked)), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12
    }
  }, I18N.t("WL_LOCKED_DESC")))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap16",
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec lg",
    style: {
      flex: 1
    },
    onClick: () => setModal("deposit")
  }, "\u2193 ", I18N.t("WL_DEPOSIT")), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold lg",
    style: {
      flex: 1
    },
    onClick: () => setModal("withdraw")
  }, "\u2191 ", I18N.t("WL_WITHDRAW"))), /*#__PURE__*/React.createElement("button", {
    className: "btn block",
    style: {
      marginTop: 10
    },
    onClick: () => setModal("history")
  }, "\uD83E\uDDFE ", I18N.t("WL_HISTORY")), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: "12px 14px",
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono muted",
    style: {
      fontSize: 12
    }
  }, "\u2191 ", I18N.t("WL_WD_DEST")), peutRetirer ? /*#__PURE__*/React.createElement(CopyAddr, {
    addr: dest
  }) : /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--fire)"
    }
  }, I18N.t("WL_WD_DEST_NONE")))), modal === "deposit" && /*#__PURE__*/React.createElement(DepositModal, {
    onClose: () => setModal(null)
  }), modal === "withdraw" && /*#__PURE__*/React.createElement(WithdrawModal, {
    onClose: () => setModal(null)
  }), modal === "history" && /*#__PURE__*/React.createElement(HistoryModal, {
    onClose: () => setModal(null)
  }));
}

/* L'historique des mouvements on-chain — pour que le joueur VÉRIFIE lui-même :
   montant, date/heure locale, statut du retrait, et le txid qui mène à
   l'explorateur. Chargé à l'ouverture seulement : la liste ne concerne que qui
   la demande. */
const UNISCAN_TX = "https://uniscan.cc/fractal/tx/"; // le réseau Fractal, PAS /tx/ (qui cherche sur Bitcoin)
const WL_H_STATUS = {
  pending: "WL_H_PENDING",
  pending_send: "WL_H_PENDING",
  completed: "WL_H_SENT",
  failed: "WL_H_FAILED"
};
function HistoryModal({
  onClose
}) {
  const {
    actions
  } = useFA();
  const [st, setSt] = useState({
    loading: true,
    entries: null
  });
  useEffect(() => {
    let vivant = true;
    actions.fetchWalletHistory().then(r => {
      if (vivant) setSt({
        loading: false,
        entries: r.ok ? r.entries : null
      });
    });
    return () => {
      vivant = false;
    };
  }, []);
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose,
    accent: "var(--elec)"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "\uD83E\uDDFE LEDGER",
    title: I18N.t("WL_HISTORY")
  }), st.loading && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      textAlign: "center",
      padding: 18
    }
  }, "\u2026"), !st.loading && !st.entries && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12,
      textAlign: "center",
      padding: 18
    }
  }, I18N.t("WL_H_ERROR")), !st.loading && st.entries && st.entries.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 12,
      textAlign: "center",
      padding: 18
    }
  }, I18N.t("WL_H_EMPTY")), !st.loading && st.entries && st.entries.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: "55vh",
      overflowY: "auto"
    }
  }, st.entries.map((e, i) => {
    const retrait = e.type === "withdraw";
    const echoue = e.status === "failed";
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        borderBottom: "1px solid var(--line)",
        padding: "9px 2px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "flex between center",
      style: {
        gap: 8
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: retrait ? "var(--gold)" : "var(--elec)",
        textDecoration: echoue ? "line-through" : "none"
      }
    }, retrait ? "↑ −" : "↓ +", fmt(e.amount), " ", /*#__PURE__*/React.createElement(TokenIcon, {
      s: 11
    })), retrait && /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 11,
        color: echoue ? "var(--alert)" : e.status === "completed" ? "var(--success)" : "var(--text-dim)"
      }
    }, I18N.t(WL_H_STATUS[e.status] || "WL_H_PENDING"))), /*#__PURE__*/React.createElement("div", {
      className: "flex between center",
      style: {
        gap: 8,
        marginTop: 3
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mono muted",
      style: {
        fontSize: 11
      }
    }, new Date(e.at).toLocaleString()), e.txid ? /*#__PURE__*/React.createElement("a", {
      className: "mono",
      style: {
        fontSize: 11,
        color: "var(--elec)"
      },
      href: UNISCAN_TX + e.txid,
      target: "_blank",
      rel: "noopener"
    }, e.txid.slice(0, 8), "\u2026", e.txid.slice(-6), " \u2197") : retrait && !echoue && /*#__PURE__*/React.createElement("span", {
      className: "mono muted",
      style: {
        fontSize: 11
      }
    }, I18N.t("WL_H_NO_TXID"))));
  })));
}
function CopyAddr({
  addr
}) {
  const {
    toast
  } = useFA();
  const [done, setDone] = useState(false);
  return /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: () => {
      navigator.clipboard && navigator.clipboard.writeText(addr).catch(() => {});
      setDone(true);
      toast(I18N.t("WL_COPIED"), "good");
      setTimeout(() => setDone(false), 1500);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11
    }
  }, addr.slice(0, 8), "\u2026", addr.slice(-6)), " \xB7 ", done ? I18N.t("WL_COPIED") : I18N.t("WL_COPY"));
}
function DepositModal({
  onClose
}) {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [txid, setTxid] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    const tx = txid.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(tx)) {
      toast(I18N.t("WL_DEP_TXID_INVALID"), "bad");
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch(`${API_URL}/verify-deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${g.authToken}`
        },
        body: JSON.stringify({
          wallet: g.wallet,
          txid: tx
        })
      });
      const data = await resp.json();
      if (data.status === "ok") {
        actions.deposit(data.credited);
        toast(I18N.t("WL_DEP_OK", data.credited), "good");
        onClose();
      } else if (data.status === "already_used") {
        toast("Ce TXID a déjà été utilisé", "bad");
      } else if (data.status === "wrong_recipient") {
        toast("Transaction non destinée au Reward Pool", "bad");
      } else {
        toast(data.error || "Dépôt non détecté on-chain", "bad");
      }
    } catch (e) {
      toast("Erreur réseau — réessaie", "bad");
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose,
    accent: "var(--elec)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      color: "var(--elec)"
    }
  }, I18N.t("WL_DEPOSIT")), /*#__PURE__*/React.createElement("div", {
    className: "h2",
    style: {
      margin: "4px 0 10px"
    }
  }, I18N.t("WL_DEP_TXID")), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12,
      lineHeight: 1.5,
      marginBottom: 12
    }
  }, I18N.t("WL_DEP_INFO")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      lineHeight: 1.5,
      marginBottom: 16,
      color: "var(--elec)",
      background: "rgba(0,0,0,0.25)",
      border: "1px solid var(--elec)",
      borderRadius: 6,
      padding: "10px 12px"
    }
  }, I18N.t("WL_DEP_CONFIRMS")), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: "12px 14px",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono muted",
    style: {
      fontSize: 12
    }
  }, I18N.t("WL_REWARD_POOL")), /*#__PURE__*/React.createElement(CopyAddr, {
    addr: "bc1qhgnfujw5f6r0hct45vmrrwuyrkh4u8npjn0p4s"
  }))), /*#__PURE__*/React.createElement("input", {
    className: "field",
    style: {
      fontSize: 12
    },
    value: txid,
    onChange: e => setTxid(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 64)),
    placeholder: I18N.t("WL_DEP_TXID_PH")
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec block lg",
    style: {
      marginTop: 18
    },
    disabled: busy,
    onClick: go
  }, busy ? I18N.t("WL_DEP_DETECT") : I18N.t("WL_DEP_SEND")));
}
function WithdrawModal({
  onClose
}) {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [amt, setAmt] = useState("500");
  const [busy, setBusy] = useState(false);
  const [cdMsg, setCdMsg] = useState(""); // message cooldown persistant (1 retrait / 24h)
  async function go() {
    setCdMsg("");
    const n = parseInt(amt, 10) || 0;
    const r = actions.withdraw(n); // validation min/max + débit optimiste client
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    setBusy(true);
    try {
      // Step-up : signature UniSat fraîche → token retrait
      toast(I18N.t("WL_WD_SIGN"), "info");
      const a = await actions.authForWithdraw();
      if (!a.ok) {
        actions.deposit(n);
        // Un compte créé sans wallet qui n'a rien lié n'a AUCUNE signature à produire :
        // lui réclamer une signature ne lui dit pas quoi faire. Il doit lier son
        // portefeuille — c'est là que partiraient ses jetons.
        toast(I18N.t(a.reason === "not-linked" ? "WL_WD_NOT_LINKED" : "WL_WD_SIGN_NEEDED"), "bad");
        return;
      }
      const resp = await fetch(`${API_URL}/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${a.token}`
        },
        body: JSON.stringify({
          wallet: g.wallet,
          amount: n
        })
      });
      const data = await resp.json();
      if (resp.status === 401) {
        actions.deposit(n);
        toast(I18N.t("WL_WD_SIGN_NEEDED"), "bad");
        return;
      }
      if (data.status === "ok") {
        toast(I18N.t("WL_WD_OK", n), "good");
        // Resync du solde avec le serveur (qui a déjà déduit) : l'affichage reflète
        // immédiatement le vrai solde au lieu de rester sur le débit optimiste.
        try {
          await actions.connectWallet(g.wallet, a.token);
        } catch (e) {/* best-effort */}
        onClose();
      } else if (data.status === "cooldown") {
        actions.deposit(n);
        setCdMsg(`Un seul retrait toutes les 24 h — prochain disponible dans ${data.hours_left} h.`);
      } else {
        actions.deposit(n);
        toast(data.error || "Erreur retrait serveur", "bad");
      }
    } catch (e) {
      actions.deposit(n);
      toast("Erreur réseau — retrait annulé", "bad");
    } finally {
      setBusy(false);
    }
  }
  // Sur un appareil sans extension (téléphone, y compris session rejointe par
  // QR), la signature step-up ne peut PAS aboutir : le joueur remplissait le
  // montant pour voir authForWithdraw échouer après coup. On lui montre le vrai
  // chemin AVANT la saisie : le pont vers l'app UniSat, où le jeu reste
  // connecté et où le retrait se signe (cf. UnisatAppBridge, account.jsx).
  const pont = window.FA_ACCOUNT.cheminLiaison(window.FA_ACCOUNT.hasProvider(), window.FA_ACCOUNT.estNavigateurMobile()) === "unisat-app";
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose,
    accent: "var(--gold)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      color: "var(--gold)"
    }
  }, I18N.t("WL_WITHDRAW")), /*#__PURE__*/React.createElement("div", {
    className: "h2",
    style: {
      margin: "4px 0 10px"
    }
  }, I18N.t("WL_LIQUID"), " : ", /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      color: "var(--gold)"
    }
  }, /*#__PURE__*/React.createElement(TokenIcon, {
    s: 14
  }), " ", fmt(g.liquid))), pont ? /*#__PURE__*/React.createElement(UnisatAppBridge, {
    mode: "withdraw"
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12,
      lineHeight: 1.5,
      marginBottom: 16
    }
  }, I18N.t("WL_WD_INFO")), cdMsg && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      lineHeight: 1.4,
      marginBottom: 12,
      padding: "8px 10px",
      borderRadius: 8,
      background: "rgba(255,90,90,0.12)",
      color: "var(--alert)"
    }
  }, "\u23F3 ", cdMsg), /*#__PURE__*/React.createElement("input", {
    className: "field",
    value: amt,
    onChange: e => setAmt(e.target.value.replace(/[^0-9]/g, "")),
    placeholder: "500"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-gold block lg",
    style: {
      marginTop: 18
    },
    disabled: busy,
    onClick: go
  }, busy ? I18N.t("WL_WD_PROC") : I18N.t("WL_WD_SEND"))));
}

/* ---------------- PERSO / VANITY ---------------- */
function Perso() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [tab, setTab] = useState("rename");
  const [sel, setSel] = useState(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState(g.playerTitle || "");
  const [busy, setBusy] = useState(false);
  async function doRename() {
    if (!sel || !name.trim() || busy) return;
    setBusy(true);
    const r = await actions.rename(sel, name.trim().slice(0, 24));
    setBusy(false);
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    toast(I18N.t("PE_RENAMED"), "good");
    setName("");
  }
  async function doTitle() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const r = await actions.setTitle(title.trim().slice(0, 32));
    setBusy(false);
    if (!r.ok) {
      toast(r.reason, "bad");
      return;
    }
    toast(I18N.t("PE_TITLE_SET"), "good");
  }
  return /*#__PURE__*/React.createElement("div", {
    className: "container"
  }, /*#__PURE__*/React.createElement(SectionHead, {
    eyebrow: "VANITY SINK",
    title: I18N.t("PE_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "subtabs"
  }, /*#__PURE__*/React.createElement("button", {
    className: cx("subtab", tab === "rename" && "on"),
    style: {
      "--c": "var(--elec)"
    },
    onClick: () => setTab("rename")
  }, I18N.t("PE_RENAME")), /*#__PURE__*/React.createElement("button", {
    className: cx("subtab", tab === "title" && "on"),
    style: {
      "--c": "var(--fire)"
    },
    onClick: () => setTab("title")
  }, I18N.t("PE_TITLE_TAB"))), tab === "rename" ? /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex gap12 center wrap",
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "field",
    style: {
      flex: 1,
      minWidth: 200
    },
    maxLength: 24,
    value: name,
    onChange: e => setName(e.target.value),
    placeholder: I18N.t("PE_NEW_NAME")
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec",
    disabled: !sel || !name.trim() || busy,
    onClick: doRename
  }, busy ? "…" : /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("PE_RENAME_BTN", D.ECON.VANITY_RENAME)
  }))), !sel && /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 12,
      marginBottom: 12
    }
  }, I18N.t("PE_PICK")), /*#__PURE__*/React.createElement("div", {
    className: "grid-cards"
  }, g.roster.map(b => /*#__PURE__*/React.createElement(CreatureCard, {
    key: b.id,
    beast: b,
    selectable: true,
    selected: sel === b.id,
    onClick: () => setSel(sel === b.id ? null : b.id)
  })))) : /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: 520
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 22
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mono muted",
    style: {
      fontSize: 12,
      marginBottom: 10
    }
  }, I18N.t("PE_NEW_TITLE")), /*#__PURE__*/React.createElement("input", {
    className: "field",
    maxLength: 32,
    value: title,
    onChange: e => setTitle(e.target.value),
    placeholder: "Whale \xB7 Diamond Hands \xB7 \u2026"
  }), /*#__PURE__*/React.createElement("button", {
    className: "btn btn-fire block",
    style: {
      marginTop: 16
    },
    disabled: !title.trim() || busy,
    onClick: doTitle
  }, busy ? "…" : /*#__PURE__*/React.createElement(FaText, {
    text: I18N.t("PE_TITLE_BTN", D.ECON.VANITY_TITLE)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 20,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "h2",
    style: {
      fontSize: 15,
      color: g.holderDays >= 360 ? "var(--fire)" : "var(--text)"
    }
  }, "\u2726 ", I18N.t("PE_BADGE")), /*#__PURE__*/React.createElement("span", {
    className: "pill"
  }, Math.min(360, g.holderDays), "/360")), /*#__PURE__*/React.createElement("div", {
    className: "muted",
    style: {
      fontSize: 11,
      marginTop: 8,
      lineHeight: 1.4,
      fontStyle: "italic"
    }
  }, I18N.t("PE_BADGE_HINT")), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 12,
      marginTop: 8
    }
  }, I18N.t("PE_BADGE_DESC", g.holderDays)), /*#__PURE__*/React.createElement(Bar, {
    frac: g.holderDays / 360,
    kind: "xp",
    className: ""
  })), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 20,
      marginTop: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center"
  }, /*#__PURE__*/React.createElement("span", {
    className: "h2"
  }, "\uD83D\uDD17 ", I18N.t("CHAMP_POINTS")), /*#__PURE__*/React.createElement("span", {
    className: "pill",
    style: {
      color: "var(--elec)"
    }
  }, g.championPoints)), /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 11,
      marginTop: 6
    }
  }, I18N.t("CHAMP_POINTS_DESC"))), /*#__PURE__*/React.createElement(QuizPrestige, null)));
}

/* ---------------- OPTIONS ---------------- */
/* « Connecter un téléphone » : émet un code de liaison bref (serveur) et le
   montre en QR + en clair. Le téléphone qui scanne devient une session du même
   compte — c'est le SEUL chemin mobile pour un compte au wallet lié, UniSat ne
   sachant pas signer pour une web app mobile (voir device-link-ui.js). */
function DeviceLinkPanel() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [link, setLink] = useState(null); // { code, expiresAt }
  const [restant, setRestant] = useState(0);
  const [busy, setBusy] = useState(false);

  // Le décompte affiché est ce qui retire le QR de l'écran : un code mort ne
  // doit pas rester scannable en silence.
  useEffect(() => {
    if (!link) return undefined;
    const id = setInterval(() => {
      const r = Math.max(0, Math.ceil((link.expiresAt - Date.now()) / 1000));
      setRestant(r);
      if (r <= 0) setLink(null);
    }, 500);
    return () => clearInterval(id);
  }, [link]);
  const generer = async () => {
    setBusy(true);
    const r = await actions.createDeviceLink();
    setBusy(false);
    if (!r.ok) {
      toast(I18N.t("OP_DEVLINK_ERROR"), "bad");
      return;
    }
    setLink({
      code: r.code,
      expiresAt: Date.now() + r.expires_in * 1000
    });
    setRestant(r.expires_in);
  };

  // Deux choses à copier, deux usages distincts :
  //   - le CODE, pour le coller dans « J'ai déjà un compte » sur l'autre
  //     appareil. C'est le cas courant depuis qu'on peut prendre un code sur
  //     son propre téléphone (jeu ouvert dans l'app UniSat) pour ouvrir sa
  //     session dans le navigateur : on ne scanne pas son propre écran ;
  //   - le LIEN, à s'envoyer par message : l'ouvrir connecte sans rien saisir.
  // Le champ de saisie accepte les deux (codeFromInput extrait le code d'une
  // URL), mais le joueur qui voit « https://… » là où on lui demande un code
  // croit s'être trompé de bouton.
  const copierTexte = async (texte, cle) => {
    try {
      await navigator.clipboard.writeText(texte);
      toast(I18N.t(cle), "good");
    } catch (e) {/* presse-papier refusé : le code reste lisible à l'écran */}
  };
  const copierCode = () => copierTexte(link.code, "OP_DEVLINK_CODE_COPIED");
  const copierLien = () => copierTexte(window.FA_DEVICE_LINK.linkUrl(window.location.origin, link.code), "OP_DEVLINK_COPIED");
  if (!g.authToken) return null;
  const svg = link && window.FA_DEVICE_LINK ? window.FA_DEVICE_LINK.svgQr(window.FA_DEVICE_LINK.linkUrl(window.location.origin, link.code)) : null;
  return /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 20,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      color: "var(--elec)",
      marginBottom: 8
    }
  }, "\uD83D\uDCF1 ", I18N.t("OP_DEVLINK_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginBottom: 12
    }
  }, I18N.t("OP_DEVLINK_HINT")), !link && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec block",
    disabled: busy,
    onClick: generer
  }, I18N.t("OP_DEVLINK_BTN")), link && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center"
    }
  }, svg && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      padding: 10,
      width: 208,
      margin: "0 auto",
      borderRadius: 6
    },
    dangerouslySetInnerHTML: {
      __html: svg
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 15,
      fontWeight: 700,
      letterSpacing: 1,
      margin: "10px 0 2px",
      userSelect: "all"
    }
  }, link.code), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10.5,
      color: "var(--text-dim)",
      marginBottom: 10
    }
  }, I18N.t("OP_DEVLINK_TTL", restant)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      justifyContent: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: copierCode
  }, "\u29C9 ", I18N.t("OP_DEVLINK_COPY_CODE")), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    onClick: copierLien
  }, "\u29C9 ", I18N.t("OP_DEVLINK_COPY")))));
}
function Options() {
  const {
    g,
    actions,
    toast
  } = useFA();
  const [scanState, setScanState] = useState("idle"); // idle | scanning | done
  const [found, setFound] = useState([]);
  const [query, setQuery] = useState("");
  // Un compte genere n'a AUCUN wallet a re-signer : se deconnecter sans avoir note son
  // code de recuperation est une perte de compte definitive. Un compte UniSat, lui, peut
  // re-signer a tout moment -> aucune confirmation necessaire (comportement inchange).
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const isGenerated = g.accountKind === window.FA_ACCOUNT.KIND_GENERATED;
  const langs = [["FR", "Français"], ["EN", "English"], ["ZH", "中文"]];
  // Titre de prestige que le joueur a choisi de porter (choix local, cf. QuizPrestige).
  // Sans cet affichage le sélecteur ne changerait rien à l'écran.
  const [prestigeAffiche, setPrestigeAffiche] = useState("");
  useEffect(() => {
    let vivant = true;
    actions.fetchQuizProfile().then(r => {
      if (vivant && r.ok) setPrestigeAffiche(titrePrestige(r.data, litChoixTitre()));
    });
    return () => {
      vivant = false;
    };
  }, [actions]);
  function onDisconnectClick() {
    if (isGenerated) setConfirmDisconnect(true);else actions.disconnect();
  }
  function scan() {
    setScanState("scanning");
    setFound([]);
    setQuery("");
    fetch(`${API_URL}/vanity/ordinal-names/${g.wallet}`).then(r => r.json()).then(data => {
      setFound(data.names || []);
      setScanState("done");
    }).catch(() => {
      setFound([]);
      setScanState("done");
    });
  }
  function selectName(name) {
    actions.setOrdinalName(name);
    toast(I18N.t("OP_ORDINAL_SELECTED"), "good");
  }
  function useAddress() {
    actions.setOrdinalName("");
    toast(I18N.t("OP_ORDINAL_CLEARED"), "info");
  }
  const q = query.trim().toLowerCase();
  const filtered = q ? found.filter(ins => ins.name.toLowerCase().includes(q)) : found;
  return /*#__PURE__*/React.createElement("div", {
    className: "container",
    style: {
      maxWidth: 560
    }
  }, /*#__PURE__*/React.createElement(SectionHead, {
    title: I18N.t("OP_TITLE")
  }), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 20,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "eyebrow",
    style: {
      color: "var(--fire)",
      marginBottom: 12
    }
  }, I18N.t("OP_PROFILE")), /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("OP_ORDINAL")), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 13,
      fontWeight: 700,
      color: g.ordinalName ? "var(--elec)" : "var(--text-faint)"
    }
  }, prestigeAffiche ? prestigeAffiche + " " : "", g.ordinalName ? (g.playerTitle ? g.playerTitle + " " : "") + g.ordinalName : g.playerName || "—")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10.5,
      color: "var(--text-faint)",
      marginBottom: 14
    }
  }, I18N.t("OP_ORDINAL_HINT")), scanState === "idle" && /*#__PURE__*/React.createElement("button", {
    className: "btn btn-elec block",
    onClick: scan
  }, "\u2315 ", I18N.t("OP_ORDINAL_SCAN")), scanState === "scanning" && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--elec)",
      textAlign: "center",
      padding: "14px 0",
      letterSpacing: 1
    }
  }, "\u2315 ", I18N.t("OP_ORDINAL_SCANNING")), scanState === "done" && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--text-dim)"
    }
  }, found.length ? I18N.t("OP_ORDINAL_FOUND", found.length) : I18N.t("OP_ORDINAL_NONE")), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    style: {
      padding: "3px 9px"
    },
    onClick: scan
  }, "\u21BB ", I18N.t("OP_ORDINAL_RESCAN"))), found.length > 8 && /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      gap: 10,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "field",
    style: {
      flex: 1,
      fontSize: 12,
      padding: "9px 12px"
    },
    value: query,
    onChange: e => setQuery(e.target.value),
    placeholder: I18N.t("OP_ORDINAL_SEARCH")
  }), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 10.5,
      color: "var(--text-faint)",
      whiteSpace: "nowrap"
    }
  }, I18N.t("OP_ORDINAL_SHOWING", filtered.length, found.length))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      maxHeight: found.length > 6 ? 290 : "none",
      overflowY: found.length > 6 ? "auto" : "visible",
      paddingRight: found.length > 6 ? 4 : 0,
      scrollbarWidth: "thin",
      scrollbarColor: "var(--line) transparent"
    }
  }, filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-faint)",
      textAlign: "center",
      padding: "12px 0"
    }
  }, I18N.t("OP_ORDINAL_NOMATCH")), filtered.map(ins => {
    const sel = g.ordinalName === ins.name;
    return /*#__PURE__*/React.createElement("button", {
      key: ins.name,
      onClick: () => selectName(ins.name),
      className: "oct-sm",
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        textAlign: "left",
        padding: "11px 14px",
        cursor: "pointer",
        flex: "none",
        background: sel ? "color-mix(in srgb, var(--elec) 14%, var(--bg-panel))" : "rgba(255,255,255,0.022)",
        border: `1px solid ${sel ? "var(--elec)" : "var(--line)"}`,
        boxShadow: sel ? "0 0 18px color-mix(in srgb, var(--elec) 25%, transparent)" : "none"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "block",
        fontFamily: "var(--font-mono)",
        fontSize: 15,
        fontWeight: 700,
        color: sel ? "var(--elec)" : "var(--text)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis"
      }
    }, ins.name), /*#__PURE__*/React.createElement("span", {
      className: "mono",
      style: {
        fontSize: 10,
        color: "var(--text-dim)"
      }
    }, I18N.t("OP_ORDINAL_INSCR"), " #", ins.number, " \xB7 ", ins.sats, " sats")), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: "none",
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: `1px solid ${sel ? "var(--elec)" : "var(--line)"}`,
        background: sel ? "var(--elec)" : "transparent",
        color: "#06101a",
        display: "grid",
        placeItems: "center",
        fontSize: 12,
        fontWeight: 700
      }
    }, sel ? "✓" : ""));
  })), /*#__PURE__*/React.createElement("button", {
    onClick: useAddress,
    className: "oct-sm",
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12,
      width: "100%",
      textAlign: "left",
      padding: "11px 14px",
      cursor: "pointer",
      marginTop: 8,
      background: !g.ordinalName ? "color-mix(in srgb, var(--text-dim) 14%, var(--bg-panel))" : "rgba(255,255,255,0.022)",
      border: `1px solid ${!g.ordinalName ? "var(--text-dim)" : "var(--line)"}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("OP_ORDINAL_USE_ADDR")), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: "none",
      width: 20,
      height: 20,
      borderRadius: "50%",
      border: `1px solid ${!g.ordinalName ? "var(--text-dim)" : "var(--line)"}`,
      background: !g.ordinalName ? "var(--text-dim)" : "transparent",
      color: "#06101a",
      display: "grid",
      placeItems: "center",
      fontSize: 12,
      fontWeight: 700
    }
  }, !g.ordinalName ? "✓" : ""))), /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      gap: 14,
      borderTop: "1px solid var(--line-soft)",
      paddingTop: 12,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 12,
      color: "var(--text-dim)"
    }
  }, I18N.t("OP_WALLET_ADDR")), g.wallet ? /*#__PURE__*/React.createElement(CopyAddr, {
    addr: g.wallet
  }) : /*#__PURE__*/React.createElement("span", {
    className: "mono muted",
    style: {
      fontSize: 12
    }
  }, "\u2014"))), /*#__PURE__*/React.createElement(DeviceLinkPanel, null), /*#__PURE__*/React.createElement("div", {
    className: "panel oct",
    style: {
      border: "1px solid var(--line)",
      padding: 22,
      display: "flex",
      flexDirection: "column",
      gap: 20
    }
  }, /*#__PURE__*/React.createElement(Row, {
    label: I18N.t("OP_LANG")
  }, /*#__PURE__*/React.createElement("div", {
    className: "lang-switch"
  }, langs.map(([code, lbl]) => /*#__PURE__*/React.createElement("button", {
    key: code,
    className: g.lang === code ? "on" : "",
    onClick: () => actions.setLang(code)
  }, lbl)))), /*#__PURE__*/React.createElement(Row, {
    label: I18N.t("OP_SOUND")
  }, /*#__PURE__*/React.createElement(Toggle, {
    on: g.options.sound,
    onClick: () => actions.setOption("sound", !g.options.sound)
  }))), /*#__PURE__*/React.createElement("div", {
    className: "flex gap12",
    style: {
      marginTop: 18
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    style: {
      flex: 1
    },
    onClick: onDisconnectClick
  }, I18N.t("OP_DISCONNECT"))), confirmDisconnect && /*#__PURE__*/React.createElement(Modal, {
    onClose: () => setConfirmDisconnect(false),
    accent: "var(--alert)"
  }, /*#__PURE__*/React.createElement("div", {
    className: "h1",
    style: {
      fontSize: 20,
      color: "var(--alert)",
      marginBottom: 12
    }
  }, I18N.t("ACC_DISCONNECT_CONFIRM_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 13,
      lineHeight: 1.6,
      color: "var(--text-dim)",
      marginBottom: 20
    }
  }, I18N.t(g.linkedWallet ? "ACC_DISCONNECT_CONFIRM_BODY_LINKED" : "ACC_DISCONNECT_CONFIRM_BODY")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8",
    style: {
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "btn btn-alert",
    onClick: () => {
      setConfirmDisconnect(false);
      actions.disconnect();
    }
  }, I18N.t("ACC_DISCONNECT_CONFIRM_BTN")), /*#__PURE__*/React.createElement("button", {
    className: "btn ghost",
    onClick: () => setConfirmDisconnect(false)
  }, I18N.t("ACC_DISCONNECT_CANCEL")))));
}
function Row({
  label,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      fontSize: 13,
      color: "var(--text-dim)"
    }
  }, label), children);
}
function Toggle({
  on,
  onClick
}) {
  return /*#__PURE__*/React.createElement("span", {
    onClick: onClick,
    style: {
      cursor: "pointer",
      width: 46,
      height: 24,
      background: on ? "var(--elec)" : "#1a2238",
      position: "relative",
      borderRadius: 12,
      transition: "background .2s"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 3,
      left: on ? 25 : 3,
      width: 18,
      height: 18,
      borderRadius: "50%",
      background: "#fff",
      transition: "left .2s"
    }
  }));
}
Object.assign(window, {
  Team,
  Forge,
  Boosts,
  Wallet,
  Perso,
  Options
});
})();
