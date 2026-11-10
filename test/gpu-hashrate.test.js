"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeGpuName, resolveGpu, GPU_TABLE, detectGpu } = require("../gpu-hashrate.js");

test("renderers réels : NVIDIA, AMD et Apple, débits mesurés", () => {
  for (const [raw, nom, gh, mesure] of [
    ["ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)", "RTX 4070", 7.8, true],
    ["ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 ...)", "RX 6800 XT", 8.6, true],
    // Aucun benchmark SHA-256 relevé pour les Apple M : valeur estimée, et dite telle.
    ["Apple M2 Pro", "M2 Pro", 1, false],
  ]) {
    assert.equal(normalizeGpuName(raw), nom);
    assert.deepEqual(resolveGpu(raw), { nom, gh, mesure, connu: true });
  }
});

test("normalisation des marques, suffixes, casse, espaces et identifiants ANGLE", () => {
  for (const raw of [
    "  angle (nvidia, nvidia   geforce   rtx  4070 direct3d11 vs_5_0 ps_5_0, d3d11)  ",
    "NVIDIA Corporation GeForce RTX 4070 OpenGL Engine",
    "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  ]) assert.deepEqual(resolveGpu(raw), { nom: "RTX 4070", gh: 7.8, mesure: true, connu: true });
  assert.equal(resolveGpu("Intel(R) Arc(TM) A770 Graphics").gh, 4);
  assert.equal(resolveGpu("Intel(R) UHD Graphics 630").gh, 0.4);
  assert.equal(resolveGpu("ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)").gh, 1);
});

test("GPU inconnus ou variantes absentes : jamais de modèle approché ni d'exception", () => {
  for (const raw of ["Mali-G78", null, "", undefined, NaN, {}, "Intel Arc B580", "RTX 4070 Laptop GPU", "Apple M2 Ultra"]) {
    assert.equal(resolveGpu(raw).connu, false);
    assert.equal(resolveGpu(raw).gh, null);
  }
});

test("renderers mobiles Apple GPU, Adreno et Mali : inconnus sans exception", () => {
  for (const raw of ["Apple GPU", "Adreno (TM) 740", "Mali-G78"]) {
    assert.doesNotThrow(() => resolveGpu(raw));
    assert.equal(resolveGpu(raw).connu, false);
    assert.equal(resolveGpu(raw).gh, null);
  }
});

test("la table porte les débits mesurés, sans doublon de correspondance", () => {
  // Valeurs relevées sur des benchmarks hashcat mode 1400 (SHA2-256), clocks stock.
  const mesurees = {
    "RTX 5090": 26.8, "RTX 5080": 13.6, "RTX 4090": 22, "RTX 4080": 13.1, "RTX 4080 Super": 12.7,
    "RTX 4070 Ti Super": 11.3, "RTX 4070 Super": 9.3, "RTX 4070": 7.8, "RTX 4060 Ti": 5.7, "RTX 4060": 4,
    "RTX 3090": 9.7, "RTX 3080 Ti": 6.8, "RTX 3080": 7, "RTX 3070 Ti": 5.8, "RTX 3070": 5.3,
    "RTX 3060 Ti": 4.7, "RTX 3060": 2.2, "RTX 2080 Ti": 7.3, "RTX 2060": 3.6,
    "GTX 1080": 3.1, "GTX 1070": 2.5, "RX 7900 XTX": 12.6, "RX 6800 XT": 8.6, "RX 6700 XT": 5.2,
    "M1 Pro": 0.87, "M2": 0.67,
  };
  for (const [nom, gh] of Object.entries(mesurees)) {
    const ligne = GPU_TABLE.find((e) => e.nom === nom);
    assert.ok(ligne, nom + " absente de la table");
    assert.equal(ligne.gh, gh, nom);
    assert.equal(ligne.mesure, true, nom + " doit être marquée comme mesurée");
  }
  // Aucune estimation ne se fait passer pour une mesure, et chaque ligne est atteignable.
  for (const ligne of GPU_TABLE) {
    assert.equal(typeof ligne.mesure, "boolean", ligne.nom);
    assert.ok(ligne.gh > 0, ligne.nom);
    assert.equal(GPU_TABLE.filter((e) => e.match.test(ligne.nom)).length, 1, ligne.nom);
    assert.deepEqual(resolveGpu(ligne.nom), { nom: ligne.nom, gh: ligne.gh, mesure: ligne.mesure, connu: true });
  }
  // Toute la gamme RTX 40 doit être reconnue, y compris les suffixes Super.
  for (const nom of ["RTX 4090", "RTX 4080 Super", "RTX 4070 Ti Super", "RTX 4070 Super", "RTX 4060 Ti"]) {
    assert.equal(resolveGpu(nom).connu, true, nom);
  }
});

function detector(document) {
  const context = { window: {}, document };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../gpu-hashrate.js"), "utf8"), context);
  return context.window.FA_GPU_HASHRATE.detectGpu;
}

test("détection WebGL : renderer brut et contexte libéré, sans dessiner", () => {
  const calls = [];
  const gl = {
    getExtension(name) {
      calls.push(name);
      return name === "WEBGL_debug_renderer_info" ? { UNMASKED_RENDERER_WEBGL: 123 } : { loseContext: () => calls.push("released") };
    },
    getParameter(key) { assert.equal(key, 123); return "Renderer brut"; },
  };
  const detect = detector({ createElement: (tag) => {
    assert.equal(tag, "canvas");
    return { getContext: (kind) => { calls.push(kind); return kind === "experimental-webgl" ? gl : null; } };
  } });
  assert.deepEqual(calls, [], "aucune détection au chargement du module");
  assert.equal(detect(), "Renderer brut");
  assert.deepEqual(calls, ["webgl", "experimental-webgl", "WEBGL_debug_renderer_info", "WEBGL_lose_context", "released"]);
});

test("détection absente, masquée ou refusée : null sans exception", () => {
  assert.equal(detectGpu(), null);
  for (const document of [undefined,
    { createElement() { throw new Error("bloqué"); } },
    { createElement: () => ({ getContext: () => null }) },
    { createElement: () => ({ getContext: () => ({ getExtension: () => null }) }) },
    { createElement: () => ({ getContext: () => ({ getExtension: () => ({ UNMASKED_RENDERER_WEBGL: 1 }), getParameter() { throw new Error("masqué"); } }) }) },
  ]) assert.equal(detector(document)(), null);
});
