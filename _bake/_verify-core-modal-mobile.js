// Repro FIX 2 en mobile (390×844, DPR 3) + réseau ralenti sur les .glb :
// vérifie le dimensionnement de la modale détail et l'état du viewer pendant le chargement.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });

  // Retarde les .glb de cores de 8 s pour figer l'état « en cours de chargement ».
  await page.route("**/*.glb", async (route) => {
    await new Promise((r) => setTimeout(r, 8000));
    await route.continue();
  });

  await page.addInitScript(() => {
    localStorage.setItem("fractal_arena_tutorial_v1", "1");
    let _tui;
    Object.defineProperty(window, "FA_TALENTS_UI", {
      get() { return _tui; },
      set(v) {
        _tui = v;
        const roster = window.FA_DATA.starterRoster();
        const equipment = [
          { id: "core_t1", core_id: "last_stand_core", rarity: "Epic" },
        ];
        localStorage.setItem("fractal_arena_v1", JSON.stringify({
          roster, equipment, view: "team", lang: "FR",
          wallet: "bc1qtestwalletfactice000000000000",
          liquid: 50000, locked: 0,
          options: { sound: false, speed: 1 },
        }));
      },
      configurable: true,
    });
  });

  await page.goto("http://localhost:8791/", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.FA_DATA, null, { timeout: 30000 });
  await page.waitForTimeout(10000);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);

  const slots = page.locator(".relic-slot");
  const n = await slots.count();
  let coreSlot = null;
  for (let i = 0; i < n; i++) {
    const t = await slots.nth(i).innerText();
    if (t.includes("⬡")) { coreSlot = slots.nth(i); break; }
  }
  if (!coreSlot) { console.log("PAS DE SLOT CORE"); await browser.close(); return; }
  await coreSlot.evaluate((el) => el.click());
  await page.waitForTimeout(500);
  const info = page.locator(".modal button", { hasText: "ⓘ" }).first();
  await info.evaluate((el) => el.click());
  await page.waitForTimeout(400);

  const r = await page.evaluate(() => {
    const modals = [...document.querySelectorAll(".modal")];
    return modals.map((m) => {
      const b = m.getBoundingClientRect();
      const cv = m.querySelector("canvas");
      const cb = cv ? cv.getBoundingClientRect() : null;
      return { modal: { x: b.x, y: b.y, w: b.width, h: b.height }, scrollW: m.scrollWidth, clientW: m.clientWidth,
               canvas: cb ? { w: cb.width, h: cb.height, bufW: cv.width, bufH: cv.height } : null,
               viewportW: innerWidth };
    });
  });
  console.log("MOBILE pendant chargement:", JSON.stringify(r, null, 1));
  await page.screenshot({ path: "_bake/_verify-mobile-loading.png" });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: "_bake/_verify-mobile-loaded.png" });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
