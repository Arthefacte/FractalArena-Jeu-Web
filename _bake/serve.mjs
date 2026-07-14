import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME={".html":"text/html",".js":"text/javascript",".jsx":"text/javascript",".mjs":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".glb":"model/gltf-binary",".wasm":"application/wasm",".svg":"image/svg+xml",".mp3":"audio/mpeg",".woff2":"font/woff2"};
http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split("?")[0]);const f=path.join(ROOT,p==="/"?"/index.html":p);if(!f.startsWith(ROOT)){res.writeHead(403);res.end();return;}fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end("nf");return;}res.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});res.end(d);});}).listen(8123,()=>console.log("Serveur local prêt : http://localhost:8123"));
