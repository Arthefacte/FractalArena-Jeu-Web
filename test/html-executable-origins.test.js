const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const IGNORED_DIRECTORIES = new Set([".git", "node_modules"]);
const REMOTE_URL = /^(?:https?:)?\/\//i;

function htmlFiles(directory = ROOT) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && !IGNORED_DIRECTORIES.has(entry.name)) {
      files.push(...htmlFiles(path.join(directory, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(path.join(directory, entry.name));
    }
  }
  return files;
}

function attribute(tag, name) {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, "i"
  ).exec(tag);
  return match && (match[1] ?? match[2] ?? match[3]);
}

function strings(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

function moduleSpecifiers(source) {
  const specifiers = [];
  const statiques = /\b(?:import|export)\s+(?:[^;\n]*?\s+from\s+)?(["'])([^"']+)\1/g;
  const dynamiques = /\bimport\s*\(\s*(["'])([^"']+)\1\s*\)/g;
  for (const match of source.matchAll(statiques)) specifiers.push(match[2]);
  for (const match of source.matchAll(dynamiques)) specifiers.push(match[2]);
  return specifiers;
}

test("aucune page HTML ne charge de code executable depuis une origine tierce", () => {
  for (const file of htmlFiles()) {
    const relative = path.relative(ROOT, file);
    const html = fs.readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");

    for (const tag of html.match(/<script\b[^>]*>/gi) || []) {
      const src = attribute(tag, "src");
      if (src) assert.doesNotMatch(src, REMOTE_URL, `${relative} charge un script tiers : ${src}`);
    }

    for (const tag of html.match(/<link\b[^>]*>/gi) || []) {
      const rel = (attribute(tag, "rel") || "").toLowerCase().split(/\s+/);
      const href = attribute(tag, "href");
      if (rel.includes("modulepreload") && href) {
        assert.doesNotMatch(href, REMOTE_URL, `${relative} precharge un module tiers : ${href}`);
      }
    }

    for (const match of html.matchAll(/(<script\b[^>]*>)([\s\S]*?)<\/script>/gi)) {
      const type = (attribute(match[1], "type") || "").toLowerCase();
      if (type === "importmap") {
        for (const url of strings(JSON.parse(match[2]))) {
          assert.doesNotMatch(url, REMOTE_URL, `${relative} mappe un module tiers : ${url}`);
        }
      } else if (type === "module") {
        for (const url of moduleSpecifiers(match[2])) {
          assert.doesNotMatch(url, REMOTE_URL, `${relative} importe un module tiers : ${url}`);
        }
      }
    }
  }
});

test("la page de test conserve la cinematique avec le Three.js local", () => {
  const html = fs.readFileSync(path.join(ROOT, "_cine-test.html"), "utf8");
  const cine = fs.readFileSync(path.join(ROOT, "totem-cine.js"), "utf8");
  const source = /<script\b[^>]*\btype=["']importmap["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  assert.ok(source, "importmap absent de _cine-test.html");

  const imports = JSON.parse(source[1]).imports;
  assert.deepStrictEqual(imports, {
    three: "./vendor/three-0.160.0/three.module.js",
    "three/addons/": "./vendor/three-0.160.0/addons/",
  });
  for (const specifier of moduleSpecifiers(cine)) {
    const local = specifier === "three"
      ? imports.three
      : path.join(imports["three/addons/"], specifier.slice("three/addons/".length));
    assert.ok(specifier === "three" || specifier.startsWith("three/addons/"),
      `specifier Three.js inattendu : ${specifier}`);
    assert.ok(fs.existsSync(path.join(ROOT, local)), `module Three.js local absent : ${local}`);
  }
  assert.match(html, /<script type="module" src="totem-cine\.js"><\/script>/,
    "la page ne charge plus la cinematique reelle");
});
