/* FRACTAL ARENA — Forge : helpers purs (testables Node) */
(function () {
  const KEYS = [
    { key: "base_hp",  label: "HP" },
    { key: "base_atk", label: "ATK" },
    { key: "base_def", label: "DEF" },
    { key: "base_spd", label: "SPD" },
    { key: "base_mag", label: "MAG" },
  ];
  function rerollDiff(oldStats, newStats) {
    const o = oldStats || {}, n = newStats || {};
    return KEYS.map(({ key, label }) => {
      const from = Number(o[key]) || 0;
      const to = Number(n[key]) || 0;
      const dir = to > from ? "up" : to < from ? "down" : "same";
      return { key, label, from, to, dir };
    });
  }
  window.FA_FORGE_UI = { rerollDiff };
})();
