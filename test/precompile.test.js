/* Pré-transpilation des .jsx — le jeu ne compile plus dans le téléphone.
 *
 * Mesuré sur téléphone simulé (CPU ÷4), premier écran :
 *     Babel dans le navigateur ...... 26,2 s
 *     .js pré-transpilés .............. 2,1 s
 * Le réseau n'y était pour rien : c'était le CPU du joueur qui transpilait les
 * vingt fichiers à CHAQUE lancement.
 *
 * La source reste le .jsx. `npm run build` produit build/<nom>.js, qui est
 * versionné parce que GitHub Pages sert le dépôt tel quel. Le danger de ce
 * genre de montage est la dérive silencieuse — un .jsx modifié, un .js oublié,
 * et le site sert l'ancien code sans que rien ne proteste. D'où l'empreinte
 * vérifiée ici : la suite échoue tant que le build n'a pas été relancé.
 */
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ROOT = path.join(__dirname, "..");
const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const BUILD = path.join(ROOT, "build");

// Contenu normalisé : le dépôt est en `* text=auto`, les fins de ligne
// diffèrent selon la plateforme. Hacher les octets bruts rendrait cette
// vérification fausse partout ailleurs que sur la machine qui a construit.
const sha = (p) =>
  crypto.createHash("sha256").update(fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n")).digest("hex");

test("index.html ne charge plus Babel, ni aucun script text/babel", () => {
  assert.ok(!/@babel\/standalone/.test(HTML), "Babel est encore téléchargé (2,9 Mo) et exécuté");
  assert.ok(!/type="text\/babel"/.test(HTML), "un script est resté en transpilation navigateur");
});

test("index.html charge les .js pré-transpilés, cache-bustés", () => {
  const scripts = [...HTML.matchAll(/<script src="build\/([^"?]+)\?v=(\d+)"><\/script>/g)];
  assert.ok(scripts.length >= 20, "attendu les 20 écrans transpilés, trouvé " + scripts.length);
  for (const [, f] of scripts) {
    assert.ok(fs.existsSync(path.join(BUILD, f)), "script déclaré mais absent du build : " + f);
  }
});

test("l'ordre de chargement est préservé (components → écrans → app)", () => {
  // Chaque fichier importe ses dépendances depuis window au moment de son
  // exécution : l'ordre est porteur de sens, pas cosmétique.
  const i = (f) => HTML.indexOf("build/" + f);
  assert.ok(i("components.js") > 0 && i("app.js") > 0);
  assert.ok(i("components.js") < i("account.js"), "account.js utilise Modal/SectionHead");
  assert.ok(i("account.js") < i("app.js"), "app.js est la racine, elle vient en dernier");
});

test("chaque .js du build correspond au .jsx courant (pas de dérive)", () => {
  const man = JSON.parse(fs.readFileSync(path.join(BUILD, "sources.json"), "utf8"));
  const attendus = [...HTML.matchAll(/<script src="build\/([^"?]+)\?v=\d+"><\/script>/g)].map((m) => m[1]);
  assert.deepEqual(Object.keys(man).sort().map((k) => k.replace(/\.jsx$/, ".js")).sort(), attendus.slice().sort(),
    "build/sources.json ne couvre pas exactement les scripts d'index.html");
  for (const [jsx, empreinte] of Object.entries(man)) {
    const src = path.join(ROOT, jsx);
    assert.ok(fs.existsSync(src), "source disparue : " + jsx);
    assert.equal(sha(src), empreinte,
      jsx + " a changé depuis le dernier build — lancer `npm run build` (sinon le site sert l'ancien code)");
  }
});

test("chaque fichier transpilé garde son propre scope", () => {
  // Babel exécutait chaque <script type="text/babel"> dans un scope isolé ;
  // un <script src> ordinaire partage le scope global. Sans enveloppe, les
  // vingt « const { useState } = React » se télescopent — constaté, la page
  // ne montait pas du tout.
  for (const f of fs.readdirSync(BUILD).filter((f) => f.endsWith(".js"))) {
    const code = fs.readFileSync(path.join(BUILD, f), "utf8");
    assert.match(code.slice(0, 400), /\(function \(\) \{/, f + " n'est pas enveloppé dans une IIFE");
  }
});

test("le build ne contient plus de JSX", () => {
  for (const f of fs.readdirSync(BUILD).filter((f) => f.endsWith(".js"))) {
    const code = fs.readFileSync(path.join(BUILD, f), "utf8");
    assert.ok(!/<\/div>|<div className=/.test(code), f + " contient encore du JSX brut");
    assert.match(code, /React\.createElement/, f + " ne semble pas transpilé");
  }
});

test("retranspiler les sources redonne EXACTEMENT le build livré", () => {
  /* L'empreinte ci-dessus protège du .jsx modifié sans rebuild ; celui-ci
     protège du cas inverse — un build/*.js retouché à la main, ou produit par
     une autre version de Babel. C'est la garantie qui compte : ce qui est
     servi aux joueurs est bien ce que les sources disent. */
  const Babel = require("@babel/standalone");
  const cibles = [...HTML.matchAll(/<script src="build\/([^"?]+)\.js\?v=\d+"><\/script>/g)].map((m) => m[1]);
  for (const nom of cibles) {
    const code = fs.readFileSync(path.join(ROOT, nom + ".jsx"), "utf8");
    const out = Babel.transform(code, { presets: ["react"], filename: nom + ".jsx", sourceType: "script" }).code;
    const attendu = "/* Généré par tools/precompile.mjs depuis " + nom + ".jsx — NE PAS ÉDITER. */\n"
      + "(function () {\n" + out + "\n})();\n";
    const livre = fs.readFileSync(path.join(BUILD, nom + ".js"), "utf8");
    assert.equal(livre.replace(/\r\n/g, "\n"), attendu.replace(/\r\n/g, "\n"),
      "build/" + nom + ".js diverge de sa source — lancer `npm run build`");
  }
});

test("package.json expose la commande de build", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.ok(pkg.scripts && pkg.scripts.build, "sans `npm run build`, personne ne saura régénérer");
});
