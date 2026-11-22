/* FRACTAL ARENA — Forge : helpers purs (testables Node) */
(function () {
  const KEYS = [
    { stat: "hp",  key: "base_hp",  label: "HP" },
    { stat: "atk", key: "base_atk", label: "ATK" },
    { stat: "def", key: "base_def", label: "DEF" },
    { stat: "spd", key: "base_spd", label: "SPD" },
    { stat: "mag", key: "base_mag", label: "MAG" },
  ];
  // Verrous de reroll (miroir serveur forge.js — PR#49) : max 2, surcoût ×1.5/verrou.
  const MAX_REROLL_LOCKS = 2;
  const REROLL_LOCK_MULT = 1.5;

  // Ajoute/retire un verrou (immutable). Retourne null si l'ajout dépasserait le max.
  function toggleLock(locks, stat) {
    const L = Array.isArray(locks) ? locks : [];
    if (L.includes(stat)) return L.filter((s) => s !== stat);
    if (L.length >= MAX_REROLL_LOCKS) return null;
    return [...L, stat];
  }

  // Coût affiché avec verrous : arrondi sur le PRODUIT (parité formule serveur).
  function withLockCost(cost, nLocks) {
    return Math.round(cost * Math.pow(REROLL_LOCK_MULT, nLocks || 0));
  }

  function rerollDiff(oldStats, newStats, locks) {
    const o = oldStats || {}, n = newStats || {}, L = Array.isArray(locks) ? locks : [];
    return KEYS.map(({ stat, key, label }) => {
      const from = Number(o[key]) || 0;
      const to = Number(n[key]) || 0;
      const dir = to > from ? "up" : to < from ? "down" : "same";
      return { key, label, from, to, dir, locked: L.includes(stat) };
    });
  }

  // Fusion : sel[0] = conservée (primary serveur), sel[1] = sacrifiée. Inverse les rôles (immutable).
  function fusionSwap(sel) {
    const S = Array.isArray(sel) ? sel : [];
    if (S.length !== 2) return S;
    return [S[1], S[0]];
  }

  // Puissance d'une entité pour comparer deux candidates à une fusion : le TOTAL des 5 stats
  // de base (le rang ET le tirage d'invocation sont déjà bakés dedans) × le facteur de niveau.
  // Aucune table du moteur n'est recopiée ici : les deux entités d'une fusion ont la MÊME
  // rareté (règle serveur), donc le poids de rareté s'annule dans la comparaison.
  // Le reroll ne fausse pas la mesure : il redistribue le même total (rerollStats, serveur).
  function entityPower(b) {
    if (!b) return 0;
    const D = window.FA_DATA;
    const base = (b.base_hp || 0) + (b.base_atk || 0) + (b.base_def || 0) + (b.base_spd || 0) + (b.base_mag || 0);
    const lm = D && D.levelMult ? D.levelMult(b.level || 1) : 1;
    return base * lm;
  }

  // Garde de fusion : l'entité SACRIFIÉE est-elle plus forte que celle conservée ?
  // Motif produit : le joueur qui ne lit pas le guide sacrifiait son meilleur tirage (rang
  // supérieur, ou tirage au plafond) sans s'en rendre compte — rien à l'écran ne le disait.
  // Renvoie null quand il n'y a rien à signaler (sélection incomplète, ou sacrifiée ≤ conservée) :
  // l'appelant n'a donc qu'un cas à traiter.
  function fusionKeepWarning(kept, sacrificed) {
    if (!kept || !sacrificed) return null;
    const pk = entityPower(kept), ps = entityPower(sacrificed);
    if (!(ps > pk)) return null;
    return {
      keptPower: Math.round(pk),
      sacrificedPower: Math.round(ps),
      gapPct: pk > 0 ? Math.round((ps / pk - 1) * 100) : null,
    };
  }

  // État du bouton Fusionner. Trois vitesses, trois ressources (décision fondateur
  // 13/10/2026) :
  //  - ticket Or (gratuit) : seul le ticket compte, le solde FA est ignoré (0 FA côté serveur) ;
  //  - tickets Argent : prix progressif par palier (5/15/50) ; même garantie de 100 %, donc
  //    là encore le solde FA ne compte pas — mais le ticket manquant doit se DIRE, sinon le
  //    bouton resterait bloqué sans que le joueur sache pourquoi ;
  //  - FA : solde requis, 75 % de réussite (le seul mode où l'on peut échouer).
  function fusionButtonState({ gold, silver, cost, balance, ticketsGold, ticketsSilver, silverCost, busy }) {
    if (busy) return { disabled: true, showInsufficient: false };
    if (gold) return { disabled: (ticketsGold || 0) < 1, showInsufficient: false };
    if (silver) {
      const lack = (ticketsSilver || 0) < (silverCost || 0);
      return { disabled: lack, showInsufficient: false, showSilverMissing: lack };
    }
    const insufficient = (balance || 0) < cost;
    return { disabled: insufficient, showInsufficient: insufficient };
  }

  // ---- Fusion de RANG (3 entités de même rang, rareté indifférente → 1 entité Commune
  //      du rang au-dessus, niveau 1, 100 %) — décision fondateur 11/11/2026 ----
  // Barèmes et paliers lus sur window.FA_DATA À L'APPEL (D.FORGE.RANK_FUSE_COST,
  // D.RANK_LIST) : aucune table recopiée ici, sinon elle dériverait du serveur en silence.

  function rankNext(rank) {
    const D = window.FA_DATA;
    const L = D && D.RANK_LIST ? D.RANK_LIST : [];
    const i = L.indexOf(rank);
    return i >= 0 ? (L[i + 1] || null) : null;
  }

  // Prix du palier d'entrée. null pour un rang S (sommet) : la fusion est refusée, pas gratuite.
  function rankFuseCost(rank) {
    const D = window.FA_DATA;
    const T = D && D.FORGE ? D.FORGE.RANK_FUSE_COST : null;
    return (T && Object.hasOwn(T, rank)) ? T[rank] : null;
  }

  // Normalisations IDENTIQUES au serveur (forge.js, POST /forge/rank-fuse) : une entité
  // antérieure au champ `rank` est lue « C », une entité sans `rarity` est lue « Commune » —
  // c'est ainsi que l'écran les affiche. Comparer en brut refusait la fusion d'entités que
  // le joueur voyait identiques (vécu 05/11 sur le rang).
  function rankKey(beast) {
    const D = window.FA_DATA;
    const L = (D && D.RANK_LIST) ? D.RANK_LIST : [];
    return (beast && L.includes(beast.rank)) ? beast.rank : "C";
  }
  function rarityKey(beast) {
    return (beast && typeof beast.rarity === "string" && beast.rarity) ? beast.rarity : "Common";
  }

  // Sélection de 3 entités éligibles. Refus (null) : une 4ᵉ, ou une entité d'un autre rang
  // ou d'une autre RARETÉ que la première choisie (décision fondateur 21/11/2026 : les trois
  // doivent partager rang ET rareté). Re-cliquer une entité la retire.
  // On garde les ENTITÉS (pas les ids) : la modale d'avertissement doit nommer leur niveau,
  // leur XP, leurs talents et leur équipement — un id seul ne dit rien au joueur.
  function rankSelToggle(sel, beast) {
    const S = Array.isArray(sel) ? sel : [];
    if (!beast) return null;
    if (S.some((b) => b.id === beast.id)) return S.filter((b) => b.id !== beast.id);
    if (S.length >= 3) return null;
    if (S.length && rankKey(S[0]) !== rankKey(beast)) return null;
    if (S.length && rarityKey(S[0]) !== rarityKey(beast)) return null;
    return [...S, beast];
  }

  function rankFuseState({ sel, balance, busy }) {
    const S = Array.isArray(sel) ? sel : [];
    const rank = S.length ? (S[0].rank || "C") : null;
    const nextRank = rank ? rankNext(rank) : null;
    const cost = rank ? rankFuseCost(rank) : null;
    const maxRank = rank != null && nextRank == null;   // S : sommet, rien au-dessus
    const ready = S.length === 3 && cost != null;
    const insufficient = ready && (balance || 0) < cost;
    return {
      rank, nextRank, cost, maxRank,
      disabled: !!busy || !ready || insufficient,
      showInsufficient: insufficient,
      missing: 3 - S.length,
    };
  }

  // Choix de la carte GARDÉE (décision fondateur 21/11/2026) : la carte désignée monte d'un
  // rang SUR PLACE — elle conserve id, niveau, XP, rareté, template, art, nom, talents et
  // équipement. Ce n'est donc plus « quel type tu produis » mais « laquelle tu gardes » :
  // une entrée par carte sélectionnée, dans l'ordre de sélection du joueur.
  function rankFuseKeptChoices(beasts) {
    const D = window.FA_DATA;
    return (Array.isArray(beasts) ? beasts : []).filter(Boolean).map((b) => ({
      id: b.id,
      name: (D && D.displayName) ? D.displayName(b) : (b.name || b.id),
      template_name: b.template_name,
      type: b.type,
      level: b.level || 1,
      rarity: b.rarity,
      rollPct: Number.isFinite(b.summon_roll_pct) ? b.summon_roll_pct : null,
    }));
  }

  function countTalents(b) {
    if (!b || !b.talents || typeof b.talents !== "object") return 0;
    return Object.keys(b.talents).filter((k) => b.talents[k]).length;
  }

  // Ce que la modale d'avertissement DOIT nommer (exigence explicite du fondateur) : la carte
  // qui SURVIT (elle monte d'un rang en place, elle garde niveau, XP, rareté et art) et les
  // DEUX qui partent, avec leur niveau, leur XP, leurs talents et leur équipement.
  // Plus de `targetRarity` ni de `bestRollPct` : la sortie n'est plus une entité neuve, et le
  // tirage reste celui de la gardée (décision 21/11/2026 — plus jamais « le meilleur des trois »).
  // Renvoie null tant que la sélection n'est pas complète : l'appelant n'a qu'un cas à traiter.
  function rankFuseWarning(sel, keptId) {
    const D = window.FA_DATA;
    const S = Array.isArray(sel) ? sel : [];
    if (S.length !== 3) return null;
    const lines = S.map((b) => ({
      id: b.id,
      name: (D && D.displayName) ? D.displayName(b) : (b.name || b.id),
      rarity: rarityKey(b),
      rank: rankKey(b),
      level: b.level || 1,
      xp: b.xp || 0,
      talents: countTalents(b),
      equipment: (b.relic_id ? 1 : 0) + (b.core_id ? 1 : 0),
      rollPct: Number.isFinite(b.summon_roll_pct) ? b.summon_roll_pct : null,
    }));
    // `keptId` inconnu (carte décochée entre-temps) : on retombe sur la première — jamais
    // d'avertissement vide, et l'écran affiche la même carte que celle annoncée ici.
    const kept = lines.find((l) => l.id === keptId) || lines[0];
    const sacrificed = lines.filter((l) => l.id !== kept.id);
    return {
      kept,
      sacrificed,
      lostXp: sacrificed.reduce((s, l) => s + l.xp, 0),
      lostTalents: sacrificed.reduce((s, l) => s + l.talents, 0),
      lostEquipment: sacrificed.reduce((s, l) => s + l.equipment, 0),
    };
  }

  // ---- Forge d'équipement (fusion de reliques + désenchantement) ----
  // Constantes lues sur window.FA_DATA À L'APPEL (pattern errText d'expeditions-ui) :
  // ce fichier reste chargeable seul dans les tests qui n'utilisent pas ces helpers.

  // Sélection partagée fusion/désenchantement, PAR FAMILLE : `family` = "relic"
  // (défaut) ou "core". Les deux familles vivent dans le même tableau `equipment`,
  // donc le filtre est explicite : jamais de core dans un flux de relique, et
  // inversement. Toutes de la même rareté — cliquer une autre rareté repart de zéro.
  // Retourne null quand le clic est refusé (mauvaise famille, ou déjà 3 choisies).
  function familyMatch(item, family) {
    const D = window.FA_DATA;
    if (!D || !item) return false;
    return family === "core" ? D.isCoreItem(item) : D.isRelicItem(item);
  }

  // Tables par famille — miroir serveur (RELIC_BUYBACK/RELIC_FUSE_COSTS vs
  // CORE_BUYBACK/CORE_FUSE_COSTS). Aujourd'hui identiques, mais jamais fusionnées :
  // réviser une famille ne doit pas toucher l'autre par accident.
  function buybackFor(item) {
    const D = window.FA_DATA;
    const key = familyMatch(item, "core") ? D.CORE_BUYBACK : D.RELIC_BUYBACK;
    return item && key && Object.hasOwn(key, item.rarity) ? key[item.rarity] : null;
  }
  function fuseCostFor(item) {
    const D = window.FA_DATA;
    const key = familyMatch(item, "core") ? D.CORE_FUSE_COSTS : D.RELIC_FUSE_COSTS;
    return item && key && Object.hasOwn(key, item.rarity) ? key[item.rarity] : null;
  }

  function equipSelToggle(sel, item, family) {
    const S = Array.isArray(sel) ? sel : [];
    if (!familyMatch(item, family)) return null;
    if (S.some((x) => x.id === item.id)) return S.filter((x) => x.id !== item.id);
    if (S.length && S[0].rarity !== item.rarity) return [item];
    if (S.length >= 3) return null;
    return [...S, item];
  }

  // État du bouton Fusionner : 3 objets de même rareté, rareté < Legendary,
  // solde >= coût. Le coût et la rareté de sortie s'affichent dès le 1er objet.
  // La FAMILLE du premier objet sélectionné choisit le barème.
  function fuseState({ sel, balance, busy }) {
    const D = window.FA_DATA;
    const S = Array.isArray(sel) ? sel : [];
    const rarity = S.length ? S[0].rarity : null;
    const cost = S.length ? fuseCostFor(S[0]) : null;
    const ready = S.length === 3 && cost != null;
    const insufficient = ready && (balance || 0) < cost;
    return {
      disabled: !!busy || !ready || insufficient,
      cost,
      nextRarity: cost != null ? D.RARITY_UPGRADE[rarity] : null,
      showInsufficient: insufficient,
      maxRarity: rarity === "Legendary",
    };
  }

  // Compat : l'onglet Reliques appelle relicFuseState, l'onglet Cores coreFuseState.
  function relicFuseState(args) { return fuseState(args); }
  function coreFuseState(args) { return fuseState(args); }

  // Recyclage : l'objet est détruit et rend des FRAGMENTS — plus aucun FA (décision fondateur
  // 15/11/2026). Le bouton reste (c'est la soupape contre l'inventaire mort), mais il n'exige
  // plus de solde : l'objet EST le coût. Il faut quand même un seul objet sélectionné.
  const RECYCLE_SHARE = 0.30;
  const FRAGMENT_COSTS = { C: 100, B: 250, A: 600, S: 1000 };
  const RANK_OF_RARITY = { Common: "C", Rare: "B", Epic: "A", Legendary: "S" };
  function fragmentsForRecycle(item) {
    if (!item || !Object.hasOwn(RANK_OF_RARITY, item.rarity)) return null;
    const rank = RANK_OF_RARITY[item.rarity];
    return { rank, fragments: Math.max(1, Math.floor(FRAGMENT_COSTS[rank] * RECYCLE_SHARE)) };
  }

  function disenchantState({ sel, busy }) {
    const S = Array.isArray(sel) ? sel : [];
    const one = S.length === 1 ? S[0] : null;
    const r = fragmentsForRecycle(one);
    return {
      disabled: !!busy || r == null,
      value: 0,
      fee: 0,
      net: 0,
      fragments: r ? r.fragments : null,
      rank: r ? r.rank : null,
      showInsufficient: false,
    };
  }

  // Traduction d'un code d'erreur serveur relic-fuse / equip-disenchant (codes
  // 1:1 avec les clés FG_EQ_ERR_<code>). I18N résolu à l'appel — absent dans les
  // tests node, on renvoie alors le code brut.
  function equipForgeErrText(code) {
    const I = typeof window !== "undefined" && window.FA_I18N;
    if (!I) return String(code);
    const k = "FG_EQ_ERR_" + code;
    const s = I.t(k);
    return s === k ? I.t("FG_EQ_ERR_generic") : s;
  }

  window.FA_FORGE_UI = { rerollDiff, toggleLock, withLockCost, fusionSwap, fusionButtonState, entityPower, fusionKeepWarning, MAX_REROLL_LOCKS, REROLL_LOCK_MULT, LOCKABLE: KEYS,
    rankNext, rankFuseCost, rankKey, rarityKey, rankSelToggle, rankFuseState, rankFuseKeptChoices, rankFuseWarning, countTalents,
    FRAGMENT_COSTS, RECYCLE_SHARE, RANK_OF_RARITY,
    equipSelToggle, familyMatch, buybackFor, fuseCostFor, fuseState, relicFuseState, coreFuseState, disenchantState, equipForgeErrText };
})();
