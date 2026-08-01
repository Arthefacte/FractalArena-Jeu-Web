// Generates components/<group>/<Name>/<Name>.html preview cards from specs.mjs.
// Each card is self-contained: vendored React + the real _ds_bundle.js + styles.css.
// First line is the @dsCard marker the Design System pane indexes on.
import fs from "node:fs";
import path from "node:path";
import { COMPONENTS } from "./specs.mjs";

const ROOT = path.resolve(process.argv[2] || ".");
const BUNDLE = path.join(ROOT, "ds-bundle");

function cardHtml(c) {
  const fit = c.full ? "stretch" : "center";
  return `<!-- @dsCard group="${c.group}" name="${c.name}" -->
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${c.name} — Fractal Arena DS</title>
<link rel="stylesheet" href="../../../styles.css" />
<script src="../../../_vendor/react.production.min.js"></script>
<script src="../../../_vendor/react-dom.production.min.js"></script>
<style>
  html, body { margin: 0; height: 100%; background: var(--bg-0, #05070f); color: var(--text, #EAF1FF); font-family: var(--font-display); }
  #root { min-height: 100vh; display: flex; align-items: ${fit === "stretch" ? "stretch" : "center"}; justify-content: center; padding: 24px; box-sizing: border-box; }
</style>
</head>
<body>
<div id="root"></div>
<script src="../../../_ds_bundle.js"></script>
<script>
  const DS = window.FractalArenaDS;
  const e = React.createElement;
  function Card() { return (${c.render}); }
  ReactDOM.createRoot(document.getElementById("root")).render(e(Card));
  window.__ready = true;
</script>
</body>
</html>
`;
}

for (const c of COMPONENTS) {
  const dir = path.join(BUNDLE, "components", c.group, c.name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${c.name}.html`), cardHtml(c));
  console.log("card", `${c.group}/${c.name}/${c.name}.html`);
}
console.log("done:", COMPONENTS.length, "cards");
