import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import { fileURLToPath } from "node:url"; import { chromium } from "playwright";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const server = http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split("?")[0]);const f=path.join(ROOT,p);fs.readFile(f,(e,d)=>{if(e){res.writeHead(404);res.end();return;}res.writeHead(200,{"Content-Type":p.endsWith(".png")?"image/png":"text/html"});res.end(d);});});
await new Promise(r=>server.listen(0,r));
const port=server.address().port;
const browser=await chromium.launch();
const page=await browser.newPage();
await page.goto(`http://localhost:${port}/_bake/_blank.html`,{waitUntil:"domcontentloaded"}).catch(()=>{});
await page.setContent('<canvas id=c></canvas>');
const durl = await page.evaluate(async (port)=>{
  const img=new Image(); img.crossOrigin="anonymous"; img.src=`http://localhost:${port}/assets/boot-emblem.png`;
  await img.decode();
  const S=320, cv=document.getElementById("c"); cv.width=S; cv.height=S;
  const ctx=cv.getContext("2d"); ctx.clearRect(0,0,S,S);
  // fit inside en gardant le ratio
  const r=Math.min(S/img.width,S/img.height), w=img.width*r, h=img.height*r;
  ctx.drawImage(img,(S-w)/2,(S-h)/2,w,h);
  return cv.toDataURL("image/webp",0.9);
}, port);
const b64=durl.split(",")[1];
fs.writeFileSync(path.join(ROOT,"assets","boot-emblem.webp"), Buffer.from(b64,"base64"));
console.log("webp:", Math.round(fs.statSync(path.join(ROOT,"assets","boot-emblem.webp")).size/1024),"Ko | dataURI len:", durl.length);
fs.writeFileSync(path.join(ROOT,"_bake","_boot-emblem-datauri.txt"), durl);
await browser.close(); server.close();
