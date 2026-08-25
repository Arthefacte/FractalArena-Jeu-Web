/* ============================================================
   FRACTAL ARENA — Team / Forge / Boosts / Wallet / Perso / Options
   ============================================================ */
const { useState, useEffect, useMemo } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { useFA, cx, fmt, presetLabel, rarityLabel, Bar, StatGrid, CreatureCard, Modal, SectionHead, MiniStats, RelicIcon, TokenIcon, FaText, UnisatAppBridge } = window;
const API_URL = window.FA_API_URL;

/* ---------------- PRESTIGE DU QUIZ ----------------
   Deux pistes indépendantes, servies par GET /quiz/profile : le savoir (bonnes
   réponses) et la contribution (FA versés aux pools de rachat, quiz et sinks de
   jeu confondus). Le joueur choisit lequel des deux titres il porte ; en v1 ce
   choix est local (localStorage) — aucune route serveur de plus. */
const QUIZ_TITLE_KEY = "fa_quiz_title_choice";

function litChoixTitre() {
  try { return localStorage.getItem(QUIZ_TITLE_KEY) || "none"; } catch (e) { return "none"; }
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
  const { actions } = useFA();
  const [profil, setProfil] = useState(null);
  const [quizTitleChoice, setQuizTitleChoice] = useState(litChoixTitre);

  useEffect(() => {
    let vivant = true;
    actions.fetchQuizProfile().then((r) => { if (vivant && r.ok) setProfil(r.data); });
    return () => { vivant = false; };
  }, [actions]);

  function choisir(v) {
    setQuizTitleChoice(v);
    try { localStorage.setItem(QUIZ_TITLE_KEY, v); } catch (e) { /* mode privé : le choix ne survit pas, tant pis */ }
  }

  if (!profil) return null;

  const options = [
    ["none", I18N.t("QUIZ_NONE"), ""],
    ["knowledge", I18N.t("QUIZ_TITLE_KNOWLEDGE"), profil.knowledge_title || ""],
    ["contribution", I18N.t("QUIZ_TITLE_CONTRIB"), profil.contribution_title || ""],
  ];

  return (
    <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 20, marginTop: 16 }}>
      <div className="eyebrow" style={{ color: "var(--elec)", marginBottom: 12 }}>{I18N.t("QUIZ_PRESTIGE")}</div>

      <div className="flex between center" style={{ marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("QUIZ_TITLE_KNOWLEDGE")}</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: profil.knowledge_title ? "var(--elec)" : "var(--text-faint)" }}>
          {profil.knowledge_title || "—"}
        </span>
      </div>
      <div className="mono muted" style={{ fontSize: 11, marginBottom: 12 }}>
        {I18N.t("QUIZ_ANSWERED", profil.knowledge || 0, profil.total_questions || 0)}
      </div>

      <div className="flex between center" style={{ marginBottom: 4 }}>
        <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("QUIZ_TITLE_CONTRIB")}</span>
        <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: profil.contribution_title ? "var(--fire)" : "var(--text-faint)" }}>
          {profil.contribution_title || "—"}
        </span>
      </div>
      <div className="mono muted" style={{ fontSize: 11, marginBottom: 14 }}>
        <FaText text={I18N.t("QUIZ_CONTRIBUTED", profil.contribution || 0)} s={11} />
      </div>

      <div className="mono" style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 8 }}>{I18N.t("QUIZ_SHOWN")}</div>
      <div className="flex gap12 wrap">
        {options.map(([v, label, titre]) => (
          <button
            key={v}
            className={cx("btn sm", quizTitleChoice === v && "on")}
            style={{ flex: 1, minWidth: 96 }}
            // Un titre pas encore débloqué ne se choisit pas : il n'y a rien à porter.
            disabled={v !== "none" && !titre}
            onClick={() => choisir(v)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------- TEAM ---------------- */
function Team() {
  const { g, actions, toast } = useFA();
  const sorted = useMemo(() => {
    return g.roster.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity] || b.level - a.level);
  }, [g.roster]);
  const selCount = g.selected.length;

  // Entités parties en expédition : non sélectionnables ici (même garde que le
  // serveur, qui refuse le combat avec bete_en_expedition — miroir d'expeditions.jsx).
  const busyIds = useMemo(
    () => new Set((g.expeditions || []).flatMap((e) => (Array.isArray(e.beast_ids) ? e.beast_ids : []))),
    [g.expeditions]
  );
  // Une entité déjà sélectionnée qui part en expédition est désélectionnée d'office :
  // sans ça, l'équipe garde un membre injouable et la Fosse échoue au lancement.
  useEffect(() => {
    g.selected.filter((id) => busyIds.has(id)).forEach((id) => actions.toggleSelect(id));
  }, [busyIds]);

  // Champion de soutien : ma designation courante (badge ★ + bande sous les cartes)
  // + l'historique des locations (panneau en bas d'écran — c'est ICI qu'on désigne
  // son champion, le user ne le trouvait pas dans Perso sous un onglet).
  useEffect(() => { if (g.authToken) { actions.championGet(); actions.championUses(); } }, [g.authToken]);

  async function designate(b) {
    if (g.championBeastId === b.id) return;
    const r = await actions.championSet(b.id);
    if (r.ok) toast(I18N.t("CHAMP_DESIGNATED_OK", D.displayName(b)), "good");
    else toast(r.reason || "error", "bad");
  }

  function toggle(b) {
    if (g.selected.includes(b.id)) actions.toggleSelect(b.id);
    else if (busyIds.has(b.id)) toast(I18N.t("EXP_ERR_bete_en_expedition"), "bad");
    else if (selCount >= 3) toast(I18N.t("TEAM_FULL"), "bad");
    else actions.toggleSelect(b.id);
  }

  return (
    <div className="container">
      <div className="flex between center wrap" style={{ marginBottom: 22, gap: 12 }}>
        <div>
          <div className="eyebrow">{I18N.t("TEAM_COUNT", g.roster.length)}</div>
          <div className="h1" style={{ marginBottom: 0 }}>{I18N.t("TEAM_TITLE")}</div>
          <div className="muted mono" style={{ fontSize: 13, marginTop: 4 }}>{I18N.t("TEAM_HINT")}</div>
        </div>
        <div className="flex gap12 center">
          <span className="pill" style={{ color: selCount === 3 ? "var(--success)" : "var(--text-dim)", fontSize: 13 }}>{I18N.t("TEAM_SELECTED", selCount)}</span>
          <button className="btn btn-elec lg" disabled={selCount !== 3} onClick={() => actions.setView("fosse")}>{I18N.t("TEAM_ENTER")} →</button>
        </div>
      </div>
      {/* Slot Capitaine (Totem) — affichage seul, clic → écran Lien */}
      {(() => {
        const TU = window.FA_TOTEM_UI;
        const t = g.totem;
        return (
          <div className="totem-slot" onClick={() => actions.setView("lien")}
               style={{ cursor: "pointer", display: "flex", gap: 12, alignItems: "center",
                        border: "1px solid var(--gold, #F7931A)", borderRadius: 12, padding: 10, marginBottom: 12 }}>
            <img alt="Totem"
                 src={t ? TU.totemArt(t) : "assets/HASHBYTE.webp"}
                 onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = t ? TU.totemArtFallback(t.type) : "assets/HASHBYTE.webp"; }}
                 style={{ width: 56, height: 56, borderRadius: 8, filter: t && t.tier > 0 ? "none" : "grayscale(1) opacity(0.5)" }} />
            <div>
              <div style={{ fontWeight: 700 }}>
                {I18N.t("LINK_CAPTAIN")} · {t ? t.type : "—"} · {t ? TU.tierName(t.tier) : TU.tierName(0)}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                {t ? TU.auraSummary(t.aura) : I18N.t("LINK_DORMANT_HINT")}
              </div>
            </div>
            <div style={{ marginLeft: "auto", opacity: 0.6 }}>›</div>
          </div>
        );
      })()}
      <div className="grid-cards">
        {sorted.map((b) => {
          const busy = busyIds.has(b.id);
          const isChamp = g.championBeastId === b.id;
          return (
            <div key={b.id} style={{ display: "flex", flexDirection: "column", ...(busy ? { opacity: 0.55, filter: "saturate(0.4)" } : {}) }}>
              <CreatureCard beast={b} selectable={!busy} selected={g.selected.includes(b.id)} onClick={() => toggle(b)} showXp
                badge={busy ? (
                  <div style={{ position: "absolute", bottom: 8, left: 8, right: 8, textAlign: "center", background: "rgba(6,9,18,0.85)", border: "1px solid var(--elec)", color: "var(--elec)", fontSize: 11, padding: "3px 6px", borderRadius: 6 }} className="mono">
                    ⏳ {I18N.t("TEAM_BUSY_EXP")}
                  </div>
                ) : isChamp ? (
                  <div style={{ position: "absolute", top: 8, left: 8, fontSize: 16, color: "var(--gold, #F7931A)", textShadow: "0 0 8px rgba(247,147,26,0.8)" }}>★</div>
                ) : null} />
              <RelicSlot beast={b} />
              <TalentSlot beast={b} />
              <div className="relic-slot mono"
                style={{ cursor: isChamp ? "default" : "pointer", color: isChamp ? "var(--gold, #F7931A)" : "var(--text-dim)" }}
                onClick={() => designate(b)}>
                {isChamp ? "★ " + I18N.t("CHAMP_IS") : "☆ " + I18N.t("CHAMP_DESIGNATE")}
              </div>
            </div>
          );
        })}
      </div>
      {/* Historique des locations du champion — sur l'écran où on le désigne
          (il était introuvable dans Perso, caché sous l'onglet Titre). */}
      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 20, marginTop: 20, maxWidth: 560 }}>
        <div className="flex between center wrap" style={{ gap: 8 }}>
          <span className="h2">⚔️ {I18N.t("CHAMP_USES_TITLE")}</span>
          {g.championUses.totals && g.championUses.totals.uses > 0 && (
            <span className="pill mono" style={{ color: "var(--gold)" }}>
              {I18N.t("CHAMP_TOTAL_LINE", g.championUses.totals.uses, g.championUses.totals.commission)}
            </span>
          )}
        </div>
        {(() => {
          const agg = window.FA_CHAMPION_UI.aggregateUsesByDay(g.championUses.uses);
          if (!agg.length) return <div className="muted mono" style={{ fontSize: 11, marginTop: 8 }}>{I18N.t("CHAMP_USES_EMPTY")}</div>;
          return agg.map((a) => (
            <div key={a.day} style={{ marginTop: 10, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>{a.day}</div>
              <div style={{ fontSize: 13 }}><FaText text={I18N.t("CHAMP_USES_LINE", a.fights, a.commission, a.points)} /></div>
              {a.names.length > 0 && (
                <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{I18N.t("CHAMP_USES_BY", a.names.join(", "))}</div>
              )}
            </div>
          ));
        })()}
      </div>
    </div>
  );
}

function RelicSlot({ beast }) {
  const { g, actions, toast } = useFA();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  // L'écran d'équipe montre des vignettes de reliques : on amorce les modèles ici
  // plutôt qu'au boot, et seulement quand le navigateur est libre.
  useEffect(() => {
    const M = window.FA_RELIC_MODELS;
    if (M && M.preloadWhenIdle) M.preloadWhenIdle();
  }, []);
  const equipped = beast.relic_id ? (g.equipment || []).find((e) => e.id === beast.relic_id) : null;
  const eff = equipped ? D.relicEffect(equipped.type, equipped.rarity) : null;
  // reliques équipables = non portées, ou déjà sur CETTE bête
  const available = (g.equipment || []).filter((inst) => {
    const holder = g.roster.find((b) => b.relic_id === inst.id);
    return !holder || holder.id === beast.id;
  });
  async function doEquip(relicId) {
    if (busy) return; setBusy(true);
    const r = await actions.relicEquip(beast.id, relicId);
    setBusy(false); setOpen(false);
    if (!r || !r.ok) toast((r && r.reason) || "error", "bad");
  }
  return (
    <>
      <div className="relic-slot mono" onClick={() => setOpen(true)}
        style={{ cursor: "pointer", fontSize: 11, marginTop: 6, padding: "4px 8px",
                 border: "1px solid var(--line)", borderRadius: 8, display: "flex", gap: 6, alignItems: "center" }}>
        {equipped
          ? (<><RelicIcon type={equipped.type} rarity={equipped.rarity} size={18} /><span style={{ color: D.RARITY_COLORS[equipped.rarity] }}>{I18N.t("RELIC_" + equipped.type.toUpperCase())}</span>
              <span style={{ color: "var(--text-dim)" }}>{D.relicStatDelta(eff)}</span></>)
          : (<span style={{ color: "var(--text-faint)" }}>◇ {I18N.t("RELIC_NONE")}</span>)}
      </div>
      {open && (
        <Modal onClose={() => setOpen(false)}>
          <div className="h2" style={{ fontSize: 14, marginBottom: 10 }}>{I18N.t("RELIC_EQUIP")} — {D.displayName(beast)}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: "50vh", overflow: "auto" }}>
            {available.length === 0 && <div className="mono muted" style={{ fontSize: 12 }}>{I18N.t("RELIC_INVENTORY")}: —</div>}
            {available.map((inst) => {
              const on = beast.relic_id === inst.id;
              const e = D.relicEffect(inst.type, inst.rarity);
              return (
                <button key={inst.id} className={cx("btn sm", on && "on")} disabled={busy}
                  onClick={() => doEquip(on ? null : inst.id)} style={{ justifyContent: "flex-start", gap: 8 }}>
                  <RelicIcon type={inst.type} rarity={inst.rarity} size={18} /> {I18N.t("RELIC_" + inst.type.toUpperCase())} · {rarityLabel(inst.rarity)} · {D.relicStatDelta(e)} {on ? "✓" : ""}
                </button>
              );
            })}
          </div>
          <button className="btn sm block" style={{ marginTop: 10 }} disabled={busy || !beast.relic_id}
            onClick={() => doEquip(null)}>{I18N.t("RELIC_UNEQUIP")}</button>
        </Modal>
      )}
    </>
  );
}

/* --- Bande talents sous la carte : 3 paliers L25/50/75, 1 choix parmi 2 --- */
function TalentSlot({ beast }) {
  const { actions, toast } = useFA();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const TAL = window.FA_TALENTS, TUI = window.FA_TALENTS_UI;
  const slots = TUI.slotState(beast);
  const nUnlocked = slots.filter((sl) => sl.unlocked).length;
  const nChosen = slots.filter((sl) => sl.unlocked && sl.chosen).length;

  const pick = async (tierKey, talentId) => {
    if (busy) return;
    setBusy(true);
    const r = await actions.chooseTalent(beast.id, Number(tierKey), talentId);
    setBusy(false);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t("TAL_TITLE") + " ✓", "good");
  };

  return (
    <>
      <div className="relic-slot mono" onClick={() => setOpen(true)} title={I18N.t("TAL_TITLE")}
        style={{ cursor: "pointer", fontSize: 11, marginTop: 6, padding: "4px 8px",
                 border: "1px solid var(--line)", borderRadius: 8, display: "flex", gap: 6, alignItems: "center" }}>
        {nUnlocked === 0
          ? <span className="muted">✦ {I18N.t("TAL_NONE_UNLOCKED")}</span>
          : <span>✦ {I18N.t("TAL_TITLE")} {nChosen}/{nUnlocked}</span>}
      </div>
      {open && (
        <Modal onClose={() => setOpen(false)} accent={D.RARITY_COLORS[beast.rarity]} wide>
          <h3>{I18N.t("TAL_TITLE")} — {D.displayName(beast)}</h3>
          {slots.map(({ key, unlocked, chosen }) => {
            const { cost, freeRespec } = TUI.chooseCost(beast, key);
            return (
              <div key={key} className="panel" style={{ marginBottom: 8, opacity: unlocked ? 1 : 0.55 }}>
                <div className="flex between center">
                  <b>{I18N.t("TAL_TIER", key)}</b>
                  {!unlocked && <span className="muted">{I18N.t("TAL_TIER_LOCKED", key)}</span>}
                  {unlocked && !chosen && <span className="muted">{I18N.t("TAL_PICK_FREE")}</span>}
                  {unlocked && chosen && (freeRespec
                    ? <span className="muted">{I18N.t("TAL_RESPEC_FREE")}</span>
                    : <span className="muted"><FaText text={I18N.t("TAL_RESPEC_COST", cost)} s={12} /></span>)}
                </div>
                {unlocked && (
                  <div className="flex wrap" style={{ gap: 6, marginTop: 6 }}>
                    {TAL.talentsFor(beast.type, Number(key)).map((t) => {
                      const on = chosen === t.id;
                      return (
                        <button key={t.id} disabled={busy || on}
                                className={cx("btn sm", on && "on")}
                                onClick={() => pick(key, t.id)}
                                style={{ flex: 1, minWidth: 150, textAlign: "left" }}>
                          <b>{I18N.t("TAL_" + t.id)}</b>{on ? " ✓" : ""}
                          <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>
                            {TUI.talentDesc(t, beast.rarity, I18N.t)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </Modal>
      )}
    </>
  );
}

/* ---------------- FORGE ---------------- */
function Forge() {
  const { g, actions, toast } = useFA();
  const [tab, setTab] = useState("fusion");
  const tabs = [{ k: "fusion", c: "var(--forge)" }, { k: "reroll", c: "var(--elec)" }, { k: "summon", c: "var(--fire)" }, { k: "reliques", c: "var(--gold)" }];
  return (
    <div className="container">
      <SectionHead eyebrow={I18N.t("FG_SUB")} title={I18N.t("FG_TITLE")} />
      <div className="subtabs">
        {tabs.map((t) => (
          <button key={t.k} className={cx("subtab", tab === t.k && "on")} style={{ "--c": t.c }} onClick={() => setTab(t.k)}>
            {I18N.t("FG_" + t.k.toUpperCase())}
          </button>
        ))}
      </div>
      {tab === "fusion" && <ForgeFusion />}
      {tab === "reroll" && <ForgeReroll />}
      {tab === "summon" && <ForgeSummon />}
      {tab === "reliques" && <ForgeReliques />}
    </div>
  );
}

function ForgeFusion() {
  const { g, actions, toast } = useFA();
  const [sel, setSel] = useState([]);
  const [fuseBusy, setFuseBusy] = useState(false);
  const [goldMode, setGoldMode] = useState(false);
  const elig = g.roster.filter((b) => b.rarity !== "Legendary");
  const sorted = elig.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity]);
  const first = sel[0] ? g.roster.find((b) => b.id === sel[0]) : null;

  function clickable(b) {
    if (!first) return true;
    if (b.id === first.id) return true;
    return b.rarity === first.rarity;
  }
  function toggle(b) {
    if (sel.includes(b.id)) setSel(sel.filter((x) => x !== b.id));
    else if (sel.length < 2 && clickable(b)) setSel([...sel, b.id]);
  }
  async function doFuse(gold) {
    if (fuseBusy) return;
    setFuseBusy(true);
    const r = await actions.fuse(sel[0], sel[1], gold);
    setFuseBusy(false);
    // bete_en_expedition : garde serveur des Expéditions — code traduit, pas brut.
    if (!r.ok) { toast(r.reason === "bete_en_expedition" ? I18N.t("EXP_ERR_bete_en_expedition") : r.reason, "bad"); return; }
    const showFuseResult = () => {
      if (r.success) {
        if (r.result?.premium) toast(I18N.t("FG_FUSE_PREMIUM", rarityLabel(r.result?.rarity)), "good");
        else toast(I18N.t("FG_FUSE_OK", rarityLabel(r.result?.rarity)), "good");
      }
      else toast(I18N.t("FG_FUSE_FAIL"), "bad");
    };
    if (window.FA_FORGE_CINE) {
      window.FA_FORGE_CINE.play({
        mode: "fuse", success: r.success, tier: r.result?.rarity,
        color: D.RARITY_COLORS[r.result?.rarity] || "#46e6ff",
        premium: r.result?.premium, onDone: showFuseResult,
      });
    } else showFuseResult();
    setSel([]);
    setGoldMode(false);
  }
  const F = window.FA_FORGE_UI;
  const cost = first ? D.FORGE.FUSION_COST[first.rarity] : 0;
  const rate = first ? D.FORGE.FUSION_RATE[first.rarity] : 0;
  const canFuse = sel.length === 2;
  const btn = F.fusionButtonState({ gold: goldMode, cost, balance: g.liquid + g.locked, ticketsGold: g.ticketsGold, busy: fuseBusy });

  return (
    <div>
      <div className="flex between center wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div className="mono muted" style={{ fontSize: 13 }}>{first ? I18N.t("FG_PICK_SAME", rarityLabel(first.rarity)) : I18N.t("FG_FUSION_HINT")}</div>
        {canFuse && (
          <div className="flex gap12 center">
            <span className="pill" style={{ color: "var(--elec)" }}>{I18N.t("FG_SUCCESS_RATE")} {goldMode ? 100 : Math.round(rate * 100)}%</span>
            <span className="pill" style={{ cursor: "pointer" }} onClick={() => setSel(F.fusionSwap(sel))}>⇄ {I18N.t("FG_SWAP")}</span>
            <span className="pill" style={{ color: "var(--gold)", cursor: "pointer", opacity: g.ticketsGold >= 1 ? 1 : 0.4, border: goldMode ? "1px solid var(--gold)" : undefined }}
              onClick={() => g.ticketsGold >= 1 && setGoldMode(!goldMode)}>
              🎟 {I18N.t("FG_GOLD")} {goldMode ? "✓" : ""}
            </span>
            <button className={cx("btn", goldMode ? "btn-gold" : "btn-forge")} disabled={btn.disabled} onClick={() => doFuse(goldMode)}>{fuseBusy ? "…" : goldMode ? I18N.t("FG_FUSE_BTN_GOLD") : <FaText text={I18N.t("FG_FUSE_BTN", cost)} />}</button>
          </div>
        )}
      </div>
      {btn.showInsufficient && canFuse && <div className="mono" style={{ color: "var(--alert)", fontSize: 12, marginBottom: 10 }}>{I18N.t("INSUFFICIENT", g.liquid + g.locked, cost)}</div>}
      <div className="grid-cards">
        {sorted.map((b) => {
          const role = sel[0] === b.id ? "kept" : sel[1] === b.id ? "sacrificed" : null;
          const roleColor = role === "kept" ? "var(--success)" : "var(--alert)";
          const roleBadge = role && (
            <div className="pill" style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap", background: "var(--bg)", color: roleColor, border: `1px solid ${roleColor}` }}>
              {role === "kept" ? I18N.t("FG_KEPT") : I18N.t("FG_SACRIFICED")}
            </div>
          );
          return (
            <div key={b.id} style={{ opacity: clickable(b) ? 1 : 0.32, pointerEvents: clickable(b) ? "auto" : "none", transition: "opacity .2s" }}>
              <CreatureCard beast={b} selectable selected={sel.includes(b.id)} onClick={() => toggle(b)} badge={roleBadge} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RerollPreviewModal({ preview, busy, onValidate, onAgain, onKeep }) {
  const { Modal } = window;
  const F = window.FA_FORGE_UI;
  const rows = F.rerollDiff(preview.old_stats, preview.new_stats, preview.locks);
  const color = (dir) => dir === "up" ? "var(--success)" : dir === "down" ? "var(--alert)" : "var(--text-dim)";
  const arrow = (dir) => dir === "up" ? "▲" : dir === "down" ? "▼" : "=";
  return (
    <Modal onClose={onKeep} accent="var(--elec)">
      <div className="h1" style={{ fontSize: 24, color: "var(--elec)", textAlign: "center", marginBottom: 14 }}>{I18N.t("REROLL_PREVIEW_TITLE")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: "6px 14px", alignItems: "center", marginBottom: 12 }}>
        <span className="mono muted" style={{ fontSize: 11 }}></span>
        <span className="mono muted" style={{ fontSize: 11, textAlign: "right" }}>{I18N.t("REROLL_CURRENT")}</span>
        <span className="mono muted" style={{ fontSize: 11, textAlign: "right" }}>{I18N.t("REROLL_PROPOSED")}</span>
        {rows.map((r) => [
          <span key={r.key + "l"} className="mono" style={{ fontSize: 13, opacity: r.locked ? 0.6 : 1 }}>{r.locked ? "🔒 " : ""}{r.label}</span>,
          <span key={r.key + "f"} className="mono" style={{ fontSize: 13, textAlign: "right", color: "var(--text-dim)" }}>{r.from}</span>,
          <span key={r.key + "t"} className="mono" style={{ fontSize: 13, textAlign: "right", color: r.locked ? "var(--text-dim)" : color(r.dir), opacity: r.locked ? 0.6 : 1 }}>{r.to} {r.locked ? "=" : arrow(r.dir)}</span>,
        ])}
      </div>
      <div className="mono muted" style={{ fontSize: 11, marginBottom: 14 }}>{I18N.t("REROLL_REFUND_HINT")}</div>
      <div className="flex gap8" style={{ flexWrap: "wrap" }}>
        <button className="btn btn-success" disabled={busy} onClick={onValidate}>{I18N.t("REROLL_VALIDATE")}</button>
        <button className="btn btn-elec" disabled={busy} onClick={onAgain}><FaText text={I18N.t("REROLL_AGAIN", F.withLockCost(preview.next_reroll_cost || 0, (preview.locks || []).length))} /></button>
        <button className="btn" disabled={busy} onClick={onKeep}>{I18N.t("REROLL_KEEP_OLD")}</button>
      </div>
    </Modal>
  );
}

function ForgeReroll() {
  const { g, actions, toast } = useFA();
  const [sel, setSel] = useState(null);
  const [rerollBusy, setRerollBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [locks, setLocks] = useState([]);
  const beast = sel ? g.roster.find((b) => b.id === sel) : null;
  const F = window.FA_FORGE_UI;
  const baseCost = beast ? Math.round(D.FORGE.REROLL_BASE[beast.rarity] * (1 + 0.5 * beast.reroll_count)) : 0;
  const cost = F.withLockCost(baseCost, locks.length);
  const balOk = (g.liquid + g.locked) >= cost;
  async function doReroll() {
    if (rerollBusy) return;
    setRerollBusy(true);
    const r = await actions.reroll(sel, locks);
    setRerollBusy(false);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    setPreview(r.preview);
  }
  async function onValidate() {
    setRerollBusy(true);
    const r = await actions.rerollConfirm(sel);
    setRerollBusy(false);
    setPreview(null);
    if (r.ok) toast(I18N.t("FG_REROLL_OK"), "good"); else toast(r.reason, "bad");
  }
  async function onAgain() {
    setRerollBusy(true);
    const r = await actions.reroll(sel, locks);
    setRerollBusy(false);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    setPreview(r.preview);
  }
  async function onKeep() {
    setRerollBusy(true);
    const r = await actions.rerollDiscard(sel);
    setRerollBusy(false);
    setPreview(null);
    if (r.ok) toast(I18N.t("REROLL_KEPT_OLD", r.refunded || 0), "good"); else toast(r.reason, "bad");
  }
  return (
    <div>
      <div className="flex between center wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div className="mono muted" style={{ fontSize: 13 }}>{I18N.t("FG_REROLL_HINT")}</div>
        {beast && (
          <div className="flex gap12 center">
            <span className="pill">reroll #{beast.reroll_count + 1}</span>
            <button className="btn btn-elec" disabled={!balOk || rerollBusy} onClick={doReroll}>{rerollBusy ? "…" : <FaText text={I18N.t("FG_REROLL_BTN", cost)} />}</button>
          </div>
        )}
      </div>
      {beast && (
        <div className="flex wrap center" style={{ gap: 6, marginBottom: 10 }}>
          <span className="mono muted" style={{ fontSize: 11 }}>{I18N.t("FG_LOCK_HINT")}</span>
          {F.LOCKABLE.map(({ stat, key, label }) => {
            const on = locks.includes(stat);
            return (
              <span key={stat} className="pill" onClick={() => {
                  const next = F.toggleLock(locks, stat);
                  if (next === null) { toast(I18N.t("FG_LOCK_MAX"), "bad"); return; }
                  setLocks(next);
                }}
                style={{ cursor: "pointer", userSelect: "none", border: on ? "1px solid var(--gold)" : undefined, color: on ? "var(--gold)" : undefined }}>
                {on ? "🔒" : "🔓"} {label} {beast[key]}
              </span>
            );
          })}
        </div>
      )}
      {!balOk && beast && <div className="mono" style={{ color: "var(--alert)", fontSize: 12, marginBottom: 10 }}>{I18N.t("INSUFFICIENT", g.liquid + g.locked, cost)}</div>}
      <div className="grid-cards">
        {g.roster.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity]).map((b) => (
          <CreatureCard key={b.id} beast={b} selectable selected={sel === b.id} onClick={() => { setSel(sel === b.id ? null : b.id); setLocks([]); }} />
        ))}
      </div>
      {preview && <RerollPreviewModal preview={preview} busy={rerollBusy} onValidate={onValidate} onAgain={onAgain} onKeep={onKeep} />}
    </div>
  );
}

function ForgeSummon() {
  const { g, actions, toast } = useFA();
  const [last, setLast] = useState(null);
  const [rolling, setRolling] = useState(false);
  const cost = D.ECON.MINT_COST;
  const balOk = (g.liquid + g.locked) >= cost;
  async function doSummon() {
    if (!balOk || rolling) return;
    setRolling(true); setLast(null);
    const r = await actions.summon();
    setRolling(false);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    const reveal = () => {
      setLast(r.beast);
      toast(I18N.t("FG_SUMMON_OK", D.displayName(r.beast), I18N.t("FG_RANK") + " " + (r.beast.rank || "C")), "good");
    };
    if (window.FA_FORGE_CINE) {
      window.FA_FORGE_CINE.play({
        mode: "summon", success: true, tier: r.beast.rank || "C",
        color: D.RANK_COLORS[r.beast.rank || "C"] || "#46e6ff",
        onDone: reveal,
      });
    } else reveal();
  }
  const odds = [["C", 55], ["B", 28], ["A", 13], ["S", 4]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 26, alignItems: "start" }} className="summon-grid">
      <div>
        <div className="mono muted" style={{ fontSize: 13, marginBottom: 16 }}>{I18N.t("FG_SUMMON_HINT")}</div>
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {odds.map(([r, p]) => (
              <div key={r} className="flex between center">
                <span className="flex center gap8"><span style={{ width: 10, height: 10, background: D.RANK_COLORS[r], display: "inline-block", clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }} /><span style={{ color: D.RANK_COLORS[r], fontWeight: 600 }}>{I18N.t("FG_RANK")} {r}</span></span>
                <span className="mono" style={{ color: "var(--text-dim)" }}>{p}%</span>
              </div>
            ))}
          </div>
          <div className="divider" />
          <button className="btn btn-fire block lg" disabled={!balOk || rolling} onClick={doSummon}>{rolling ? "…" : <FaText text={I18N.t("FG_SUMMON_BTN", cost)} />}</button>
        </div>
      </div>
      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 18, minHeight: 300, display: "grid", placeItems: "center" }}>
        {rolling ? (
          <div className="mono" style={{ color: "var(--fire)", fontSize: 13, letterSpacing: 2 }}>FORGING…</div>
        ) : last ? (
          <div style={{ width: "100%" }}>
            <div className="eyebrow" style={{ textAlign: "center", marginBottom: 10, color: D.RANK_COLORS[last.rank || "C"] }}>{I18N.t("MINT_TITLE")}</div>
            <CreatureCard beast={last} />
          </div>
        ) : (
          <div className="mono" style={{ color: "var(--text-faint)", fontSize: 12, textAlign: "center" }}>⬡<br />{I18N.t("FG_SUMMON")}</div>
        )}
      </div>
    </div>
  );
}

// Fragments d'expédition → relique (rang du fragment = rareté de la relique).
// Compteurs dans g.expFragments (GET /expeditions/state), coût 0 FA.
function ForgeFragments({ onForged }) {
  const { g, actions, toast } = useFA();
  const XU = window.FA_EXPEDITIONS_UI;
  const [crafting, setCrafting] = useState(false);
  const frags = g.expFragments || { C: 0, B: 0, A: 0, S: 0 };
  async function doCraft(rk) {
    if (crafting) return;
    setCrafting(true);
    let r = await actions.expeditionsCraftRelic(rk);
    if (!r.ok && r.reason === "retry") r = await actions.expeditionsCraftRelic(rk);
    setCrafting(false);
    // reason "auth" : app.jsx a déjà affiché AUTH_EXPIRED — pas de second toast.
    if (!r.ok) { if (r.reason !== "auth") toast(XU.errText(r.reason), "bad"); return; }
    // Le reveal (toast + panneau) appartient au parent, DANS le onDone de la
    // cinématique — même séquencement que doSummon.
    if (onForged) onForged(r.relic);
  }
  return (
    <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22, marginTop: 26 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{I18N.t("EXP_FORGE_TITLE")}</div>
      <div className="mono muted" style={{ fontSize: 12, marginBottom: 14 }}>{I18N.t("EXP_FORGE_SUB")}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {["C", "B", "A", "S"].map((rk) => {
          const have = frags[rk] || 0;
          const need = XU.FRAGMENT_COSTS[rk];
          const col = D.RANK_COLORS[rk];
          return (
            <div key={rk} style={{ display: "grid", gridTemplateColumns: "28px minmax(0,1fr) auto", gap: 12, alignItems: "center" }}>
              <b style={{ color: col, fontSize: 16, textAlign: "center" }}>{rk}</b>
              <div style={{ minWidth: 0 }}>
                <Bar frac={Math.min(1, have / need)} kind="xp" />
              </div>
              <button className="btn sm" disabled={have < need || crafting} onClick={() => doCraft(rk)}
                style={have >= need ? { borderColor: col, color: col, fontWeight: 700 } : {}}>
                {I18N.t("EXP_FORGE_BTN")} <span className="mono">{have}/{need}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ForgeReliques() {
  const { g, actions, toast } = useFA();
  const [last, setLast] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [detail, setDetail] = useState(null);
  const RV = window.RelicViewer;
  const cost = 8000;
  const balOk = (g.liquid + g.locked) >= cost;
  async function doSummon() {
    if (!balOk || rolling) return;
    setRolling(true); setLast(null);
    const r = await actions.relicSummon();
    setRolling(false);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    const revealRelic = () => {
      setLast(r.relic);
      toast(I18N.t("FG_SUMMON_OK", I18N.t("RELIC_" + r.relic.type.toUpperCase()), rarityLabel(r.relic.rarity)), "good");
    };
    if (window.FA_FORGE_CINE) {
      window.FA_FORGE_CINE.play({
        mode: "summon", success: true, tier: r.relic.rarity,
        color: D.RARITY_COLORS[r.relic.rarity] || "#46e6ff",
        onDone: revealRelic,
      });
    } else revealRelic();
  }
  const odds = [["Common", 70], ["Rare", 20], ["Epic", 8], ["Legendary", 2]];
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 26, alignItems: "start" }} className="summon-grid">
        <div>
          <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {odds.map(([r, p]) => (
                <div key={r} className="flex between center">
                  <span className="flex center gap8"><span style={{ width: 10, height: 10, background: D.RARITY_COLORS[r], display: "inline-block", clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)" }} /><span style={{ color: D.RARITY_COLORS[r], fontWeight: 600 }}>{rarityLabel(r)}</span></span>
                  <span className="mono" style={{ color: "var(--text-dim)" }}>{p}%</span>
                </div>
              ))}
            </div>
            <div className="divider" />
            <button className="btn btn-gold block lg" disabled={!balOk || rolling} onClick={doSummon}>{rolling ? "…" : <FaText text={I18N.t("FG_SUMMON_BTN", cost)} />}</button>
          </div>
        </div>
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 18, minHeight: 300, display: "grid", placeItems: "center" }}>
          {rolling ? (
            <div className="mono" style={{ color: "var(--gold)", fontSize: 13, letterSpacing: 2 }}>FORGING…</div>
          ) : last ? (
            <div style={{ width: "100%", textAlign: "center" }}>
              <div className="eyebrow" style={{ marginBottom: 10, color: D.RARITY_COLORS[last.rarity] }}>{I18N.t("RELIC_FORGED")}</div>
              <div style={{ margin: "0 auto 12px", display: "flex", justifyContent: "center" }}>
                {RV ? <RV type={last.type} rarity={last.rarity} size={200} /> : <RelicIcon type={last.type} rarity={last.rarity} size={48} />}
              </div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{I18N.t("RELIC_" + last.type.toUpperCase())}</div>
              <div style={{ color: D.RARITY_COLORS[last.rarity], fontWeight: 600, marginTop: 4 }}>{rarityLabel(last.rarity)}</div>
              <div className="mono muted" style={{ fontSize: 13, marginTop: 8 }}>{D.relicStatDelta(D.relicEffect(last.type, last.rarity))}</div>
            </div>
          ) : (
            <div className="mono" style={{ color: "var(--text-faint)", fontSize: 12, textAlign: "center" }}>⬡<br />{I18N.t("RELIC_SUMMON")}</div>
          )}
        </div>
      </div>
      <ForgeFragments onForged={(relic) => {
        // Reveal APRÈS la cinématique (même séquencement que doSummon) : le
        // panneau et le toast n'apparaissent pas sous l'animation.
        const reveal = () => {
          setLast(relic);
          toast(I18N.t("FG_SUMMON_OK", I18N.t("RELIC_" + relic.type.toUpperCase()), rarityLabel(relic.rarity)), "good");
        };
        if (window.FA_FORGE_CINE) {
          window.FA_FORGE_CINE.play({
            mode: "summon", success: true, tier: relic.rarity,
            color: D.RARITY_COLORS[relic.rarity] || "#46e6ff",
            onDone: reveal,
          });
        } else reveal();
      }} />
      <div style={{ marginTop: 26 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{I18N.t("RELIC_INVENTORY")}</div>
        {(g.equipment || []).length === 0 ? (
          <div className="mono muted" style={{ fontSize: 13 }}>{I18N.t("RELIC_NONE")}</div>
        ) : (
          <div className="grid-cards">
            {(g.equipment || []).map((inst) => {
              const holder = g.roster.find((b) => b.relic_id === inst.id);
              const effect = D.relicEffect(inst.type, inst.rarity);
              return (
                <div key={inst.id} className="panel oct" onClick={() => setDetail(inst)} style={{ border: `1px solid ${D.RARITY_COLORS[inst.rarity]}`, padding: 16, display: "flex", flexDirection: "column", gap: 8, cursor: "pointer" }}>
                  <div className="flex center gap8">
                    <RelicIcon type={inst.type} rarity={inst.rarity} size={28} />
                    <span style={{ fontWeight: 700 }}>{I18N.t("RELIC_" + inst.type.toUpperCase())}</span>
                  </div>
                  <span style={{ color: D.RARITY_COLORS[inst.rarity], fontWeight: 600, fontSize: 12 }}>{rarityLabel(inst.rarity)}</span>
                  <span className="mono muted" style={{ fontSize: 12 }}>{D.relicStatDelta(effect)}</span>
                  {holder && <span className="pill" style={{ color: "var(--gold)", fontSize: 11 }}>⚔ {D.displayName(holder)}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {detail && (
        <Modal onClose={() => setDetail(null)} accent={D.RARITY_COLORS[detail.rarity]}>
          <div style={{ textAlign: "center", padding: 8 }}>
            {RV && <RV type={detail.type} rarity={detail.rarity} size={240} />}
            <div style={{ fontWeight: 700, fontSize: 16, marginTop: 10 }}>{I18N.t("RELIC_" + detail.type.toUpperCase())}</div>
            <div style={{ color: D.RARITY_COLORS[detail.rarity], fontWeight: 600, marginTop: 4 }}>{rarityLabel(detail.rarity)}</div>
            <div className="mono muted" style={{ fontSize: 13, marginTop: 8 }}>{D.relicStatDelta(D.relicEffect(detail.type, detail.rarity))}</div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------------- BOOSTS ---------------- */
// v2 : 4 boosts en packs de 50 charges. Les charges achetées restent INERTES tant
// que le joueur n'a pas armé le boost (interrupteur ici et dans la Fosse).
function BoostArmSwitch({ armed, color, disabled, onToggle }) {
  return (
    <span onClick={disabled ? undefined : onToggle} className="oct-sm" style={{ width: 42, height: 22, flex: "none", background: armed ? color : "#1a2238", position: "relative", transition: "background .2s", borderRadius: 11, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1 }}>
      <span style={{ position: "absolute", top: 3, left: armed ? 22 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
    </span>
  );
}
function Boosts() {
  const { g, actions, toast } = useFA();
  const items = [
    { key: "xp_boost", name: I18N.t("BO_XP_NAME"), desc: I18N.t("BO_XP_DESC"), color: "var(--gold)" },
    { key: "lucky_strike", name: I18N.t("BO_LUCKY_NAME"), desc: I18N.t("BO_LUCKY_DESC"), color: "var(--fire)" },
    { key: "momentum", name: I18N.t("BO_MOM_NAME"), desc: I18N.t("BO_MOM_DESC"), color: "#9B5CFF" },
    { key: "catalyst", name: I18N.t("BO_CAT_NAME"), desc: I18N.t("BO_CAT_DESC"), color: "var(--success)" },
  ];
  const [buyingKey, setBuyingKey] = useState(null);
  const [togglingKey, setTogglingKey] = useState(null);
  async function buy(key) {
    if (buyingKey) return;
    setBuyingKey(key);
    const r = await actions.buyBoost(key);
    setBuyingKey(null);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t("BO_BOUGHT"), "good");
  }
  async function arm(key) {
    if (togglingKey) return;
    setTogglingKey(key);
    const r = await actions.toggleBoost(key, !g.boostsArmed[key]);
    setTogglingKey(null);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t(r.armed ? "BO_ARMED_ON" : "BO_ARMED_OFF"), r.armed ? "good" : "info");
  }
  return (
    <div className="container">
      <SectionHead eyebrow={I18N.t("BO_SUB")} title={I18N.t("BO_TITLE")} />
      <div className="muted" style={{ fontSize: 13, marginBottom: 14 }}>{I18N.t("BO_ARM_HINT")}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
        {items.map((it) => {
          const def = D.BOOSTS[it.key];
          const remaining = g.boosts[it.key] || 0;
          const armed = g.boostsArmed[it.key] === true;
          const lit = armed && remaining > 0;
          // Sans charge, rien à activer (le serveur le refuse aussi : no_charges).
          // Le Catalyseur exige en plus un compte vérifié on-chain.
          const armDisabled = togglingKey !== null || (remaining <= 0 && !armed) || (it.key === "catalyst" && !g.onchainVerified && !armed);
          return (
            <div key={it.key} className="panel oct" style={{ border: `1px solid ${lit ? it.color : "var(--line)"}`, padding: 20, display: "flex", flexDirection: "column", gap: 12, boxShadow: lit ? `0 0 24px color-mix(in srgb, ${it.color} 22%, transparent)` : "none" }}>
              <div className="flex between center">
                <span className="h2" style={{ color: it.color, fontSize: 17 }}>{it.name}</span>
                <span className="pill" style={{ color: remaining > 0 ? it.color : "var(--text-dim)", borderColor: remaining > 0 ? it.color : "var(--line)" }}>{I18N.t("BO_CHARGES", remaining)}</span>
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, minHeight: 56 }}>{it.desc}</div>
              <label className="flex between center" style={{ padding: "8px 0", borderTop: "1px solid var(--line-soft)" }}>
                <span className="mono" style={{ fontSize: 12, color: armed ? it.color : "var(--text-dim)" }}>{I18N.t(armed ? "BO_STATE_ARMED" : "BO_STATE_OFF")}</span>
                <BoostArmSwitch armed={armed} color={it.color} disabled={armDisabled} onToggle={() => arm(it.key)} />
              </label>
              {it.key === "catalyst" && !g.onchainVerified && <div className="mono" style={{ fontSize: 11, color: "var(--alert)" }}>{I18N.t("BO_NEED_VERIFIED")}</div>}
              <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>{`${def.charges} charges / pack`}</div>
              <button className="btn block" style={{ "--c": it.color, marginTop: "auto" }} disabled={!!buyingKey} onClick={() => buy(it.key)}>{buyingKey === it.key ? "…" : <FaText text={I18N.t("BO_BUY", def.cost)} />}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- WALLET ---------------- */
function Wallet() {
  const { g, actions, toast } = useFA();
  const [modal, setModal] = useState(null);
  // Où partiront réellement les jetons. Un compte créé sans wallet retire vers le
  // portefeuille qu'il a lié, jamais vers son adresse de compte (le serveur en détient
  // la seed). Cette adresse n'était affichée nulle part : le joueur devait faire
  // confiance sans pouvoir vérifier.
  const dest = window.FA_ACCOUNT.withdrawDestination(g);
  const peutRetirer = !!window.FA_ACCOUNT.withdrawSigner(g);
  return (
    <div className="container">
      <SectionHead eyebrow="FRACTALARENA" title={I18N.t("WL_TITLE")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="wallet-grid">
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>{I18N.t("WL_LIQUID")}</div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 700, color: "var(--gold)", margin: "6px 0", display: "flex", alignItems: "center", gap: 10 }}>
            <img src="assets/TOKEN.png" alt="FRACTALARENA" width="30" height="30" style={{ borderRadius: 6, border: "1px solid var(--line)", flexShrink: 0 }} />
            {fmt(g.liquid)}
          </div>
          <div className="muted mono" style={{ fontSize: 12 }}>{I18N.t("WL_LIQUID_DESC")}</div>
        </div>
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
          <div className="eyebrow" style={{ color: "var(--fire)" }}>{I18N.t("WL_LOCKED")}</div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 700, color: "var(--fire)", margin: "6px 0", display: "flex", alignItems: "center", gap: 10 }}>
            <img src="assets/TOKEN.png" alt="FRACTALARENA" width="30" height="30" style={{ borderRadius: 6, border: "1px solid var(--line)", flexShrink: 0 }} />
            {fmt(g.locked)}
          </div>
          <div className="muted mono" style={{ fontSize: 12 }}>{I18N.t("WL_LOCKED_DESC")}</div>
        </div>
      </div>
      <div className="flex gap16" style={{ marginTop: 18 }}>
        <button className="btn btn-elec lg" style={{ flex: 1 }} onClick={() => setModal("deposit")}>↓ {I18N.t("WL_DEPOSIT")}</button>
        <button className="btn btn-gold lg" style={{ flex: 1 }} onClick={() => setModal("withdraw")}>↑ {I18N.t("WL_WITHDRAW")}</button>
      </div>
      <button className="btn block" style={{ marginTop: 10 }} onClick={() => setModal("history")}>
        🧾 {I18N.t("WL_HISTORY")}
      </button>

      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: "12px 14px", marginTop: 16 }}>
        <div className="flex between center" style={{ gap: 10, flexWrap: "wrap" }}>
          <span className="mono muted" style={{ fontSize: 12 }}>↑ {I18N.t("WL_WD_DEST")}</span>
          {peutRetirer
            ? <CopyAddr addr={dest} />
            : <span className="mono" style={{ fontSize: 12, color: "var(--fire)" }}>{I18N.t("WL_WD_DEST_NONE")}</span>}
        </div>
      </div>

      {modal === "deposit" && <DepositModal onClose={() => setModal(null)} />}
      {modal === "withdraw" && <WithdrawModal onClose={() => setModal(null)} />}
      {modal === "history" && <HistoryModal onClose={() => setModal(null)} />}
    </div>
  );
}

/* L'historique des mouvements on-chain — pour que le joueur VÉRIFIE lui-même :
   montant, date/heure locale, statut du retrait, et le txid qui mène à
   l'explorateur. Chargé à l'ouverture seulement : la liste ne concerne que qui
   la demande. */
const UNISCAN_TX = "https://uniscan.cc/fractal/tx/"; // le réseau Fractal, PAS /tx/ (qui cherche sur Bitcoin)
const WL_H_STATUS = { pending: "WL_H_PENDING", pending_send: "WL_H_PENDING", completed: "WL_H_SENT", failed: "WL_H_FAILED" };

function HistoryModal({ onClose }) {
  const { actions } = useFA();
  const [st, setSt] = useState({ loading: true, entries: null });
  useEffect(() => {
    let vivant = true;
    actions.fetchWalletHistory().then((r) => {
      if (vivant) setSt({ loading: false, entries: r.ok ? r.entries : null });
    });
    return () => { vivant = false; };
  }, []);
  return (
    <Modal onClose={onClose} accent="var(--elec)">
      <SectionHead eyebrow="🧾 LEDGER" title={I18N.t("WL_HISTORY")} />
      {st.loading && <div className="muted" style={{ textAlign: "center", padding: 18 }}>…</div>}
      {!st.loading && !st.entries && (
        <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: 18 }}>{I18N.t("WL_H_ERROR")}</div>
      )}
      {!st.loading && st.entries && st.entries.length === 0 && (
        <div className="muted" style={{ fontSize: 12, textAlign: "center", padding: 18 }}>{I18N.t("WL_H_EMPTY")}</div>
      )}
      {!st.loading && st.entries && st.entries.length > 0 && (
        <div style={{ maxHeight: "55vh", overflowY: "auto" }}>
          {st.entries.map((e, i) => {
            const retrait = e.type === "withdraw";
            const echoue = e.status === "failed";
            return (
              <div key={i} style={{ borderBottom: "1px solid var(--line)", padding: "9px 2px" }}>
                <div className="flex between center" style={{ gap: 8 }}>
                  <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: retrait ? "var(--gold)" : "var(--elec)", textDecoration: echoue ? "line-through" : "none" }}>
                    {retrait ? "↑ −" : "↓ +"}{fmt(e.amount)} <TokenIcon s={11} />
                  </span>
                  {/* Le statut d'un dépôt est constant (une ligne n'existe que
                      vérifiée on-chain) : on ne l'affiche que pour les retraits. */}
                  {retrait && (
                    <span className="mono" style={{ fontSize: 11, color: echoue ? "var(--alert)" : e.status === "completed" ? "var(--success)" : "var(--text-dim)" }}>
                      {I18N.t(WL_H_STATUS[e.status] || "WL_H_PENDING")}
                    </span>
                  )}
                </div>
                <div className="flex between center" style={{ gap: 8, marginTop: 3 }}>
                  <span className="mono muted" style={{ fontSize: 11 }}>{new Date(e.at).toLocaleString()}</span>
                  {e.txid
                    ? <a className="mono" style={{ fontSize: 11, color: "var(--elec)" }} href={UNISCAN_TX + e.txid} target="_blank" rel="noopener">
                        {e.txid.slice(0, 8)}…{e.txid.slice(-6)} ↗
                      </a>
                    : retrait && !echoue && <span className="mono muted" style={{ fontSize: 11 }}>{I18N.t("WL_H_NO_TXID")}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function CopyAddr({ addr }) {
  const { toast } = useFA();
  const [done, setDone] = useState(false);
  return (
    <button className="btn ghost sm" onClick={() => {
      navigator.clipboard && navigator.clipboard.writeText(addr).catch(() => { });
      setDone(true); toast(I18N.t("WL_COPIED"), "good"); setTimeout(() => setDone(false), 1500);
    }}>
      <span className="mono" style={{ fontSize: 11 }}>{addr.slice(0, 8)}…{addr.slice(-6)}</span> · {done ? I18N.t("WL_COPIED") : I18N.t("WL_COPY")}
    </button>
  );
}

function DepositModal({ onClose }) {
  const { g, actions, toast } = useFA();
  const [txid, setTxid] = useState("");
  const [busy, setBusy] = useState(false);
  async function go() {
    const tx = txid.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(tx)) { toast(I18N.t("WL_DEP_TXID_INVALID"), "bad"); return; }
    setBusy(true);
    try {
      const resp = await fetch(`${API_URL}/verify-deposit`, {
        method: "POST", headers: { "Content-Type": "application/json", "Authorization": `Bearer ${g.authToken}` },
        body: JSON.stringify({ wallet: g.wallet, txid: tx }),
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
  return (
    <Modal onClose={onClose} accent="var(--elec)">
      <div className="eyebrow" style={{ color: "var(--elec)" }}>{I18N.t("WL_DEPOSIT")}</div>
      <div className="h2" style={{ margin: "4px 0 10px" }}>{I18N.t("WL_DEP_TXID")}</div>
      <div className="muted mono" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>{I18N.t("WL_DEP_INFO")}</div>
      <div className="mono" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 16, color: "var(--elec)", background: "rgba(0,0,0,0.25)", border: "1px solid var(--elec)", borderRadius: 6, padding: "10px 12px" }}>{I18N.t("WL_DEP_CONFIRMS")}</div>
      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: "12px 14px", marginBottom: 16 }}>
        <div className="flex between center" style={{ gap: 10 }}>
          <span className="mono muted" style={{ fontSize: 12 }}>{I18N.t("WL_REWARD_POOL")}</span>
          <CopyAddr addr="bc1qhgnfujw5f6r0hct45vmrrwuyrkh4u8npjn0p4s" />
        </div>
      </div>
      <input className="field" style={{ fontSize: 12 }} value={txid} onChange={(e) => setTxid(e.target.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 64))} placeholder={I18N.t("WL_DEP_TXID_PH")} />
      <button className="btn btn-elec block lg" style={{ marginTop: 18 }} disabled={busy} onClick={go}>{busy ? I18N.t("WL_DEP_DETECT") : I18N.t("WL_DEP_SEND")}</button>
    </Modal>
  );
}

function WithdrawModal({ onClose }) {
  const { g, actions, toast } = useFA();
  const [amt, setAmt] = useState("500");
  const [busy, setBusy] = useState(false);
  const [cdMsg, setCdMsg] = useState("");  // message cooldown persistant (1 retrait / 24h)
  async function go() {
    setCdMsg("");
    const n = parseInt(amt, 10) || 0;
    const r = actions.withdraw(n);            // validation min/max + débit optimiste client
    if (!r.ok) { toast(r.reason, "bad"); return; }
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
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${a.token}` },
        body: JSON.stringify({ wallet: g.wallet, amount: n }),
      });
      const data = await resp.json();
      if (resp.status === 401) { actions.deposit(n); toast(I18N.t("WL_WD_SIGN_NEEDED"), "bad"); return; }
      if (data.status === "ok") {
        toast(I18N.t("WL_WD_OK", n), "good");
        // Resync du solde avec le serveur (qui a déjà déduit) : l'affichage reflète
        // immédiatement le vrai solde au lieu de rester sur le débit optimiste.
        try { await actions.connectWallet(g.wallet, a.token); } catch (e) { /* best-effort */ }
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
  const pont = window.FA_ACCOUNT.cheminLiaison(
    window.FA_ACCOUNT.hasProvider(), window.FA_ACCOUNT.estNavigateurMobile()) === "unisat-app";
  return (
    <Modal onClose={onClose} accent="var(--gold)">
      <div className="eyebrow" style={{ color: "var(--gold)" }}>{I18N.t("WL_WITHDRAW")}</div>
      <div className="h2" style={{ margin: "4px 0 10px" }}>{I18N.t("WL_LIQUID")} : <span className="mono" style={{ color: "var(--gold)" }}><TokenIcon s={14} /> {fmt(g.liquid)}</span></div>
      {pont ? (
        <UnisatAppBridge mode="withdraw" />
      ) : (
        <>
          <div className="muted mono" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>{I18N.t("WL_WD_INFO")}</div>
          {cdMsg && <div className="mono" style={{ fontSize: 12, lineHeight: 1.4, marginBottom: 12, padding: "8px 10px", borderRadius: 8, background: "rgba(255,90,90,0.12)", color: "var(--alert)" }}>⏳ {cdMsg}</div>}
          <input className="field" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9]/g, ""))} placeholder="500" />
          <button className="btn btn-gold block lg" style={{ marginTop: 18 }} disabled={busy} onClick={go}>{busy ? I18N.t("WL_WD_PROC") : I18N.t("WL_WD_SEND")}</button>
        </>
      )}
    </Modal>
  );
}

/* ---------------- PERSO / VANITY ---------------- */
function Perso() {
  const { g, actions, toast } = useFA();
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
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t("PE_RENAMED"), "good"); setName("");
  }
  async function doTitle() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const r = await actions.setTitle(title.trim().slice(0, 32));
    setBusy(false);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t("PE_TITLE_SET"), "good");
  }
  return (
    <div className="container">
      <SectionHead eyebrow="VANITY SINK" title={I18N.t("PE_TITLE")} />
      <div className="subtabs">
        <button className={cx("subtab", tab === "rename" && "on")} style={{ "--c": "var(--elec)" }} onClick={() => setTab("rename")}>{I18N.t("PE_RENAME")}</button>
        <button className={cx("subtab", tab === "title" && "on")} style={{ "--c": "var(--fire)" }} onClick={() => setTab("title")}>{I18N.t("PE_TITLE_TAB")}</button>
      </div>
      {tab === "rename" ? (
        <div>
          <div className="flex gap12 center wrap" style={{ marginBottom: 16 }}>
            <input className="field" style={{ flex: 1, minWidth: 200 }} maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder={I18N.t("PE_NEW_NAME")} />
            <button className="btn btn-elec" disabled={!sel || !name.trim() || busy} onClick={doRename}>{busy ? "…" : <FaText text={I18N.t("PE_RENAME_BTN", D.ECON.VANITY_RENAME)} />}</button>
          </div>
          {!sel && <div className="mono muted" style={{ fontSize: 12, marginBottom: 12 }}>{I18N.t("PE_PICK")}</div>}
          <div className="grid-cards">
            {g.roster.map((b) => (
              <CreatureCard key={b.id} beast={b} selectable selected={sel === b.id} onClick={() => setSel(sel === b.id ? null : b.id)} />
            ))}
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: 520 }}>
          <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
            <div className="mono muted" style={{ fontSize: 12, marginBottom: 10 }}>{I18N.t("PE_NEW_TITLE")}</div>
            <input className="field" maxLength={32} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Whale · Diamond Hands · …" />
            <button className="btn btn-fire block" style={{ marginTop: 16 }} disabled={!title.trim() || busy} onClick={doTitle}>{busy ? "…" : <FaText text={I18N.t("PE_TITLE_BTN", D.ECON.VANITY_TITLE)} />}</button>
          </div>
          <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 20, marginTop: 16 }}>
            <div className="flex between center">
              <span className="h2" style={{ fontSize: 15, color: g.holderDays >= 360 ? "var(--fire)" : "var(--text)" }}>✦ {I18N.t("PE_BADGE")}</span>
              <span className="pill">{Math.min(360, g.holderDays)}/360</span>
            </div>
            <div className="muted" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.4, fontStyle: "italic" }}>{I18N.t("PE_BADGE_HINT")}</div>
            <div className="muted mono" style={{ fontSize: 12, marginTop: 8 }}>{I18N.t("PE_BADGE_DESC", g.holderDays)}</div>
            <Bar frac={g.holderDays / 360} kind="xp" className="" />
          </div>
          {/* Champion de soutien : points de lien — affichage seul en v1 (aucun
              achat par points ; ils se gagnent quand le champion sert). */}
          <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 20, marginTop: 16 }}>
            <div className="flex between center">
              <span className="h2">🔗 {I18N.t("CHAMP_POINTS")}</span>
              <span className="pill" style={{ color: "var(--elec)" }}>{g.championPoints}</span>
            </div>
            <div className="muted mono" style={{ fontSize: 11, marginTop: 6 }}>{I18N.t("CHAMP_POINTS_DESC")}</div>
          </div>
          {/* Les titres du quiz se gagnent, ils ne s'achètent pas : ils vivent
              sous le titre payant, pas à sa place. */}
          <QuizPrestige />
        </div>
      )}
    </div>
  );
}

/* ---------------- OPTIONS ---------------- */
/* « Connecter un téléphone » : émet un code de liaison bref (serveur) et le
   montre en QR + en clair. Le téléphone qui scanne devient une session du même
   compte — c'est le SEUL chemin mobile pour un compte au wallet lié, UniSat ne
   sachant pas signer pour une web app mobile (voir device-link-ui.js). */
function DeviceLinkPanel() {
  const { g, actions, toast } = useFA();
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
    if (!r.ok) { toast(I18N.t("OP_DEVLINK_ERROR"), "bad"); return; }
    setLink({ code: r.code, expiresAt: Date.now() + r.expires_in * 1000 });
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
    } catch (e) { /* presse-papier refusé : le code reste lisible à l'écran */ }
  };
  const copierCode = () => copierTexte(link.code, "OP_DEVLINK_CODE_COPIED");
  const copierLien = () => copierTexte(window.FA_DEVICE_LINK.linkUrl(window.location.origin, link.code), "OP_DEVLINK_COPIED");

  if (!g.authToken) return null;
  const svg = link && window.FA_DEVICE_LINK
    ? window.FA_DEVICE_LINK.svgQr(window.FA_DEVICE_LINK.linkUrl(window.location.origin, link.code))
    : null;

  return (
    <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 20, marginBottom: 16 }}>
      <div className="eyebrow" style={{ color: "var(--elec)", marginBottom: 8 }}>📱 {I18N.t("OP_DEVLINK_TITLE")}</div>
      <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 12 }}>{I18N.t("OP_DEVLINK_HINT")}</div>
      {!link && (
        <button className="btn btn-elec block" disabled={busy} onClick={generer}>{I18N.t("OP_DEVLINK_BTN")}</button>
      )}
      {link && (
        <div style={{ textAlign: "center" }}>
          {/* Fond blanc obligatoire : un QR sur le fond sombre du jeu ne se
              scanne pas. SVG produit par notre lib vendorisée depuis notre
              propre URL — aucun contenu tiers. */}
          {svg && <div style={{ background: "#fff", padding: 10, width: 208, margin: "0 auto", borderRadius: 6 }} dangerouslySetInnerHTML={{ __html: svg }} />}
          <div className="mono" style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1, margin: "10px 0 2px", userSelect: "all" }}>{link.code}</div>
          <div className="mono" style={{ fontSize: 10.5, color: "var(--text-dim)", marginBottom: 10 }}>{I18N.t("OP_DEVLINK_TTL", restant)}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
            <button className="btn ghost sm" onClick={copierCode}>⧉ {I18N.t("OP_DEVLINK_COPY_CODE")}</button>
            <button className="btn ghost sm" onClick={copierLien}>⧉ {I18N.t("OP_DEVLINK_COPY")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Options() {
  const { g, actions, toast } = useFA();
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
    actions.fetchQuizProfile().then((r) => {
      if (vivant && r.ok) setPrestigeAffiche(titrePrestige(r.data, litChoixTitre()));
    });
    return () => { vivant = false; };
  }, [actions]);

  function onDisconnectClick() {
    if (isGenerated) setConfirmDisconnect(true);
    else actions.disconnect();
  }

  function scan() {
    setScanState("scanning");
    setFound([]);
    setQuery("");
    fetch(`${API_URL}/vanity/ordinal-names/${g.wallet}`)
      .then((r) => r.json())
      .then((data) => { setFound(data.names || []); setScanState("done"); })
      .catch(() => { setFound([]); setScanState("done"); });
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
  const filtered = q ? found.filter((ins) => ins.name.toLowerCase().includes(q)) : found;

  return (
    <div className="container" style={{ maxWidth: 560 }}>
      <SectionHead title={I18N.t("OP_TITLE")} />

      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 20, marginBottom: 16 }}>
        <div className="eyebrow" style={{ color: "var(--fire)", marginBottom: 12 }}>{I18N.t("OP_PROFILE")}</div>

        <div className="flex between center" style={{ marginBottom: 6 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("OP_ORDINAL")}</span>
          <span className="mono" style={{ fontSize: 13, fontWeight: 700, color: g.ordinalName ? "var(--elec)" : "var(--text-faint)" }}>
            {/* Repli sur le nom décidé par le serveur (display_name) et non sur l'adresse
                du compte : pour un compte créé sans portefeuille, celle-ci a été
                fabriquée par le serveur et n'appartient pas au joueur. */}
            {(prestigeAffiche ? prestigeAffiche + " " : "")}
            {g.ordinalName
              ? ((g.playerTitle ? g.playerTitle + " " : "") + g.ordinalName)
              : (g.playerName || "—")}
          </span>
        </div>
        <div className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", marginBottom: 14 }}>{I18N.t("OP_ORDINAL_HINT")}</div>

        {scanState === "idle" && (
          <button className="btn btn-elec block" onClick={scan}>⌕ {I18N.t("OP_ORDINAL_SCAN")}</button>
        )}
        {scanState === "scanning" && (
          <div className="mono" style={{ fontSize: 12, color: "var(--elec)", textAlign: "center", padding: "14px 0", letterSpacing: 1 }}>
            ⌕ {I18N.t("OP_ORDINAL_SCANNING")}
          </div>
        )}
        {scanState === "done" && (
          <div>
            <div className="flex between center" style={{ marginBottom: 10 }}>
              <span className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>
                {found.length ? I18N.t("OP_ORDINAL_FOUND", found.length) : I18N.t("OP_ORDINAL_NONE")}
              </span>
              <button className="btn ghost sm" style={{ padding: "3px 9px" }} onClick={scan}>↻ {I18N.t("OP_ORDINAL_RESCAN")}</button>
            </div>

            {found.length > 8 && (
              <div className="flex between center" style={{ gap: 10, marginBottom: 10 }}>
                <input className="field" style={{ flex: 1, fontSize: 12, padding: "9px 12px" }} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={I18N.t("OP_ORDINAL_SEARCH")} />
                <span className="mono" style={{ fontSize: 10.5, color: "var(--text-faint)", whiteSpace: "nowrap" }}>{I18N.t("OP_ORDINAL_SHOWING", filtered.length, found.length)}</span>
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: found.length > 6 ? 290 : "none", overflowY: found.length > 6 ? "auto" : "visible", paddingRight: found.length > 6 ? 4 : 0, scrollbarWidth: "thin", scrollbarColor: "var(--line) transparent" }}>
              {filtered.length === 0 && (
                <div className="mono" style={{ fontSize: 12, color: "var(--text-faint)", textAlign: "center", padding: "12px 0" }}>{I18N.t("OP_ORDINAL_NOMATCH")}</div>
              )}
              {filtered.map((ins) => {
                const sel = g.ordinalName === ins.name;
                return (
                  <button key={ins.name} onClick={() => selectName(ins.name)} className="oct-sm" style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    textAlign: "left", padding: "11px 14px", cursor: "pointer", flex: "none",
                    background: sel ? "color-mix(in srgb, var(--elec) 14%, var(--bg-panel))" : "rgba(255,255,255,0.022)",
                    border: `1px solid ${sel ? "var(--elec)" : "var(--line)"}`,
                    boxShadow: sel ? "0 0 18px color-mix(in srgb, var(--elec) 25%, transparent)" : "none",
                  }}>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 700, color: sel ? "var(--elec)" : "var(--text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ins.name}</span>
                      <span className="mono" style={{ fontSize: 10, color: "var(--text-dim)" }}>{I18N.t("OP_ORDINAL_INSCR")} #{ins.number} · {ins.sats} sats</span>
                    </span>
                    <span style={{ flex: "none", width: 20, height: 20, borderRadius: "50%", border: `1px solid ${sel ? "var(--elec)" : "var(--line)"}`, background: sel ? "var(--elec)" : "transparent", color: "#06101a", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{sel ? "✓" : ""}</span>
                  </button>
                );
              })}
            </div>

            <button onClick={useAddress} className="oct-sm" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, width: "100%",
              textAlign: "left", padding: "11px 14px", cursor: "pointer", marginTop: 8,
              background: !g.ordinalName ? "color-mix(in srgb, var(--text-dim) 14%, var(--bg-panel))" : "rgba(255,255,255,0.022)",
              border: `1px solid ${!g.ordinalName ? "var(--text-dim)" : "var(--line)"}`,
            }}>
              <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("OP_ORDINAL_USE_ADDR")}</span>
              <span style={{ flex: "none", width: 20, height: 20, borderRadius: "50%", border: `1px solid ${!g.ordinalName ? "var(--text-dim)" : "var(--line)"}`, background: !g.ordinalName ? "var(--text-dim)" : "transparent", color: "#06101a", display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{!g.ordinalName ? "✓" : ""}</span>
            </button>
          </div>
        )}

        <div className="flex between center" style={{ gap: 14, borderTop: "1px solid var(--line-soft)", paddingTop: 12, marginTop: 14 }}>
          <span className="mono" style={{ fontSize: 12, color: "var(--text-dim)" }}>{I18N.t("OP_WALLET_ADDR")}</span>
          {g.wallet ? <CopyAddr addr={g.wallet} /> : <span className="mono muted" style={{ fontSize: 12 }}>—</span>}
        </div>
      </div>

      <DeviceLinkPanel />

      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>
        <Row label={I18N.t("OP_LANG")}>
          <div className="lang-switch">
            {langs.map(([code, lbl]) => (
              <button key={code} className={g.lang === code ? "on" : ""} onClick={() => actions.setLang(code)}>{lbl}</button>
            ))}
          </div>
        </Row>
        <Row label={I18N.t("OP_SOUND")}>
          <Toggle on={g.options.sound} onClick={() => actions.setOption("sound", !g.options.sound)} />
        </Row>
      </div>
      <div className="flex gap12" style={{ marginTop: 18 }}>
        <button className="btn ghost" style={{ flex: 1 }} onClick={onDisconnectClick}>{I18N.t("OP_DISCONNECT")}</button>
      </div>

      {confirmDisconnect && (
        <Modal onClose={() => setConfirmDisconnect(false)} accent="var(--alert)">
          <div className="h1" style={{ fontSize: 20, color: "var(--alert)", marginBottom: 12 }}>{I18N.t("ACC_DISCONNECT_CONFIRM_TITLE")}</div>
          {/* Un compte généré au portefeuille LIÉ n'est plus « sans wallet » —
              mais le portefeuille ne sert qu'aux retraits, PAS à se reconnecter
              (refus serveur volontaire, auth.js « compte_reserve_au_retrait ») :
              le code de récupération reste la seule clé de retour. Dire l'ancien
              texte à un joueur qui vient de lier ferait douter la liaison. */}
          <div className="mono" style={{ fontSize: 13, lineHeight: 1.6, color: "var(--text-dim)", marginBottom: 20 }}>
            {I18N.t(g.linkedWallet ? "ACC_DISCONNECT_CONFIRM_BODY_LINKED" : "ACC_DISCONNECT_CONFIRM_BODY")}
          </div>
          <div className="flex gap8" style={{ flexWrap: "wrap" }}>
            <button className="btn btn-alert" onClick={() => { setConfirmDisconnect(false); actions.disconnect(); }}>{I18N.t("ACC_DISCONNECT_CONFIRM_BTN")}</button>
            <button className="btn ghost" onClick={() => setConfirmDisconnect(false)}>{I18N.t("ACC_DISCONNECT_CANCEL")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function Row({ label, children }) {
  return (
    <div className="flex between center" style={{ gap: 16 }}>
      <span className="mono" style={{ fontSize: 13, color: "var(--text-dim)" }}>{label}</span>
      {children}
    </div>
  );
}
function Toggle({ on, onClick }) {
  return (
    <span onClick={onClick} style={{ cursor: "pointer", width: 46, height: 24, background: on ? "var(--elec)" : "#1a2238", position: "relative", borderRadius: 12, transition: "background .2s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 25 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
    </span>
  );
}

Object.assign(window, { Team, Forge, Boosts, Wallet, Perso, Options });
