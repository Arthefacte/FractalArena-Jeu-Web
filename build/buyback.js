/* Généré par tools/precompile.mjs depuis buyback.jsx — NE PAS ÉDITER. */
(function () {
// buyback.jsx
// Ticker économie — 4 jauges de rachat (pools 5k/10k/25k/50k) sous le header ← /buyback/status.
// Preuve = le pool du DEX (InSwap) où le rachat est exécuté puis la liquidité verrouillée à vie.
// Auto-suffisant : fait ses propres fetch + polling. Aucune prop. Exposé sur window.

const API_URL = window.FA_API_URL;
const {
  FaText,
  Modal
} = window;

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
function TickerRow({
  kind,
  icon,
  label,
  total,
  threshold,
  wallet,
  proofLabel,
  sub,
  gain,
  rachat
}) {
  const frac = buybackFraction(total, threshold);
  return /*#__PURE__*/React.createElement("div", {
    className: "bb-row " + kind + (gain ? " bb-gain" : "") + (rachat ? " bb-rachat" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "bb-line"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bb-icon"
  }, icon), /*#__PURE__*/React.createElement("span", {
    className: "bb-label"
  }, label), /*#__PURE__*/React.createElement("div", {
    className: "bb-bar"
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: frac * 100 + "%"
    }
  })), gain > 0 && /*#__PURE__*/React.createElement("span", {
    className: "bb-delta"
  }, "+", bbFmt(gain)), /*#__PURE__*/React.createElement("span", {
    className: "bb-nums"
  }, bbFmt(total), " / ", bbFmt(threshold)), wallet && /*#__PURE__*/React.createElement("a", {
    className: "bb-tx",
    href: DEX_URL,
    target: "_blank",
    rel: "noreferrer"
  }, proofLabel, " \u2197")), sub && /*#__PURE__*/React.createElement("div", {
    className: "bb-sub"
  }, /*#__PURE__*/React.createElement(FaText, {
    text: sub,
    s: 10
  })));
}

// ——— Tape boursière (#7 header vivant) : les items structurés de FA_TAPE,
// formatés via I18N puis FaText (convention : jamais « FA » écrit à côté d'un
// montant). Piste dupliquée pour un défilement sans couture (translateX -50 %).
function ageTexte(I, age) {
  if (age.unite === "min") return I.t("TAPE_AGE_MIN", age.n);
  if (age.unite === "h") return I.t("TAPE_AGE_H", age.n);
  if (age.unite === "j") return I.t("TAPE_AGE_J", age.n);
  return I.t("TAPE_AGE_NOW");
}
function texteTape(I, it) {
  if (it.type === "rachat") return I.t("TAPE_RACHAT", bbFmt(it.tier), bbFmt(it.montant)) + " · " + ageTexte(I, it.age);
  if (it.type === "entree") return I.t("TAPE_ENTREE", bbFmt(it.montant), bbFmt(it.tier));
  if (it.type === "pool") return I.t("TAPE_POOL", bbFmt(it.tier), it.pct);
  if (it.type === "cumul") return I.t("TAPE_CUMUL", bbFmt(it.montant));
  return "";
}
function TapeBoursiere({
  pools,
  gainsSession,
  fraiche
}) {
  // Repli : tape-ui.js absent (404 de déploiement) → pas de tape, pas de crash.
  if (!window.FA_TAPE) return null;
  const I = window.FA_I18N;
  const items = window.FA_TAPE.composerTape(pools, gainsSession, Date.now());
  if (!items.length) return null;
  const run = cle => /*#__PURE__*/React.createElement("span", {
    className: "fa-tape-run",
    "aria-hidden": cle === "b" ? "true" : undefined
  }, items.map((it, i) => /*#__PURE__*/React.createElement("span", {
    className: "fa-tape-item",
    key: cle + i
  }, /*#__PURE__*/React.createElement(FaText, {
    text: texteTape(I, it),
    s: 10
  }))));
  return /*#__PURE__*/React.createElement("div", {
    className: "fa-tape" + (fraiche ? " fraiche" : "")
  }, /*#__PURE__*/React.createElement("div", {
    className: "fa-tape-track"
  }, run("a"), run("b")));
}

// La pluie d'or d'un rachat exécuté. Spans en transform/opacity uniquement
// (patron embers de la cinématique) — pas de canvas, pas de filtre : leçon
// Mali-G68. `graine` remonte les nœuds pour rejouer la chute à chaque rachat.
function PluieOr({
  graine
}) {
  const gouttes = React.useMemo(() => Array.from({
    length: 30
  }, (_, i) => {
    const s = 2.5 + Math.random() * 2.5;
    return {
      id: i,
      style: {
        left: Math.random() * 100 + "%",
        width: s + "px",
        height: s + "px",
        animationDuration: 1.1 + Math.random() * 0.9 + "s",
        animationDelay: Math.random() * 0.5 + "s",
        "--drift": (Math.random() * 2 - 1) * 26 + "px"
      }
    };
  }), [graine]);
  return /*#__PURE__*/React.createElement("div", {
    className: "fa-pluie",
    "aria-hidden": "true"
  }, gouttes.map(g => /*#__PURE__*/React.createElement("span", {
    key: g.id,
    className: "fa-or",
    style: g.style
  })));
}

// Rangée DEX : prix spot InSwap + accès aux rachats vérifiés. Ne s'affiche que si
// /dex/status a répondu — pas de valeur fabriquée quand le serveur ou UniSat manque.
function RangeeDex({
  dex,
  onVoirRachats
}) {
  const I = window.FA_I18N,
    FDX = window.FA_DEX;
  if (!dex || !dex.pool || !FDX) return null;
  const prix = FDX.prixTexte(dex.pool.price_fb);
  if (!prix) return null;
  const chg = Number(dex.pool.price_change_24h) || 0;
  const count = dex.buyback_totals && dex.buyback_totals.count || 0;
  return /*#__PURE__*/React.createElement("div", {
    className: "bb-dex mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "bb-dex-prix"
  }, /*#__PURE__*/React.createElement(FaText, {
    text: I.t("DEX_PRICE", prix),
    s: 10
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      color: chg >= 0 ? "var(--success)" : "var(--alert)"
    }
  }, I.t("DEX_CHANGE", FDX.variationTexte(chg))), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), count > 0 && /*#__PURE__*/React.createElement("button", {
    className: "bb-dex-btn",
    onClick: onVoirRachats
  }, I.t("DEX_VERIFIED_BTN", count)));
}

// Panneau de preuve : la liste des achats DEX des adresses officielles de rachat,
// telle que renvoyée par le serveur (lecture on-chain via l'Open API InSwap).
function PanneauRachats({
  dex,
  onClose
}) {
  const I = window.FA_I18N;
  const t = dex.buyback_totals || {
    count: 0,
    fa: 0,
    fb: 0
  };
  return /*#__PURE__*/React.createElement(Modal, {
    onClose: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "h2",
    style: {
      fontSize: 14,
      marginBottom: 6,
      textAlign: "center"
    }
  }, I.t("DEX_MODAL_TITLE")), /*#__PURE__*/React.createElement("p", {
    className: "muted",
    style: {
      fontSize: 12,
      margin: "0 0 10px"
    }
  }, I.t("DEX_MODAL_SUB")), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      marginBottom: 10,
      textAlign: "center"
    }
  }, /*#__PURE__*/React.createElement(FaText, {
    text: I.t("DEX_MODAL_TOTALS", bbFmt(t.fa), (t.fb || 0).toFixed(2)),
    s: 12
  })), /*#__PURE__*/React.createElement("div", {
    className: "bb-dex-liste"
  }, (dex.buybacks || []).map(b => /*#__PURE__*/React.createElement("div", {
    key: b.id,
    className: "bb-dex-item mono"
  }, /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, new Date(b.ts * 1000).toLocaleDateString()), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(FaText, {
    text: bbFmt(b.fa) + " FA",
    s: 11
  })), /*#__PURE__*/React.createElement("span", {
    className: "muted"
  }, "\u2190 ", (b.fb || 0).toFixed(2), " FB")))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("a", {
    className: "btn sm",
    href: DEX_URL,
    target: "_blank",
    rel: "noreferrer"
  }, I.t("DEX_OPEN_INSWAP"), " \u2197")));
}
function BuybackTicker() {
  const [bb, setBb] = React.useState(null);
  const [dex, setDex] = React.useState(null);
  const [voirRachats, setVoirRachats] = React.useState(false);
  // Ce qui vient d'entrer, par tier, et un compteur de relevé pour que React
  // remonte les nœuds et rejoue l'animation même si le montant est identique.
  const [gains, setGains] = React.useState({
    n: 0,
    par: {}
  });
  // Un rachat vient d'être exécuté : {tier: montant}, compteur pour rejouer.
  const [rachat, setRachat] = React.useState({
    n: 0,
    tiers: {}
  });
  // Mobile : la tape est repliée par défaut ; `on` la déplie quand il y a du
  // neuf (entrée ou rachat), ~8 s, puis elle se replie.
  const [fraiche, setFraiche] = React.useState(false);
  const fraicheTimer = React.useRef(0);
  // Entrées cumulées de la session, par tier — la matière « en direct » de la tape.
  const cumulGains = React.useRef({});
  const prevPools = React.useRef([]);
  const poolsPret = React.useRef(false);
  React.useEffect(() => {
    let alive = true;
    async function load() {
      // /dex/status en parallèle : cache serveur 60 s, donc les réveils fréquents
      // (fa:buyback-refresh à chaque dépense) ne coûtent aucun appel UniSat de plus.
      const [rb, dx] = await Promise.all([fetch(API_URL + "/buyback/status").then(r => r.json()).catch(() => null), fetch(API_URL + "/dex/status").then(r => r.ok ? r.json() : null).catch(() => null)]);
      if (!alive) return;
      if (dx && dx.dex) setDex(dx.dex);
      if (rb && rb.buyback && Array.isArray(rb.buyback.pools)) {
        const par = window.FA_JUICE_UI.gainsPools(prevPools.current, rb.buyback.pools, poolsPret.current);
        // AVANT d'écraser prevPools : la détection compare l'ancien relevé au
        // nouveau. Même garde d'initialisation que gainsPools — pas de pluie
        // d'or à la connexion pour des rachats passés.
        const rachats = window.FA_TAPE ? window.FA_TAPE.rachatsDetectes(prevPools.current, rb.buyback.pools, poolsPret.current) : {};
        prevPools.current = rb.buyback.pools;
        poolsPret.current = true;
        setBb(rb.buyback);
        // La tape se nourrit du neuf : on déplie (mobile) sur entrée OU rachat.
        function reveille() {
          setFraiche(true);
          clearTimeout(fraicheTimer.current);
          fraicheTimer.current = setTimeout(() => {
            if (alive) setFraiche(false);
          }, 8000);
        }
        if (Object.keys(par).length) {
          for (const t of Object.keys(par)) cumulGains.current[t] = (cumulGains.current[t] || 0) + par[t];
          setGains(g => ({
            n: g.n + 1,
            par
          }));
          // Le montant vit dans le flux de sa rangée : le laisser en place une
          // fois effacé garderait la jauge rétrécie autour d'un élément devenu
          // invisible. On le retire après l'animation (1,8 s côté CSS).
          setTimeout(() => {
            if (alive) setGains(g => ({
              n: g.n,
              par: {}
            }));
          }, 1900);
          reveille();
        }
        if (Object.keys(rachats).length) {
          // Le moment fort de l'économie : pluie d'or + ka-ching + jauge qui pulse.
          setRachat(r => ({
            n: r.n + 1,
            tiers: rachats
          }));
          if (window.FA_SFX) window.FA_SFX.play("kaching");
          setTimeout(() => {
            if (alive) setRachat(r => ({
              n: r.n,
              tiers: {}
            }));
          }, 2400);
          reveille();
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
      clearTimeout(fraicheTimer.current);
      window.removeEventListener("fa:buyback-refresh", load);
    };
  }, []);

  // Rien tant que les pools ne sont pas chargés — pas de bandeau vide.
  if (!bb || !bb.pools || !bb.pools.length) return null;
  const I = window.FA_I18N;
  const totalBought = bb.pools.reduce((s, p) => s + (p.total_bought || 0), 0);
  const last = bb.pools.length - 1;
  return /*#__PURE__*/React.createElement("div", {
    className: "bb-ticker",
    title: I.t("BB_TICK_TITLE")
  }, bb.pools.map((p, i) => /*#__PURE__*/React.createElement(TickerRow, {
    key: p.tier + ":" + (gains.par[p.tier] ? gains.n : 0) + ":" + (rachat.tiers[p.tier] ? rachat.n : 0),
    gain: gains.par[p.tier] || 0,
    rachat: rachat.tiers[p.tier] || 0,
    kind: "buy",
    icon: "",
    label: I.t("BB_POOL_LABEL", bbFmt(p.tier)),
    total: p.total,
    threshold: p.threshold,
    wallet: i === 0 ? bb.buyback_wallet : null,
    proofLabel: I.t("BB_PROOF"),
    sub: i === last ? I.t("BB_BOUGHT_SUB", bbFmt(totalBought)) : null
  })), /*#__PURE__*/React.createElement(RangeeDex, {
    dex: dex,
    onVoirRachats: () => setVoirRachats(true)
  }), /*#__PURE__*/React.createElement(TapeBoursiere, {
    pools: bb.pools,
    gainsSession: cumulGains.current,
    fraiche: fraiche
  }), rachat.n > 0 && Object.keys(rachat.tiers).length > 0 && /*#__PURE__*/React.createElement(PluieOr, {
    graine: rachat.n
  }), voirRachats && dex && /*#__PURE__*/React.createElement(PanneauRachats, {
    dex: dex,
    onClose: () => setVoirRachats(false)
  }));
}
Object.assign(window, {
  BuybackTicker,
  buybackFraction
});
})();
