// BAKE JETABLE — récupère les deux sprites rendus par __bake/badges-2d-bake.html.
// node "$LOCALAPPDATA/Temp/bake-badges.mjs" <dossier-sortie>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const racineGlobale = execSync("npm root -g").toString().trim();
const { chromium } = require(racineGlobale + "/playwright");

const sortie = process.argv[2];
if (!sortie) { console.error("dossier de sortie manquant"); process.exit(2); }
fs.mkdirSync(sortie, { recursive: true });

const browser = await chromium.launch({
  channel: "chrome", headless: true,
  args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist", "--no-sandbox"],
});
const page = await browser.newPage({ viewport: { width: 900, height: 900 } });
page.on("console", (m) => { if (m.type() === "error") console.log("console.error:", m.text()); });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto("http://127.0.0.1:8123/_bake/badges-2d-bake.html", { waitUntil: "load" });
await page.waitForFunction(() => document.body.dataset.done && document.body.dataset.done !== "0", { timeout: 120000 });

const baked = await page.evaluate(() => window.__BAKED);
if (baked.erreur) console.log("ERREUR PAGE:", baked.erreur);
for (const cle of ["fa", "fb"]) {
  if (!baked[cle]) { console.log("MANQUANT:", cle); continue; }
  const f = path.join(sortie, cle + "-badge-256.png");
  fs.writeFileSync(f, Buffer.from(baked[cle].replace(/^data:image\/png;base64,/, ""), "base64"));
  console.log("ecrit", f, fs.statSync(f).size, "octets");
}
await browser.close();
process.exit(0);
