/* Titres de campagne dérivés de la progression.
 *
 * Bug (2026-08-19) : les titres n'étaient calculés que dans campaignFight,
 * stockés dans l'état React de la session, jamais persistés ni recalculés au
 * chargement — un joueur à 100 % voyait « Aucun titre » après un rechargement.
 * Les titres sont une fonction PURE de la progression : on les dérive.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function lire(f) { return fs.readFileSync(path.join(__dirname, "..", f), "utf8"); }

function loadD() {
  const sandbox = { window: {} };
  vm.runInNewContext(lire("data.js"), sandbox, { filename: "data.js" });
  return sandbox.window.FA_DATA;
}

// Le tableau revient d'un autre realm vm (prototype Array différent) :
// Array.from le ramène dans le nôtre pour que deepStrictEqual compare le contenu.
function derive(D, progress) { return Array.from(D.deriveCampaignTitles(progress)); }

// Progression imbriquée { [w]: { stars: number[10] } } avec les mondes donnés à 30/30.
function fullWorlds(D, indices) {
  const p = {};
  for (const i of indices) p[i] = { stars: new Array(D.FLOORS_PER_WORLD).fill(3) };
  return p;
}

test("deriveCampaignTitles : progression vide → aucun titre", () => {
  const D = loadD();
  assert.deepStrictEqual(derive(D, {}), []);
});

test("deriveCampaignTitles : un monde à 30/30 → son titre, pas les autres", () => {
  const D = loadD();
  assert.deepStrictEqual(derive(D, fullWorlds(D, [0])), ["CAMP_W1_TITLE"]);
});

test("deriveCampaignTitles : 29/30 étoiles → pas de titre", () => {
  const D = loadD();
  const p = fullWorlds(D, [0]);
  p[0].stars[9] = 2;
  assert.deepStrictEqual(derive(D, p), []);
});

test("deriveCampaignTitles : tous les mondes à 100 % → 6 titres + Légende", () => {
  const D = loadD();
  const all = D.WORLDS.map((_, i) => i);
  const titles = derive(D, fullWorlds(D, all));
  for (let i = 1; i <= D.WORLDS.length; i++) assert.ok(titles.includes("CAMP_W" + i + "_TITLE"), "manque W" + i);
  assert.ok(titles.includes("CAMP_LEGEND_TITLE"), "manque le titre Légende");
  assert.strictEqual(titles.length, D.WORLDS.length + 1);
});

test("serverToState hydrate campaignTitles depuis la progression (app.jsx)", () => {
  // Sans harnais React on vérifie le câblage au niveau source : l'hydratation
  // de la save doit dériver les titres, pas les remettre à zéro.
  const src = lire("app.jsx");
  const idx = src.indexOf("function serverToState");
  const body = src.slice(idx, src.indexOf("\n}", idx));
  assert.ok(/campaignTitles:\s*D\.deriveCampaignTitles\(/.test(body),
    "serverToState doit poser campaignTitles: D.deriveCampaignTitles(...)");
});

test("le titre Légende ne s'appelle plus NETWORK (entité du jeu)", () => {
  const src = lire("i18n.js");
  const ligne = src.split("\n").find((l) => l.includes("CAMP_LEGEND_TITLE:"));
  assert.ok(ligne, "clé CAMP_LEGEND_TITLE absente d'i18n.js");
  assert.ok(!/NETWORK/i.test(ligne),
    "CAMP_LEGEND_TITLE mentionne encore NETWORK : " + ligne.trim());
});
