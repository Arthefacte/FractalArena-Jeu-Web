"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeGpuName, resolveGpu, GPU_TABLE, detectGpu } = require("../gpu-hashrate.js");

test("renderers du brief : NVIDIA, AMD et Apple", () => {
  for (const [raw, nom, gh] of [
    ["ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)", "RTX 4070", 6],
    ["ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 ...)", "RX 6800 XT", 5],
    ["Apple M2 Pro", "M2 Pro", 2],
  ]) {
    assert.equal(normalizeGpuName(raw), nom);
    assert.deepEqual(resolveGpu(raw), { nom, gh, connu: true });
  }
});

test("normalisation des marques, suffixes, casse, espaces et identifiants ANGLE", () => {
  for (const raw of [
    "  angle (nvidia, nvidia   geforce   rtx  4070 direct3d11 vs_5_0 ps_5_0, d3d11)  ",
    "NVIDIA Corporation GeForce RTX 4070 OpenGL Engine",
    "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)",
  ]) assert.deepEqual(resolveGpu(raw), { nom: "RTX 4070", gh: 6, connu: true });
  assert.equal(resolveGpu("Intel(R) Arc(TM) A770 Graphics").gh, 4);
  assert.equal(resolveGpu("Intel(R) UHD Graphics 630").gh, 0.4);
  assert.equal(resolveGpu("ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)").gh, 2);
});

test("GPU inconnus ou variantes absentes : jamais de modèle approché ni d'exception", () => {
  for (const raw of ["Mali-G78", null, "", undefined, NaN, {}, "Intel Arc B580", "RTX 4070 Ti SUPER", "RTX 4070 Laptop GPU", "Apple M2 Ultra"]) {
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

test("la table conserve exactement les 43 valeurs du brief et distingue les suffixes", () => {
  const expected = [
    ["RTX 5090", 22], ["RTX 5080", 14], ["RTX 5070 Ti", 11], ["RTX 5070", 8], ["RTX 5060 Ti", 6],
    ["RTX 4090", 13], ["RTX 4080", 9.5], ["RTX 4070 Ti", 7.5], ["RTX 4070", 6], ["RTX 4060 Ti", 5], ["RTX 4060", 4],
    ["RTX 3090", 10], ["RTX 3080 Ti", 8.5], ["RTX 3080", 7.5], ["RTX 3070 Ti", 6], ["RTX 3070", 5.5], ["RTX 3060 Ti", 5], ["RTX 3060", 4],
    ["RTX 2080 Ti", 6.5], ["RTX 2070", 4], ["RTX 2060", 3], ["GTX 1080 Ti", 4], ["GTX 1070", 2.5],
    ["RX 7900 XTX", 8.5], ["RX 7900 XT", 7.5], ["RX 7800 XT", 5.5], ["RX 7700 XT", 5],
    ["RX 6950 XT", 6], ["RX 6900 XT", 5.5], ["RX 6800 XT", 5], ["RX 6700 XT", 3.5],
    ["Arc A770", 4], ["Arc A750", 3.5],
    ["M1", 1], ["M1 Pro", 1.6], ["M1 Max", 2.5], ["M2", 1.4], ["M2 Pro", 2], ["M2 Max", 3.2], ["M3", 1.8], ["M3 Pro", 2.6], ["M3 Max", 4], ["Intel", 0.4],
  ];
  assert.deepEqual(GPU_TABLE.map(({ nom, gh }) => [nom, gh]), expected);
  for (const [nom, gh] of expected) {
    assert.deepEqual(resolveGpu(nom), { nom, gh, connu: true });
    assert.equal(GPU_TABLE.filter((entry) => entry.match.test(nom)).length, 1);
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
