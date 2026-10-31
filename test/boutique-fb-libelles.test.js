const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const SCREENS = fs.readFileSync(path.join(root, "screens.jsx"), "utf8");
const I18N = fs.readFileSync(path.join(root, "i18n.js"), "utf8");

// Bug vu à l'écran le 31/10/2026 : la boutique FB affichait « XP ×2 permanent » sur les DEUX
// lignes (4 FB et 10 FB) — le libellé était codé en dur alors que le catalogue a maintenant
// deux objets différents. Le joueur ne pouvait pas savoir ce qu'il achetait.
test("chaque objet du catalogue a SON libellé, plus un texte unique répété", () => {
  assert.match(SCREENS, /xp2_30d:\s*\{\s*name:\s*I18N\.t\("FB_ITEM_XP2_30D"\)/, "XP ×2 a son nom");
  assert.match(SCREENS, /fosse_team2_30d:\s*\{\s*name:\s*I18N\.t\("FB_ITEM_TEAM2"\)/, "la 2e équipe a le sien");
  // Le libellé figé du temps de l'objet unique ne doit plus être rendu directement.
  assert.doesNotMatch(SCREENS, /<div style=\{\{ fontSize: 13 \}\}>\{I18N\.t\("FB_ITEM_XP2"\)\}/,
    "le nom ne doit plus être codé en dur dans la boucle");
});

test("les deux objets annoncent leur durée et leur nature", () => {
  for (const k of ["FB_ITEM_XP2_30D", "FB_ITEM_TEAM2", "FB_ITEM_XP2_30D_DESC", "FB_ITEM_TEAM2_DESC"]) {
    assert.match(I18N, new RegExp(`${k}:\\s*\\{ FR:`), `${k} doit exister dans les trois langues`);
  }
  assert.match(I18N, /FB_ITEM_XP2_30D: \{ FR: "XP ×2 — 30 jours"/, "XP ×2 = 30 jours, pas « permanent »");
  assert.match(I18N, /FB_ITEM_TEAM2: \{ FR: "2e équipe de Fosse — 30 jours"/, "la 2e équipe est nommée");
  assert.match(I18N, /sans mise/, "la 2e équipe dit qu'elle est sans mise");
  assert.match(I18N, /aucun FA/, "et qu'elle ne rapporte aucun FA");
  assert.match(I18N, /Arrêter/, "et qu'il faut arrêter la boucle pour récupérer les entités");
});

test("un abonnement actif affiche son échéance", () => {
  assert.match(SCREENS, /FB_UNTIL/, "l'écran dit jusqu'à quand l'objet est actif");
  assert.match(SCREENS, /it\.expires_at/, "l'échéance vient du serveur");
});
