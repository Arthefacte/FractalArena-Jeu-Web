/* ============================================================
   FRACTAL ARENA — Game data & beast factory
   (mirrors fractal_arena_source.gd constants)
   ============================================================ */
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
    HashByte: "assets/HASHBYTE.png",
    Miner: "assets/MINER.png",
    LEDGER: "assets/LEDGER.png",
    NETWORK: "assets/NETWORK.png",
    BLOCK: "assets/BLOCK.png",
    GENESIS: "assets/GENESIS.png",
  };
  // Display names per type
  const TYPE_LABEL = {
    HASH: "HashByte", MINING: "Miner", LEDGER: "Ledger",
    NETWORK: "Network", BLOCK: "Block", GENESIS: "Genesis",
  };

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
    MINT_COST: 20000,
    FREE_FIGHTS_PER_DAY: 5,
    BET: { bronze: 10, silver: 25, gold: 50 },
    BET_GAIN: { bronze: 7, silver: 17, gold: 35 }, // net win
    PAYOUT_MULT: 1.7,
    MILESTONE_EVERY: 50,
    MILESTONE_REWARD: 50,
    DEFEAT_POOL_RATIO: 0.667,
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
    xp_boost: { cost: 500, fights: 50, color: "#FFE600" },
    insurance: { cost: 200, charges: 5, color: "#27E08A" },
    lucky_strike: { cost: 750, fights: 15, color: "#F7931A" },
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

  let _idc = 0;
  function newId() { return "beast_" + (_idc++) + "_" + ((Math.random() * 1e6) | 0); }

  // Effective stat getters
  function eff(beast, key) { return Math.floor(beast["base_" + key] * levelMult(beast.level)); }
  function maxHp(b) { return eff(b, "hp"); }

  // Make a beast from template
  function mintBeast(templateName, forceRarity, idx) {
    const tpl = TEMPLATES[templateName];
    const rarity = forceRarity || rollRarity();
    const v = rarityVariance(rarity);
    const b = {
      id: newId(),
      template_name: templateName,
      type: tpl.type,
      image_key: tpl.img,
      preset: TYPE_TO_PRESET[tpl.type],
      rarity,
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
      mintBeast("HashByte-1", "Common", 1),
      mintBeast("Block-1", "Common", 2),
      mintBeast("Ledger-1", "Common", 3),
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
  //  PvE CAMPAIGN — 6 mondes × 10 étages, génération procédurale
  //  (cf. specs/CAMPAIGN.spec.md). Tout est local : aucune dépendance
  //  serveur. Le combat est joué côté client via FA_ENGINE.runBattle.
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

  window.FA_DATA = {
    RARITY_ORDER, RARITY_LIST, RARITY_COLORS, RARITY_UPGRADE, MINT_ODDS,
    PRESET_COLORS, TYPE_TO_PRESET, TYPE_LABEL, ART,
    TYPE_ADVANTAGE, getTypeMultiplier,
    TEMPLATES, TEMPLATE_KEYS, TEMPLATES_BY_TYPE,
    ECON, FORGE, BOOSTS,
    rand, pick, levelMult, rarityVariance, rollRarity, newId,
    eff, maxHp, mintBeast, starterRoster, xpToNext, displayName,
    grantXp, upgradeRarity, avgRarity, avgLevel, generateEnemyTeam,
    walletNameInscriptions,
    // PvE Campaign
    WORLDS, FLOORS_PER_WORLD, BOSS_FLOOR, STARS_PER_WORLD,
    campReward,
    generatePvEEnemy,
  };
})();
