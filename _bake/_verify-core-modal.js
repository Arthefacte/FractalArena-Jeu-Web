// Repro FIX 2 : écran Équipe → slot core → modale équipement → ⓘ détail.
// Mesure les rects de la modale + du canvas du viewer, capture des screenshots.
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("console", (m) => { if (m.type() === "error") console.log("[console.error]", m.text().slice(0, 200)); });

  await page.addInitScript(() => {
    localStorage.setItem("fractal_arena_tutorial_v1", "1");
    let _tui;
    Object.defineProperty(window, "FA_TALENTS_UI", {
      get() { return _tui; },
      set(v) {
        _tui = v;
        const roster = window.FA_DATA.starterRoster();
        const equipment = [
          { id: "core_t1", core_id: "fury_core", rarity: "Legendary" },
          { id: "core_t2", core_id: "last_stand_core", rarity: "Epic" },
          { id: "core_t3", core_id: "regen_core", rarity: "Common" },
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
  await page.waitForTimeout(9000);
  await page.keyboard.press("Escape"); // LoginGate éventuel
  await page.waitForTimeout(800);

  // Slot core sous la première carte (texte ⬡ / CORE_NONE)
  const slots = page.locator(".relic-slot");
  const n = await slots.count();
  console.log("relic-slot count:", n);
  let coreSlot = null;
  for (let i = 0; i < n; i++) {
    const t = await slots.nth(i).innerText();
    if (t.includes("⬡")) { coreSlot = slots.nth(i); break; }
  }
  if (!coreSlot) { console.log("PAS DE SLOT CORE TROUVÉ"); await page.screenshot({ path: "_bake/_verify-noslot.png", fullPage: true }); await browser.close(); return; }
  await coreSlot.evaluate((el) => el.click());
  await page.waitForTimeout(600);

  const measure = async (label) => {
    const r = await page.evaluate(() => {
      const modals = [...document.querySelectorAll(".modal")];
      return modals.map((m) => {
        const b = m.getBoundingClientRect();
        const cv = m.querySelector("canvas");
        const cb = cv ? cv.getBoundingClientRect() : null;
        return {
          modal: { x: b.x, y: b.y, w: b.width, h: b.height },
          scrollW: m.scrollWidth, clientW: m.clientWidth,
          canvas: cb ? { x: cb.x, y: cb.y, w: cb.width, h: cb.height, bufW: cv.width, bufH: cv.height } : null,
        };
      });
    });
    console.log(label, JSON.stringify(r, null, 1));
  };
  await measure("MODALE ÉQUIPEMENT:");
  await page.screenshot({ path: "_bake/_verify-equip-modal.png" });

  // Clic sur le premier ⓘ
  const info = page.locator(".modal button", { hasText: "ⓘ" }).first();
  if (await info.count()) {
    await info.evaluate((el) => el.click());
    await page.waitForTimeout(300);
    await measure("DÉTAIL t+300ms:");
    await page.screenshot({ path: "_bake/_verify-detail-early.png" });
    await page.waitForTimeout(5000);
    await measure("DÉTAIL t+5300ms:");
    await page.screenshot({ path: "_bake/_verify-detail-late.png" });
  } else {
    console.log("PAS DE BOUTON ⓘ");
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
