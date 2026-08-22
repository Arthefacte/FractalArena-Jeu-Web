/* ============================================================
   FRACTAL ARENA — Écran « Lien » : détail du Totem (Capitaine)
   Affichage seul (le Totem est déterministe par wallet). Atteint
   au clic du slot Capitaine de l'écran Équipe (hors barre de nav).
   ============================================================ */
const I18N = window.FA_I18N;
const { useFA, SectionHead } = window;

// Écran-héros : tout est CENTRÉ (retour user 2026-08-22 : la colonne brute
// alignée à gauche « penchait », sans espacement). Les stats passent de la
// liste à puces à une grille de panneaux 2×2, l'aura en pleine largeur.
const statCell = {
  background: "var(--bg-panel)", border: "1px solid var(--line)",
  borderRadius: 10, padding: "10px 12px", fontSize: 13, lineHeight: 1.5,
};

function Link() {
  const { g, actions } = useFA();
  const TU = window.FA_TOTEM_UI;
  const t = g.totem;
  const dormant = !t || t.tier <= 0;
  return (
    <div className="container link-screen" style={{ maxWidth: 620, textAlign: "center" }}>
      <SectionHead eyebrow={"◈ " + I18N.t("LINK_CAPTAIN")} title={I18N.t("LINK_TITLE")} />
      <img alt="Totem"
           src={t ? TU.totemArt(t) : "assets/HASHBYTE.webp"}
           onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = t ? TU.totemArtFallback(t.type) : "assets/HASHBYTE.webp"; }}
           style={{ width: 140, height: 140, borderRadius: 14, display: "block", margin: "0 auto",
                    filter: dormant ? "grayscale(1) opacity(0.5)" : "drop-shadow(0 0 18px rgba(247,147,26,0.25))" }} />
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>{t ? t.type : "—"}</div>
      <div style={{ opacity: 0.85, marginTop: 2 }}>{I18N.t("LINK_TIER")} {t ? t.tier : 0} · {TU.tierName(t ? t.tier : 0)}</div>
      {t && t.canInvoke && (
        <button
          style={{ margin: "16px auto 0", display: "block", padding: "12px 22px", fontWeight: 800, fontSize: 16,
                   background: "linear-gradient(90deg,#F7931A,#00F0FF)", color: "#05070f",
                   border: "none", borderRadius: 10, cursor: "pointer" }}
          onClick={() => {
            const img = (t.artByTier && t.artByTier[t.tier]) || TU.totemArtFallback(t.type);
            const tier = t.tier;
            window.FA_TOTEM_CINE.play({
              imageUrl: img,
              fallbackUrl: TU.totemArtFallback(t.type),
              onDone: () => actions.invokeTotem(tier),
            });
          }}
        >{I18N.t("TOTEM_INVOKE_BTN")}</button>
      )}
      {dormant && <p style={{ color: "var(--alert, #e55)", marginTop: 14 }}>{I18N.t("LINK_DORMANT_HINT")}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20, textAlign: "center" }}>
        <div style={statCell}>{I18N.t("LINK_LOYALTY", t ? t.loyaltyDays : 0)}</div>
        <div style={statCell}>{I18N.t("LINK_WORLDS", t ? t.worldsCompleted : 0)}</div>
        <div style={statCell}>{I18N.t("LINK_WINS", t ? t.paidWins : 0)}</div>
        <div style={{ ...statCell, gridColumn: "1 / -1" }}>{I18N.t("LINK_AURA")} : {TU.auraSummary(t ? t.aura : null)}</div>
      </div>
      {(() => {
        const items = TU.galleryItems(t);
        if (items.length < 2) return null; // galerie utile à partir de 2 images révélées
        return (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontWeight: 700 }}>{I18N.t("TOTEM_GALLERY_TITLE")}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>{I18N.t("TOTEM_GALLERY_COSMETIC")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
              {items.map((it) => (
                <img key={it.tier} alt={TU.tierName(it.tier)} src={it.url}
                     onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = TU.totemArtFallback(t.type); }}
                     onClick={() => actions.pickTotemImage(it.tier)}
                     style={{ width: 64, height: 64, borderRadius: 8, cursor: "pointer",
                              border: (t.displayTier === it.tier) ? "2px solid var(--gold,#F7931A)" : "2px solid transparent" }} />
              ))}
            </div>
          </div>
        );
      })()}
      <button className="btn ghost sm" style={{ marginTop: 24 }} onClick={() => actions.setView("team")}>{I18N.t("LINK_BACK")}</button>
    </div>
  );
}
Object.assign(window, { Link });
