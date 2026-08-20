/* Généré par tools/precompile.mjs depuis components.jsx — NE PAS ÉDITER. */
(function () {
/* ============================================================
   FRACTAL ARENA — shared components + context
   ============================================================ */
const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  createContext,
  useContext
} = React;
const D = window.FA_DATA;
const I18N = window.FA_I18N;
const FA_Ctx = createContext(null);
const useFA = () => useContext(FA_Ctx);
function cx(...a) {
  return a.filter(Boolean).join(" ");
}
function fmt(n) {
  return Math.floor(n).toLocaleString("en-US").replace(/,/g, " ");
}
function presetLabel(p) {
  return I18N.t(p);
}
function rarityLabel(r) {
  return I18N.t(r);
}

// Small ◎ coin glyph
function Coin({
  c
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: {
      color: c || "var(--gold)",
      fontWeight: 700
    }
  }, "\u25CE");
}

// Logo du token FRACTALARENA (assets/TOKEN.png), inline à côté d'un montant.
function TokenIcon({
  s = 15
}) {
  return /*#__PURE__*/React.createElement("img", {
    src: "assets/TOKEN.png",
    alt: "FA",
    width: s,
    height: s,
    draggable: "false",
    style: {
      borderRadius: 3,
      verticalAlign: "-2px",
      display: "inline-block"
    }
  });
}

// Convention d'affichage des montants : dans les chaînes i18n, un montant s'écrit
// « %d FA » ; FaText remplace chaque « <nombre> FA » par le logo du token suivi du
// nombre — aucune écriture « FA » à l'écran à côté d'un montant.
function FaText({
  text,
  s = 13
}) {
  const parts = String(text).split(/(\d[\d\s.,]*)\s*FA\b/);
  if (parts.length === 1) return text;
  return parts.map((p, i) => i % 2 === 1 ? /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement(TokenIcon, {
    s: s
  }), " ", p.trim()) : p || null);
}
function Bar({
  frac,
  kind,
  className
}) {
  const pct = Math.max(0, Math.min(1, frac)) * 100;
  let mod = "";
  if (kind === "hp") {
    if (pct < 30) mod = "low";else if (pct < 60) mod = "mid";
  }
  return /*#__PURE__*/React.createElement("div", {
    className: cx("bar", kind, mod, className)
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: pct + "%"
    }
  }));
}
function StatGrid({
  beast,
  compact
}) {
  const stats = [["HP", D.eff(beast, "hp")], ["ATK", D.eff(beast, "atk")], ["DEF", D.eff(beast, "def")], ["SPD", D.eff(beast, "spd")], ["MAG", D.eff(beast, "mag")]];
  const show = compact ? stats.slice(1) : stats;
  return /*#__PURE__*/React.createElement("div", {
    className: "stat-row"
  }, show.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    className: "stat",
    key: k
  }, /*#__PURE__*/React.createElement("div", {
    className: "k"
  }, k), /*#__PURE__*/React.createElement("div", {
    className: "v",
    title: String(v),
    style: {
      color: k === "HP" ? "var(--success)" : "var(--text)"
    }
  }, D.fmtStat(v)))));
}

// Collection / selection card
// Intensité du foil holographique par rareté (subtile → éclatante).
const FOIL_BY_RARITY = {
  Common: 0.4,
  Rare: 0.55,
  Epic: 0.72,
  Legendary: 0.92
};
const MAX_TILT = 7; // degrés

function CreatureCard({
  beast,
  selected,
  onClick,
  selectable,
  showXp,
  badge
}) {
  const rc = D.RARITY_COLORS[beast.rarity];
  const maxRarity = beast.rarity === "Legendary"; // hors du cycle des raretés
  const pc = D.PRESET_COLORS[beast.preset];
  const xpMax = D.xpToNext(beast);
  const ref = useRef(null);
  const raf = useRef(0);

  // Tilt parallax + position du reflet, pilotés par des vars CSS (pas de re-render).
  function onMove(e) {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia && window.matchMedia("(hover: none)").matches) return; // tactile : pas de tilt
    const cx0 = e.clientX,
      cy0 = e.clientY;
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const el2 = ref.current;
      if (!el2) return;
      const r = el2.getBoundingClientRect();
      const px = Math.min(1, Math.max(0, (cx0 - r.left) / r.width));
      const py = Math.min(1, Math.max(0, (cy0 - r.top) / r.height));
      el2.style.setProperty("--rx", ((px - 0.5) * 2 * MAX_TILT).toFixed(2) + "deg"); // rotateY
      el2.style.setProperty("--ry", ((0.5 - py) * 2 * MAX_TILT).toFixed(2) + "deg"); // rotateX
      el2.style.setProperty("--mx", (px * 100).toFixed(1) + "%");
      el2.style.setProperty("--my", (py * 100).toFixed(1) + "%");
    });
  }
  function onLeave() {
    const el = ref.current;
    if (!el) return;
    if (raf.current) {
      cancelAnimationFrame(raf.current);
      raf.current = 0;
    }
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  }
  return /*#__PURE__*/React.createElement("div", {
    ref: ref,
    className: cx("card", "r-" + String(beast.rarity || "Common").toLowerCase(), selectable && "selectable", selected && "sel"),
    style: {
      "--rc": rc,
      "--foil": FOIL_BY_RARITY[beast.rarity] || 0.4
    },
    onClick: onClick,
    onMouseMove: onMove,
    onMouseLeave: onLeave
  }, /*#__PURE__*/React.createElement("div", {
    className: "art"
  }, /*#__PURE__*/React.createElement("img", {
    src: D.artFor(beast),
    alt: beast.name,
    draggable: "false",
    onError: e => {
      const fb = D.ART[beast.image_key];
      if (fb && !e.currentTarget.dataset.fb) {
        e.currentTarget.dataset.fb = "1";
        e.currentTarget.src = fb;
      }
    }
  }), selectable && /*#__PURE__*/React.createElement("div", {
    className: "sel-check"
  }, "\u2713"), badge), /*#__PURE__*/React.createElement("div", {
    className: "body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "flex between center",
    style: {
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "cname",
    title: D.displayName(beast)
  }, D.displayName(beast))), /*#__PURE__*/React.createElement("div", {
    className: "cpreset",
    style: {
      color: pc
    }
  }, presetLabel(beast.preset)), /*#__PURE__*/React.createElement(StatGrid, {
    beast: beast
  }), showXp && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 9
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-label"
  }, /*#__PURE__*/React.createElement("span", null, "XP"), /*#__PURE__*/React.createElement("span", null, beast.xp, "/", xpMax)), /*#__PURE__*/React.createElement(Bar, {
    frac: beast.xp / xpMax,
    kind: "xp"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: showXp ? 6 : 9
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "bar-label"
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: rc
    }
  }, rarityLabel(beast.rarity)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: "var(--text)"
    }
  }, maxRarity ? "LV " + beast.level : beast.level + "/" + D.ECON.MAX_LEVEL_UPGRADE)), /*#__PURE__*/React.createElement(Bar, {
    frac: maxRarity ? 1 : beast.level / D.ECON.MAX_LEVEL_UPGRADE,
    kind: "rar"
  }))), /*#__PURE__*/React.createElement("div", {
    className: "foil",
    "aria-hidden": "true"
  }));
}
function Modal({
  children,
  onClose,
  wide,
  accent,
  openSound = "open"
}) {
  useEffect(() => {
    const h = e => {
      if (e.key === "Escape") onClose && onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  // Son d'ouverture/fermeture (mount/unmount uniquement ; openSound=null pour laisser
  // le contenu jouer son propre son — ex. victoire/défaite).
  useEffect(() => {
    if (openSound && window.FA_SFX) window.FA_SFX.play(openSound);
    return () => {
      if (window.FA_SFX) window.FA_SFX.play("close");
    };
  }, []);
  return /*#__PURE__*/React.createElement("div", {
    className: "overlay",
    onMouseDown: e => {
      if (e.target === e.currentTarget && onClose) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: cx("modal", wide && "wide"),
    style: accent ? {
      borderColor: accent
    } : null
  }, onClose && /*#__PURE__*/React.createElement("button", {
    className: "btn ghost sm",
    style: {
      position: "absolute",
      top: 14,
      right: 14,
      padding: "5px 10px"
    },
    onClick: onClose
  }, "\u2715"), children));
}
function SectionHead({
  eyebrow,
  title,
  sub
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 22
    }
  }, eyebrow && /*#__PURE__*/React.createElement("div", {
    className: "eyebrow"
  }, eyebrow), /*#__PURE__*/React.createElement("div", {
    className: "h1"
  }, title), sub && /*#__PURE__*/React.createElement("div", {
    className: "muted mono",
    style: {
      fontSize: 13,
      marginTop: 4
    }
  }, sub));
}

// Stat bars used in forge preview
function MiniStats({
  beast
}) {
  const rows = [["HP", D.eff(beast, "hp")], ["ATK", D.eff(beast, "atk")], ["DEF", D.eff(beast, "def")], ["SPD", D.eff(beast, "spd")], ["MAG", D.eff(beast, "mag")]];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 5
    }
  }, rows.map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    className: "flex center",
    style: {
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mono",
    style: {
      width: 34,
      fontSize: 11,
      color: "var(--text-dim)"
    }
  }, k), /*#__PURE__*/React.createElement("div", {
    className: "bar",
    style: {
      flex: 1,
      height: 6
    }
  }, /*#__PURE__*/React.createElement("i", {
    style: {
      width: Math.min(100, v / 2.2) + "%",
      background: "linear-gradient(90deg,var(--elec),#7af6ff)"
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "mono",
    title: String(v),
    style: {
      width: 34,
      fontSize: 12,
      textAlign: "right",
      fontWeight: 700
    }
  }, D.fmtStat(v)))));
}

// Posture pré-combat (1.3) — sélecteur partagé PvE/PvP
const POSTURE_KEYS = ["equilibre", "assaut", "rempart", "tactique"];
function PostureSelect({
  value,
  onChange,
  disabled
}) {
  const active = POSTURE_KEYS.includes(value) ? value : "equilibre";
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 11,
      color: "var(--text-dim)",
      marginBottom: 4
    }
  }, I18N.t("POSTURE_TITLE")), /*#__PURE__*/React.createElement("div", {
    className: "flex gap8",
    style: {
      flexWrap: "wrap"
    }
  }, POSTURE_KEYS.map(k => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: cx("btn sm", active === k && "on"),
    disabled: disabled,
    onClick: () => onChange && onChange(k)
  }, /*#__PURE__*/React.createElement("div", null, I18N.t("POSTURE_" + k.toUpperCase())), /*#__PURE__*/React.createElement("div", {
    className: "mono",
    style: {
      fontSize: 10,
      color: "var(--text-dim)"
    }
  }, I18N.t("POSTURE_" + k.toUpperCase() + "_D"))))));
}

// Icône 3D des reliques (2.1/2.2) — vignette Three.js (modèle .glb), repli primitive/pastille
function RelicIcon({
  type,
  rarity,
  size
}) {
  const s = size || 28;
  const [, force] = useState(0);
  useEffect(() => {
    const onReady = e => {
      if (!e.detail || e.detail.type === type) force(n => n + 1);
    };
    window.addEventListener("fa:relic-model-ready", onReady);
    return () => window.removeEventListener("fa:relic-model-ready", onReady);
  }, [type]);
  const url = window.FA_RELIC_ICON && window.FA_RELIC_ICON.get(type, rarity, s * 2) || null;
  if (url) return /*#__PURE__*/React.createElement("img", {
    src: url,
    alt: "",
    width: s,
    height: s,
    draggable: "false",
    style: {
      display: "inline-block",
      verticalAlign: "middle"
    }
  });
  const col = window.FA_DATA && window.FA_DATA.RARITY_COLORS[rarity] || "#9CA3AF";
  return /*#__PURE__*/React.createElement("span", {
    style: {
      width: Math.round(s * 0.45),
      height: Math.round(s * 0.45),
      display: "inline-block",
      background: col,
      clipPath: "polygon(50% 0,100% 50%,50% 100%,0 50%)"
    }
  });
}
Object.assign(window, {
  FA_Ctx,
  useFA,
  cx,
  fmt,
  presetLabel,
  rarityLabel,
  Coin,
  TokenIcon,
  FaText,
  Bar,
  StatGrid,
  CreatureCard,
  Modal,
  SectionHead,
  MiniStats,
  PostureSelect,
  RelicIcon
});
})();
