const { test } = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;

test("clés d'invocation présentes en FR/EN/ZH", () => {
  for (const k of ["TOTEM_INVOKE_BTN","TOTEM_PREPARING","TOTEM_GALLERY_TITLE","TOTEM_GALLERY_COSMETIC"]) {
    assert.ok(T[k], `clé manquante: ${k}`);
    for (const lang of ["FR","EN","ZH"]) {
      assert.ok(T[k][lang] && T[k][lang].length > 0, `${k}.${lang} manquant`);
    }
  }
});
