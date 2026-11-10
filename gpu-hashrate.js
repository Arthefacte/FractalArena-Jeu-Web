/* Minage simulé : lecture du renderer uniquement, aucun benchmark ni minage. */
(function () {
  "use strict";

  function detectGpu() {
    let gl = null;
    try {
      if (typeof document === "undefined") return null;
      const canvas = document.createElement("canvas");
      gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
      const info = gl && gl.getExtension("WEBGL_debug_renderer_info");
      const raw = info && gl.getParameter(info.UNMASKED_RENDERER_WEBGL);
      return typeof raw === "string" && raw.trim() ? raw : null;
    } catch (e) {
      return null; // Renderer masqué ou WebGL refusé : aucune estimation disponible.
    } finally {
      // Ne pas garder un contexte GPU juste pour lire son nom.
      try { const ext = gl && gl.getExtension("WEBGL_lose_context"); if (ext) ext.loseContext(); } catch (e) {}
    }
  }

  function normalizeGpuName(raw) {
    if (typeof raw !== "string" || !raw.trim()) return "";
    let name = raw.trim().replace(/^ANGLE\s*\(\s*/i, "")
      .replace(/\((?:R|TM)\)/gi, "").replace(/\bCorporation\b/gi, "")
      .replace(/\s+/g, " ");
    // ANGLE répète souvent la marque dans un premier champ séparé par une virgule.
    name = name.replace(/^(?:NVIDIA|AMD|ATI|Intel|Apple)\s*,\s*/i, "")
      .replace(/^ANGLE Metal Renderer:\s*/i, "")
      .replace(/\s*(?:Direct3D\w*|D3D\d+|OpenGL(?: Engine)?|, Unspecified Version)[\s\S]*$/i, "")
      .replace(/\s*\(0x[\da-f]+\)/gi, "")
      .replace(/^[\s,]*(?:(?:NVIDIA|GeForce|AMD|ATI|Radeon|Apple)\s+)+/i, "")
      .replace(/^Intel\s+(?=Arc\b)/i, "")
      .replace(/[\s,)]+$/, "").trim();
    return name;
  }

  // Hashrate d'usine en GH/s : clocks stock, médiane des relevés publiés pour SHA-256d — ni underclock, ni overclock.
  const GPU_TABLE = [
    { nom: "RTX 5090", gh: 22, match: /^RTX 5090$/i },
    { nom: "RTX 5080", gh: 14, match: /^RTX 5080$/i },
    { nom: "RTX 5070 Ti", gh: 11, match: /^RTX 5070 Ti$/i },
    { nom: "RTX 5070", gh: 8, match: /^RTX 5070$/i },
    { nom: "RTX 5060 Ti", gh: 6, match: /^RTX 5060 Ti$/i },
    { nom: "RTX 4090", gh: 13, match: /^RTX 4090$/i },
    { nom: "RTX 4080", gh: 9.5, match: /^RTX 4080$/i },
    { nom: "RTX 4070 Ti", gh: 7.5, match: /^RTX 4070 Ti$/i },
    { nom: "RTX 4070", gh: 6, match: /^RTX 4070$/i },
    { nom: "RTX 4060 Ti", gh: 5, match: /^RTX 4060 Ti$/i },
    { nom: "RTX 4060", gh: 4, match: /^RTX 4060$/i },
    { nom: "RTX 3090", gh: 10, match: /^RTX 3090$/i },
    { nom: "RTX 3080 Ti", gh: 8.5, match: /^RTX 3080 Ti$/i },
    { nom: "RTX 3080", gh: 7.5, match: /^RTX 3080$/i },
    { nom: "RTX 3070 Ti", gh: 6, match: /^RTX 3070 Ti$/i },
    { nom: "RTX 3070", gh: 5.5, match: /^RTX 3070$/i },
    { nom: "RTX 3060 Ti", gh: 5, match: /^RTX 3060 Ti$/i },
    { nom: "RTX 3060", gh: 4, match: /^RTX 3060$/i },
    { nom: "RTX 2080 Ti", gh: 6.5, match: /^RTX 2080 Ti$/i },
    { nom: "RTX 2070", gh: 4, match: /^RTX 2070$/i },
    { nom: "RTX 2060", gh: 3, match: /^RTX 2060$/i },
    { nom: "GTX 1080 Ti", gh: 4, match: /^GTX 1080 Ti$/i },
    { nom: "GTX 1070", gh: 2.5, match: /^GTX 1070$/i },
    { nom: "RX 7900 XTX", gh: 8.5, match: /^RX 7900 XTX$/i },
    { nom: "RX 7900 XT", gh: 7.5, match: /^RX 7900 XT$/i },
    { nom: "RX 7800 XT", gh: 5.5, match: /^RX 7800 XT$/i },
    { nom: "RX 7700 XT", gh: 5, match: /^RX 7700 XT$/i },
    { nom: "RX 6950 XT", gh: 6, match: /^RX 6950 XT$/i },
    { nom: "RX 6900 XT", gh: 5.5, match: /^RX 6900 XT$/i },
    { nom: "RX 6800 XT", gh: 5, match: /^RX 6800 XT$/i },
    { nom: "RX 6700 XT", gh: 3.5, match: /^RX 6700 XT$/i },
    { nom: "Arc A770", gh: 4, match: /^Arc A770(?: Graphics)?$/i },
    { nom: "Arc A750", gh: 3.5, match: /^Arc A750(?: Graphics)?$/i },
    { nom: "M1", gh: 1, match: /^M1$/i },
    { nom: "M1 Pro", gh: 1.6, match: /^M1 Pro$/i },
    { nom: "M1 Max", gh: 2.5, match: /^M1 Max$/i },
    { nom: "M2", gh: 1.4, match: /^M2$/i },
    { nom: "M2 Pro", gh: 2, match: /^M2 Pro$/i },
    { nom: "M2 Max", gh: 3.2, match: /^M2 Max$/i },
    { nom: "M3", gh: 1.8, match: /^M3$/i },
    { nom: "M3 Pro", gh: 2.6, match: /^M3 Pro$/i },
    { nom: "M3 Max", gh: 4, match: /^M3 Max$/i },
    // Libellé traduit par l'écran.
    { nom: "Intel", gh: 0.4, match: /^Intel(?:\s+(?:HD|UHD|Iris)\b.*|\s+Graphics)?$/i },
  ];

  function resolveGpu(raw) {
    const nom = normalizeGpuName(raw);
    const gpu = GPU_TABLE.find((entry) => entry.match.test(nom));
    return gpu ? { nom: gpu.nom, gh: gpu.gh, connu: true } : { nom, gh: null, connu: false };
  }

  const api = { detectGpu, normalizeGpuName, GPU_TABLE, resolveGpu };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof window !== "undefined") window.FA_GPU_HASHRATE = api;
})();
