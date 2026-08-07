// buyback.jsx
// Ticker économie — 4 jauges de rachat (pools 5k/10k/25k/50k) sous le header ← /buyback/status.
// Preuve = le pool du DEX (InSwap) où le rachat est exécuté puis la liquidité verrouillée à vie.
// Auto-suffisant : fait ses propres fetch + polling. Aucune prop. Exposé sur window.

const API_URL = window.FA_API_URL;
const { FaText } = window;

// Lien « preuve » = page du DEX InSwap (paire FractalArena / sFB) — même cible que la vitrine arthefacte.com.
const DEX_URL = "https://inswap.net/swap?t0=FractalArena&t1=sFB___000";

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
// `gain` : ce qui vient d'entrer dans ce pool, à annoncer une fois. La rangée
// s'allume et le montant s'affiche — sinon un don part sans que rien ne bouge à
// l'écran, et « Offrir » redevient un bouton qui ne produit rien de visible.
function TickerRow({ kind, icon, label, total, threshold, wallet, proofLabel, sub, gain }) {
  const frac = buybackFraction(total, threshold);
  return (
    <div className={"bb-row " + kind + (gain ? " bb-gain" : "")}>
      <div className="bb-line">
        <span className="bb-icon">{icon}</span>
        <span className="bb-label">{label}</span>
        <div className="bb-bar"><i style={{ width: (frac * 100) + "%" }} /></div>
        {/* Hors de .bb-bar : celle-ci a `overflow: hidden` pour arrondir son
            remplissage, le montant y serait rogné. */}
        {gain > 0 && <span className="bb-delta">+{bbFmt(gain)}</span>}
        <span className="bb-nums">{bbFmt(total)} / {bbFmt(threshold)}</span>
        {wallet && (
          <a className="bb-tx" href={DEX_URL} target="_blank" rel="noreferrer">{proofLabel} ↗</a>
        )}
      </div>
      {sub && <div className="bb-sub"><FaText text={sub} s={10} /></div>}
    </div>
  );
}

function BuybackTicker() {
  const [bb, setBb] = React.useState(null);
  // Ce qui vient d'entrer, par tier, et un compteur de relevé pour que React
  // remonte les nœuds et rejoue l'animation même si le montant est identique.
  const [gains, setGains] = React.useState({ n: 0, par: {} });
  const prevPools = React.useRef([]);
  const poolsPret = React.useRef(false);

  React.useEffect(() => {
    let alive = true;
    async function load() {
      const rb = await fetch(API_URL + "/buyback/status").then((r) => r.json()).catch(() => null);
      if (!alive) return;
      if (rb && rb.buyback && Array.isArray(rb.buyback.pools)) {
        const par = window.FA_JUICE_UI.gainsPools(prevPools.current, rb.buyback.pools, poolsPret.current);
        prevPools.current = rb.buyback.pools;
        poolsPret.current = true;
        setBb(rb.buyback);
        if (Object.keys(par).length) {
          setGains((g) => ({ n: g.n + 1, par }));
          // Le montant vit dans le flux de sa rangée : le laisser en place une
          // fois effacé garderait la jauge rétrécie autour d'un élément devenu
          // invisible. On le retire après l'animation (1,8 s côté CSS).
          setTimeout(() => { if (alive) setGains((g) => ({ n: g.n, par: {} })); }, 1900);
        }
      }
    }
    load();
    const id = setInterval(load, 60000); // rafraîchit chaque minute
    // Un don vient d'être versé : on ne fait pas attendre le joueur jusqu'à la
    // minute suivante, sinon l'animation ne se rattache plus à son geste.
    // /buyback/status lit la base sans cache, la valeur est donc déjà à jour.
    window.addEventListener("fa:buyback-refresh", load);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("fa:buyback-refresh", load);
    };
  }, []);

  // Rien tant que les pools ne sont pas chargés — pas de bandeau vide.
  if (!bb || !bb.pools || !bb.pools.length) return null;

  const I = window.FA_I18N;
  const totalBought = bb.pools.reduce((s, p) => s + (p.total_bought || 0), 0);
  const last = bb.pools.length - 1;
  return (
    <div className="bb-ticker" title={I.t("BB_TICK_TITLE")}>
      {bb.pools.map((p, i) => (
        <TickerRow
          key={p.tier + ":" + (gains.par[p.tier] ? gains.n : 0)}
          gain={gains.par[p.tier] || 0}
          kind="buy"
          icon=""
          label={I.t("BB_POOL_LABEL", bbFmt(p.tier))}
          total={p.total}
          threshold={p.threshold}
          wallet={i === 0 ? bb.buyback_wallet : null}
          proofLabel={I.t("BB_PROOF")}
          sub={i === last ? I.t("BB_BOUGHT_SUB", bbFmt(totalBought)) : null}
        />
      ))}
    </div>
  );
}

Object.assign(window, { BuybackTicker, buybackFraction });
