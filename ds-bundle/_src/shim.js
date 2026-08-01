/* ============================================================
   FRACTAL ARENA DS — standalone runtime shim
   Mirrors the parts of data.js / i18n.js that components.jsx reads
   from window.FA_DATA / window.FA_I18N, so the design-system
   components render outside the game runtime. Logic and constants
   are copied verbatim from the source files; ART is embedded as
   data URIs (300px thumbnails of the real game assets).
   ============================================================ */
import ART from "./art-data.json";

/* ---- Rarity (data.js) ---- */
const RARITY_ORDER = { Common: 0, Rare: 1, Epic: 2, Legendary: 3 };
const RARITY_LIST = ["Common", "Rare", "Epic", "Legendary"];
const RARITY_COLORS = {
  Common: "#9CA3AF", Rare: "#3B82F6", Epic: "#B026FF", Legendary: "#F7931A",
};

/* ---- Presets (data.js) ---- */
const PRESET_COLORS = {
  aggressive: "#FF3B5C", berserker: "#F7931A", tactician: "#9F00FF",
  controller: "#00F0FF", lifesteal: "#27E08A", sniper: "#FFE600",
};
const TYPE_TO_PRESET = {
  HASH: "aggressive", MINING: "berserker", LEDGER: "tactician",
  NETWORK: "controller", BLOCK: "lifesteal", GENESIS: "sniper",
};
const TYPE_LABEL = {
  HASH: "HashByte", MINING: "Miner", LEDGER: "Ledger",
  NETWORK: "Network", BLOCK: "Block", GENESIS: "Genesis",
};

/* ---- Art par rang (data.js, v87 : 24 visuels 6 types × 4 rangs) ----
   Les previews vivent en components/<groupe>/<Nom>/, d'où la base ../../../
   pour atteindre assets/ à la racine du projet. Sans ce bloc, CreatureCard
   plantait sur « D.artFor is not a function ». */
const ASSET_BASE = (typeof window !== "undefined" && window.FA_DS_ASSET_BASE) || "../../../";
const RANK_FACTOR = { C: 1.0, B: 1.25, A: 1.6, S: 2.0 };
const ART_FILE_KEY = {
  HashByte: "HASHBYTE", Miner: "MINER", LEDGER: "LEDGER",
  NETWORK: "NETWORK", BLOCK: "BLOCK", GENESIS: "GENESIS",
};
function artFor(b) {
  const fk = b && ART_FILE_KEY[b.image_key];
  if (!fk) return ART[b && b.image_key];              // repli : art de base du type
  const rk = b.rank && RANK_FACTOR[b.rank] ? b.rank : "C";
  return ASSET_BASE + "assets/" + fk + "_" + rk + ".webp";
}

/* ---- Stat math (data.js) ---- */
function fmtStat(n) {
  if (n < 10000) return String(Math.floor(n));
  if (n < 999500) return Math.round(n / 1000) + "k";
  return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
}
function levelMult(level) { return 1 + 0.03 * (level - 1); }
function eff(beast, key) { return Math.floor(beast["base_" + key] * levelMult(beast.level)); }
function maxHp(b) { return eff(b, "hp"); }
function xpToNext(beast) { return beast.level * 100; }
function displayName(b) { return b.custom_name || b.name; }

window.FA_DATA = {
  RARITY_ORDER, RARITY_LIST, RARITY_COLORS,
  PRESET_COLORS, TYPE_TO_PRESET, TYPE_LABEL, ART,
  RANK_FACTOR, ART_FILE_KEY, artFor,
  eff, maxHp, xpToNext, displayName, levelMult, fmtStat,
};

/* ---- i18n (i18n.js) — preset/rarity labels are the only keys read by
   components.jsx (presetLabel/rarityLabel). Passthrough with a small
   label table so previews read naturally. ---- */
const LABELS = {
  Common: "Common", Rare: "Rare", Epic: "Epic", Legendary: "Legendary",
  aggressive: "Aggressive", berserker: "Berserker", tactician: "Tactician",
  controller: "Controller", lifesteal: "Lifesteal", sniper: "Sniper",
};
window.FA_I18N = {
  t: (key) => LABELS[key] != null ? LABELS[key] : key,
  getLang: () => "EN",
  setLang: () => {},
  T: LABELS,
};

/* ---- Sample beasts for data-driven components (StatGrid / CreatureCard /
   MiniStats). Shapes mirror data.js#mintBeast output. ---- */
function beast(o) {
  return Object.assign({
    id: "sample_" + o.image_key, level: 1, xp: 0, custom_name: null,
    reroll_count: 0, sv: 1,
  }, o);
}
window.FA_SAMPLE = {
  legendary: beast({
    template_name: "HashByte-2", type: "HASH", image_key: "HashByte",
    preset: "aggressive", rarity: "Legendary", name: "HashByte #420",
    base_hp: 180, base_atk: 31, base_def: 7, base_spd: 26, base_mag: 35,
    level: 12, xp: 640,
  }),
  epic: beast({
    template_name: "Ledger-1", type: "LEDGER", image_key: "LEDGER",
    preset: "tactician", rarity: "Epic", name: "Ledger #77",
    base_hp: 142, base_atk: 16, base_def: 9, base_spd: 14, base_mag: 25,
    level: 6, xp: 220,
  }),
  rare: beast({
    template_name: "Miner-2", type: "MINING", image_key: "Miner",
    preset: "berserker", rarity: "Rare", name: "Miner #13",
    base_hp: 168, base_atk: 15, base_def: 11, base_spd: 9, base_mag: 9,
    level: 3, xp: 80,
  }),
  common: beast({
    template_name: "Network-1", type: "NETWORK", image_key: "NETWORK",
    preset: "controller", rarity: "Common", name: "Network #5",
    base_hp: 120, base_atk: 12, base_def: 7, base_spd: 13, base_mag: 16,
    level: 1, xp: 35,
  }),
};
