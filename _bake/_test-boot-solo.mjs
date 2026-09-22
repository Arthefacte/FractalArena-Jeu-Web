import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const __dirname=path.dirname(fileURLToPath(import.meta.url)); const ROOT=path.resolve(__dirname,"..");
const MIME={".html":"text/html",".js":"text/javascript",".jsx":"text/javascript",".mjs":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".webp":"image/webp",".glb":"model/gltf-binary",".wasm":"application/wasm",".svg":"image/svg+xml"};
const server=http.createServer((rq,rs)=>{const p=decodeURIComponent(rq.url.split("?")[0]);const f=path.join(ROOT,p==="/"?"/index.html":p);if(!f.startsWith(ROOT)){rs.writeHead(403);rs.end();return;}fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end("nf");return;}rs.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});rs.end(d);});});
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const browser=await chromium.launch();
const page=await (await browser.newContext({viewport:{width:900,height:760}})).newPage();
// bloque .jsx et babel → React ne monte jamais → le splash reste affiché
await page.route("**/*.jsx*",r=>r.abort());
await page.route("**/babel*",r=>r.abort());
const errors=[]; page.on("console",m=>{if(m.type()==="error")errors.push(m.text());}); page.on("pageerror",e=>errors.push("PE:"+e.message));
await page.goto(`http://localhost:${port}/index.html`,{waitUntil:"domcontentloaded"});
for(const ms of [900,1500,2800]){ await page.waitForTimeout(ms-(ms===900?0:(ms===1500?900:1500)));
  const st=await page.evaluate(()=>{const b=document.getElementById("boot"),i=document.getElementById("boot-emblem");return{present:!!b,settled:b&&b.classList.contains("settled"),srcLen:(i&&i.src||"").length};});
  console.log("@"+ms+"ms",JSON.stringify(st));
  await page.screenshot({path:path.join(ROOT,"_bake",`_boot-solo-${ms}.png`)});
}
const re=errors.filter(e=>!/CSP|Content Security|401|Failed to load resource|net::ERR_ABORTED|frame-ancestors/i.test(e));
console.log("erreurs pertinentes:",re.length,re.slice(0,5));
await browser.close(); server.close();
