// Fond peint par écran — direction « Data Citadel » (live 26/09/2026).
// Le contrat : chaque écran a sa peinture, les fichiers existent vraiment sur le disque,
// le poids reste maîtrisé, et le voile de lisibilité est là. Le drapeau reste ÉTEINT par
// défaut : sans `?cite=1`, rien ne change pour le joueur.
"use strict";
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const read = (f) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const existe = (f) => fs.existsSync(path.join(__dirname, "..", f));

// Les 14 écrans qui ont une peinture dédiée dans les livraisons Astra (dont `compte`,
// le sas d'entrée, qui n'est pas une vue du jeu mais un état de l'application).
const ATTENDUS = ["team", "fosse", "arene", "campaign", "tour", "expeditions", "quests",
  "forge", "market", "wallet", "boosts", "leaderboard", "options", "compte"];
// Les écrans sans peinture propre : ils héritent, ils ne tombent pas dans le vide.
const HERITENT = ["perso", "lien", "parrainage"];

// Extrait un objet littéral `const NOM = { ... };` du source — le test suit le code
// réel au lieu de recopier une liste qui pourrait diverger.
function bloc(src, nom) {
  const i = src.indexOf(`const ${nom} = {`);
  assert.ok(i > 0, `${nom} introuvable dans app.jsx`);
  const j = src.indexOf("};", i);
  return src.slice(i, j + 2);
}
// Plusieurs clés par ligne dans la table : on lit toutes les paires `clé: "valeur"`.
const cles = (src, nom) => [...bloc(src, nom).matchAll(/([a-z]+):\s*"/g)].map((m) => m[1]).sort();

test("app.jsx : les 8 écrans peints ont chacun leur fond, et rien de plus", () => {
  const src = read("app.jsx");
  assert.deepStrictEqual(cles(src, "WORLD_BG"), [...ATTENDUS].sort());
  // Chaque entrée pointe sur elle-même : la clé du fond EST l'identifiant de vue.
  for (const v of ATTENDUS) assert.match(src, new RegExp(`${v}: "${v}"`));
});

test("app.jsx : les écrans sans peinture héritent d'un écran parent", () => {
  const src = read("app.jsx");
  assert.deepStrictEqual(cles(src, "WORLD_BG_PARENT"), [...HERITENT].sort());
  // Le repli final existe : un identifiant inconnu ne doit jamais laisser un fond vide.
  assert.match(src, /WORLD_BG\[view\] \|\| WORLD_BG_PARENT\[view\] \|\| "team"/);
});

test("app.jsx : les 42 fichiers de fond existent sur le disque", () => {
  const src = read("app.jsx");
  const vues = cles(src, "WORLD_BG");
  assert.strictEqual(vues.length, 14, "14 peintures : les 13 écrans du jeu + le sas d'entrée");
  for (const v of vues) {
    for (const suf of ["-desktop.webp", "-mobile.webp", "-mobile@2x.webp"]) {
      const f = `assets/backgrounds/${v}${suf}`;
      assert.ok(existe(f), `fichier manquant : ${f}`);
      assert.ok(fs.statSync(path.join(__dirname, "..", f)).size > 40 * 1024, `${f} suspicieusement léger`);
    }
  }
});

test("assets/backgrounds : les masters PNG de 3 Mo ne sont PAS embarqués", () => {
  const d = path.join(__dirname, "..", "assets", "backgrounds");
  // Seuls les deux formats SERVIS sont admis : le WebP (repli) et l'AVIF (choisi par
  // les navigateurs qui le lisent, encodé depuis les masters à poids égal).
  const lourds = fs.readdirSync(d).filter((f) => !/\.(webp|avif)$/.test(f));
  assert.deepStrictEqual(lourds, [], `fichiers non servis embarqués : ${lourds.join(", ")}`);
  const total = fs.readdirSync(d).reduce((a, f) => a + fs.statSync(path.join(d, f)).size, 0);
  // Les deux formats cohabitent : le plafond compte donc le dossier entier, pas ce
  // qu'un joueur télécharge (un seul format part par écran, selon son navigateur).
  // Il monte avec les fonds AVIF à q100 — choix explicite du fondateur, ~2 Mo par écran
  // au lieu de 360 Ko, pour une peinture indistinguable du master, et étendu au mobile
  // le 2026-09-27 (1,7 Mo en @2x, 0,55 Mo en 1x). Plafond : 105 fichiers = 15 écrans
  // × (WebP bureau + WebP mobile + WebP mobile@2x + AVIF bureau + AVIF mobile + AVIF mobile@2x).
  assert.ok(total < 85 * 1024 * 1024, `poids total des fonds : ${(total / 1e6).toFixed(1)} Mo`);
});

test("assets/backgrounds : chaque peinture a son AVIF à q100 — bureau ET mobile", () => {
  // La finesse des fonds vient de l'AVIF : s'il disparaît d'un écran, ce fond retombe
  // silencieusement sur le WebP et le joueur ne voit plus la différence.
  // q100 = le maximum utile (écart moyen 0,3/255 au master, indiscernable de l'œil).
  // Le mobile est encodé depuis les MASTERS mobiles, pas depuis les WebP servis.
  const d = path.join(__dirname, "..", "assets", "backgrounds");
  const src = read("app.jsx");
  for (const v of cles(src, "WORLD_BG")) {
    const f = `assets/backgrounds/${v}-desktop.avif`;
    assert.ok(existe(f), `AVIF manquant : ${f}`);
    const ko = fs.statSync(path.join(d, `${v}-desktop.avif`)).size / 1024;
    assert.ok(ko > 1000, `${f} n'est pas encodé au maximum (${ko.toFixed(0)} Ko au lieu de ~2000)`);
    assert.ok(ko <= 2.6 * 1024, `${f} dépasse 2,6 Mo (${(ko / 1024).toFixed(2)} Mo)`);
    // Deux tailles mobiles, chacune à son niveau : un 1x resté léger trahirait un encodage
    // oublié, un @2x sous 1,4 Mo ne serait pas au maximum.
    for (const [suffixe, mini, maxi] of [["mobile", 300, 800], ["mobile@2x", 1400, 2.6 * 1024]]) {
      const fm = `assets/backgrounds/${v}-${suffixe}.avif`;
      assert.ok(existe(fm), `AVIF mobile manquant : ${fm}`);
      const kom = fs.statSync(path.join(d, `${v}-${suffixe}.avif`)).size / 1024;
      assert.ok(kom > mini, `${fm} n'est pas encodé au maximum (${kom.toFixed(0)} Ko)`);
      assert.ok(kom <= maxi, `${fm} dépasse ${maxi} Ko`);
    }
  }
  assert.ok(existe("assets/backgrounds/quiz-desktop.avif"), "AVIF du quiz manquant (il reste en réserve)");
  assert.ok(existe("assets/backgrounds/quiz-mobile@2x.avif"), "AVIF mobile du quiz manquant");
});

test("assets/backgrounds : la peinture du quiz existe mais reste en réserve", () => {
  // Le quiz n'a pas d'écran à lui : c'est une modale. Sa peinture est livrée et gardée
  // — le jour où le quiz aura sa surface, il suffira d'une entrée dans WORLD_BG.
  for (const suf of ["-desktop.webp", "-mobile.webp", "-mobile@2x.webp"]) {
    assert.ok(existe(`assets/backgrounds/quiz${suf}`), `peinture du quiz manquante : quiz${suf}`);
  }
  assert.doesNotMatch(read("app.jsx"), /quiz: "quiz"/, "le quiz ne doit pas être branché en fond d'application");
});

test("app.jsx : le fond est branché sur la vue, en <picture>, et il est décoratif", () => {
  const src = read("app.jsx");
  assert.match(src, /<picture className="world-backdrop" aria-hidden="true">/);
  assert.match(src, /<source media="\(max-width: 700px\)"/);
  assert.match(src, /srcSet=\{`\$\{bgMobile\} 1x, \$\{bgMobile2x\} 2x`\}/);
  // L'AVIF mobile doit précéder le repli WebP mobile : sinon il ne serait jamais choisi.
  assert.match(src, /<source type="image\/avif" media="\(max-width: 700px\)" srcSet=\{`\$\{bgMobileAvif\} 1x, \$\{bgMobile2xAvif\} 2x`\} \/>/);
  assert.ok(src.indexOf("bgMobileAvif") < src.indexOf("${bgMobile} 1x"),
    "la source AVIF mobile doit venir AVANT le repli WebP mobile");
  assert.match(src, /<img src=\{bgDesktop\} alt="" draggable=\{false\} \/>/);
  // Même source de vérité que l'accent contextuel : g.view, pas un second état.
  assert.match(src, /<Ambient view=\{g\.wallet \? g\.view : "compte"\} \/>/);
  assert.strictEqual((src.match(/<Ambient /g) || []).length, 2, "les deux coquilles (avant/après connexion) doivent passer la vue");
});

test("app.jsx : les décors peints sont le fond par défaut, l'ancien se mémorise par l'URL", () => {
  const src = read("app.jsx");
  assert.match(src, /new URLSearchParams\(location\.search\)\.get\("cite"\)/);
  // Défaut = peinture ; seul un choix explicite « ancien » (?cite=0) l'éteint, et il est
  // mémorisé pour la visite suivante.
  assert.match(src, /localStorage\.setItem\("fa_fond", "ancien"\)/);
  assert.match(src, /return localStorage\.getItem\("fa_fond"\) !== "ancien"/);
  // Le rendu de la peinture est conditionné : pas de `cite &&`, pas de fond.
  assert.match(src, /\{cite && \(\s*<picture/);
  // Les URL passent par FA_ASSET_URL (cache-bust par la version du jeu, convention
  // des images du balisage — le manifeste d'empreintes ne couvre pas ces fichiers).
  assert.match(src, /function assetDeFond\(chemin\)/);
  assert.match(src, /window\.FA_ASSET_URL\(chemin\)/);
});

test("styles.css : couche fixe sous le contenu, et voile de lisibilité", () => {
  const src = read("styles.css");
  const i = src.indexOf(".world-backdrop {");
  assert.ok(i > 0, "règle .world-backdrop absente");
  const blocCss = src.slice(i, src.indexOf("}", i));
  assert.match(blocCss, /position:\s*fixed/);
  assert.match(blocCss, /inset:\s*0/);
  assert.match(blocCss, /z-index:\s*0/);
  assert.match(blocCss, /pointer-events:\s*none/);
  // L'image couvre le cadre et reste assombrie : une peinture claire ne doit jamais
  // concurrencer un texte.
  assert.match(src, /\.world-backdrop img \{[\s\S]*?object-fit:\s*cover/);
  assert.match(src, /\.world-backdrop img \{[\s\S]*?filter:\s*saturate\(0\.92\) brightness\(0\.78\)/);
  // Le voile : sans lui, les panneaux .panel perdent leur contraste sur la peinture.
  assert.match(src, /body\[data-fond="cite"\] \.app-bg \{/);
});

test("styles.css : l'accent par écran du jeu reste intact", () => {
  const src = read("styles.css");
  for (const v of ["fosse", "arene", "campaign", "tour", "forge", "market", "quests", "expeditions"]) {
    assert.match(src, new RegExp(`body\\[data-view="${v}"\\]`), `accent perdu pour ${v}`);
  }
});
