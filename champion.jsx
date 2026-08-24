/* ==== FRACTAL ARENA — Champion de soutien : composants ====
   Rangée « Champions alliés » (Campagne/Tour), tuile d'emprunt, modale
   « ton champion a servi ». Helpers purs dans champion-ui.js. */
const D = window.FA_DATA, I18N = window.FA_I18N;
const CU = window.FA_CHAMPION_UI;
const { Modal, Bar, FaText } = window;

/* Tuile d'un champion empruntable : art + pseudo du PRÊTEUR + entité en corps.
   Jamais de rareté/niveau sur la vignette (règle du lot cartes) — tout en corps. */
function ChampionTile({ entry, active, disabled, onClick, hpFrac }) {
  const b = entry.beast;
  const rc = D.RARITY_COLORS[b.rarity];
  return (
    <button className="panel oct" disabled={disabled} onClick={onClick}
      style={{
        border: "1px solid " + (active ? "var(--elec)" : "var(--line)"),
        padding: 8, textAlign: "center", cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1, position: "relative",
      }}>
      {active && (
        <span className="mono" style={{ position: "absolute", top: 4, left: 4, fontSize: 9, padding: "1px 5px", borderRadius: 4, background: "var(--elec)", color: "#03121a", fontWeight: 700 }}>
          AR
        </span>
      )}
      <div style={{ position: "relative", width: 56, height: 56, margin: "0 auto", borderRadius: 8, overflow: "hidden", background: "#0b1020", border: "1px solid " + rc }}>
        {D.ART[b.image_key] && <img src={D.artFor(b)} alt="" draggable="false" style={{ width: "100%", height: "100%", objectFit: "contain", filter: disabled ? "grayscale(1)" : "none" }}
          onError={(e) => { const fb = D.ART[b.image_key]; if (fb && !e.currentTarget.dataset.fb) { e.currentTarget.dataset.fb = "1"; e.currentTarget.src = fb; } }} />}
        {disabled && <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: 22 }}>☠</span>}
      </div>
      <div className="mono" style={{ fontSize: 10, marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--elec)" }}>
        {entry.name}
      </div>
      <div className="mono" style={{ fontSize: 10, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--text-dim)" }}>
        {b.name} · LV{b.level}
      </div>
      {hpFrac != null && <div style={{ marginTop: 3 }}><Bar frac={disabled ? 0 : hpFrac} kind="hp" /></div>}
    </button>
  );
}

/* Rangée « Champions alliés » — Campagne et Tour. runState (Tour) grise un
   champion tombé dans le run courant. Re-cliquer la tuile active la retire. */
function ChampionRow({ champions, activeOwner, onPick, onClear, runState }) {
  const list = Array.isArray(champions) ? champions : [];
  return (
    <div style={{ marginTop: 10 }}>
      <div className="h2" style={{ fontSize: 13, color: "var(--elec)", marginBottom: 6 }}>{I18N.t("CHAMP_ROW_TITLE")}</div>
      {list.length === 0
        ? <div className="muted mono" style={{ fontSize: 11 }}>{I18N.t("CHAMP_EMPTY")}</div>
        : <div className="champ-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 8 }}>
            {list.map((entry) => {
              const active = activeOwner === entry.owner_wallet;
              const st = runState ? CU.championRunState(runState, entry.beast.id) : null;
              return <ChampionTile key={entry.owner_wallet} entry={entry} active={active}
                disabled={!!(st && st.dead)} hpFrac={st ? st.hpFrac : null}
                onClick={() => (active ? onClear() : onPick(entry))} />;
            })}
          </div>}
      {activeOwner && (
        <button className="btn sm" style={{ marginTop: 6 }} onClick={onClear}>{I18N.t("CHAMP_CLEAR")}</button>
      )}
    </div>
  );
}

/* Modale de reconnexion : « ⚔️ Ton champion a servi » — agrégée par jour
   (patron PrizeModal). onSeen → POST /champion/uses/seen. */
function ChampionUsesModal({ uses, onSeen }) {
  const agg = CU.aggregateUsesByDay(uses);
  return (
    <Modal accent="var(--gold)" onClose={onSeen}>
      <div className="h2" style={{ color: "var(--gold, #F7931A)", marginBottom: 12 }}>⚔️ {I18N.t("CHAMP_USES_TITLE")}</div>
      {agg.map((a) => (
        <div key={a.day} className="panel oct" style={{ padding: 12, marginBottom: 8, border: "1px solid var(--line)" }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--text-dim)" }}>{a.day}</div>
          <div style={{ fontSize: 13 }}><FaText text={I18N.t("CHAMP_USES_LINE", a.fights, a.commission, a.points)} /></div>
          {a.names.length > 0 && (
            <div className="muted mono" style={{ fontSize: 11, marginTop: 2 }}>{I18N.t("CHAMP_USES_BY", a.names.join(", "))}</div>
          )}
        </div>
      ))}
      <button className="btn btn-elec block" onClick={onSeen}>OK</button>
    </Modal>
  );
}

Object.assign(window, { ChampionRow, ChampionTile, ChampionUsesModal });
