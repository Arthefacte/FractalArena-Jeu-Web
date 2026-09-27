/* Le numéro de cache-busting doit AVANCER quand un fichier servi change.

 * E9 (audit D10, finding F4). Trois tests tenaient déjà l'alignement INTERNE du
 * numéro : `FA_ASSET_V` de data.js, les `?v=` de index.html, le nom de cache du
 * service worker. Aucun ne vérifiait que le numéro avait BOUGÉ depuis la livraison
 * précédente — un oubli de bump passait donc la CI en silence, et les joueurs
 * restaient sur les anciens scripts du cache HTTP alors que l'API, elle, avait bougé.
 * C'est le pire des deux mondes : un client périmé qui parle à un serveur à jour.

 * La comparaison se fait contre `origin/main`, la branche de référence :
 *   - sur une PULL REQUEST, la CI récupère `origin/main` (étape ajoutée à tests.yml),
 *     le diff `origin/main...HEAD` liste ce que la branche change, et le test exige que
 *     le numéro ait augmenté dès qu'un fichier servi est touché ;
 *   - sur un push sur `main`, le diff est vide (on compare la branche à elle-même) :
 *     le test ne dit rien, ce qui est exact — il n'y a rien à bumper ;
 *   - si `origin/main` est absent (clone superficiel, poste sans remote), le test est
 *     NEUTRE et le DIT : une garde qui fait semblant de garder est pire que rien.

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

test("le numéro de cache-busting avance dès qu'un fichier servi change", () => {
  const main = git("show origin/main:index.html");
  const ici = fs.readFileSync(path.join(RACINE, "index.html"), "utf8");

  if (!main) {
    console.log("[E9] origin/main indisponible : garde neutre (la CI la fournit — cf. tests.yml)");
    return;
  }

  const vMain = versionDe(main);
  const vIci = versionDe(ici);

  const diff = git("diff --name-only origin/main...HEAD");
  assert.notStrictEqual(diff, null, "diff avec origin/main illisible");
  const servis = diff.split("\n").filter((f) => f && SERVI.test(f) && !DEVELOPPEMENT.test(f));

  if (servis.length === 0) {
    // Rien de servi n'a changé (documentation, tests, outillage) : aucun bump attendu.
    assert.ok(vIci >= vMain, `le numéro a reculé (${vIci} < ${vMain}) sans nécessité`);
    return;
  }

  assert.ok(
    vIci > vMain,
    `des fichiers servis ont changé (${servis.slice(0, 6).join(", ")}${servis.length > 6 ? "…" : ""}) ` +
      `mais le cache-busting est resté à v${vIci} (origin/main : v${vMain}).\n` +
      `Sans bump, les joueurs gardent les anciens fichiers dans le cache HTTP : incrémenter les ?v= de\n` +
      `index.html, FA_ASSET_V dans data.js, CACHE (sw-policy.js) et les assertions épinglées des tests.`
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
