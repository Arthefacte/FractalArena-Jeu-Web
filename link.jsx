/* ============================================================
   FRACTAL ARENA — Écran « Lien » : détail du Totem (Capitaine)
   Affichage seul (le Totem est déterministe par wallet). Atteint
   au clic du slot Capitaine de l'écran Équipe (hors barre de nav).
   ============================================================ */
const I18N = window.FA_I18N;
const { useFA } = window;

function Link() {
  const { g, actions } = useFA();
  const TU = window.FA_TOTEM_UI;
  const t = g.totem;
  const dormant = !t || t.tier <= 0;
  return (
    <div className="screen link-screen" style={{ maxWidth: 560, margin: "0 auto" }}>
      <h2>{I18N.t("LINK_TITLE")}</h2>
      <div style={{ display: "flex", gap: 16, alignItems: "center", margin: "12px 0" }}>
        <img alt="Totem"
             src={t ? TU.totemArt(t) : "assets/HASHBYTE.png"}
             onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = t ? TU.totemArtFallback(t.type) : "assets/HASHBYTE.png"; }}
             style={{ width: 120, height: 120, borderRadius: 12,
                      filter: dormant ? "grayscale(1) opacity(0.5)" : "none" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{t ? t.type : "—"}</div>
          <div style={{ opacity: 0.85 }}>{I18N.t("LINK_TIER")} {t ? t.tier : 0} · {TU.tierName(t ? t.tier : 0)}</div>
        </div>
      </div>
      {t && t.canInvoke && (
        <button
          style={{ margin: "8px 0", padding: "12px 18px", fontWeight: 800, fontSize: 16,
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
      {dormant && <p style={{ color: "var(--alert, #e55)" }}>{I18N.t("LINK_DORMANT_HINT")}</p>}
      <ul style={{ lineHeight: 1.8 }}>
        <li>{I18N.t("LINK_LOYALTY", t ? t.loyaltyDays : 0)}</li>
        <li>{I18N.t("LINK_WORLDS", t ? t.worldsCompleted : 0)}</li>
        <li>{I18N.t("LINK_WINS", t ? t.paidWins : 0)}</li>
        <li>{I18N.t("LINK_AURA")} : {TU.auraSummary(t ? t.aura : null)}</li>
      </ul>
      {(() => {
        const items = TU.galleryItems(t);
        if (items.length < 2) return null; // galerie utile à partir de 2 images révélées
        return (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontWeight: 700 }}>{I18N.t("TOTEM_GALLERY_TITLE")}</div>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 6 }}>{I18N.t("TOTEM_GALLERY_COSMETIC")}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {items.map((it) => (
                <img key={it.tier} alt={TU.tierName(it.tier)} src={it.url}
                     onClick={() => actions.pickTotemImage(it.tier)}
                     style={{ width: 64, height: 64, borderRadius: 8, cursor: "pointer",
                              border: (t.displayTier === it.tier) ? "2px solid var(--gold,#F7931A)" : "2px solid transparent" }} />
              ))}
            </div>
          </div>
        );
      })()}
      <button className="btn ghost sm" style={{ marginTop: 16 }} onClick={() => actions.setView("team")}>{I18N.t("LINK_BACK")}</button>
    </div>
  );
}
Object.assign(window, { Link });
