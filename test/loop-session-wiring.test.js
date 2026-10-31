const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const fosse = fs.readFileSync(path.join(root, "fosse.jsx"), "utf8");
const i18n = fs.readFileSync(path.join(root, "i18n.js"), "utf8");

// Contrat de câblage : la boucle de la Fosse ouvre une session d'une heure, l'affiche,
// et ne relance plus de combat quand elle est finie.

test("la Fosse ouvre une session d'une heure quand on active la boucle", () => {
  assert.match(fosse, /loopEndRef\.current = now \+ window\.FA_LOOP\.LOOP_SESSION_MS/);
  assert.match(fosse, /setLoopStart\(now\)/);
});

test("le tour de boucle s'arrête quand l'heure est passée, avant toute décision de quota", () => {
  assert.match(fosse, /if \(!loopSession\(loopEndRef\.current - window\.FA_LOOP\.LOOP_SESSION_MS, Date\.now\(\)\)\.open\)/);
  assert.match(fosse, /toast\(I18N\.t\("AR_LOOP_TIME_END"\), "info"\)/);
});

test("le chrono est affiché pendant la session et se remet à zéro à l'arrêt", () => {
  assert.match(fosse, /loopClock\(loopLeft\)/);
  assert.match(fosse, /setLoopStart\(0\); setLoopLeft\(0\);/);
});

test("les libellés du chrono existent en FR, EN et ZH", () => {
  for (const k of ["AR_LOOP_TIME_END", "AR_LOOP_SESSION"]) {
    const block = new RegExp(k + ": \\{ FR: .*EN: .*ZH: .*\\}");
    assert.match(i18n, block, k + " doit avoir ses trois langues");
  }
});
