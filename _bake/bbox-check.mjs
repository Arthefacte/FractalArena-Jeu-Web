import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const ROOT = path.join(process.cwd(), "assets", "cores");
for (const f of fs.readdirSync(ROOT).filter(f => f.endsWith(".glb")).sort()) {
  const doc = await io.read(path.join(ROOT, f));
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute("POSITION");
      if (!pos) continue;
      const a = pos.getArray();
      for (let i = 0; i < a.length; i += 3) {
        for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], a[i+k]); max[k] = Math.max(max[k], a[i+k]); }
      }
    }
  const size = max.map((v, k) => (v - min[k]).toFixed(2));
  const center = max.map((v, k) => ((v + min[k]) / 2).toFixed(2));
  console.log(`${f.padEnd(24)} size=[${size.join(", ")}]  center=[${center.join(", ")}]`);
}
