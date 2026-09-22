// Vérif post-fix : (1) panneau d'odds du summon de core dans la Forge (onglet Reliques),
// (2) repli primitive immédiat dans la modale détail de core (glb retardés 15 s).
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  // Retarde fortement les .glb : l'état « chargement » doit montrer une primitive, pas du vide.
  // NB : les URLs de modèles sont versionnées (?v=hash) → le glob doit finir par `*`.
  await page.route("**/*.glb*", async (route) => {
    await new Promise((r) => setTimeout(r, 15000));
    await route.continue().catch(() => {});
  });

  await page.addInitScript(() => {
    localStorage.setItem("fractal_arena_tutorial_v1", "1");
    let _tui;
    Object.defineProperty(window, "FA_TALENTS_UI", {
      get() { return _tui; },
      set(v) {
        _tui = v;
        const roster = window.FA_DATA.starterRoster();
        const equipment = [{ id: "core_t1", core_id: "last_stand_core", rarity: "Epic" }];
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
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);

  // (2) Équipe → slot core → ⓘ : primitive visible immédiatement (pixels non transparents).
  const slots = page.locator(".relic-slot");
  const n = await slots.count();
  let coreSlot = null;
  for (let i = 0; i < n; i++) {
    if ((await slots.nth(i).innerText()).includes("⬡")) { coreSlot = slots.nth(i); break; }
  }
  await coreSlot.evaluate((el) => el.click());
  await page.waitForTimeout(400);
  await page.locator(".modal button", { hasText: "ⓘ" }).first().evaluate((el) => el.click());
  await page.waitForTimeout(500);
  const px = await page.evaluate(() => {
    const cv = document.querySelectorAll(".modal canvas");
    const c = cv[cv.length - 1];
    if (!c) return { canvas: false };
    // compte les pixels non transparents via readback 2D
    const t = document.createElement("canvas"); t.width = c.width; t.height = c.height;
    const ctx = t.getContext("2d"); ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, t.width, t.height).data;
    let opaque = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 10) opaque++;
    return { canvas: true, opaquePx: opaque, total: d.length / 4 };
  });
  console.log("VIEWER PENDANT CHARGEMENT (glb retardé):", JSON.stringify(px));
  console.log("isReady@primitive:", await page.evaluate(() => window.FA_CORE_MODELS.isReady("last_stand_core")));
  await page.screenshot({ path: "_bake/_verify-fix2-primitive.png" });
  page.on("requestfinished", (r) => { if (r.url().includes(".glb")) console.log("glb fini:", r.url().split("/").pop()); });
  page.on("requestfailed", (r) => { if (r.url().includes(".glb")) console.log("glb ÉCHEC:", r.url().split("/").pop(), r.failure() && r.failure().errorText); });
  await page.waitForTimeout(20000); // le glb arrive → la primitive doit être remplacée par le modèle
  console.log("isReady@model:", await page.evaluate(() => window.FA_CORE_MODELS.isReady("last_stand_core")));
  await page.screenshot({ path: "_bake/_verify-fix2-model.png" });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);

  // (1) Forge → onglet Reliques → section « Invoquer un core » : panneau d'odds.
  const forgeTab = page.locator(".nav-item, nav button, a", { hasText: /forge/i }).first();
  await page.evaluate(() => {
    // navigation directe : setG n'est pas exposé, on clique le bouton de nav
    const els = [...document.querySelectorAll("button, a")];
    const el = els.find((e) => /forge/i.test(e.textContent || ""));
    if (el) el.click();
  });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const els = [...document.querySelectorAll(".subtab")];
    const el = els.find((e) => /relique/i.test(e.textContent || ""));
    if (el) el.click();
  });
  await page.waitForTimeout(800);
  const odds = await page.evaluate(() => {
    const body = document.body.innerText;
    const hasCoreTitle = /invoquer un core/i.test(body);
    // compte les occurrences de chaque % dans la page (reliques + cores → 2 chacune)
    const count = (s) => (body.match(new RegExp(s, "g")) || []).length;
    return { hasCoreTitle, p70: count("70%"), p20: count("20%"), p8: count("8%"), p2: count("2%") };
  });
  console.log("ODDS FORGE:", JSON.stringify(odds));
  await page.evaluate(() => {
    const el = [...document.querySelectorAll(".eyebrow")].find((e) => /invoquer un core/i.test(e.textContent || ""));
    if (el) el.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "_bake/_verify-fix1-odds.png" });
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
