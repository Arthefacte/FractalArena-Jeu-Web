"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeGpuName, resolveGpu, GPU_TABLE, FALLBACKS, detectGpu } = require("../gpu-hashrate.js");

test("renderers réels : NVIDIA, AMD et Apple, débits mesurés", () => {
  for (const [raw, nom, gh, mesure] of [
    ["ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)", "RTX 4070", 7.9, true],
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
  ]) assert.deepEqual(resolveGpu(raw), { nom: "RTX 4070", gh: 7.9, mesure: true, connu: true });
  assert.equal(resolveGpu("ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)").gh, 1);
});

test("la table couvre des centaines de cartes, sans doublon de correspondance", () => {
  assert.ok(GPU_TABLE.length >= 400, "table trop courte : " + GPU_TABLE.length);
  assert.ok(GPU_TABLE.length <= 500, "table au-delà du plafond : " + GPU_TABLE.length);
  const detects = new Set();
  for (const ligne of GPU_TABLE) {
    assert.equal(typeof ligne.mesure, "boolean", ligne.nom);
    assert.ok(ligne.gh > 0, ligne.nom);
    assert.ok(ligne.detect && ligne.detect.length > 1, ligne.nom + " sans motif de détection");
    const cle = ligne.detect.toLowerCase();
    assert.ok(!detects.has(cle), "motif en double : " + ligne.detect);
    detects.add(cle);
  }
  // Chaque ligne doit être atteignable depuis son propre nom, et sur elle-même.
  for (const ligne of GPU_TABLE) {
    assert.equal(resolveGpu(ligne.nom).nom, ligne.nom, ligne.nom + " introuvable ou captée par une autre ligne");
  }
});

test("portables, tailles mémoire et iGPU génériques tombent sur la bonne ligne", () => {
  // La taille mémoire du renderer ne doit pas empêcher la correspondance au modèle fin.
  assert.equal(resolveGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 3050 6GB Laptop GPU Direct3D11, D3D11)").nom, "RTX 3050 Laptop GPU");
  assert.equal(resolveGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU Direct3D11, D3D11)").nom, "RTX 4060 Laptop GPU");
  // Deux tailles mémoire mesurées séparément restent distinctes.
  assert.equal(resolveGpu("ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 6GB Direct3D11, D3D11)").nom, "GTX 1060 6GB");
  assert.equal(resolveGpu("ANGLE (NVIDIA, NVIDIA GeForce GTX 1060 3GB Direct3D11, D3D11)").nom, "GTX 1060 3GB");
  // Le plus spécifique gagne toujours.
  assert.equal(resolveGpu("ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti SUPER Direct3D11, D3D11)").nom, "RTX 4070 Ti Super");
  // iGPU sans modèle identifiable : repli explicite, jamais une erreur.
  for (const [raw, nom] of [
    ["ANGLE (AMD, AMD Radeon(TM) Graphics Direct3D11, D3D11)", "Radeon Graphics"],
    ["ANGLE (Intel, Intel(R) HD Graphics 4000 Direct3D11, D3D11)", "Intel"],
  ]) {
    const r = resolveGpu(raw);
    assert.equal(r.nom, nom);
    assert.equal(r.connu, true);
    assert.equal(r.mesure, false, "un repli n'est jamais présenté comme une mesure");
    assert.ok(r.gh > 0 && r.gh < 1, "un iGPU reste sous le GH/s");
  }
  assert.ok(FALLBACKS.length >= 1);
});

test("la table porte les débits mesurés, sans estimation déguisée", () => {
  // Sorties hashcat mode 1400 (SHA2-256), clocks stock — github.com/its5Q/hashcat-benchmarks.
  const mesurees = {
    "RTX 5090": 26.8, "RTX 4090": 22, "RTX 5080": 13.6, "RTX 4080 Super": 13.3, "RTX 4080": 13.1,
    "RX 7900 XTX": 12.6, "RTX 4070 Ti Super": 11.3, "RTX 3090": 9.6, "RTX 4070 Super": 9.3,
    "RTX 3080 Ti": 9.3, "RX 6800 XT": 8.6, "RTX 4070": 7.9, "RTX 2080 Ti": 7.3, "RTX 3080": 6.9,
    "RTX 4060 Ti": 5.7, "RX 6700 XT": 5.2, "RTX 3070": 4.8, "RTX 3060 Ti": 4.7, "RTX 4060": 4,
    "RTX 2060 Super": 3.9, "RTX 2060": 3.6, "RTX 3060": 3.4, "GTX 1080": 3.1, "GTX 1070 Ti": 3,
    "GTX 1660 Super": 2.6, "GTX 1070": 2.5, "GTX 1660": 2.4, "Titan X": 2.2, "GTX 1650": 1.7,
    "GTX 1060 6GB": 1.7, "GTX 1060 3GB": 1.1, "M1 Pro": 0.87, "M2": 0.67,
  };
  for (const [nom, gh] of Object.entries(mesurees)) {
    const ligne = GPU_TABLE.find((e) => e.nom === nom);
    assert.ok(ligne, nom + " absente de la table");
    assert.equal(ligne.gh, gh, nom);
    assert.equal(ligne.mesure, true, nom + " doit être marquée comme mesurée");
  }
  assert.equal(GPU_TABLE.filter((e) => e.mesure).length, Object.keys(mesurees).length,
    "seules les cartes listées ci-dessus portent une mesure");
  // Toute la gamme RTX 40 doit être reconnue, y compris les suffixes Super.
  for (const nom of ["RTX 4090", "RTX 4080 Super", "RTX 4070 Ti Super", "RTX 4070 Super", "RTX 4060 Ti"]) {
    assert.equal(resolveGpu(nom).connu, true, nom);
  }
});

test("mobiles et inconnus : jamais de modèle approché ni d'exception", () => {
  for (const raw of ["Mali-G78", null, "", undefined, NaN, {}, "Adreno (TM) 740", "Apple GPU", "PowerVR Rogue GE8320"]) {
    assert.equal(resolveGpu(raw).connu, false, String(raw));
    assert.equal(resolveGpu(raw).gh, null, String(raw));
  }
  assert.doesNotThrow(() => resolveGpu("Apple GPU"));
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
