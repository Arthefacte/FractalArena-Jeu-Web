// verify-app-pc.mjs — compte les requêtes réellement émises par la page, avec et
// sans `?app=pc`. C'est la seule preuve qui vaut : le test statique vérifie que
// le fichier est bien câblé, celui-ci vérifie que le navigateur ne demande PAS la
// HD quand le paramètre est absent.
//
// Usage : node _bake/verify-app-pc.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const requireQA = createRequire("C:/Users/PC/orca/workspaces/fractal-arena-web/app-pc-native/desktop/qa/x.js");
const { chromium } = requireQA("playwright");

const MIME = {
  ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript",
  ".css": "text/css", ".json": "application/json", ".webp": "image/webp",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".glb": "model/gltf-binary", ".wasm": "application/wasm", ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};
const vus = [];
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/" || p.endsWith("/")) p += "index.html";   // même règle qu'un vrai serveur
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    vus.push({ url: req.url, status: 404, octets: 0 });
    res.writeHead(404); res.end("nf"); return;
  }
  const d = fs.readFileSync(file);
  const vu = { url: req.url, status: 200, octets: d.length, fini: false };
  vus.push(vu);
  res.on("close", () => { vu.fini = res.writableFinished; });
  res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
  res.end(d);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;

let browser;
try { browser = await chromium.launch(); }
catch { browser = await chromium.launch({ channel: "chrome" }); }

async function mesurer(page_url) {
  vus.length = 0;
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", () => {});
  await page.goto(`http://localhost:${port}${page_url}`, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const etat = await page.evaluate(() => ({
    app: document.documentElement.dataset.app || null,
    img: (document.getElementById("boot-emblem") || {}).src || null,
  })).catch(() => ({ app: null, img: null }));
  await page.close();
  return { etat, requetes: vus.filter((r) => /boot-strip|emblem-spin/.test(r.url)) };
}

const sans = await mesurer("/");
const avec = await mesurer("/?app=pc");
await browser.close();
server.close();

const resume = (r) => r.requetes.length === 0 ? "aucune"
  : r.requetes.map((q) => `${q.url} (${Math.round(q.octets / 1024)} Ko${q.fini ? "" : ", annulé"})`).join(", ");

console.log("— SANS ?app=pc (visiteur web) —");
console.log("  dataset.app :", sans.etat.app, "| image :", sans.etat.img);
console.log("  bandes demandées :", resume(sans));
console.log("  octets bandes :", sans.requetes.reduce((s, q) => s + q.octets, 0));
console.log("— AVEC ?app=pc (app PC) —");
console.log("  dataset.app :", avec.etat.app, "| image :", avec.etat.img);
console.log("  bandes demandées :", resume(avec));
console.log("  octets bandes :", avec.requetes.reduce((s, q) => s + q.octets, 0));

const sansHd = sans.requetes.every((q) => !q.url.includes("-hd"));
const avecHd = avec.requetes.some((q) => q.url.includes("boot-strip-hd"));
console.log(sansHd ? "OK  aucune bande HD n'est demandée sans le paramètre" : "ECHEC  la HD part vers le web");
console.log(avecHd ? "OK  l'app PC reçoit la bande HD" : "ECHEC  l'app PC reçoit encore la SD");
process.exit(sansHd && avecHd ? 0 : 1);
