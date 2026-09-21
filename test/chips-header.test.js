// test/chips-header.test.js
// Le 21/09/2026, les trois chips du bandeau sont passées d'un canvas WebGL de 56 px
// (Badge3D, badges hexagonaux) à un sprite 2D (assets/fa-badge.webp, fb-badge.webp).
// Raison : un canvas n'est pas stylable. Dans le bandeau mobile — une seule ligne,
// `flex-wrap: nowrap` en ≤640 px — le badge de 56 px débordait du chip, poussait la
// rangée sous le logo et sortait du cadre ; et il fallait trois contextes WebGL dans
// le header pour trois chips. Le sprite, lui, se dimensionne en CSS : 56 px en
// desktop (styles.css), 14-18 px en mobile (mobile.css).
// Ces tests tiennent l'acquis : un canvas qui revient dans un chip doit faire
// échouer la suite, pas se découvrir à l'œil sur un téléphone.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const lire = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const APP = lire("app.jsx");

test("les chips du header montrent un sprite 2D, plus un canvas", () => {
  assert.match(APP, /ChipBadge src="assets\/fa-badge\.webp"/,
    "le chip FA/liquidé ne passe plus par le sprite 2D");
  assert.match(APP, /ChipBadge src="assets\/fb-badge\.webp"/,
    "le chip FB ne passe plus par le sprite 2D");
  assert.doesNotMatch(APP, /Badge3D|chargerBadge|_badgeGlb/,
    "un canvas WebGL est revenu dans le bandeau — c'est ce qui débordait en mobile");
  assert.doesNotMatch(APP, /assets\/(fa|fb)-badge\.glb/,
    "le header charge à nouveau le .glb du badge : le boot retélécharge 0,5 Mo pour rien");
});

test("le sprite passe par le cache-buster d'assets", () => {
  // « l'asset le plus lent du boot » : un sprite servi sous son chemin nu resterait
  // au cache du CDN d'une livraison à l'autre (même famille que la PR #92).
  assert.match(APP, /FA_ASSET_URL\(src\)/,
    "le sprite doit être versionné par FA_ASSET_URL, sinon le CDN sert l'ancien");
});

test("la taille du badge est pilotée par le CSS des deux écrans", () => {
  assert.match(lire("styles.css"), /\.chip-badge \{[^}]*width: \d+px[^}]*height: \d+px/,
    "le badge desktop doit rester une taille CSS pilotable (pas celle du canvas)");
  // Window: mobile.css réduit TOUT `.chip img` — c'est ce qui ramène le badge à la
  // taille du chip compact. Un clamp, pas une valeur figée : le bandeau tient sur
  // une ligne de 320 à 640 px.
  assert.match(lire("mobile.css"), /\.chip img \{ width: clamp\([^)]*\); height: clamp\([^)]*\); \}/,
    "sans réduction mobile, le sprite de 56 px déborde du chip compact");
});

test("les deux sprites sont dans le dépôt", () => {
  for (const f of ["assets/fa-badge.webp", "assets/fb-badge.webp"]) {
    assert.ok(fs.existsSync(path.join(__dirname, "..", f)), `${f} manquant`);
    assert.ok(fs.statSync(path.join(__dirname, "..", f)).size < 40 * 1024,
      `${f} : un sprite de chip doit rester léger (c'est tout l'intérêt)`,
      );
  }
});
