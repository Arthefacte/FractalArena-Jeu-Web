// Off-script bundle build for Fractal Arena DS.
// Concatenates the standalone runtime shim + components.jsx (verbatim) and
// compiles to an IIFE that exposes window.FractalArenaDS. React is left as a
// free global (resolves to the vendored React UMD loaded before the bundle).
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.argv[2] || ".");          // fractal-arena-web
const SRC = path.join(ROOT, "ds-bundle", "_src");
const OUT = path.join(ROOT, "ds-bundle", "_ds_bundle.js");

const shim = fs.readFileSync(path.join(SRC, "shim.js"), "utf8");
const components = fs.readFileSync(path.join(ROOT, "components.jsx"), "utf8");

const footer = `
/* ===== expose design-system surface ===== */
window.FractalArenaDS = Object.assign({}, window.FractalArenaDS, {
  Coin, Bar, StatGrid, CreatureCard, Modal, SectionHead, MiniStats,
  FA_Ctx, useFA, cx, fmt, presetLabel, rarityLabel,
  sample: window.FA_SAMPLE,
  data: window.FA_DATA,
});
`;

const stamp = `// @ds-bundle name=FractalArenaDS source=fractal-arena-web/components.jsx\n`;

const source =
  shim +
  "\n/* ===== components.jsx (verbatim from fractal-arena-web) ===== */\n" +
  components +
  footer;

await build({
  stdin: {
    contents: source,
    resolveDir: SRC,        // so `import ART from "./art-data.json"` resolves
    loader: "jsx",
    sourcefile: "ds-bundle.jsx",
  },
  bundle: true,
  format: "iife",
  jsx: "transform",         // classic React.createElement; React is a global
  target: ["es2019"],
  outfile: OUT,
  banner: { js: stamp.trim() },
  legalComments: "none",
  logLevel: "info",
});
console.log("built", OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + "KB");
