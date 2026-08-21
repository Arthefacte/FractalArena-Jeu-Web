/* ============================================================
   FRACTAL ARENA — Game data & beast factory
   (mirrors fractal_arena_source.gd constants)
   ============================================================ */
// Aiguillage API — une seule source pour toute l'app : stack locale quand la
// page tourne sur localhost (cf. _dev/ du repo serveur), prod Railway sinon.
// Garde typeof : les tests node chargent ce fichier sans objet location.
window.FA_API_URL = (typeof location !== "undefined" &&
  (location.hostname === "localhost" || location.hostname === "127.0.0.1"))
  ? "http://localhost:3000"
  : "https://fractal-arena-server-production.up.railway.app";

// Version des assets binaires (.glb). Les scripts portent « ?v=N » dans index.html ;
// les modèles 3D, eux, étaient chargés par des URL nues — et le 07/08/2026 on a
// découvert que Cloudflare servait encore les .glb d'avant l'allègement de la PR #90
// (12,7 Mo au lieu de 492 Ko, Age de 5 jours, et un 404 mis en cache sur
// assets/emblem.glb). Rien ne signalait au CDN que le fichier avait changé : le
// correctif du crash mobile n'atteignait aucun joueur. Une URL neuve à chaque
// livraison force le CDN à revenir chercher le fichier à l'origine.
// À BUMPER AVEC LES BALISES ?v= D'index.html — un test le vérifie.
// Ne sert plus que de REPLI : un asset absent du manifeste doit rester cache-busté
// plutôt que servi indéfiniment par le CDN.
window.FA_ASSET_V = "186";

// L'URL porte l'empreinte du CONTENU du fichier (asset-hashes.js, généré au build),
// et non la version du jeu. Versionner par la version du jeu — ce que faisait la
// PR #92 — donnait une URL neuve à chaque livraison pour un fichier inchangé :
// mesuré le 07/08/2026, `emblem.glb` était retéléchargé en entier (1350 Ko) à
// chaque déploiement, et c'était la requête la plus lente du service worker.
// Un fichier inchangé garde son URL, donc son cache ; un fichier modifié en change.
window.FA_ASSET_URL = function (chemin) {
  var table = window.FA_ASSET_HASHES || {};
  var v = table[chemin] || window.FA_ASSET_V;
  return chemin + (chemin.indexOf("?") === -1 ? "?v=" : "&v=") + v;
};

(function () {
  "use strict";

  // ---- Rarity ----
  const RARITY_ORDER = { Common: 0, Rare: 1, Epic: 2, Legendary: 3 };
  const RARITY_LIST = ["Common", "Rare", "Epic", "Legendary"];
  const RARITY_COLORS = {
    Common: "#9CA3AF", Rare: "#3B82F6", Epic: "#B026FF", Legendary: "#F7931A",
  };
  const RARITY_UPGRADE = { Common: "Rare", Rare: "Epic", Epic: "Legendary", Legendary: "Legendary" };
  // Mint odds
  const MINT_ODDS = [ ["Common", 0.70], ["Rare", 0.20], ["Epic", 0.08], ["Legendary", 0.02] ];

  // ---- Reliques (miroir serveur — data.node.js, fait foi) ----
  const RELIC_RARITY_MULT = { Common: 1.0, Rare: 1.25, Epic: 1.5, Legendary: 2.0 };
  const RELICS = {
    ruby_shard:     { name: "Ruby Shard",     stat: "atk",      bonus: 0.12 },
    sapphire_plate: { name: "Sapphire Plate", stat: "def",      bonus: 0.10 },
    quartz_lens:    { name: "Quartz Lens",    stat: "mag",      bonus: 0.10 },
    amber_cell:     { name: "Amber Cell",     stat: "hp",       bonus: 0.08 },
    cobalt_spring:  { name: "Cobalt Spring",  stat: "spd",      bonus: 0.10 },
    onyx_membrane:  { name: "Onyx Membrane",  stat: "dmgTaken", bonus: 0.08 },
    jade_circuit:   { name: "Jade Circuit",   stat: "crit",     bonus: 0.05 },
    prism_matrix:   { name: "Prism Matrix",   stat: "all",      bonus: 0.06 },
  };
  const RELIC_KEYS = Object.keys(RELICS);
  function relicEffect(type, rarity) {          // IDENTIQUE serveur (Object.hasOwn)
    const r = Object.hasOwn(RELICS, type) ? RELICS[type] : null;
    const m = Object.hasOwn(RELIC_RARITY_MULT, rarity) ? RELIC_RARITY_MULT[rarity] : null;
    if (!r || m == null) return null;
    return { stat: r.stat, bonus: r.bonus * m };
  }
  // Libellé court pour l'affichage des stats effectives (bonus déjà mis à l'échelle par rareté).
  const RELIC_STAT_LABEL = {
    atk: "ATK", def: "DEF", spd: "SPD", mag: "MAG", hp: "PV",
    all: "toutes stats", crit: "crit", dmgTaken: "dégâts subis",
  };
  function relicStatDelta(effect) {
    if (!effect) return "";
    const pct = Math.round(effect.bonus * 100);
    const label = RELIC_STAT_LABEL[effect.stat] || effect.stat;
    if (effect.stat === "dmgTaken") return "−" + pct + "% " + label; // − U+2212
    return "+" + pct + "% " + label;
  }

  // ---- Presets ----
  const PRESET_COLORS = {
    aggressive: "#FF3B5C", berserker: "#F7931A", tactician: "#9F00FF",
    controller: "#00F0FF", lifesteal: "#27E08A", sniper: "#FFE600",
  };
  const TYPE_TO_PRESET = {
    HASH: "aggressive", MINING: "berserker", LEDGER: "tactician",
    NETWORK: "controller", BLOCK: "lifesteal", GENESIS: "sniper",
  };

  // ---- Creature art (real assets) ----
  const ART = {
    HashByte: "assets/HASHBYTE.webp",
    Miner: "assets/MINER.webp",
    LEDGER: "assets/LEDGER.webp",
    NETWORK: "assets/NETWORK.webp",
    BLOCK: "assets/BLOCK.webp",
    GENESIS: "assets/GENESIS.webp",
  };
  // Display names per type
  const TYPE_LABEL = {
    HASH: "HashByte", MINING: "Miner", LEDGER: "Ledger",
    NETWORK: "Network", BLOCK: "Block", GENESIS: "Genesis",
  };

  // ---- Rangs (qualité des stats de base ; fixé à l'invocation, à vie) ----
  // PARITÉ STRICTE avec data.node.js (serveur) — ne jamais diverger.
  const RANK_LIST = ["C", "B", "A", "S"];
  const RANK_FACTOR = { C: 1.0, B: 1.25, A: 1.6, S: 2.0 };
  const RANK_ODDS = [ ["C", 0.55], ["B", 0.28], ["A", 0.13], ["S", 0.04] ];
  const RANK_COLORS = { C: "#9CA3AF", B: "#38BDF8", A: "#FB923C", S: "#FACC15" };

  // Art par rang : cartes complètes bakées type × rang (assets/{TYPE}_{RANG}.webp).
  // image_key (clé ART) → préfixe de fichier.
  const ART_FILE_KEY = {
    HashByte: "HASHBYTE", Miner: "MINER", LEDGER: "LEDGER",
    NETWORK: "NETWORK", BLOCK: "BLOCK", GENESIS: "GENESIS",
  };
  function artFor(b) {
    const fk = b && ART_FILE_KEY[b.image_key];
    if (!fk) return ART[b && b.image_key]; // repli : art de base du type
    const rk = b.rank && RANK_FACTOR[b.rank] ? b.rank : "C"; // défaut paresseux legacy
    return "assets/" + fk + "_" + rk + ".webp";
  }

  // ---- Affinités entre types (cf. specs/GAMEPLAY_DEPTH_PACK.md §1) ----
  // Cycle fermé : HASH > MINING > LEDGER > NETWORK > BLOCK > GENESIS > HASH
  const TYPE_ADVANTAGE = {
    HASH: { strong: "MINING", weak: "GENESIS" },
    MINING: { strong: "LEDGER", weak: "HASH" },
    LEDGER: { strong: "NETWORK", weak: "MINING" },
    NETWORK: { strong: "BLOCK", weak: "LEDGER" },
    BLOCK: { strong: "GENESIS", weak: "NETWORK" },
    GENESIS: { strong: "HASH", weak: "BLOCK" },
  };
  // ×1.25 si l'attaquant bat le type du défenseur, ×0.80 s'il est battu par lui.
  function getTypeMultiplier(atkType, defType) {
    const adv = TYPE_ADVANTAGE[atkType];
    if (!adv) return 1.0;
    if (adv.strong === defType) return 1.25;
    if (adv.weak === defType) return 0.80;
    return 1.0;
  }

  // ---- Templates (18) ----
  const TEMPLATES = {
    "HashByte-1": { hp: 115, atk: 18, def: 5, spd: 14, mag: 20, type: "HASH", img: "HashByte" },
    "HashByte-2": { hp: 108, atk: 20, def: 4, spd: 17, mag: 23, type: "HASH", img: "HashByte" },
    "HashByte-3": { hp: 121, atk: 15, def: 6, spd: 11, mag: 18, type: "HASH", img: "HashByte" },
    "Miner-1": { hp: 147, atk: 16, def: 7, spd: 11, mag: 10, type: "MINING", img: "Miner" },
    "Miner-2": { hp: 160, atk: 14, def: 10, spd: 9, mag: 9, type: "MINING", img: "Miner" },
    "Miner-3": { hp: 141, atk: 17, def: 6, spd: 12, mag: 11, type: "MINING", img: "Miner" },
    "Ledger-1": { hp: 119, atk: 12, def: 7, spd: 11, mag: 19, type: "LEDGER", img: "LEDGER" },
    "Ledger-2": { hp: 113, atk: 11, def: 8, spd: 10, mag: 21, type: "LEDGER", img: "LEDGER" },
    "Ledger-3": { hp: 124, atk: 14, def: 6, spd: 12, mag: 18, type: "LEDGER", img: "LEDGER" },
    "Network-1": { hp: 104, atk: 18, def: 5, spd: 14, mag: 20, type: "NETWORK", img: "NETWORK" },
    "Network-2": { hp: 108, atk: 15, def: 6, spd: 16, mag: 18, type: "NETWORK", img: "NETWORK" },
    "Network-3": { hp: 112, atk: 16, def: 4, spd: 15, mag: 21, type: "NETWORK", img: "NETWORK" },
    "Block-1": { hp: 148, atk: 14, def: 8, spd: 9, mag: 11, type: "BLOCK", img: "BLOCK" },
    "Block-2": { hp: 151, atk: 12, def: 11, spd: 7, mag: 9, type: "BLOCK", img: "BLOCK" },
    "Block-3": { hp: 139, atk: 15, def: 7, spd: 11, mag: 12, type: "BLOCK", img: "BLOCK" },
    "Genesis-1": { hp: 113, atk: 15, def: 7, spd: 11, mag: 21, type: "GENESIS", img: "GENESIS" },
    "Genesis-2": { hp: 108, atk: 16, def: 6, spd: 12, mag: 19, type: "GENESIS", img: "GENESIS" },
    "Genesis-3": { hp: 118, atk: 14, def: 8, spd: 10, mag: 22, type: "GENESIS", img: "GENESIS" },
  };
  const TEMPLATE_KEYS = Object.keys(TEMPLATES);
  const TEMPLATES_BY_TYPE = {};
  TEMPLATE_KEYS.forEach((k) => {
    const ty = TEMPLATES[k].type;
    (TEMPLATES_BY_TYPE[ty] = TEMPLATES_BY_TYPE[ty] || []).push(k);
  });

  // ---- Economy ----
  const ECON = {
    MINT_COST: 10000,
    FREE_FIGHTS_PER_DAY: 5,
    BET: { bronze: 10, silver: 25, gold: 50 },
    BET_GAIN: { bronze: 7, silver: 17, gold: 35 }, // net win
    PAYOUT_MULT: 1.7,
    MILESTONE_EVERY: 50,
    MILESTONE_REWARD: 50,
    LOOP_SILVER_MAX: 100,
    LOOP_GOLD_MAX: 50,
    TICKET_SILVER_PER_MS: 2,
    TICKET_GOLD_PER_MS: 0,
    WITHDRAW_MIN: 500,
    WITHDRAW_MAX: 20000,
    DEPOSIT_MIN: 100,
    XP_PER_VICTORY: 50,
    MAX_LEVEL_UPGRADE: 100,
    WELCOME_LOCKED: 1000,
    WELCOME_LIQUID: 0,
    WELCOME_TICKETS_SILVER: 5,
    VANITY_RENAME: 1000,
    VANITY_TITLE: 5000,
  };

  const FORGE = {
    FUSION_COST: { Common: 3000, Rare: 8000, Epic: 25000 },
    FUSION_RATE: { Common: 0.6, Rare: 0.45, Epic: 0.3 },
    REROLL_BASE: { Common: 1000, Rare: 3000, Epic: 8000, Legendary: 25000 },
  };

  const BOOSTS = {
    xp_boost: { cost: 500, charges: 50, color: "#FFE600" },
    lucky_strike: { cost: 750, charges: 50, color: "#F7931A" },
    momentum: { cost: 750, charges: 50, color: "#9B5CFF" },
    catalyst: { cost: 750, charges: 50, color: "#27E08A" },
  };

  // ---- helpers ----
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function levelMult(level) { return 1 + 0.03 * (level - 1); }

  function rarityVariance(rarity) {
    switch (rarity) {
      case "Common": return rand(0.85, 1.0);
      case "Rare": return rand(1.2, 1.4);
      case "Epic": return rand(1.65, 1.9);
      case "Legendary": return rand(2.25, 2.6);
      default: return 1.0;
    }
  }
  function rollRarity() {
    const r = Math.random();
    let acc = 0;
    for (const [name, p] of MINT_ODDS) { acc += p; if (r < acc) return name; }
    return "Common";
  }
  function rollRank() {
    const r = Math.random();
    let acc = 0;
    for (const [name, p] of RANK_ODDS) { acc += p; if (r < acc) return name; }
    return "C";
  }

  let _idc = 0;
  function newId() { return "beast_" + (_idc++) + "_" + ((Math.random() * 1e6) | 0); }

  // Effective stat getters
  function eff(beast, key) { return Math.floor(beast["base_" + key] * levelMult(beast.level)); }
  function maxHp(b) { return eff(b, "hp"); }

  // Format compact pour les cellules de stats (≤ 4 caractères — elles font ~28px) :
  // < 10k brut, 10k–999k arrondi en "Nk", au-delà "N.NM". La valeur exacte reste
  // accessible via l'attribut title posé par les composants.
  function fmtStat(n) {
    if (n < 10000) return String(Math.floor(n));
    if (n < 999500) return Math.round(n / 1000) + "k";
    return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  }

  // Make a beast from template
  function mintBeast(templateName, forceRarity, idx, rank) {
    const tpl = TEMPLATES[templateName];
    const rarity = forceRarity || rollRarity();
    const rk = RANK_FACTOR[rank] ? rank : "C";
    const v = rarityVariance(rarity) * RANK_FACTOR[rk];
    const b = {
      id: newId(),
      template_name: templateName,
      type: tpl.type,
      image_key: tpl.img,
      preset: TYPE_TO_PRESET[tpl.type],
      rarity,
      rank: rk,
      base_hp: Math.floor(tpl.hp * v),
      base_atk: Math.floor(tpl.atk * v),
      base_def: Math.floor(tpl.def * v),
      base_spd: Math.floor(tpl.spd * v),
      base_mag: Math.floor(tpl.mag * v),
      level: 1,
      xp: 0,
      reroll_count: 0,
      name: TYPE_LABEL[tpl.type] + " #" + (idx == null ? ((Math.random() * 900 + 100) | 0) : idx),
      custom_name: null,
      sv: 1, // version de stats (rééquilibrage des types) — évite un double-scaling à la migration
    };
    return b;
  }

  function starterRoster() {
    return [
      mintBeast("HashByte-1", "Common", 1, "C"),
      mintBeast("Block-1", "Common", 2, "C"),
      mintBeast("Ledger-1", "Common", 3, "C"),
    ];
  }

  function xpToNext(beast) { return beast.level * 100; }
  function displayName(b) { return b.custom_name || b.name; }

  // ---- Simulated on-chain name-inscription scan ----
  // Deterministic per wallet: a seeded RNG picks a handful of ".fb" names the
  // wallet "owns". In a real build this would query the wallet's inscriptions.
  const _NAME_POOL = [
    "FractalArena", "Satoshi", "BlockForge", "HashKing", "DeepMiner", "Ordinal",
    "ChainBreaker", "GenesisBlock", "MerkleRoot", "NodeRunner", "ProofOfWork",
    "DiamondHands", "WhaleGod", "ByteLord", "CryptoSamurai", "LedgerWolf",
    "MoonMiner", "FractalKnight", "BitForge", "VoidWalker",
  ];
  function _seedFromStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function _mulberry(seed) { return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function walletNameInscriptions(address) {
    if (!address) return [];
    const rng = _mulberry(_seedFromStr(address));
    // Most wallets hold a handful; ~1 in 4 is a "collector" with many names.
    const collector = rng() < 0.25;
    const n = collector ? 30 + Math.floor(rng() * 110) : 2 + Math.floor(rng() * 5);
    const out = [];
    const seen = new Set();
    let guard = 0;
    while (out.length < n && guard++ < n * 6) {
      const base = _NAME_POOL[Math.floor(rng() * _NAME_POOL.length)];
      // numeric suffix keeps large collections unique (e.g. Satoshi420.fb)
      const suffix = out.length < 4 && rng() < 0.5 ? "" : String(Math.floor(rng() * 9000) + 100);
      const name = base + suffix + ".fb";
      if (seen.has(name)) continue;
      seen.add(name);
      out.push({
        name,
        number: 4000000000 + Math.floor(rng() * 900000000),
        sats: 330,
        days: 1 + Math.floor(rng() * 120),
      });
    }
    return out;
  }

  // Grant XP to a team, returns events
  function grantXp(team, xp) {
    const events = [];
    for (const b of team) {
      b.xp += xp;
      while (b.xp >= xpToNext(b)) {
        b.xp -= xpToNext(b);
        b.level += 1;
        events.push({ type: "levelup", beast: b });
        if (b.level >= ECON.MAX_LEVEL_UPGRADE && b.rarity !== "Legendary") {
          upgradeRarity(b);
          events.push({ type: "rarity_up", beast: b });
          break;
        }
      }
    }
    return events;
  }

  function upgradeRarity(b) {
    const nr = RARITY_UPGRADE[b.rarity];
    if (nr === b.rarity) return;
    const curHp = maxHp(b), curAtk = eff(b, "atk"), curDef = eff(b, "def"),
      curSpd = eff(b, "spd"), curMag = eff(b, "mag");
    const v = rarityVariance(nr);
    b.rarity = nr;
    b.base_hp = Math.floor(curHp * v);
    b.base_atk = Math.floor(curAtk * v);
    b.base_def = Math.floor(curDef * v);
    b.base_spd = Math.floor(curSpd * v);
    b.base_mag = Math.floor(curMag * v);
    b.level = 1;
    b.xp = 0;
  }

  // Average / majority rarity of a team
  function avgRarity(team) {
    const counts = { Common: 0, Rare: 0, Epic: 0, Legendary: 0 };
    team.forEach((c) => { counts[c.rarity]++; });
    let best = "Common", bc = 0;
    for (const r of RARITY_LIST) {
      if (counts[r] > bc) { bc = counts[r]; best = r; }
      else if (counts[r] === bc && RARITY_ORDER[r] > RARITY_ORDER[best]) best = r;
    }
    return best;
  }
  function avgLevel(team) {
    if (!team.length) return 1;
    return Math.round(team.reduce((s, c) => s + c.level, 0) / team.length);
  }

  // Generate a mirror-style enemy team with a difficulty multiplier
  function generateEnemyTeam(playerTeam, diffMult) {
    const types = ["HASH", "MINING", "LEDGER", "NETWORK", "BLOCK", "GENESIS"];
    // shuffle
    for (let i = types.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[types[i], types[j]] = [types[j], types[i]]; }
    const chosen = types.slice(0, 3);
    const enemies = [];
    for (let i = 0; i < 3; i++) {
      const ptype = chosen[i];
      const tname = pick(TEMPLATES_BY_TYPE[ptype]);
      const mirrorRarity = playerTeam[i].rarity;
      const g = mintBeast(tname, mirrorRarity);
      g.level = playerTeam[i].level;
      g.xp = 0;
      g.name = TYPE_LABEL[ptype];
      const m = diffMult * (0.96 + Math.random() * 0.08);
      g.base_hp = Math.max(1, Math.floor(g.base_hp * m));
      g.base_atk = Math.max(1, Math.floor(g.base_atk * m));
      g.base_def = Math.max(1, Math.floor(g.base_def * m));
      g.base_spd = Math.max(1, Math.floor(g.base_spd * m));
      g.base_mag = Math.max(1, Math.floor(g.base_mag * m));
      enemies.push(g);
    }
    // shuffle final
    for (let i = enemies.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0;[enemies[i], enemies[j]] = [enemies[j], enemies[i]]; }
    return enemies;
  }

  // ============================================================
  //  PvE CAMPAIGN — 6 mondes × 10 étages, génération procédurale des étages
  //  (cf. specs/CAMPAIGN.spec.md), déterministe côté client. Le COMBAT, lui, est
  //  résolu côté serveur (FA_ENGINE/engine.js client est obsolète et retiré).
  // ============================================================
  const FLOORS_PER_WORLD = 10;
  const BOSS_FLOOR = 9;               // 10e étage (index 0-based)
  const STARS_PER_WORLD = FLOORS_PER_WORLD * 3; // 30 étoiles = 100 %
  const CAMP_REWARD_FLOOR = 20;        // FRACTALARENA locked par étage (base)
  const CAMP_REWARD_BOSS = 20;        // FRACTALARENA locked pour un boss
  // Récompense progressive : +4 par étage, bonus ×2 pour le boss
  function campReward(floorIndex, isBoss) {
    const base = 12 + floorIndex * 4;
    return base + (isBoss ? base + 20 : 0);
  }
  const ALL_ENEMY_TYPES = ["HASH", "MINING", "LEDGER", "NETWORK", "BLOCK", "GENESIS"];

  // Config des 6 mondes. `type` = type dominant (ou "MIX" pour Le Cœur).
  // `img` = clé d'art (D.ART) pour la vignette. `starsReq` = étoiles
  // cumulées (tous mondes) requises pour déverrouiller ce monde.
  const WORLDS = [
    { id: 0, type: "BLOCK",   img: "BLOCK",   color: "#9CA3AF", starsReq: 0 },
    { id: 1, type: "MINING",  img: "Miner",   color: "#F7931A", starsReq: 10 },
    { id: 2, type: "LEDGER",  img: "LEDGER",  color: "#3B82F6", starsReq: 20 },
    { id: 3, type: "NETWORK", img: "NETWORK", color: "#00F0FF", starsReq: 40 },
    { id: 4, type: "GENESIS", img: "GENESIS", color: "#B026FF", starsReq: 65 },
    { id: 5, type: "MIX",     img: "NETWORK", color: "#FF3B5C", starsReq: 90 },
  ];

  // Rareté/niveau AFFICHÉS par bande de difficulté (cf. spec §2.3). Purement
  // cosmétiques : la PUISSANCE réelle est pilotée par pveAbsPower (absolue, fixée
  // par l'étage) — la campagne se joue aux stats des entités, pas en relatif au joueur.
  function pveLevel(worldIndex, floorIndex) {
    let base;
    if (floorIndex <= 2) base = 1 + floorIndex;             // 1..3
    else if (floorIndex <= 5) base = 5 + (floorIndex - 3) * 2; // 5,7,9
    else if (floorIndex <= 8) base = 10 + (floorIndex - 6) * 4; // 10,14,18
    else base = 25;                                          // boss
    return base + worldIndex * 3;
  }
  function pveRarity(worldIndex, floorIndex) {
    if (WORLDS[worldIndex].type === "MIX") {
      return floorIndex === BOSS_FLOOR ? "Legendary" : (Math.random() < 0.5 ? "Epic" : "Legendary");
    }
    const r = Math.random();
    if (floorIndex === 0) return "Common"; // étage 1 = 100% Common (tutorial)
    if (floorIndex === BOSS_FLOOR) return r < 0.5 ? "Epic" : "Legendary";
    if (floorIndex <= 2) return r < 0.7 ? "Common" : "Rare";
    if (floorIndex <= 5) return r < 0.5 ? "Rare" : "Epic";
    return r < 0.6 ? "Epic" : "Legendary";
  }
  // Puissance ABSOLUE de l'étage (multiplicateur vs le template brut), pilotée par
  // (monde, étage) UNIQUEMENT — plus aucune référence à l'équipe du joueur. La campagne
  // « se joue aux stats » : monter ses bêtes / fusionner / reroll change réellement l'issue,
  // et un étage peut murer une équipe trop faible. Courbe quadratique : douce à l'ouverture
  // (un starter Common passe les 2-3 premiers étages), raide en fin de monde, +scaling/monde.
  const PVE_BOSS_MULT = 1.12;
  function pveAbsPower(worldIndex, floorIndex) {
    return 0.72 + 0.08 * floorIndex + 0.018 * floorIndex * floorIndex + 0.40 * worldIndex;
  }
  function generatePvEBeast(worldIndex, floorIndex, slot) {
    const world = WORLDS[worldIndex];
    const type = world.type === "MIX" ? pick(ALL_ENEMY_TYPES) : world.type;
    const isBoss = floorIndex === BOSS_FLOOR && slot === 1;
    const level = pveLevel(worldIndex, floorIndex);
    const rarity = pveRarity(worldIndex, floorIndex);        // rareté/niveau = affichage cosmétique
    const variant = (floorIndex % 3) + 1;                    // 1, 2 ou 3
    const templateName = TYPE_LABEL[type] + "-" + variant;   // ex "Block-1"
    const tpl = TEMPLATES[templateName];

    let scale = pveAbsPower(worldIndex, floorIndex);
    if (isBoss) scale *= PVE_BOSS_MULT;                      // l'unité boss frappe un cran au-dessus
    scale *= 0.92 + Math.random() * 0.16;                   // variance ±8 % (casse les timeouts déterministes)
    // Puissance EFFECTIVE = template × scale ; eff() ré-applique levelMult(level) pour
    // l'affichage du niveau, on neutralise donc ce facteur ici.
    const lm = levelMult(level);
    const b = mintBeast(templateName, rarity);
    b.level = level;
    b.xp = 0;
    for (const k of ["hp", "atk", "def", "spd", "mag"]) {
      b["base_" + k] = Math.max(1, Math.floor(tpl[k] * scale / lm));
    }
    b.name = TYPE_LABEL[type];
    b.is_boss = isBoss;
    return b;
  }
  // Renvoie une ÉQUIPE de 3 ennemis pour un (monde, étage). Puissance absolue,
  // aucune référence à l'équipe du joueur.
  function generatePvEEnemy(worldIndex, floorIndex) {
    const team = [];
    for (let i = 0; i < 3; i++) team.push(generatePvEBeast(worldIndex, floorIndex, i));
    return team;
  }

  // Titres de campagne : fonction PURE de la progression imbriquée
  // ({ [w]: { stars: number[] } }). Rien à persister — un monde à 30/30 vaut
  // son titre, tous les mondes à 100 % valent en plus le titre Légende.
  function deriveCampaignTitles(progress) {
    const titles = [];
    WORLDS.forEach((_, i) => {
      const wp = progress && progress[i];
      const total = wp ? wp.stars.reduce((a, b) => a + b, 0) : 0;
      if (total === STARS_PER_WORLD) titles.push("CAMP_W" + (i + 1) + "_TITLE");
    });
    if (titles.length === WORLDS.length) titles.push("CAMP_LEGEND_TITLE");
    return titles;
  }

  window.FA_DATA = {
    RARITY_ORDER, RARITY_LIST, RARITY_COLORS, RARITY_UPGRADE, MINT_ODDS,
    RANK_LIST, RANK_FACTOR, RANK_ODDS, RANK_COLORS, rollRank, artFor,
    RELICS, RELIC_KEYS, RELIC_RARITY_MULT, relicEffect, relicStatDelta,
    PRESET_COLORS, TYPE_TO_PRESET, TYPE_LABEL, ART,
    TYPE_ADVANTAGE, getTypeMultiplier,
    TEMPLATES, TEMPLATE_KEYS, TEMPLATES_BY_TYPE,
    ECON, FORGE, BOOSTS,
    rand, pick, levelMult, rarityVariance, rollRarity, newId,
    eff, maxHp, fmtStat, mintBeast, starterRoster, xpToNext, displayName,
    grantXp, upgradeRarity, avgRarity, avgLevel, generateEnemyTeam,
    walletNameInscriptions,
    // PvE Campaign
    WORLDS, FLOORS_PER_WORLD, BOSS_FLOOR, STARS_PER_WORLD,
    campReward,
    generatePvEEnemy,
    deriveCampaignTitles,
  };
})();
