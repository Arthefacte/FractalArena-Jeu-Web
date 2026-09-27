/* ============================================================
   FRACTAL ARENA — instantané des codes d'erreur du SERVEUR

   E7 (audit D10, findings F1 et F2) : la table d'erreurs du client (`i18n.js`,
   + `MKT_ERR_KEYS` de `market.jsx`) couvrait 44 des 99 codes que le serveur peut
   renvoyer en 4xx — les autres tombaient sur « Une erreur est survenue ». Un test
   ne peut pas lire le dépôt serveur depuis la CI du dépôt web (deux dépôts, et le
   serveur est privé) : d'où cet INSTANTANÉ, versionné, que le test confronte au
   client.

   Usage (depuis la racine du dépôt WEB) :

     node tools/snapshot-server-codes.mjs ../fractal-arena-server

   L'instantané porte l'empreinte du dépôt serveur au moment du prélèvement : c'est
   ce qui dit à quel point la garde est fraîche. À rejouer dès qu'un module serveur
   ajoute un code — sinon le test protège l'état d'hier, et le dit (champ `commit`).
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, extname, basename, resolve } from "node:path";
import { execSync } from "node:child_process";

const racine = resolve(process.argv[2] || "../fractal-arena-server");
if (!statSync(racine).isDirectory()) {
  console.error("Dossier serveur introuvable :", racine);
  process.exit(1);
}

// Seuls les fichiers du jeu : les tests, les outils et les artefacts de build ne
// renvoient rien aux joueurs.
const IGNORES = new Set(["node_modules", "test", "tests", "tools", "dist", "coverage", ".git", "docs"]);
const fichiers = [];
(function parcours(dir) {
  for (const e of readdirSync(dir)) {
    if (IGNORES.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) parcours(p);
    else if (extname(p) === ".js" && !e.startsWith(".")) fichiers.push(p);
  }
})(racine);

// `res.status(400).json({ error: "..." })`, dans l'ordre des appellations réelles.
// On capture les deux styles présents dans le dépôt : `res.status(N)` et `res.sendStatus(N)`,
// avec le corps qui suit quand il est sur la même expression ou juste après.
const CODES = /res\s*\.\s*status\s*\(\s*(4\d\d)\s*\)\s*\.\s*json\s*\(\s*\{([^}]*)\}/g;
const CODE_FIELD = /\b(?:code|error|status)\s*:\s*(?:"([^"]{2,60})"|([A-Za-z_$][\w$]*))/g;

const trouves = new Map();
for (const f of fichiers) {
  const src = readFileSync(f, "utf8");
  let m;
  while ((m = CODES.exec(src)) !== null) {
    const statut = Number(m[1]);
    const corps = m[2];
    let c;
    while ((c = CODE_FIELD.exec(corps)) !== null) {
      // Seule une CHAÎNE est un code : `error: uneVariable` capturait des identifiants
      // JS (`dec`, `err`, `sel`…) qui n'ont rien d'un code d'erreur.
      if (c[1] === undefined) continue;
      const valeur = c[1];
      // Un code technique est en snake_case (ou en kebab) : les phrases en clair
      // (« Adresse wallet invalide ») sont des messages, pas des codes.
      if (!/^[a-z][a-z0-9_]{2,49}$/.test(valeur)) continue;
      const cle = valeur;
      if (!trouves.has(cle)) trouves.set(cle, { statut, fichiers: new Set() });
      trouves.get(cle).fichiers.add(basename(f));
    }
  }
}

let commit = "inconnu";
try {
  commit = execSync("git rev-parse --short HEAD", { cwd: racine }).toString().trim();
} catch (e) { /* dépôt absent : l'instantané reste utilisable, la fraîcheur n'est plus datée */ }

const codes = [...trouves.entries()]
  .map(([code, v]) => ({ code, statut: v.statut, fichiers: [...v.fichiers].sort() }))
  .sort((a, b) => a.code.localeCompare(b.code));

const sortie = {
  _lisez: "Instantané des codes 4xx du serveur. Régénérer : node tools/snapshot-server-codes.mjs <chemin du dépôt serveur>",
  serveur_commit: commit,
  fichiers_lus: fichiers.length,
  codes,
};

writeFileSync("test/fixtures/server-error-codes.json", JSON.stringify(sortie, null, 2) + "\n");
console.log(`${codes.length} codes 4xx prélevés sur ${fichiers.length} fichiers serveur (commit ${commit})`);
