/* ============================================================
   FRACTAL ARENA — pré-transpilation des .jsx  (`npm run build`)
   ============================================================

   Pourquoi. Le jeu transpilait ses vingt écrans dans le navigateur, à chaque
   lancement, avec @babel/standalone. Sur un téléphone milieu de gamme (CPU ÷4)
   le premier écran mettait 26,2 s ; avec les .js produits ici, 2,1 s. Rien
   n'est dégradé au passage : c'est le même code, calculé une fois au lieu de
   vingt fois par lancement sur l'appareil du joueur.

   Ce que ça change pour qui édite le jeu. La source reste le .jsx, on l'édite
   comme avant. Il faut seulement relancer `npm run build` avant de commiter —
   et si on l'oublie, la suite de tests le dit (empreintes dans
   build/sources.json), plutôt que de laisser le site servir l'ancien code.

   Deux pièges, tous deux payés une fois :
   1. Babel exécutait chaque <script type="text/babel"> dans SON propre scope.
      Un <script src> ordinaire partage le scope global : sans enveloppe, les
      vingt « const { useState } = React » se télescopent et la page ne monte
      pas du tout. D'où l'IIFE autour de chaque fichier.
   2. La liste des fichiers n'est pas écrite ici : elle est LUE dans
      index.html, pour qu'ajouter un écran ne demande pas de tenir deux listes
      en accord.
   ============================================================ */
import { createRequire } from "node:module";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const Babel = require("@babel/standalone");

const ROOT = path.join(import.meta.dirname, "..");
const BUILD = path.join(ROOT, "build");
const INDEX = path.join(ROOT, "index.html");

const html = fs.readFileSync(INDEX, "utf8");
/* Les scripts du build tels qu'index.html les réclame — c'est la liste qui
   fait foi. Chaque build/<nom>.js vient de <nom>.jsx à la racine. */
const cibles = [...html.matchAll(/<script src="build\/([^"?]+)\?v=\d+"><\/script>/g)]
  .map((m) => m[1].replace(/\.js$/, ".jsx"));

if (!cibles.length) {
  console.error("Aucun <script src=\"build/....js\"> dans index.html — rien à construire.");
  process.exit(1);
}

fs.rmSync(BUILD, { recursive: true, force: true });
fs.mkdirSync(BUILD, { recursive: true });

const sources = {};
let entree = 0, sortie = 0;

for (const jsx of cibles) {
  const src = path.join(ROOT, jsx);
  if (!fs.existsSync(src)) {
    console.error("Source introuvable : " + jsx + " (réclamée par index.html)");
    process.exit(1);
  }
  const code = fs.readFileSync(src, "utf8");
  const out = Babel.transform(code, { presets: ["react"], filename: jsx, sourceType: "script" }).code;
  const enveloppe = "/* Généré par tools/precompile.mjs depuis " + jsx + " — NE PAS ÉDITER. */\n"
    + "(function () {\n" + out + "\n})();\n";
  fs.writeFileSync(path.join(BUILD, jsx.replace(/\.jsx$/, ".js")), enveloppe);
  /* Empreinte sur le contenu NORMALISÉ : le dépôt est en `* text=auto`, donc
     le même fichier est en CRLF sur Windows et en LF ailleurs. Hacher les
     octets bruts ferait échouer la vérification de dérive sur toute autre
     machine que celle qui a construit. */
  sources[jsx] = crypto.createHash("sha256").update(code.replace(/\r\n/g, "\n")).digest("hex");
  entree += code.length; sortie += enveloppe.length;
}

fs.writeFileSync(path.join(BUILD, "sources.json"), JSON.stringify(sources, null, 2) + "\n");

console.log(cibles.length + " écrans transpilés — "
  + (entree / 1024).toFixed(0) + " Ko de .jsx → " + (sortie / 1024).toFixed(0) + " Ko de .js");
