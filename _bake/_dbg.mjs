import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const __dirname=path.dirname(fileURLToPath(import.meta.url)); const ROOT=path.resolve(__dirname,"..");
const MIME={".html":"text/html",".js":"text/javascript",".mjs":"text/javascript",".glb":"model/gltf-binary",".wasm":"application/wasm"};
const server=http.createServer((rq,rs)=>{const p=decodeURIComponent(rq.url.split("?")[0]);const f=path.join(ROOT,p);fs.readFile(f,(e,d)=>{if(e){rs.writeHead(404);rs.end();return;}rs.writeHead(200,{"Content-Type":MIME[path.extname(f)]||"application/octet-stream"});rs.end(d);});});
await new Promise(r=>server.listen(0,r)); const port=server.address().port;
const browser=await chromium.launch();
const page=await browser.newPage();
page.on("pageerror",e=>console.log("PAGEERR:",e.message));
page.on("console",m=>console.log("LOG:",m.text()));
await page.goto(`http://localhost:${port}/_bake/bake-assemble.html`,{waitUntil:"load"});
await page.waitForFunction(()=>window.__ready===true,null,{timeout:60000});
console.log("err:", await page.evaluate(()=>window.__err), "parts:", await page.evaluate(()=>window.__parts));
// bbox debug + non-empty pixel test à t=1
const info=await page.evaluate(()=>{
  window.__setT(1);
  const cv=document.querySelector("#stage canvas");
  const g=cv.getContext("webgl2")||cv.getContext("webgl");
  const px=new Uint8Array(4*cv.width*cv.height);
  // lire via 2d proxy
  const p2=document.createElement("canvas"); p2.width=cv.width; p2.height=cv.height;
  const c2=p2.getContext("2d"); c2.drawImage(cv,0,0);
  const d=c2.getImageData(0,0,cv.width,cv.height).data;
  let nz=0,amax=0; for(let i=3;i<d.length;i+=4){ if(d[i]>0){nz++; if(d[i]>amax)amax=d[i];} }
  return {w:cv.width,h:cv.height,nonzeroAlpha:nz,maxAlpha:amax,dbg:window.__dbg||null};
});
console.log("canvas:",JSON.stringify(info));
await page.evaluate(()=>window.__setT(1));
await page.$("#stage canvas").then(c=>c.screenshot({path:path.join(ROOT,"_bake","_dbg-t1.png"),omitBackground:true}));
await browser.close(); server.close();
