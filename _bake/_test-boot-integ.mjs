import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const __dirname=path.dirname(fileURLToPath(import.meta.url)); const ROOT=path.resolve(__dirname,"..");
const MIME={".html":"text/html",".js":"text/javascript",".jsx":"text/javascript",".mjs":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".webp":"image/webp",".glb":"model/gltf-binary",".wasm":"application/wasm",".svg":"image/svg+xml"};
const server=http.createServer((rq,rs)=>{const p=decodeURIComponent(rq.url.split("?")[0]);const f=path.join(ROOT,p==="/"?"/index.html":p);if(!f.startsWith(ROOT)){rs.writeHead(403);rs.end();return;}fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end("nf");return;}rs.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});rs.end(d);});});
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const browser=await chromium.launch();
const page=await (await browser.newContext({viewport:{width:1280,height:800}})).newPage();
const errors=[];
page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
page.on("pageerror",e=>errors.push("PAGEERR: "+e.message));
await page.goto(`http://localhost:${port}/index.html`,{waitUntil:"domcontentloaded"});
for(const ms of [700,1400]){
  await page.waitForTimeout(ms - (ms===700?0:700));
  const st=await page.evaluate(()=>{ const b=document.getElementById("boot"),img=document.getElementById("boot-emblem");
    return { t:0, present:!!b, imgSrcLen:(img&&img.src||"").length, settled:b?b.classList.contains("settled"):false, frames:!!(window.__BOOT_FRAMES&&window.__BOOT_FRAMES.length) }; });
  console.log("@"+ms+"ms:", JSON.stringify(st));
  await page.screenshot({ path: path.join(ROOT,"_bake",`_boot-integ-${ms}.png`) });
}
let removed=false;
try { await page.waitForFunction(()=>!document.getElementById("boot"),null,{timeout:40000}); removed=true; } catch(e){}
const realErr=errors.filter(e=>!/frame-ancestors|Content Security Policy.*frame|401|Failed to load resource.*401/i.test(e));
console.log("boot retiré:", removed, "| erreurs:", realErr.length, realErr.slice(0,6));
console.log(removed && realErr.length===0 ? "RESULTAT: OK" : "RESULTAT: A VERIFIER");
await browser.close(); server.close();
