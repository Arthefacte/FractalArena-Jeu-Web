/* Le numéro de cache-busting doit AVANCER quand un fichier servi change.

 * E9 (audit D10, finding F4). Trois tests tenaient déjà l'alignement INTERNE du
 * numéro : `FA_ASSET_V` de data.js, les `?v=` de index.html, le nom de cache du
 * service worker. Aucun ne vérifiait que le numéro avait BOUGÉ depuis la livraison
 * précédente — un oubli de bump passait donc la CI en silence, et les joueurs
 * restaient sur les anciens scripts du cache HTTP alors que l'API, elle, avait bougé.
 * C'est le pire des deux mondes : un client périmé qui parle à un serveur à jour.

 * La règle est celle du geste réel : **le commit qui change un fichier servi doit porter
 * le bump**. On compare donc HEAD à son parent (`git show HEAD^:index.html` contre
 * `index.html`), et on exige que le numéro ait augmenté dès qu'un fichier servi figure
 * dans le diff.
 *
 * Pourquoi PAS `origin/main` : la première version de ce test comparait à `origin/main`,
 * et elle a cassé la CI — `git diff origin/main...HEAD` a besoin d'un ancêtre commun, que
 * le clone de la CI (profondeur 1) n'a pas. Elle échouait donc sur l'environnement, pas sur
 * un vrai oubli de bump. La comparaison au parent, elle, ne dépend d'aucune référence
 * distante et ne se laisse pas tromper par une `main` qui avance pendant qu'une branche
 * attend (ce qui aurait fait échouer une branche innocente). La CI fait `fetch-depth: 2`
 * pour que le parent soit présent.
 *
 * Cas du commit de FUSION : ignoré, et le test le DIT — son contenu a déjà été confronté à
 * cette règle par la CI de la branche fusionnée.

 * Ce qui compte comme « fichier servi » : ce que le navigateur met en cache sous
 * `?v=` — le HTML, le CSS, les .js de la racine et de build/, et les .jsx qui les
 * produisent. Les dossiers d'outillage (test/, tools/, docs/, _bake/, .design-sync/,
 * art/, ds-bundle/_src/) et les fichiers `_*` n'en font pas partie : ils changent
 * souvent et n'ont pas d'URL versionnée.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const RACINE = path.join(__dirname, "..");

const DEVELOPPEMENT = /^(test\/|tools\/|docs\/|_bake\/|\.design-sync\/|ds-bundle\/_src\/|art\/|_)/;
const SERVI = /\.(js|jsx|html|css)$/i;

function git(cmd) {
  try {
    return execSync(`git ${cmd}`, { cwd: RACINE, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch (e) {
    return null;
  }
}

function versionDe(html) {
  const m = /build\/app\.js\?v=(\d+)/.exec(html);
  assert.ok(m, "index.html doit porter build/app.js?v=N");
  return Number(m[1]);
}

function fichiersServis(liste) {
  return (liste || "").split("\n").filter((f) => f && SERVI.test(f) && !DEVELOPPEMENT.test(f));
}

test("le numéro de cache-busting avance dès qu'un fichier servi change", () => {
  const parents = git("rev-list --parents -n 1 HEAD");
  if (!parents) {
    console.log("[E9] dépôt git illisible : garde neutre (archive exportée ?)");
    return;
  }
  const champs = parents.split(/\s+/);
  if (champs.length > 2) {
    console.log("[E9] HEAD est un commit de fusion : garde neutre (son contenu a été vérifié par la CI de la branche fusionnée)");
    return;
  }
  const parent = champs[1];
  const avant = git(`show ${parent}:index.html`);
  if (!avant) {
    console.log("[E9] parent illisible : garde neutre (la CI fait fetch-depth: 2, cf. tests.yml)");
    return;
  }

  const vAvant = versionDe(avant);
  const vIci = versionDe(fs.readFileSync(path.join(RACINE, "index.html"), "utf8"));
  const servis = fichiersServis(git(`diff --name-only ${parent} HEAD`));

  if (servis.length === 0) {
    // Ce commit ne touche que des tests, de l'outillage ou de la documentation : aucun
    // bump attendu (mais un recul du numéro resterait anormal).
    assert.ok(vIci >= vAvant, `le numéro a reculé (v${vIci} < v${vAvant}) sans qu'aucun fichier servi ne change`);
    return;
  }

  assert.ok(
    vIci > vAvant,
    `ce commit change des fichiers servis (${servis.slice(0, 6).join(", ")}${servis.length > 6 ? "…" : ""}) ` +
      `mais le cache-busting est resté à v${vIci} (v${vAvant} avant).\n` +
      `Sans bump, les joueurs gardent les anciens fichiers dans le cache HTTP : incrémenter les ?v= de\n` +
      `index.html, FA_ASSET_V (data.js), CACHE (sw-policy.js), les icônes de manifest.webmanifest, et les\n` +
      `assertions épinglées des tests.`
  );
});

test("les cinq endroits du numéro sont d'accord entre eux", () => {
  // Rappel des trois autres (déjà couverts par sw-policy.test.js et asset-cache-bust.test.js) :
  // ce test-ci vérifie la version du HTML, celle que le service worker prend pour nom de cache.
  const ici = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");
  const v = versionDe(ici);
  const asset = fs.readFileSync(path.join(RACINE, "data.js"), "utf8");
  assert.match(asset, new RegExp(`FA_ASSET_V = "${v}"`), "FA_ASSET_V et le ?v= du HTML divergent");
  const sw = fs.readFileSync(path.join(RACINE, "sw-policy.js"), "utf8");
  assert.match(sw, new RegExp(`CACHE = "fa-v${v}"`), "le cache du service worker et le ?v= du HTML divergent");
});
