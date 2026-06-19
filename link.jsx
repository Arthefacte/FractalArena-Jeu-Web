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
             onError={(e) => { e.currentTarget.src = t ? TU.totemArtFallback(t.type) : "assets/HASHBYTE.png"; }}
             style={{ width: 120, height: 120, borderRadius: 12,
                      filter: dormant ? "grayscale(1) opacity(0.5)" : "none" }} />
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{t ? t.type : "—"}</div>
          <div style={{ opacity: 0.85 }}>{I18N.t("LINK_TIER")} {t ? t.tier : 0} · {TU.tierName(t ? t.tier : 0)}</div>
        </div>
      </div>
      {dormant && <p style={{ color: "var(--alert, #e55)" }}>{I18N.t("LINK_DORMANT_HINT")}</p>}
      <ul style={{ lineHeight: 1.8 }}>
        <li>{I18N.t("LINK_LOYALTY", t ? t.loyaltyDays : 0)}</li>
        <li>{I18N.t("LINK_WORLDS", t ? t.worldsCompleted : 0)}</li>
        <li>{I18N.t("LINK_WINS", t ? t.paidWins : 0)}</li>
        <li>{I18N.t("LINK_AURA")} : {TU.auraSummary(t ? t.aura : null)}</li>
      </ul>
      <button onClick={() => actions.setView("team")}>{I18N.t("LINK_BACK")}</button>
    </div>
  );
}
Object.assign(window, { Link });
