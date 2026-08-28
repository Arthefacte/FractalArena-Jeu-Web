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

  // État du bouton Fusionner. Mode Or : seul le ticket compte, le solde FA est ignoré
  // (la fusion premium coûte 0 FA côté serveur). Mode FA : solde requis.
  function fusionButtonState({ gold, cost, balance, ticketsGold, busy }) {
    if (busy) return { disabled: true, showInsufficient: false };
    if (gold) return { disabled: (ticketsGold || 0) < 1, showInsufficient: false };
    const insufficient = (balance || 0) < cost;
    return { disabled: insufficient, showInsufficient: insufficient };
  }

  // ---- Forge d'équipement (fusion de reliques + désenchantement) ----
  // Constantes lues sur window.FA_DATA À L'APPEL (pattern errText d'expeditions-ui) :
  // ce fichier reste chargeable seul dans les tests qui n'utilisent pas ces helpers.

  // Sélection partagée fusion/désenchantement : reliques SEULEMENT (jamais de
  // core), toutes de la même rareté — cliquer une autre rareté repart de zéro.
  // Retourne null quand le clic est refusé (core, ou déjà 3 sélectionnées).
  function equipSelToggle(sel, item) {
    const D = window.FA_DATA;
    const S = Array.isArray(sel) ? sel : [];
    if (!D || !D.isRelicItem(item)) return null;
    if (S.some((x) => x.id === item.id)) return S.filter((x) => x.id !== item.id);
    if (S.length && S[0].rarity !== item.rarity) return [item];
    if (S.length >= 3) return null;
    return [...S, item];
  }

  // État du bouton Fusionner : 3 reliques de même rareté, rareté < Legendary,
  // solde >= coût. Le coût et la rareté de sortie s'affichent dès la 1re relique.
  function relicFuseState({ sel, balance, busy }) {
    const D = window.FA_DATA;
    const S = Array.isArray(sel) ? sel : [];
    const rarity = S.length ? S[0].rarity : null;
    const cost = rarity != null && Object.hasOwn(D.RELIC_FUSE_COSTS, rarity) ? D.RELIC_FUSE_COSTS[rarity] : null;
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

  // État du bouton Désenchanter : exactement 1 relique ; le serveur débite les
  // frais fixes AVANT de créditer la valeur — le solde doit donc les couvrir.
  function disenchantState({ sel, balance, busy }) {
    const D = window.FA_DATA;
    const S = Array.isArray(sel) ? sel : [];
    const one = S.length === 1 ? S[0] : null;
    const value = one && Object.hasOwn(D.RELIC_BUYBACK, one.rarity) ? D.RELIC_BUYBACK[one.rarity] : null;
    const insufficient = value != null && (balance || 0) < D.DISENCHANT_FEE;
    return {
      disabled: !!busy || value == null || insufficient,
      value,
      fee: D.DISENCHANT_FEE,
      net: value != null ? value - D.DISENCHANT_FEE : null,
      showInsufficient: insufficient,
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

  window.FA_FORGE_UI = { rerollDiff, toggleLock, withLockCost, fusionSwap, fusionButtonState, MAX_REROLL_LOCKS, REROLL_LOCK_MULT, LOCKABLE: KEYS,
    equipSelToggle, relicFuseState, disenchantState, equipForgeErrText };
})();
