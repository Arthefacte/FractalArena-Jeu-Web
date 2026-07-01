/* ============================================================
   FRACTAL ARENA — Team / Forge / Boosts / Wallet / Perso / Options
   ============================================================ */
const { useState, useEffect, useMemo } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { useFA, cx, fmt, presetLabel, rarityLabel, Bar, StatGrid, CreatureCard, Modal, SectionHead, MiniStats, RelicIcon } = window;
const API_URL = "https://fractal-arena-server-production.up.railway.app";

/* ---------------- TEAM ---------------- */
function Team() {
  const { g, actions, toast } = useFA();
  const sorted = useMemo(() => {
    return g.roster.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity] || b.level - a.level);
  }, [g.roster]);
  const selCount = g.selected.length;

  function toggle(b) {
    if (g.selected.includes(b.id)) actions.toggleSelect(b.id);
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
                 src={t ? TU.totemArt(t) : "assets/HASHBYTE.png"}
                 onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = t ? TU.totemArtFallback(t.type) : "assets/HASHBYTE.png"; }}
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
        {sorted.map((b) => (
          <div key={b.id} style={{ display: "flex", flexDirection: "column" }}>
            <CreatureCard beast={b} selectable selected={g.selected.includes(b.id)} onClick={() => toggle(b)} showXp />
            <RelicSlot beast={b} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RelicSlot({ beast }) {
  const { g, actions, toast } = useFA();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
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
    if (!r.ok) { toast(r.reason, "bad"); return; }
    if (r.success) {
      if (r.result?.premium) toast(I18N.t("FG_FUSE_PREMIUM", rarityLabel(r.result?.rarity)), "good");
      else toast(I18N.t("FG_FUSE_OK", rarityLabel(r.result?.rarity)), "good");
    }
    else toast(I18N.t("FG_FUSE_FAIL"), "bad");
    setSel([]);
  }
  const cost = first ? D.FORGE.FUSION_COST[first.rarity] : 0;
  const rate = first ? D.FORGE.FUSION_RATE[first.rarity] : 0;
  const canFuse = sel.length === 2;
  const balOk = (g.liquid + g.locked) >= cost;

  return (
    <div>
      <div className="flex between center wrap" style={{ marginBottom: 16, gap: 10 }}>
        <div className="mono muted" style={{ fontSize: 13 }}>{first ? I18N.t("FG_PICK_SAME", rarityLabel(first.rarity)) : I18N.t("FG_FUSION_HINT")}</div>
        {canFuse && (
          <div className="flex gap12 center">
            <span className="pill" style={{ color: "var(--elec)" }}>{I18N.t("FG_SUCCESS_RATE")} {Math.round(rate * 100)}%</span>
            <span className="pill" style={{ color: "var(--gold)", cursor: "pointer", opacity: g.ticketsGold >= 1 ? 1 : 0.4, border: goldMode ? "1px solid var(--gold)" : undefined }}
              onClick={() => g.ticketsGold >= 1 && setGoldMode(!goldMode)}>
              🎟 {I18N.t("FG_GOLD")} {goldMode ? "✓" : ""}
            </span>
            <button className={cx("btn", goldMode ? "btn-gold" : "btn-forge")} disabled={!balOk || fuseBusy} onClick={() => doFuse(goldMode)}>{fuseBusy ? "…" : I18N.t("FG_FUSE_BTN", cost)}</button>
          </div>
        )}
      </div>
      {!balOk && canFuse && <div className="mono" style={{ color: "var(--alert)", fontSize: 12, marginBottom: 10 }}>{I18N.t("INSUFFICIENT", g.liquid + g.locked, cost)}</div>}
      <div className="grid-cards">
        {sorted.map((b) => (
          <div key={b.id} style={{ opacity: clickable(b) ? 1 : 0.32, pointerEvents: clickable(b) ? "auto" : "none", transition: "opacity .2s" }}>
            <CreatureCard beast={b} selectable selected={sel.includes(b.id)} onClick={() => toggle(b)} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RerollPreviewModal({ preview, busy, onValidate, onAgain, onKeep }) {
  const { Modal } = window;
  const F = window.FA_FORGE_UI;
  const rows = F.rerollDiff(preview.old_stats, preview.new_stats);
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
          <span key={r.key + "l"} className="mono" style={{ fontSize: 13 }}>{r.label}</span>,
          <span key={r.key + "f"} className="mono" style={{ fontSize: 13, textAlign: "right", color: "var(--text-dim)" }}>{r.from}</span>,
          <span key={r.key + "t"} className="mono" style={{ fontSize: 13, textAlign: "right", color: color(r.dir) }}>{r.to} {arrow(r.dir)}</span>,
        ])}
      </div>
      <div className="mono muted" style={{ fontSize: 11, marginBottom: 14 }}>{I18N.t("REROLL_REFUND_HINT")}</div>
      <div className="flex gap8" style={{ flexWrap: "wrap" }}>
        <button className="btn btn-success" disabled={busy} onClick={onValidate}>{I18N.t("REROLL_VALIDATE")}</button>
        <button className="btn btn-elec" disabled={busy} onClick={onAgain}>{I18N.t("REROLL_AGAIN", preview.next_reroll_cost || 0)}</button>
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
  const beast = sel ? g.roster.find((b) => b.id === sel) : null;
  const cost = beast ? Math.round(D.FORGE.REROLL_BASE[beast.rarity] * (1 + 0.5 * beast.reroll_count)) : 0;
  const balOk = (g.liquid + g.locked) >= cost;
  async function doReroll() {
    if (rerollBusy) return;
    setRerollBusy(true);
    const r = await actions.reroll(sel);
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
    const r = await actions.reroll(sel);
    setRerollBusy(false);
    if (!r.ok) { toast(r.reason, "bad"); setPreview(null); return; }
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
            <button className="btn btn-elec" disabled={!balOk || rerollBusy} onClick={doReroll}>{rerollBusy ? "…" : I18N.t("FG_REROLL_BTN", cost)}</button>
          </div>
        )}
      </div>
      {!balOk && beast && <div className="mono" style={{ color: "var(--alert)", fontSize: 12, marginBottom: 10 }}>{I18N.t("INSUFFICIENT", g.liquid + g.locked, cost)}</div>}
      <div className="grid-cards">
        {g.roster.slice().sort((a, b) => D.RARITY_ORDER[b.rarity] - D.RARITY_ORDER[a.rarity]).map((b) => (
          <CreatureCard key={b.id} beast={b} selectable selected={sel === b.id} onClick={() => setSel(sel === b.id ? null : b.id)} />
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
    setLast(r.beast);
    toast(I18N.t("FG_SUMMON_OK", D.displayName(r.beast), rarityLabel(r.beast.rarity)), "good");
  }
  const odds = [["Common", 70], ["Rare", 20], ["Epic", 8], ["Legendary", 2]];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 26, alignItems: "start" }} className="summon-grid">
      <div>
        <div className="mono muted" style={{ fontSize: 13, marginBottom: 16 }}>{I18N.t("FG_SUMMON_HINT")}</div>
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
          <button className="btn btn-fire block lg" disabled={!balOk || rolling} onClick={doSummon}>{rolling ? "…" : I18N.t("FG_SUMMON_BTN", cost)}</button>
        </div>
      </div>
      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 18, minHeight: 300, display: "grid", placeItems: "center" }}>
        {rolling ? (
          <div className="mono" style={{ color: "var(--fire)", fontSize: 13, letterSpacing: 2 }}>FORGING…</div>
        ) : last ? (
          <div style={{ width: "100%" }}>
            <div className="eyebrow" style={{ textAlign: "center", marginBottom: 10, color: D.RARITY_COLORS[last.rarity] }}>{I18N.t("MINT_TITLE") || "FORGED"}</div>
            <CreatureCard beast={last} />
          </div>
        ) : (
          <div className="mono" style={{ color: "var(--text-faint)", fontSize: 12, textAlign: "center" }}>⬡<br />{I18N.t("FG_SUMMON")}</div>
        )}
      </div>
    </div>
  );
}

function ForgeReliques() {
  const { g, actions, toast } = useFA();
  const [last, setLast] = useState(null);
  const [rolling, setRolling] = useState(false);
  const cost = 8000;
  const balOk = (g.liquid + g.locked) >= cost;
  async function doSummon() {
    if (!balOk || rolling) return;
    setRolling(true); setLast(null);
    const r = await actions.relicSummon();
    setRolling(false);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    setLast(r.relic);
    toast(I18N.t("FG_SUMMON_OK", I18N.t("RELIC_" + r.relic.type.toUpperCase()), rarityLabel(r.relic.rarity)), "good");
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
            <button className="btn btn-gold block lg" disabled={!balOk || rolling} onClick={doSummon}>{rolling ? "…" : I18N.t("FG_SUMMON_BTN", cost)}</button>
          </div>
        </div>
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 18, minHeight: 300, display: "grid", placeItems: "center" }}>
          {rolling ? (
            <div className="mono" style={{ color: "var(--gold)", fontSize: 13, letterSpacing: 2 }}>FORGING…</div>
          ) : last ? (
            <div style={{ width: "100%", textAlign: "center" }}>
              <div className="eyebrow" style={{ marginBottom: 10, color: D.RARITY_COLORS[last.rarity] }}>{I18N.t("MINT_TITLE") || "FORGED"}</div>
              <div style={{ margin: "0 auto 12px", display: "flex", justifyContent: "center" }}><RelicIcon type={last.type} rarity={last.rarity} size={48} /></div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{I18N.t("RELIC_" + last.type.toUpperCase())}</div>
              <div style={{ color: D.RARITY_COLORS[last.rarity], fontWeight: 600, marginTop: 4 }}>{rarityLabel(last.rarity)}</div>
              <div className="mono muted" style={{ fontSize: 13, marginTop: 8 }}>{D.relicStatDelta(D.relicEffect(last.type, last.rarity))}</div>
            </div>
          ) : (
            <div className="mono" style={{ color: "var(--text-faint)", fontSize: 12, textAlign: "center" }}>⬡<br />{I18N.t("RELIC_SUMMON")}</div>
          )}
        </div>
      </div>
      <div style={{ marginTop: 26 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>{I18N.t("RELIC_INVENTORY")}</div>
        {g.equipment.length === 0 ? (
          <div className="mono muted" style={{ fontSize: 13 }}>{I18N.t("RELIC_NONE")}</div>
        ) : (
          <div className="grid-cards">
            {g.equipment.map((inst) => {
              const holder = g.roster.find((b) => b.relic_id === inst.id);
              const effect = D.relicEffect(inst.type, inst.rarity);
              return (
                <div key={inst.id} className="panel oct" style={{ border: `1px solid ${D.RARITY_COLORS[inst.rarity]}`, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
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
    </div>
  );
}

/* ---------------- BOOSTS ---------------- */
function Boosts() {
  const { g, actions, toast } = useFA();
  const items = [
    { key: "xp_boost", name: I18N.t("BO_XP_NAME"), desc: I18N.t("BO_XP_DESC"), color: "var(--gold)", remaining: g.boosts.xp_boost, unit: "fights" },
    { key: "insurance", name: I18N.t("BO_INS_NAME"), desc: I18N.t("BO_INS_DESC"), color: "var(--success)", remaining: g.boosts.insurance, unit: "charges" },
    { key: "lucky_strike", name: I18N.t("BO_LUCKY_NAME"), desc: I18N.t("BO_LUCKY_DESC"), color: "var(--fire)", remaining: g.boosts.lucky_strike, unit: "fights" },
  ];
  const [buyingKey, setBuyingKey] = useState(null);
  async function buy(key) {
    if (buyingKey) return;
    setBuyingKey(key);
    const r = await actions.buyBoost(key);
    setBuyingKey(null);
    if (!r.ok) { toast(r.reason, "bad"); return; }
    toast(I18N.t("BO_BOUGHT"), "good");
  }
  return (
    <div className="container">
      <SectionHead eyebrow={I18N.t("BO_SUB")} title={I18N.t("BO_TITLE")} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 16 }}>
        {items.map((it) => {
          const def = D.BOOSTS[it.key];
          const active = it.remaining > 0;
          return (
            <div key={it.key} className="panel oct" style={{ border: `1px solid ${active ? it.color : "var(--line)"}`, padding: 20, display: "flex", flexDirection: "column", gap: 12, boxShadow: active ? `0 0 24px color-mix(in srgb, ${it.color} 22%, transparent)` : "none" }}>
              <div className="flex between center">
                <span className="h2" style={{ color: it.color, fontSize: 17 }}>{it.name}</span>
                {active && <span className="pill" style={{ color: it.color, borderColor: it.color }}>{I18N.t("BO_ACTIVE", it.remaining)}</span>}
              </div>
              <div className="muted" style={{ fontSize: 13, lineHeight: 1.5, minHeight: 56 }}>{it.desc}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>{it.unit === "fights" ? `${def.fights || def.charges} combats` : `${def.charges} charges`}</div>
              <button className="btn block" style={{ "--c": it.color, marginTop: "auto" }} disabled={!!buyingKey} onClick={() => buy(it.key)}>{buyingKey === it.key ? "…" : I18N.t("BO_BUY", def.cost)}</button>
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
  return (
    <div className="container">
      <SectionHead eyebrow="FRACTALARENA" title={I18N.t("WL_TITLE")} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }} className="wallet-grid">
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>{I18N.t("WL_LIQUID")}</div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 700, color: "var(--gold)", margin: "6px 0" }}>{fmt(g.liquid)}</div>
          <div className="muted mono" style={{ fontSize: 12 }}>{I18N.t("WL_LIQUID_DESC")}</div>
        </div>
        <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22 }}>
          <div className="eyebrow" style={{ color: "var(--fire)" }}>{I18N.t("WL_LOCKED")}</div>
          <div className="mono" style={{ fontSize: 36, fontWeight: 700, color: "var(--fire)", margin: "6px 0" }}>{fmt(g.locked)}</div>
          <div className="muted mono" style={{ fontSize: 12 }}>{I18N.t("WL_LOCKED_DESC")}</div>
        </div>
      </div>
      <div className="flex gap16" style={{ marginTop: 18 }}>
        <button className="btn btn-elec lg" style={{ flex: 1 }} onClick={() => setModal("deposit")}>↓ {I18N.t("WL_DEPOSIT")}</button>
        <button className="btn btn-gold lg" style={{ flex: 1 }} onClick={() => setModal("withdraw")}>↑ {I18N.t("WL_WITHDRAW")}</button>
      </div>

      {modal === "deposit" && <DepositModal onClose={() => setModal(null)} />}
      {modal === "withdraw" && <WithdrawModal onClose={() => setModal(null)} />}
    </div>
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
      if (!a.ok) { actions.deposit(n); toast(I18N.t("WL_WD_SIGN_NEEDED"), "bad"); return; }

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
  return (
    <Modal onClose={onClose} accent="var(--gold)">
      <div className="eyebrow" style={{ color: "var(--gold)" }}>{I18N.t("WL_WITHDRAW")}</div>
      <div className="h2" style={{ margin: "4px 0 10px" }}>{I18N.t("WL_LIQUID")} : <span className="mono" style={{ color: "var(--gold)" }}>{fmt(g.liquid)}</span></div>
      <div className="muted mono" style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>{I18N.t("WL_WD_INFO")}</div>
      {cdMsg && <div className="mono" style={{ fontSize: 12, lineHeight: 1.4, marginBottom: 12, padding: "8px 10px", borderRadius: 8, background: "rgba(255,90,90,0.12)", color: "var(--alert)" }}>⏳ {cdMsg}</div>}
      <input className="field" value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9]/g, ""))} placeholder="500" />
      <button className="btn btn-gold block lg" style={{ marginTop: 18 }} disabled={busy} onClick={go}>{busy ? I18N.t("WL_WD_PROC") : I18N.t("WL_WD_SEND")}</button>
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
            <button className="btn btn-elec" disabled={!sel || !name.trim() || busy} onClick={doRename}>{busy ? "…" : I18N.t("PE_RENAME_BTN", D.ECON.VANITY_RENAME)}</button>
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
            <button className="btn btn-fire block" style={{ marginTop: 16 }} disabled={!title.trim() || busy} onClick={doTitle}>{busy ? "…" : I18N.t("PE_TITLE_BTN", D.ECON.VANITY_TITLE)}</button>
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
        </div>
      )}
    </div>
  );
}

/* ---------------- OPTIONS ---------------- */
function Options() {
  const { g, actions, toast } = useFA();
  const [scanState, setScanState] = useState("idle"); // idle | scanning | done
  const [found, setFound] = useState([]);
  const [query, setQuery] = useState("");
  const langs = [["FR", "Français"], ["EN", "English"], ["ZH", "中文"]];

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
            {g.ordinalName
              ? ((g.playerTitle ? g.playerTitle + " " : "") + g.ordinalName)
              : (g.wallet ? (g.wallet.slice(0, 6) + "…" + g.wallet.slice(-4)) : "—")}
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

      <div className="panel oct" style={{ border: "1px solid var(--line)", padding: 22, display: "flex", flexDirection: "column", gap: 20 }}>
        <Row label={I18N.t("OP_LANG")}>
          <div className="lang-switch">
            {langs.map(([code, lbl]) => (
              <button key={code} className={g.lang === code ? "on" : ""} onClick={() => actions.setLang(code)}>{lbl}</button>
            ))}
          </div>
        </Row>
        <Row label={I18N.t("OP_ANIM")}>
          <Toggle on={g.options.anim} onClick={() => actions.setOption("anim", !g.options.anim)} />
        </Row>
        <Row label={I18N.t("OP_SOUND")}>
          <Toggle on={g.options.sound} onClick={() => actions.setOption("sound", !g.options.sound)} />
        </Row>
      </div>
      <div className="flex gap12" style={{ marginTop: 18 }}>
        <button className="btn ghost" style={{ flex: 1 }} onClick={() => { actions.disconnect(); }}>{I18N.t("OP_DISCONNECT")}</button>
      </div>
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
