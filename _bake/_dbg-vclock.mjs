import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIME = { ".html":"text/html", ".js":"text/javascript", ".jsx":"text/javascript", ".mjs":"text/javascript",
  ".css":"text/css", ".json":"application/json", ".png":"image/png", ".glb":"model/gltf-binary", ".wasm":"application/wasm", ".svg":"image/svg+xml" };
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split("?")[0]);
  const file = path.join(ROOT, p === "/" ? "/index.html" : p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (e, d) => { if (e) { res.writeHead(404); res.end("nf"); return; } res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" }); res.end(d); });
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.addInitScript(() => {
  Object.defineProperty(window, "FA_TALENTS_UI", { configurable: true, set(v) {
    try { const roster = window.FA_DATA.starterRoster();
      localStorage.setItem("fractal_arena_v1", JSON.stringify({ roster, view: "team", lang: "FR", wallet: "bc1qfinisher0000000000000000000000", options: { sound: false, speed: 1 } }));
      localStorage.setItem("fractal_arena_tutorial_v1", "1"); } catch (e) {}
    Object.defineProperty(window, "FA_TALENTS_UI", { value: v, configurable: true, writable: true });
  } });
});
await page.goto(`http://localhost:${port}/index.html`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.FA_DATA && window.FA_FINISHER).catch(() => {});
await page.waitForTimeout(8000);
await page.keyboard.press("Escape").catch(() => {});

async function run(view, win, tag) {
  await page.evaluate((v) => { document.body.dataset.view = v; }, view);
  await page.waitForTimeout(400);
  const shots = await page.evaluate(async (w) => {
    // virtual clock: freeze performance.now(), drive rAF manually so the finisher's
    // 800ms timeline can be sampled deterministically regardless of real frame rate.
    let vt = performance.now();
    let queue = [];
    const realRaf = window.requestAnimationFrame.bind(window);
    const realNow = performance.now.bind(performance);
    performance.now = () => vt;
    window.requestAnimationFrame = (cb) => { queue.push(cb); return queue.length; };
    function tick(dt) { vt += dt; const cbs = queue; queue = []; cbs.forEach((cb) => { try { cb(vt); } catch (e) {} }); }
    function snap() {
      const cv = document.getElementById("fa-finisher");
      if (!cv || cv.width === 0) return null;
      return cv.toDataURL("image/png");
    }
    const out = {};
    window.__finDone = false;
    window.FA_FINISHER.play({ win: w, onDone: () => { window.__finDone = true; } });
    tick(0);          // run frame() once at t≈0
    out.t0 = snap();
    tick(150);        // t≈150ms
    out.t150 = snap();
    tick(410);        // t≈560ms (flash window 520-680ms)
    out.t560 = snap();
    tick(190);        // t≈750ms
    out.t750 = snap();
    tick(300);        // t≈1050ms > FIN_DUR(800ms) -> should stop + flush
    out.t1050 = snap();
    out.doneAfter = window.__finDone;
    const cvFinal = document.getElementById("fa-finisher");
    out.displayAfter = cvFinal ? getComputedStyle(cvFinal).display : null;
    performance.now = realNow;
    window.requestAnimationFrame = realRaf;
    return out;
  }, win);
  console.log(tag, "doneAfter:", shots.doneAfter, "displayAfter:", shots.displayAfter,
    "have:", Object.keys(shots).filter(k => shots[k] && k.startsWith("t")).join(","));
  for (const k of ["t0", "t150", "t560", "t750", "t1050"]) {
    if (shots[k]) {
      const b64 = shots[k].split(",")[1];
      fs.writeFileSync(path.join(ROOT, "_bake", `_vc-${tag}-${k}.png`), Buffer.from(b64, "base64"));
    }
  }
}

await run("fosse", true, "win-fosse");
await run("fosse", false, "lose-fosse");
await run("arene", true, "win-arene");
await run("arene", false, "lose-arene");

await browser.close(); server.close();
