// buyback.jsx
// Buyback Ticker — bandeau permanent : jauge de la réserve de rachat (total / seuil),
// total cumulé racheté-et-verrouillé, lien de preuve vers l'adresse du wallet de rachat.
// Auto-suffisant : fait son propre fetch + polling. Aucune prop. Exposé sur window.

const API_URL = "https://fractal-arena-server-production.up.railway.app";

// Base de l'explorateur Fractal Bitcoin — PAGE D'ADRESSE. La preuve = l'historique
// on-chain du wallet dédié au rachat (exposé par l'API comme `buyback_wallet`), pas un
// txid de swap épars. ⚠️ À confirmer : qu'une adresse s'ouvre bien sur cette base.
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

function BuybackTicker() {
  const [bb, setBb] = React.useState(null);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const r = await fetch(API_URL + "/buyback/status");
        const j = await r.json();
        if (alive && j && j.buyback) setBb(j.buyback);
      } catch (e) {
        /* erreur réseau : on conserve l'état précédent, pas de crash */
      }
    }
    load();
    const id = setInterval(load, 60000); // rafraîchit chaque minute
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Tant que rien n'est chargé (ou API absente) : on n'affiche rien — pas de bandeau vide.
  if (!bb) return null;

  const I = window.FA_I18N;
  const frac = buybackFraction(bb.total, bb.threshold);
  // Preuve = adresse du wallet dédié (toujours auditable), exposée par l'API.
  const proofWallet = bb.buyback_wallet;
  // Cumul racheté-et-verrouillé à vie, exposé par l'API (`total_bought`, en FRACTALARENA).
  const bought = bb.total_bought || 0;

  return (
    <div className="bb-ticker" title={I.t("BB_TICK_TITLE")}>
      <span className="bb-label">{I.t("BB_RESERVE")}</span>
      <div className="bb-bar"><i style={{ width: (frac * 100) + "%" }} /></div>
      <span className="bb-nums">{bbFmt(bb.total)} / {bbFmt(bb.threshold)}</span>
      <span className="bb-bought">{I.t("BB_BOUGHT")} : <b>{bbFmt(bought)}</b> FA</span>
      {proofWallet && (
        <a
          className="bb-tx"
          href={FRACTAL_ADDR_EXPLORER + proofWallet}
          target="_blank"
          rel="noreferrer"
        >{I.t("BB_PROOF")} ↗</a>
      )}
    </div>
  );
}

Object.assign(window, { BuybackTicker, buybackFraction });
