const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const T = window.FA_I18N.T;

// Retrait — précision du 11/10/2026 : le joueur lisait « maximum 20 000 / jour »
// dans le panneau de retrait et en déduisait qu'il pouvait enchaîner plusieurs
// retraits de 1 000 FA dans la même journée. Ce qui borne l'usage n'est pas le
// plafond mais la FRÉQUENCE : un seul retrait toutes les 24 h (fenêtre glissante
// depuis le dernier retrait non échoué, côté serveur). La fréquence doit être
// écrite dans les trois langues, et aucune surface ne doit plus promettre un
// plafond « par jour ». Ce test sert de garde : sans lui, un futur passage peut
// réintroduire « max 20 000 / jour » sans que rien ne rougisse.
const LANGUES = ["FR", "EN", "ZH"];
const DIT_24H = /24\s?h|24\s*小时/;
const DIT_PAR_JOUR = /\/\s?jour|\/\s?day|\/\s?天|每日最高/;

test("WL_WD_INFO dit la fréquence (24 h) et ne parle plus d'un plafond par jour", () => {
  for (const lang of LANGUES) {
    const s = T.WL_WD_INFO[lang];
    assert.ok(DIT_24H.test(s), `WL_WD_INFO.${lang} ne dit pas les 24 h : ${s}`);
    assert.ok(!DIT_PAR_JOUR.test(s), `WL_WD_INFO.${lang} parle encore d'un plafond par jour : ${s}`);
  }
});

test("WL_WD_MAX rattache le maximum au RETRAIT, et rappelle la fréquence", () => {
  for (const lang of LANGUES) {
    const s = T.WL_WD_MAX[lang];
    assert.ok(/%d/.test(s), `WL_WD_MAX.${lang} sans placeholder %d`);
    assert.ok(DIT_24H.test(s), `WL_WD_MAX.${lang} ne rappelle pas la fréquence : ${s}`);
    assert.ok(!DIT_PAR_JOUR.test(s), `WL_WD_MAX.${lang} parle encore d'un plafond par jour : ${s}`);
  }
});

test("WL_WD_MAX / WL_WD_MIN portent le montant, la borne haute sans « par jour »", () => {
  for (const lang of LANGUES) {
    assert.ok(/%d/.test(T.WL_WD_MIN[lang]), `WL_WD_MIN.${lang} sans %d`);
    assert.ok(/par retrait|per withdrawal|单次/.test(T.WL_WD_MAX[lang]),
      `WL_WD_MAX.${lang} ne nomme pas l'unité du plafond (par retrait) : ${T.WL_WD_MAX[lang]}`);
  }
});

test("WL_WD_COOLDOWN annonce un délai en heures (message d'un retrait trop tôt)", () => {
  for (const lang of LANGUES) {
    assert.ok(/%d/.test(T.WL_WD_COOLDOWN[lang]), `WL_WD_COOLDOWN.${lang} sans %d`);
    assert.ok(DIT_24H.test(T.WL_WD_COOLDOWN[lang]), `WL_WD_COOLDOWN.${lang} sans référence aux 24 h`);
  }
});
