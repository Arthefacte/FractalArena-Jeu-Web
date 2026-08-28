/* ============================================================
   FRACTAL ARENA — Marché (hôtel des ventes reliques)
   Deux volets : Parcourir (achat) / Mes ventes (lister, annuler,
   récupérer, historique). Resync du save après chaque mutation.
   ============================================================ */
const { useState, useEffect } = React;
const D = window.FA_DATA, I18N = window.FA_I18N;
const { useFA, cx, fmt, rarityLabel, TokenIcon, FaText, Modal, SectionHead, RelicIcon } = window;
const MKT = window.FA_MARKET;

// Message d'erreur : clé serveur connue → traduction dédiée, sinon générique.
// (Ne PAS faire I18N.t("MKT_ERR_" + e) || generic : une clé inconnue renvoie la clé brute, truthy.)
const MKT_ERR_KEYS = ["deja_vendu", "listing_expire", "auto_achat_interdit", "limite_listings", "prix_invalide"];
function mktErrMsg(j) {
  const e = j && j.error;
  return MKT_ERR_KEYS.indexOf(e) >= 0 ? I18N.t("MKT_ERR_" + e) : I18N.t("MKT_ERR_generic");
}

function MarketListingCard({ l, onBuy, own }) {
  const it = l.item || {};
  return (
    <div className="oct-sm" style={{ border: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 10, padding: 10, marginBottom: 8 }}>
      <RelicIcon type={it.type} rarity={it.rarity} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color: D.RARITY_COLORS[it.rarity] }}>
          {I18N.t("RELIC_" + String(it.type || "").toUpperCase())} · {rarityLabel(it.rarity)}
        </div>
        <div className="muted mono" style={{ fontSize: 12 }}>
          {I18N.t("MKT_SELLER")} : {String(l.seller || "").slice(0, 8)}…{String(l.seller || "").slice(-4)}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div className="mono"><TokenIcon /> {fmt(l.price)}</div>
        {!own && <button className="btn sm" onClick={() => onBuy(l)}>{I18N.t("MKT_BUY")}</button>}
      </div>
    </div>
  );
}

function MarketBrowse() {
  const { g, actions, toast } = useFA();
  const [fType, setFType] = useState("");
  const [fRarity, setFRarity] = useState("");
  const [confirm, setConfirm] = useState(null); // listing en attente de confirmation
  const [busy, setBusy] = useState(false);
  const listings = MKT.filterListings((g.market && g.market.listings) || [], { type: fType || null, rarity: fRarity || null });

  async function doBuy() {
    if (!confirm || busy) return;
    setBusy(true);
    const j = await actions.marketBuy(confirm.id);
    setBusy(false);
    setConfirm(null);
    if (j && j.status === "ok") toast(I18N.t("MKT_BOUGHT_OK"), "good");
    else if (j && j.status === "insufficient_balance") toast(I18N.t("INSUFFICIENT", (g.liquid || 0) + (g.locked || 0), confirm.price), "bad");
    else toast(mktErrMsg(j), "bad");
  }

  return (
    <div>
      <div className="flex gap8 wrap" style={{ marginBottom: 12 }}>
        <select className="field" style={{ flex: 1, minWidth: 160 }} value={fType} onChange={(e) => setFType(e.target.value)}>
          <option value="">{I18N.t("MKT_ALL_TYPES")}</option>
          {Object.keys(D.RELICS).map((k) => <option key={k} value={k}>{I18N.t("RELIC_" + k.toUpperCase())}</option>)}
        </select>
        <select className="field" style={{ flex: 1, minWidth: 160 }} value={fRarity} onChange={(e) => setFRarity(e.target.value)}>
          <option value="">{I18N.t("MKT_ALL_RARITIES")}</option>
          {["Common", "Rare", "Epic", "Legendary"].map((r) => <option key={r} value={r}>{rarityLabel(r)}</option>)}
        </select>
      </div>
      {listings.length === 0 && <div className="muted" style={{ textAlign: "center", padding: 24 }}>{I18N.t("MKT_EMPTY")}</div>}
      {listings.map((l) => <MarketListingCard key={l.id} l={l} own={l.seller === g.wallet} onBuy={setConfirm} />)}
      {confirm && (
        <Modal onClose={() => setConfirm(null)}>
          <div className="h2" style={{ fontSize: 14, marginBottom: 10, textAlign: "center" }}>{I18N.t("MKT_CONFIRM_TITLE")}</div>
          <div style={{ textAlign: "center", padding: 8 }}>
            <RelicIcon type={confirm.item.type} rarity={confirm.item.rarity} size={48} />
            <p className="mono"><FaText text={I18N.t("MKT_CONFIRM_TEXT", fmt(confirm.price))} /></p>
            <p className="muted mono"><FaText text={I18N.t("MKT_BALANCE_AFTER", fmt(Math.max(0, (g.liquid || 0) + (g.locked || 0) - confirm.price)))} /></p>
            <button className="btn btn-elec" disabled={busy} onClick={doBuy}>{I18N.t("MKT_BUY")}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function MarketMine() {
  const { g, actions, toast } = useFA();
  const [sel, setSel] = useState(null);   // relic_id sélectionnée
  const [price, setPrice] = useState("");
  const [busy, setBusy] = useState(false);
  const mine = (g.market && g.market.mine) || { active: [], expired: [], history: [] };
  // Seules les reliques se vendent ici ; `equipment` contient aussi les cores.
  const inventory = (g.equipment || []).filter(D.isRelicItem);
  // reliques équipées (⚔) = portées par une bête du roster — miroir du repère de screens.jsx (RelicSlot).
  const equippedIds = new Set((g.roster || []).map((c) => c && c.relic_id).filter(Boolean));
  const p = parseInt(price, 10);
  const fees = MKT.isValidPrice(p) ? MKT.listingFees(p) : null;

  async function doList() {
    if (!sel || !fees || busy) return;
    setBusy(true);
    const j = await actions.marketList(sel, p);
    setBusy(false);
    if (j && j.status === "ok") { toast(I18N.t("MKT_LISTED_OK"), "good"); setSel(null); setPrice(""); }
    else if (j && j.status === "insufficient_balance") toast(I18N.t("MKT_ERR_generic"), "bad");
    else toast(mktErrMsg(j), "bad");
  }

  async function doCancel(id) {
    if (busy) return;
    setBusy(true);
    const j = await actions.marketCancel(id);
    setBusy(false);
    if (j && j.status === "ok") toast(I18N.t("MKT_CANCELLED_OK"), "good");
    else toast(mktErrMsg(j), "bad");
  }

  return (
    <div>
      <SectionHead title={I18N.t("MKT_SELL_TITLE")} />
      <div className="muted mono" style={{ marginBottom: 6, fontSize: 13 }}>{I18N.t("MKT_SELECT_RELIC")}</div>
      <div className="flex wrap" style={{ gap: 6, marginBottom: 8 }}>
        {inventory.map((it) => (
          <button key={it.id} className={cx("btn sm", sel === it.id && "on")} onClick={() => setSel(it.id)} style={{ justifyContent: "flex-start", gap: 6 }}>
            <RelicIcon type={it.type} rarity={it.rarity} size={18} /> {I18N.t("RELIC_" + it.type.toUpperCase())} {equippedIds.has(it.id) ? "⚔" : ""}
          </button>
        ))}
      </div>
      <input className="field" type="number" min="100" max="1000000" step="1" style={{ maxWidth: 280 }}
             placeholder={I18N.t("MKT_PRICE_INPUT")} value={price} onChange={(e) => setPrice(e.target.value)} />
      {fees && (
        <div className="muted mono" style={{ fontSize: 12, margin: "6px 0" }}>
          <div><FaText text={I18N.t("MKT_FEE_PREVIEW", fmt(fees.listing_fee))} s={12} /></div>
          <div><FaText text={I18N.t("MKT_NET_PREVIEW", fmt(fees.net_seller))} s={12} /></div>
        </div>
      )}
      <button className="btn btn-elec" style={{ marginTop: 8 }} disabled={!sel || !fees || busy} onClick={doList}>{I18N.t("MKT_LIST_ACTION")}</button>

      <SectionHead title={I18N.t("MKT_MY_ACTIVE", (mine.active || []).length + (mine.expired || []).length)} />
      {(mine.active || []).map((l) => (
        <div key={l.id} className="oct-sm" style={{ border: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 8, padding: 8, marginBottom: 6 }}>
          <RelicIcon type={l.item.type} rarity={l.item.rarity} size={24} />
          <span className="mono" style={{ flex: 1, minWidth: 0 }}>{I18N.t("RELIC_" + l.item.type.toUpperCase())} · <TokenIcon s={13} /> {fmt(l.price)}</span>
          <button className="btn sm" disabled={busy} onClick={() => doCancel(l.id)}>{I18N.t("MKT_CANCEL")}</button>
        </div>
      ))}

      {(mine.expired || []).length > 0 && <SectionHead title={I18N.t("MKT_MY_EXPIRED")} />}
      {(mine.expired || []).map((l) => (
        <div key={l.id} className="oct-sm" style={{ border: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 8, padding: 8, marginBottom: 6 }}>
          <RelicIcon type={l.item.type} rarity={l.item.rarity} size={24} />
          <span className="mono" style={{ flex: 1, minWidth: 0 }}>{I18N.t("RELIC_" + l.item.type.toUpperCase())} · <TokenIcon s={13} /> {fmt(l.price)}</span>
          <button className="btn sm" disabled={busy} onClick={() => doCancel(l.id)}>{I18N.t("MKT_RECLAIM")}</button>
        </div>
      ))}

      {(mine.history || []).length > 0 && <SectionHead title={I18N.t("MKT_HISTORY")} />}
      {(mine.history || []).map((l) => {
        // net/buyer_name viennent du serveur ; repli calculé (5 %) si la réponse
        // vient d'un serveur antérieur encore en cache.
        const net = l.status === "sold" ? (l.net ?? l.price - Math.floor(l.price * 0.05)) : null;
        const when = l.closed_at ? new Date(l.closed_at).toLocaleDateString() : "";
        return (
          <div key={l.id} style={{ padding: "6px 0", borderBottom: "1px solid var(--line-soft, var(--line))" }}>
            <div className="mono" style={{ fontSize: 12 }}>
              {I18N.t("RELIC_" + l.item.type.toUpperCase())} — {l.status === "sold"
                ? <FaText text={I18N.t("MKT_SOLD_LINE", fmt(l.price), fmt(net))} s={11} />
                : I18N.t("MKT_CANCEL")}
            </div>
            <div className="muted mono" style={{ fontSize: 10, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {when}{l.status === "sold" && (l.buyer_name || l.buyer) ? " · " + I18N.t("MKT_BUYER_LINE", l.buyer_name || (String(l.buyer).slice(0, 8) + "…" + String(l.buyer).slice(-4))) : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Market() {
  const { g, actions } = useFA();
  const [tab, setTab] = useState("browse");
  useEffect(() => { actions.marketRefresh(); }, [g.authToken]);
  // Ici, et pas au boot : c'est le premier écran où une grille de reliques
  // s'affiche. À l'inactivité, pour ne pas disputer le thread au rendu.
  useEffect(() => {
    const M = window.FA_RELIC_MODELS;
    if (M && M.preloadWhenIdle) M.preloadWhenIdle();
  }, []);
  return (
    <div className="container" style={{ maxWidth: 640 }}>
      <SectionHead title={I18N.t("MKT_TITLE")} sub={I18N.t("MKT_TAG")} />
      <div className="subtabs">
        <button className={cx("subtab", tab === "browse" && "on")} onClick={() => setTab("browse")}>{I18N.t("MKT_TAB_BROWSE")}</button>
        <button className={cx("subtab", tab === "mine" && "on")} onClick={() => setTab("mine")}>{I18N.t("MKT_TAB_MINE")}</button>
      </div>
      {tab === "browse" ? <MarketBrowse /> : <MarketMine />}
    </div>
  );
}

Object.assign(window, { Market });
