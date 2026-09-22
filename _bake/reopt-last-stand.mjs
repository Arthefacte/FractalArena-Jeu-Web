// _bake/reopt-last-stand.mjs — one-off : re-simplifie last_stand_core avec une erreur plus haute.
// Usage : node _bake/reopt-last-stand.mjs <error> [--write]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { simplify, weld, dedup, prune, meshopt } from "@gltf-transform/functions";
import { MeshoptSimplifier, MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const ERROR = parseFloat(process.argv[2] || "0.02");
const WRITE = process.argv.includes("--write");

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder });

const src = path.join(ROOT, "_bake", "raw", "last_stand_core.glb");
const out = path.join(ROOT, "assets", "cores", "last_stand_core.glb");

const doc = await io.read(src);
const MB = 1024 * 1024;

function measure(doc) {
  let triangles = 0, vertices = 0;
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const idx = prim.getIndices();
      if (idx) triangles += Math.floor(idx.getCount() / 3);
      const pos = prim.getAttribute("POSITION");
      if (pos) vertices += pos.getCount();
    }
  let tvram = 0;
  for (const tex of doc.getRoot().listTextures()) {
    const s = tex.getSize();
    if (s) tvram += Math.round(s[0] * s[1] * 4 * (4 / 3));
  }
  const gvram = vertices * (12 + 12 + 8 + 16) + triangles * 3 * 4;
  return { triangles, vertices, vram: (tvram + gvram) / MB };
}

const before = measure(doc);
await doc.transform(dedup(), weld());
await doc.transform(simplify({ simplifier: MeshoptSimplifier, ratio: 0.01, error: ERROR, lockBorder: false }));
await doc.transform(prune());
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: "high" }));

const after = measure(doc);
console.log(`error=${ERROR}  avant: ${before.triangles} tri / ${before.vram.toFixed(2)} Mo VRAM`);
console.log(`             apres: ${after.triangles} tri / ${after.vram.toFixed(2)} Mo VRAM`);

if (WRITE) {
  await io.write(out, doc);
  console.log(`écrit: assets/cores/last_stand_core.glb (${(fs.statSync(out).size / 1024).toFixed(0)} Ko)`);
} else {
  console.log("(--write absent : rien écrit, mesure seule)");
}
