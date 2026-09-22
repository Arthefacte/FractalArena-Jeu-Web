/* Vérif visuelle des badges de contrainte campagne (mondes / étages / combat). */
const { chromium } = require("playwright");

const PORT = 8899;
const BASE = `http://localhost:${PORT}/index.html`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.addInitScript(() => {
    localStorage.setItem("fractal_arena_tutorial_v1", "1");
    let captured;
    Object.defineProperty(window, "FA_TALENTS_UI", {
      configurable: true,
      get() { return captured; },
      set(v) {
        captured = v;
        const D = window.FA_DATA;
        const roster = D.starterRoster();
        localStorage.setItem("fractal_arena_v1", JSON.stringify({
          roster, view: "campaign", lang: "FR", wallet: "bc1qfactice000",
          options: { sound: false, speed: 1 },
          campaignProgress: { 0: { stars: [3, 3, 3, 3, 3, 3, 3, 3, 3, 0] } },
        }));
      },
    });
  });

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.FA_DATA && window.FA_TALENTS, { timeout: 30000 });
  await page.waitForTimeout(9000);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);

  // ouvrir l'onglet Campagne (le seed de `view` peut être écrasé au boot)
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll("button, a")].find((b) => /campagne/i.test(b.innerText || ""));
    if (tab) tab.click();
  });
  await page.waitForTimeout(1500);

  const body = () => page.evaluate(() => document.body.innerText);

  // 1) Carte des mondes : descriptions de saveur
  let txt = await body();
  const okDesc = /premier bloc fut scellé/i.test(txt);
  console.log("[mondes] CAMP_W1_DESC visible:", okDesc);
  await page.screenshot({ path: "_bake/_verify-camp-worlds.png" });

  // 2) Étages du monde 1 : cliquer le monde débloqué
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) => /Les Blocs/i.test(b.innerText));
    btn.click();
  });
  await page.waitForTimeout(1200);
  txt = await body();
  // Tirage attendu (data.js) W0 : f1 sans_core, f2 decharge, f3 masse, f4 sans_relique, f9 blindage
  const checks = [
    ["sans_core (étage 2)", /pas de cores/i.test(txt)],
    ["decharge (étage 3)", /décharge/i.test(txt)],
    ["masse (étage 4)", /masse/i.test(txt)],
    ["sans_relique (étage 5)", /pas de reliques/i.test(txt)],
    ["blindage (boss)", /blindage/i.test(txt)],
  ];
  checks.forEach(([k, ok]) => console.log("[étages]", k, ":", ok));
  await page.screenshot({ path: "_bake/_verify-camp-floors.png" });

  // 3) Écran combat étage 2 (index 1, contrainte sans_core)
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll(".camp-floor-grid button")];
    btns[1].click();
  });
  await page.waitForTimeout(1500);
  txt = await body();
  console.log("[combat] chip sans_core visible avant combat:", /pas de cores/i.test(txt));
  await page.screenshot({ path: "_bake/_verify-camp-combat.png" });

  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
