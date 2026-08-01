// Builds ds-bundle/README.md = conventions header + generated component index.
import fs from "node:fs";
import path from "node:path";
import { COMPONENTS, GROUP_ORDER } from "./specs.mjs";

const ROOT = path.resolve(process.argv[2] || ".");
const header = fs.readFileSync(path.join(ROOT, ".design-sync", "conventions.md"), "utf8").trimEnd();

let index = "\n\n---\n\n## Component index\n\n";
for (const g of GROUP_ORDER) {
  const items = COMPONENTS.filter((c) => c.group === g);
  if (!items.length) continue;
  index += `### ${g}\n\n`;
  for (const c of items) {
    index += `- **${c.name}** — ${c.subtitle}. ` +
      `\`components/${c.group}/${c.name}/${c.name}.prompt.md\`\n`;
  }
  index += "\n";
}
index += `_Bundle: \`_ds_bundle.js\` exposes \`window.FractalArenaDS\`. ` +
  `Styles: \`styles.css\` (tokens + classes + fonts). ` +
  `Built off-script from \`fractal-arena-web/components.jsx\`._\n`;

fs.writeFileSync(path.join(ROOT, "ds-bundle", "README.md"), header + index);
console.log("README.md", (fs.statSync(path.join(ROOT, "ds-bundle", "README.md")).size / 1024).toFixed(1) + "KB");
