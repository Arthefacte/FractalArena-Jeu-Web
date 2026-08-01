/* PWA — politique de cache du service worker.
   La logique de routage vit dans sw-policy.js, module pur (modèle des autres
   *-ui.js du dépôt), pour être éprouvée ici en node ; sw.js n'en est que la
   couche d'exécution.

   RÈGLE CARDINALE : rien de ce qui vient du serveur de jeu ne doit être mis en
   cache. Une réponse de /save, /fight ou /account rejouée depuis le cache
   afficherait un solde, un roster ou un combat périmés — exactement le genre de
   panne silencieuse qu'on s'interdit. */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const P = require("../sw-policy.js");
const ROOT = path.join(__dirname, "..");
const SW = fs.readFileSync(path.join(ROOT, "sw.js"), "utf8");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

const ORIGIN = "https://fractalarena.com";
const API = "https://fractal-arena-server-production.up.railway.app";

test("tout ce qui part vers le serveur de jeu reste RÉSEAU SEUL", () => {
  for (const u of ["/save", "/fight", "/account/me", "/pvp/attack", "/tower/run"]) {
    assert.equal(P.routeFor({ url: API + u, method: "GET", mode: "cors" }, ORIGIN), "reseau-seul",
      "l'API ne doit jamais passer par le cache : " + u);
  }
});

test("une écriture n'est jamais mise en cache, même same-origin", () => {
  assert.equal(P.routeFor({ url: ORIGIN + "/save", method: "POST", mode: "cors" }, ORIGIN), "reseau-seul");
});

test("le document passe par le réseau D'ABORD", () => {
  // Sinon un index.html en cache continuerait de réclamer les assets de
  // l'ancienne version après un déploiement.
  assert.equal(P.routeFor({ url: ORIGIN + "/", method: "GET", mode: "navigate" }, ORIGIN), "reseau-d-abord");
  assert.equal(P.routeFor({ url: ORIGIN + "/index.html", method: "GET", mode: "navigate" }, ORIGIN), "reseau-d-abord");
});

test("les assets versionnés passent par le cache D'ABORD", () => {
  // Ils portent ?v=N : une adresse donnée désigne toujours le même contenu.
  for (const u of ["/styles.css?v=109", "/app.jsx?v=109", "/assets/HASHBYTE_S.webp",
                   "/vendor/three-0.160.0/three.module.js", "/assets/Emblem_optimise_12Mo.glb"]) {
    assert.equal(P.routeFor({ url: ORIGIN + u, method: "GET", mode: "no-cors" }, ORIGIN), "cache-d-abord", u);
  }
});

test("les hôtes tiers ne sont pas mis en cache par nous", () => {
  // unpkg (React/Babel) et Google Fonts ont leurs propres en-têtes de cache ;
  // les dupliquer nous ferait porter la responsabilité de leur péremption.
  for (const u of ["https://unpkg.com/react@18.3.1/umd/react.development.js",
                   "https://fonts.gstatic.com/s/x.woff2",
                   "https://pub-0b140013c6564ee080397bcdb722b776.r2.dev/t.png"]) {
    assert.equal(P.routeFor({ url: u, method: "GET", mode: "cors" }, ORIGIN), "reseau-seul", u);
  }
});

test("le nom de cache change avec la version du déploiement", () => {
  assert.match(P.CACHE, /^fa-v\d+$/, "nom de cache : " + P.CACHE);
  const v = (HTML.match(/\?v=(\d+)/g) || []).map((s) => s.slice(3)).filter((s) => s !== "1")[0];
  assert.equal(P.CACHE, "fa-v" + v, "le cache doit suivre le cache-bust d'index.html");
});

test("obsolete() ne désigne QUE nos anciens caches", () => {
  const noms = ["fa-v107", "fa-v108", P.CACHE, "workbox-precache", "autre-app-v1"];
  assert.deepEqual(noms.filter(P.obsolete), ["fa-v107", "fa-v108"]);
});

/* --- Câblage (non exécutable ici : contexte ServiceWorker) --- */

test("sw.js s'appuie sur la politique testée, il ne la réécrit pas", () => {
  assert.match(SW, /importScripts\([^)]*sw-policy\.js/, "sw.js doit importer sw-policy.js");
  assert.match(SW, /routeFor/, "sw.js n'utilise pas la politique");
});

test("sw.js ne met en cache que des réponses réussies et non partielles", () => {
  // Une 206 (Range) ou une réponse opaque en cache casse la lecture audio/vidéo.
  assert.match(SW, /status !== 200|status === 200/, "sw.js doit filtrer sur le statut avant de mettre en cache");
  assert.match(SW, /type === "opaque"/, "une réponse opaque en cache est illisible et occupe la place");
});

test("sw.js purge les caches obsolètes à l'activation", () => {
  assert.match(SW, /activate/);
  assert.match(SW, /obsolete/, "sans purge, chaque version laisserait son cache sur le téléphone");
});

test("index.html enregistre le service worker, sous garde", () => {
  assert.match(HTML, /serviceWorker/, "aucun enregistrement : le jeu reste non installable");
  assert.match(HTML, /"serviceWorker" in navigator|'serviceWorker' in navigator/,
    "l'enregistrement doit être gardé (navigateurs anciens, contextes non sécurisés)");
  assert.match(HTML, /register\(\s*["']sw\.js/, "chemin d'enregistrement inattendu");
});
