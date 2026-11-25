import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
const ROOT_PREFIX = `${ROOT}${path.sep}`;
const HOST = "127.0.0.1";
const PORT = 8123;

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".jsx": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".woff2": "font/woff2",
};

const PUBLIC_DIRECTORIES = new Set(["assets", "build", "vendor"]);
const PUBLIC_ROOT_EXTENSIONS = new Set([".css", ".js", ".jsx"]);
const PUBLIC_FILES = new Set([
  "ai-agents/index.html",
  "apple-touch-icon.png",
  "cgu.html",
  "confidentialite.html",
  "earn/index.html",
  "favicon.ico",
  "favicon.png",
  "gagner/index.html",
  "index.html",
  "juridique.html",
  "llms.txt",
  "manifest.webmanifest",
  "mcp-client/package-lock.json",
  "mcp-client/package.json",
  "mentions-legales.html",
  "preview-butin.html",
  "robots.txt",
  "sitemap.xml",
  "version.json",
  "zh-earn/index.html",
]);

function isWithinRoot(file) {
  return file === ROOT || file.startsWith(ROOT_PREFIX);
}

function isPublicFile(relativeFile) {
  const segments = relativeFile.split("/");
  if (segments.some((segment) => !segment || segment.startsWith("."))) return false;
  if (PUBLIC_FILES.has(relativeFile)) return true;
  if (segments.length > 1) return PUBLIC_DIRECTORIES.has(segments[0]);
  return !relativeFile.startsWith("_") && PUBLIC_ROOT_EXTENSIONS.has(path.extname(relativeFile).toLowerCase());
}

function resolveRequest(rawUrl) {
  let requestPath;
  try {
    requestPath = decodeURIComponent((rawUrl || "/").split("?")[0]);
  } catch {
    return { status: 400 };
  }

  requestPath = requestPath.replace(/\\/g, "/");
  if (requestPath.endsWith("/")) requestPath += "index.html";
  const file = path.resolve(ROOT, requestPath.replace(/^\/+/, ""));
  if (!isWithinRoot(file)) return { status: 403 };

  const relativeFile = path.relative(ROOT, file).split(path.sep).join("/");
  if (!isPublicFile(relativeFile)) return { status: 403 };
  return { file };
}

http.createServer((req, res) => {
  const resolved = resolveRequest(req.url);
  if (!resolved.file) {
    res.writeHead(resolved.status);
    res.end();
    return;
  }

  fs.realpath(resolved.file, (realpathError, realFile) => {
    if (realpathError) {
      res.writeHead(404);
      res.end("nf");
      return;
    }
    if (!isWithinRoot(realFile)) {
      res.writeHead(403);
      res.end();
      return;
    }

    fs.readFile(realFile, (readError, data) => {
      if (readError) {
        res.writeHead(404);
        res.end("nf");
        return;
      }
      res.writeHead(200, { "Content-Type": MIME[path.extname(realFile).toLowerCase()] || "application/octet-stream" });
      res.end(data);
    });
  });
}).listen(PORT, HOST, () => console.log(`Serveur local prêt : http://${HOST}:${PORT}`));
