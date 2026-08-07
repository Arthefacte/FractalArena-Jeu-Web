/* FRACTAL ARENA — Empreintes des assets binaires (`npm run build`).
 *
 * Pourquoi ce fichier existe. La PR #92 a versionné les URL des `.glb` pour que le CDN cesse de
 * servir des modèles périmés — Cloudflare gardait `amber_cell.glb` cinq jours après son
 * allègement. La version employée était celle du JEU : `emblem.glb?v=127`. Correct pour le CDN,
 * mais désastreux pour le joueur — chaque livraison inventait une URL neuve pour un fichier
 * inchangé. Mesuré le 07/08/2026 sur un Mali-G68 : `emblem.glb` retéléchargé en entier,
 * **1350 Ko**, à chaque déploiement, et la requête la plus lente du service worker (430 ms).
 *
 * Le numéro de version du jeu dit « le code a changé ». Il ne dit rien de ce fichier-ci. Seul son
 * contenu peut le dire : c'est ce que ce script calcule.
 *
 *   node tools/asset-hashes.mjs           # écrit asset-hashes.js
 *   node tools/asset-hashes.mjs --check   # échoue si le manifeste est périmé
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SORTIE = path.join(ROOT, "asset-hashes.js");
const CHECK = process.argv.includes("--check");

// Les dossiers d'assets binaires servis au navigateur. Les images passent par le CSS et le
// balisage, qui portent déjà `?v=` ; seuls les `.glb` sont chargés par du code.
const DOSSIERS = ["assets", "assets/relics"];

function empreinte(fichier) {
  return crypto.createHash("sha256").update(fs.readFileSync(fichier)).digest("hex").slice(0, 10);
}

const table = {};
for (const d of DOSSIERS) {
  const abs = path.join(ROOT, d);
  if (!fs.existsSync(abs)) continue;
  for (const f of fs.readdirSync(abs).sort()) {
    if (!f.endsWith(".glb")) continue;
    table[`${d}/${f}`] = empreinte(path.join(abs, f));
  }
}

const lignes = Object.entries(table).map(([k, v]) => `  "${k}": "${v}",`).join("\n");
const contenu = `/* Généré par tools/asset-hashes.mjs — NE PAS ÉDITER.
   Empreinte du CONTENU de chaque .glb. Un fichier inchangé garde son URL d'une
   livraison à l'autre : le navigateur le garde en cache au lieu de le retélécharger.
   Un fichier modifié change d'empreinte, donc d'URL, et le CDN va chercher le neuf. */
window.FA_ASSET_HASHES = {
${lignes}
};
`;

const actuel = fs.existsSync(SORTIE) ? fs.readFileSync(SORTIE, "utf8") : "";
if (CHECK) {
  if (actuel !== contenu) {
    console.error("Manifeste périmé : lancer `npm run build` et committer asset-hashes.js");
    process.exit(1);
  }
  console.log(`asset-hashes.js à jour (${Object.keys(table).length} modèles)`);
} else {
  fs.writeFileSync(SORTIE, contenu);
  console.log(`${Object.keys(table).length} empreintes d'assets écrites dans asset-hashes.js`);
}
