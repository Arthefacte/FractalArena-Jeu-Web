const test = require("node:test");
const assert = require("node:assert");
globalThis.window = {};
require("../i18n.js");
const { T } = globalThis.window.FA_I18N;
const LANGS = ["FR", "EN", "ZH"];
const KEYS = [
  "NAV_ARENE", "AR2_TITLE", "AR2_TAG", "AR2_MY_DEFENSE", "AR2_SET_DEFENSE",
  "AR2_OPPONENTS", "AR2_LADDER", "AR2_ATTACK", "AR2_REVANCHE", "AR2_ENTRY",
  "AR2_LADDER_LEAGUE", "AR2_LADDER_POSITION",
  "AR2_FREE", "AR2_FA", "AR2_TICKET", "AR2_NO_DEFENSE", "AR2_SEASON",
  "AR2_ENDS_IN", "AR2_PRIZE", "AR2_WIN", "AR2_LOSE", "AR2_ELO_DELTA",
  // Arène V2 : les entrées implicites et leur étiquette non classée ont disparu.
  "AR2_NO_OPPONENTS", "AR2_POWER", "AR2_RANK", "AR2_REFRESH",
  "AR2_ENTRY_TITLE", "AR2_ENTRY_HINT", "AR2_OPEN_TEAM", "AR2_CHOOSE_THREE",
  "AR2_DEFENSE_HP", "AR2_HEAL", "AR2_HEAL_OK", "AR2_DEFENSE_FULL",
  "AR2_DEFENSE_DOWN", "AR2_DEFENSE_RAISE", "AR2_DEFENSE_LOADING",
  "AR2_DEFENSE_ERROR", "AR2_DEFENSE_RETRY", "AR2_ERR_NO_DEFENSE",
  "AR2_ERR_DEFENSE_DOWN", "AR2_ERR_PAIR_LIMIT", "AR2_ERR_DEFENSE_FULL",
  "AR2_DEFENSE_POSTED_AT", "AR2_DEFENSE_STALE", "AR2_DEFENSE_OUTDATED", "AR2_TAKE_TOP_THREE",
  "AR2_FORMATION_FRONT", "AR2_FORMATION_MIDDLE", "AR2_FORMATION_BACK", "AR2_FORMATION_HINT",
  "AR2_SLOT_EMPTY", "AR2_REPLACEMENT_TITLE", "AR2_SELECTION_ADD", "AR2_SLOT_POWER", "AR2_ENTITY_STATS",
  "AR2_REPLACEMENT_CANCEL", "AR2_REPLACEMENT_NONE", "AR2_MOVE_UP", "AR2_MOVE_DOWN",
  // Lot « Arène unifiée » (27/10/2026) : l'étiquette de carte d'agent et les refus du
  // chemin croisé, qui arrivent avec la même livraison que le serveur.
  "AR2_AGENT_TAG", "AR2_ERR_AGENT_GONE", "AR2_ERR_PAIR_COOLDOWN", "AR2_ERR_DEFENSE_CHANGED",
];
test("toutes les clés Arène existent dans les 3 langues, non vides", () => {
  for (const k of KEYS) {
    assert.ok(T[k], "clé manquante : " + k);
    for (const lg of LANGS) assert.ok(T[k][lg] && T[k][lg].trim().length > 0, `${k}.${lg} vide`);
  }
});

test("Arène : les paramètres de sélection et de remplacement restent identiques en FR/EN/ZH", () => {
  const expected = {
    AR2_REPLACEMENT_TITLE: ["%s"], AR2_SLOT_POWER: ["%s"],
    AR2_ENTITY_STATS: ["%d", "%s", "%d"], AR2_MOVE_UP: ["%s"], AR2_MOVE_DOWN: ["%s"],
  };
  for (const [key, parameters] of Object.entries(expected)) {
    for (const lang of LANGS) assert.deepStrictEqual(T[key][lang].match(/%[sd]/g), parameters, `${key}.${lang}`);
  }
});

test("Arène V2 : la provenance conserve la date et les mêmes paramètres dans les trois langues", () => {
  const I = window.FA_I18N;
  for (const lang of LANGS) {
    assert.deepStrictEqual(T.AR2_DEFENSE_POSTED_AT[lang].match(/%[sd]/g), ["%s"]);
    I.setLang(lang);
    const message = I.t("AR2_DEFENSE_POSTED_AT", "17/10/2026");
    assert.ok(message.includes("17/10/2026"), `${lang}: la date doit rester lisible`);
    assert.doesNotMatch(message, /%[sd]/);
  }
  I.setLang("FR");
});

test("Arène : les titres génériques restent disponibles sans ligue", () => {
  for (const lang of LANGS) {
    for (const key of ["AR2_TAG", "AR2_LADDER"]) {
      assert.doesNotMatch(T[key][lang], /ligue|league|diamant|diamond|联赛|钻石/i);
    }
  }
});

test("classement : ligue, rang et effectif sont traduits dans les trois langues", () => {
  const I = window.FA_I18N;
  for (const lang of LANGS) {
    I.setLang(lang);
    assert.deepStrictEqual(T.AR2_LADDER_LEAGUE[lang].match(/%[sd]/g), ["%s"]);
    assert.deepStrictEqual(T.AR2_LADDER_POSITION[lang].match(/%[sd]/g), ["%d", "%d", "%s"]);
    assert.ok(I.t("AR2_LADDER_LEAGUE", "Argent").includes("Argent"));
    const position = I.t("AR2_LADDER_POSITION", 4, 14, "Argent");
    assert.match(position, /4.*14.*Argent/);
    assert.doesNotMatch(position, /%[sd]/);
  }
  I.setLang("FR");
});

test("Arène V2 : les refus serveur sont lisibles dans les trois langues", () => {
  const I = window.FA_I18N;
  for (const lang of LANGS) {
    I.setLang(lang);
    for (const code of ["pas_de_defense", "defense_tombee", "plafond_couple", "defense_pleine", "solde_insuffisant", "cible_sans_fantome",
      // Chemin croisé (agent) : mêmes exigences, aucun code laissé brut.
      "agent_introuvable", "cooldown_couple", "defense_modifiee", "cible_sans_equipe", "auto_attaque_interdite"]) {
      const message = I.localizeServerError(code, { pair_limit: 7 });
      assert.notStrictEqual(message, code);
      assert.notStrictEqual(message, I.t("ERR_GENERIC"), `${lang}: ${code} doit avoir son message`);
      assert.doesNotMatch(message, /%[sd]/);
      assert.ok(message.trim().length > 0, `${lang}: ${code} doit être lisible`);
    }
  }
  I.setLang("FR");
});

test("Arène V2 : soin et plafond utilisent les valeurs du serveur", () => {
  const I = window.FA_I18N;
  for (const lang of LANGS) {
    I.setLang(lang);
    assert.match(I.localizeServerError("plafond_couple", { pair_limit: 7 }), /7/);
    assert.match(I.localizeServerError("plafond_couple", { pair_limit: 13 }), /13/);
    assert.match(I.t("AR2_HEAL", 23), /23/);
    const unknown = I.localizeServerError("plafond_couple");
    assert.doesNotMatch(unknown, /%[sd]|\d/,
      "sans cadence, aucun plafond chiffré ne doit être inventé");
  }
  I.setLang("FR");
});
