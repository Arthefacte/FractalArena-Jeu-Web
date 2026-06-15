// buyback.jsx
// Ticker économie — deux jauges empilées sous le header :
//   🔒 Liquidité verrouillée (burn = LP-lock)   ← /burn/status
//   💰 Réserve de rachat (buyback)              ← /buyback/status
// Preuve = page d'adresse du wallet dédié de chaque jambe (pas un txid de swap épars).
// Auto-suffisant : fait ses propres fetch + polling. Aucune prop. Exposé sur window.

const API_URL = "https://fractal-arena-server-production.up.railway.app";

// Base de l'explorateur Fractal Bitcoin — PAGE D'ADRESSE (confirmée OK le 15/06/2026).
const FRACTAL_ADDR_EXPLORER = "https://fractal.unisat.io/explorer/address/";

// Pur : fraction de remplissage de la jauge, bornée [0, 1].
function buybackFraction(total, threshold) {
  if (!threshold || threshold <= 0) return 0;
  return Math.max(0, Math.min(1, total / threshold));
}

// Formatage compact des entiers (séparateurs de milliers).
function bbFmt(n) {
  return Math.round(n || 0).toLocaleString("en-US");
}

// Une rangée = une jambe économique (liquidité ou rachat).
function TickerRow({ kind, icon, label, total, threshold, wallet, proofLabel, sub }) {
  const frac = buybackFraction(total, threshold);
  return (
    <div className={"bb-row " + kind}>
      <div className="bb-line">
        <span className="bb-icon">{icon}</span>
        <span className="bb-label">{label}</span>
        <div className="bb-bar"><i style={{ width: (frac * 100) + "%" }} /></div>
        <span className="bb-nums">{bbFmt(total)} / {bbFmt(threshold)}</span>
        {wallet && (
          <a className="bb-tx" href={FRACTAL_ADDR_EXPLORER + wallet} target="_blank" rel="noreferrer">{proofLabel} ↗</a>
        )}
      </div>
      {sub && <div className="bb-sub">{sub}</div>}
    </div>
  );
}

function BuybackTicker() {
  const [bb, setBb] = React.useState(null);
  const [burn, setBurn] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      const [rb, rk] = await Promise.all([
        fetch(API_URL + "/buyback/status").then((r) => r.json()).catch(() => null),
        fetch(API_URL + "/burn/status").then((r) => r.json()).catch(() => null),
      ]);
      if (!alive) return;
      if (rb && rb.buyback) setBb(rb.buyback);
      if (rk && rk.burn) setBurn(rk.burn);
    }
    load();
    const id = setInterval(load, 60000); // rafraîchit chaque minute
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Rien tant qu'aucune des deux jambes n'est chargée — pas de bandeau vide.
  if (!bb && !burn) return null;

  const I = window.FA_I18N;
  return (
    <div className="bb-ticker" title={I.t("BB_TICK_TITLE")}>
      {burn && (
        <TickerRow
          kind="liq"
          icon="🔒"
          label={I.t("BB_LIQ")}
          total={burn.total}
          threshold={burn.threshold}
          wallet={burn.burn_wallet}
          proofLabel={I.t("BB_PROOF")}
        />
      )}
      {bb && (
        <TickerRow
          kind="buy"
          icon="💰"
          label={I.t("BB_RESERVE")}
          total={bb.total}
          threshold={bb.threshold}
          wallet={bb.buyback_wallet}
          proofLabel={I.t("BB_PROOF")}
          sub={I.t("BB_BOUGHT_SUB", bbFmt(bb.total_bought || 0))}
        />
      )}
    </div>
  );
}

Object.assign(window, { BuybackTicker, buybackFraction });
